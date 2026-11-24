import {RuntimeService} from './runtime/service'
import {pendingRestore} from './runtime/backup'
import {preferences,savePreferences} from './runtime/preferences'
import type {RuntimePreferences} from '../shared/runtime'
import { createHash } from 'node:crypto'
import { makeLayer,type Scene } from '../shared/scene'
import { AgentBridge } from './agent/bridge'
import { serveAgent,launchProcess } from './agent/server'
import { ObsService } from './obs/service'
import { AlertsService } from './alerts/service'
import { app, BrowserWindow, dialog, session, screen, Tray, Menu, nativeImage } from 'electron'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'
import { readWindowState, writeWindowState } from './window-state'
import { openDatabase } from './database'
import { registerIpc } from './ipc'
import { createLogger } from './logger'

const agentMode=process.argv.includes('--pssa-agent')
const smoke = process.argv.includes('--smoke-test')
const directory = smoke
  ? mkdtempSync(join(tmpdir(), 'pssa-smoke-'))
  : join(app.getPath('appData'), 'PSSA 2 Dev')
mkdirSync(directory, { recursive: true })
if(agentMode)mkdirSync(join(directory,'agent-runtime'),{recursive:true})
app.setPath('userData', agentMode?join(directory,'agent-runtime'):directory)
app.setName('PSSA 2 Dev')
const log = createLogger(directory)
let window: BrowserWindow | undefined
let db: DatabaseSync | undefined
let disposeIpc: (() => void) | undefined
let cleaned = false
let runtime:RuntimeService|undefined
let tray:Tray|undefined
let reveal:()=>void=()=>{}
let alerts:AlertsService|undefined
let obs:ObsService|undefined
let agent:AgentBridge|undefined
let liveObsTimer:ReturnType<typeof setInterval>|undefined

function cleanup(): void {
  if (cleaned) return
  cleaned = true
  try{disposeIpc?.()}catch{console.warn('PSSA: IPC cleanup failed')}
  clearInterval(liveObsTimer)
  try{runtime?.stop();tray?.destroy()}catch{console.warn('PSSA: runtime cleanup failed')}
  try{agent?.stop()}catch{console.warn('PSSA: agent bridge cleanup failed')}
  try{obs?.stop()}catch{console.warn('PSSA: OBS cleanup failed')}
  try{alerts?.stop()}catch{console.warn('PSSA: service cleanup failed')}
  try{db?.close()}catch{console.warn('PSSA: database cleanup failed')}
  log('shutdown')
}
function fail(): void {
  log('startup-failed')
  if (!smoke) dialog.showErrorBox('PSSA 2 Dev', 'Nie udało się uruchomić aplikacji. Sprawdź application.log w katalogu danych.')
  cleanup()
  app.exit(1)
}

async function start(): Promise<void> {
  log('startup')
  db = openDatabase(join(directory, 'pssa.sqlite'))
  const restoreStatus=smoke?'':pendingRestore(db,directory)
  const file = join(__dirname, '../renderer/index.html')
  const devUrl = !app.isPackaged && !smoke ? process.env.ELECTRON_RENDERER_URL : undefined
  if (devUrl) {
    const url = new URL(devUrl)
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password) {
      throw new Error('Development renderer must be loopback HTTP')
    }
  }
  const document = devUrl ? new URL(devUrl).href : pathToFileURL(file).href
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  const state = readWindowState(db, screen.getAllDisplays().map(display => display.workArea))
  window = new BrowserWindow({
    title: 'PSSA 2 Dev', ...state.bounds, minWidth: 700, minHeight: 500,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#111114', symbolColor: '#e8e7eb', height: 36 },
    show: false, backgroundColor: '#101012',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      webSecurity: true, webviewTag: false, devTools: !app.isPackaged
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.on('will-attach-webview', event => event.preventDefault())
  window.webContents.on('render-process-gone', () => {
    log('renderer-gone')
    if (smoke) fail()
    else dialog.showErrorBox('PSSA 2 Dev', 'Interfejs uległ awarii. Uruchom aplikację ponownie.')
  })
  const activeWindow = window
  const activeDb = db
  activeWindow.on('close', () => {
    if (cleaned || smoke) return
    try { writeWindowState(activeDb, { bounds: activeWindow.getNormalBounds(), maximized: activeWindow.isMaximized() }) }
    catch { console.warn('PSSA: unable to persist window bounds') }
  })
  if (state.maximized && !smoke) activeWindow.maximize()
  alerts=new AlertsService(db,directory,window,app.getPath('documents'))
  await alerts.start(!smoke)
  obs=new ObsService(db)
  if(!smoke)obs.start()
  const activeAlerts=alerts,activeObs=obs
  if(!smoke)liveObsTimer=setInterval(()=>{try{activeAlerts.observeObs(activeObs.state())}catch{console.warn('PSSA: telemetry write failed')}},1000)
  if(!smoke){agent=new AgentBridge(directory,async()=>activeAlerts.reloadOverlay());agent.start()}
  let blank=false,modeGeneration=0
  const loadRenderer=()=>devUrl?activeWindow.loadURL(document):activeWindow.loadFile(file)
  const showWindow=async()=>{
   const g=++modeGeneration
   if(activeWindow.isDestroyed()||cleaned)return
   if(blank){await loadRenderer();if(g!==modeGeneration||cleaned)return;blank=false}
   if(activeWindow.isMinimized())activeWindow.restore()
   activeWindow.show();activeWindow.focus()
  }
  reveal=()=>{if(preferences(activeDb).mode==='background')savePreferences(activeDb,{...preferences(activeDb),mode:'streaming'});void showWindow().catch(()=>{if(!cleaned)dialog.showErrorBox('PSSA','Nie udało się przywrócić interfejsu. Uruchom PSSA ponownie.')})}
  const applyMode=(p:RuntimePreferences)=>{
   if(smoke||cleaned)return
   const g=++modeGeneration
   if(p.mode!=='background'||!tray){if(blank)reveal();return}
   // Let the IPC result reach the renderer, then unload its document and timers.
   setTimeout(()=>{if(g!==modeGeneration||cleaned||activeWindow.isDestroyed())return
    blank=true;activeWindow.hide();void activeWindow.loadURL('about:blank').catch(()=>{if(g===modeGeneration&&!cleaned)reveal()})
   },150)
  }
  if(!smoke){
   try{
    const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGN8fMCDgRTARJLqUQ2jGoaUBgAQ3wILGYFI4wAAAABJRU5ErkJggg==')
    tray=new Tray(icon);tray.setToolTip('PSSA 2')
    tray.setContextMenu(Menu.buildFromTemplate([{label:'Otwórz PSSA',click:()=>reveal()},{label:'Zakończ PSSA',click:()=>app.quit()}]))
    tray.on('double-click',()=>reveal())
   }catch{tray=undefined}
  }
  runtime=new RuntimeService(db,directory,window,alerts,obs,agent,restoreStatus,applyMode)
  if(!smoke)runtime.start()
  disposeIpc = registerIpc(window, db, document, app.getVersion(),alerts,obs,agent,runtime)
  if (devUrl) await window.loadURL(document)
  else await window.loadFile(file)
  log('ready')
  if (smoke) {
    // Exercise the actual preload and IPC bridge in the loaded renderer.
    const passed = await window.webContents.executeJavaScript(
      'window.pssa.getStatus().then(async s => s.database === "ready" && s.schemaVersion === 4 && await window.pssa.setCompact(true) && (await window.pssa.getStatus()).compact === true && (await window.pssa.setLayout({...await window.pssa.getLayout(), page:"settings", sidebarWidth:280})).page === "settings" && (await window.pssa.getLayout()).sidebarWidth === 280 && (await window.pssa.alertState()).rules.length >= 8 && (await window.pssa.alertState()).twitch.overlayUrl.startsWith("http://127.0.0.1:18766/") && await window.pssa.testAlert("raid") === 1 && (await window.pssa.alertState()).queue.pendingCount === 1 && (await window.pssa.obsState()).phase === "offline" && (await window.pssa.liveState()).phase === "disconnected" && (await window.pssa.analyticsChannels()).length === 0 && (await window.pssa.analyticsReport({channel:"42",from:1700000000000,to:1700604800000,category:"",source:"all"})).current.sessions === 0 && (await window.pssa.runtimeState()).mode === "studio" && (await window.pssa.diagnostics()).schema === 4)'
    )
    if (passed !== true) throw new Error('Smoke test failed')
    // Load the real served overlay in a separate isolated Chromium window and wait for ACK.
    const preview=new BrowserWindow({show:false,width:640,height:360,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}})
    preview.webContents.setWindowOpenHandler(()=>({action:'deny'}))
    preview.webContents.on('will-navigate',event=>event.preventDefault())
    try{
      await preview.loadURL(activeAlerts.state().twitch.overlayUrl)
      const deadline=Date.now()+20000
      let done=false,seen=false
      while(Date.now()<deadline){
        const history=activeAlerts.state().queue.history
        if(history.some(x=>x.source==='test'&&x.status==='failed'))throw Error('Overlay smoke failed')
        if(history.some(x=>x.source==='test'&&x.status==='done')){done=true;break}
        if(await preview.webContents.executeJavaScript('document.getElementById("stage")?.textContent?.includes("Test PSSA") === true'))seen=true
        await new Promise(resolve=>setTimeout(resolve,100))
      }
      if(!done||!seen)throw Error('Overlay smoke missing render or ACK')
      // Deterministic PNG in isolated smoke directory.
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGN8fMCDgRTARJLqUQ2jGoaUBgAQ3wILGYFI4wAAAABJRU5ErkJggg==','base64')
      const asset=createHash('sha256').update(png).digest('hex')+'.png'
      mkdirSync(join(directory,'media'),{recursive:true});writeFileSync(join(directory,'media',asset),png)
      const scene:Scene={version:1,width:1920,height:1080,duration:1500,layers:[{...makeLayer('image','smoke-image',1500),asset},{...makeLayer('text','smoke-text',1500),text:'Multi-layer smoke'}]}
      const exercise=async(value:Scene,expected:'done'|'failed')=>{
        const previous=new Set(activeAlerts.state().queue.history.map(x=>x.id))
        const saved=await activeWindow.webContents.executeJavaScript('window.pssa.saveScene("raid",'+JSON.stringify(value)+',"Raid")')
        if(!saved?.scene||activeAlerts.test('raid')!==1)throw Error('Scene smoke setup failed')
        const until=Date.now()+12000;let rendered=false
        while(Date.now()<until){
          const completed=activeAlerts.state().queue.history.find(x=>x.source==='test'&&!previous.has(x.id))
          if(completed){
            if(completed.status!==expected||expected==='failed'&&completed.reason!=='media-error'||expected==='done'&&!rendered)throw Error('Scene media smoke failed')
            return
          }
          if(expected==='done'&&await preview.webContents.executeJavaScript('(()=>{const i=document.querySelector("#stage img");return !!i&&i.naturalWidth===16&&i.parentElement.style.display!=="none"&&document.getElementById("stage").textContent.includes("Multi-layer smoke")})()'))rendered=true
          await new Promise(resolve=>setTimeout(resolve,80))
        }
        throw Error('Scene media smoke timeout')
      }
      await exercise(scene,'done')
      await exercise({...scene,layers:scene.layers.map(l=>l.kind==='image'?{...l,asset:'f'.repeat(64)+'.png'}:l)},'failed')
    }finally{preview.destroy()}
    app.quit()
  } else {
    window.show();applyMode(runtime.state())
  }
}

if(agentMode){
 app.whenReady().then(async()=>{
  const args=app.isPackaged?[]:[app.getAppPath()]
  const server=await serveAgent(directory,()=>launchProcess(process.execPath,args))
  app.on('before-quit',()=>server.close())
 }).catch(()=>app.exit(1))
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window && !window.isDestroyed()) {
      reveal()
    }
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    if (!cleaned && !smoke && db && window && !window.isDestroyed()) {
      try { writeWindowState(db, { bounds: window.getNormalBounds(), maximized: window.isMaximized() }) }
      catch { console.warn('PSSA: unable to persist window bounds') }
    }
    cleanup()
  })
  app.on('quit', () => {
    if (smoke) {
      try { rmSync(directory, { recursive: true, force: true }) } catch { /* temporary files only */ }
    }
  })
  app.whenReady().then(start).catch(fail)
}
