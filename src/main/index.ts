import {createConnection} from 'node:net'
import {DockControl,type DockDescriptor} from './obs/dock-control'
import {CrashLog} from './runtime/crashes'
import {launchNodeAgent} from './agent/launch'
import {BRAND} from '../shared/brand'
import {RuntimeService} from './runtime/service'
import {pendingRestore} from './runtime/backup'
import {preferences,savePreferences} from './runtime/preferences'
import type {RuntimePreferences} from '../shared/runtime'
import { createHash } from 'node:crypto'
import { makeLayer,type Scene } from '../shared/scene'
import { AgentBridge } from './agent/bridge'
import { ObsService } from './obs/service'
import { AlertsService } from './alerts/service'
import { app, BrowserWindow, dialog, session, screen, Tray, Menu, nativeImage, crashReporter } from 'electron'
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
const crashes=new CrashLog(directory,app.getVersion(),'main')
let window: BrowserWindow | undefined
let db: DatabaseSync | undefined
let disposeIpc: (() => void) | undefined
let cleaned = false
let backgrounded=false
let runtime:RuntimeService|undefined
let tray:Tray|undefined
let reveal:()=>void=()=>{}
let alerts:AlertsService|undefined
let obs:ObsService|undefined
let agent:AgentBridge|undefined
let dockControl:DockControl|undefined

function cleanup(failed=false): void {
  if (cleaned) return
  cleaned = true
  try{dockControl?.stop()}catch{console.warn('PSSA: dock cleanup failed')}
  try{disposeIpc?.()}catch{console.warn('PSSA: IPC cleanup failed')}
  try{runtime?.stop(failed);tray?.destroy()}catch{console.warn('PSSA: runtime cleanup failed')}
  try{agent?.stop()}catch{console.warn('PSSA: agent bridge cleanup failed')}
  try{obs?.stop()}catch{console.warn('PSSA: OBS cleanup failed')}
  try{alerts?.stop()}catch{console.warn('PSSA: service cleanup failed')}
  try{db?.close()}catch{console.warn('PSSA: database cleanup failed')}
  log('shutdown')
}
function fail(error?:unknown): void {
  crashes.write('startup-failed','',null,error instanceof Error?error.stack:undefined)
  log('startup-failed')
  if (!smoke) dialog.showErrorBox(BRAND, 'Nie udało się uruchomić aplikacji. Sprawdź application.log w katalogu danych.')
  cleanup(true)
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
  const activeDb=db
  alerts=new AlertsService(activeDb,directory,()=>window,app.getPath('documents'))
  await alerts.start(!smoke)
  const activeAlerts=alerts
  const activeObs=new ObsService(activeDb,state=>{try{activeAlerts.observeObs(state)}catch{console.warn('PSSA: telemetry write failed')}})
  obs=activeObs
  if(!smoke)activeObs.start()
  if(!smoke){agent=new AgentBridge(directory,async()=>activeAlerts.reloadOverlay());agent.start()}
  let modeGeneration=0,loading:Promise<void>|undefined
  function rememberWindow(w:BrowserWindow){
   if(cleaned||smoke||w.isDestroyed())return
   try{writeWindowState(activeDb,{bounds:w.getNormalBounds(),maximized:w.isMaximized()})}catch{console.warn('PSSA: unable to persist window bounds')}
  }
  function createWindow(){
   const state=readWindowState(activeDb,screen.getAllDisplays().map(d=>d.workArea))
   const w=new BrowserWindow({
    title:BRAND+' 2',...state.bounds,minWidth:700,minHeight:440,
    titleBarStyle:'hidden',titleBarOverlay:{color:'#111114',symbolColor:'#e8e7eb',height:36},
    show:false,backgroundColor:'#101012',
    webPreferences:{preload:join(__dirname,'../preload/index.js'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,webviewTag:false,devTools:!app.isPackaged}
   })
   window=w
   w.webContents.setWindowOpenHandler(()=>({action:'deny'}))
   w.webContents.on('will-navigate',event=>event.preventDefault())
   w.webContents.on('will-attach-webview',event=>event.preventDefault())
   w.webContents.on('render-process-gone',(_e,details)=>{if(details.reason==='clean-exit')return;log('renderer-gone');if(smoke)fail();else if(!cleaned&&window===w)dialog.showErrorBox(BRAND,'Interfejs uległ awarii. Uruchom aplikację ponownie.')})
   w.on('close',()=>rememberWindow(w))
   w.once('closed',()=>{if(window===w){window=undefined;disposeIpc?.();disposeIpc=undefined}})
   if(state.maximized&&!smoke)w.maximize()
   disposeIpc=registerIpc(w,activeDb,document,app.getVersion(),activeAlerts,activeObs,agent,runtime!)
   return w
  }
  const showWindow=async(show=true)=>{
   if(cleaned)return
   backgrounded=false
   let w=window
   if(!w||w.isDestroyed()){
    w=createWindow()
    const pending=devUrl?w.loadURL(document):w.loadFile(file)
    loading=pending
    try{await pending}catch(e){if(window===w&&!w.isDestroyed())w.destroy();throw e}finally{if(loading===pending)loading=undefined}
   }else if(loading)await loading
   if(cleaned||backgrounded||window!==w||w.isDestroyed())return
   if(show){if(w.isMinimized())w.restore();w.show();w.focus()}
  }
  const hibernate=()=>{
   backgrounded=true
   const w=window
   if(!w||w.isDestroyed())return
   rememberWindow(w)
   disposeIpc?.();disposeIpc=undefined;window=undefined
   w.destroy()
  }
  reveal=()=>{modeGeneration++;if(preferences(activeDb).mode==='background')savePreferences(activeDb,{...preferences(activeDb),mode:'streaming'});void showWindow().catch(()=>{if(!cleaned)dialog.showErrorBox(BRAND,'Nie udało się przywrócić interfejsu. Uruchom PSSA ponownie.')})}
  const applyMode=(p:RuntimePreferences)=>{
   if(smoke||cleaned)return
   const g=++modeGeneration
   if(p.mode!=='background'||!tray){if(p.mode==='background'&&!tray)savePreferences(activeDb,{...p,mode:'streaming'});if(backgrounded)reveal();return}
   // Deliver the IPC response before destroying the renderer and its document.
   setTimeout(()=>{if(g===modeGeneration&&!cleaned)hibernate()},150)
  }
  if(!smoke){
   try{
    const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGN8fMCDgRTARJLqUQ2jGoaUBgAQ3wILGYFI4wAAAABJRU5ErkJggg==')
    tray=new Tray(icon);tray.setToolTip(BRAND)
    tray.setContextMenu(Menu.buildFromTemplate([{label:'Otwórz PSSA',click:()=>reveal()},{label:'Zakończ PSSA',click:()=>app.quit()}]))
    tray.on('double-click',()=>reveal())
   }catch{tray=undefined}
  }
  runtime=new RuntimeService(activeDb,directory,()=>window,activeAlerts,activeObs,agent,restoreStatus,applyMode)
  if(!smoke)runtime.start()
  let dockExitScheduled=false
  const dockExit=(restart:boolean)=>{if(dockExitScheduled||cleaned)return;dockExitScheduled=true;setTimeout(()=>{if(cleaned)return;if(restart){if(smoke)return;app.relaunch({args:[...(app.isPackaged?[]:[app.getAppPath()]),'--pssa-background']})}app.quit()},150)}
  let dockDescriptor:DockDescriptor|undefined
  {
   dockControl=new DockControl(directory,process.execPath,{
    state:()=>{const a=activeAlerts.state();return {version:app.getVersion(),volume:a.queue.settings.volume,muted:a.queue.settings.muted,pending:a.queue.pendingCount,twitch:a.twitch.phase,overlayUrl:a.twitch.overlayUrl}},
    volume:value=>{activeAlerts.queueCommand({type:'settings',settings:{...activeAlerts.state().queue.settings,volume:value}})},
    mute:value=>{activeAlerts.queueCommand({type:'settings',settings:{...activeAlerts.state().queue.settings,muted:value}})},
    test:()=>{activeAlerts.queueCommand({type:'test'})},reload:()=>{activeAlerts.reloadOverlay()},show:()=>reveal(),quit:()=>dockExit(false),restart:()=>dockExit(true)
   });try{dockDescriptor=await dockControl.start()}catch(e){dockControl.stop();if(smoke)throw e;log('dock-control-unavailable')}
  }
  if(!smoke&&(process.argv.includes('--pssa-background')||runtime.state().mode==='background'&&tray)){backgrounded=true;log('ready');return}
  await showWindow(!smoke)
  const activeWindow=window
  if(!activeWindow)throw Error('Renderer unavailable')
  log('ready')
  if (smoke) {
    const child=launchNodeAgent(join(directory,'agent-smoke'),process.execPath,[],__dirname,true,app.getVersion())
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Node Agent smoke timeout'))},12000);child.once('error',e=>{clearTimeout(timer);reject(e)});child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Node Agent smoke failed'))})})
    // Exercise the actual preload and IPC bridge in the loaded renderer.
    const newFeatures=await activeWindow.webContents.executeJavaScript('window.pssa.runtimeState().then(async p=>(await window.pssa.runtimeSave({...p,theme:"vivionyx"})).theme==="vivionyx"&&(await window.pssa.runtimeSave({...p,theme:"pssa"})).theme==="pssa"&&!(await window.pssa.measurementState()).active&&Array.isArray(await window.pssa.crashState()))')
    if(newFeatures!==true)throw Error('New feature IPC smoke failed')
    const revisionCheck=await activeWindow.webContents.executeJavaScript('window.pssa.alertPoll(-1).then(async first=>!!first.state&&(await window.pssa.alertPoll(first.revision)).state===null)')
    if(revisionCheck!==true)throw Error('Alert snapshot revision smoke failed')
    if(!(await activeWindow.webContents.executeJavaScript('window.pssa.alertState().then(s=>s.twitch.publicLogin===true)')))throw Error('Public Twitch client missing in build')
    // Exercise React handlers in Chromium, not just the underlying moveNode helper.
    const navSmoke=await activeWindow.webContents.executeJavaScript(`(async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const until=async fn=>{for(let i=0;i<100;i++){const result=await fn();if(result)return result;await sleep(50)}throw Error('Navigation UI timeout')};
      await until(()=>document.querySelector('[data-nav-id="studio"]')&&!document.querySelector('[data-nav-id="studio"]').disabled);
      const local=[...document.querySelectorAll('button')].find(b=>b.textContent==='Uruchom bez logowania');local?.click();
      await until(()=>!document.querySelector('.runtime-modal'));
      if(document.querySelector('[data-nav-id="settings"]'))throw Error('Settings still in sidebar');
      const source=document.querySelector('[data-nav-id="studio"]'),target=document.querySelector('[data-nav-id="assets"]');
      if(!source.draggable||!target.draggable)throw Error('Drag disabled outside edit mode');
      const dataTransfer=new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer}));
      const rect=target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer,clientY:rect.top+rect.height/2}));
      target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer,clientY:rect.top+rect.height/2}));
      await until(async()=> (await window.pssa.getLayout()).navigation.nodes.find(n=>n.id==='assets')?.children.some(n=>n.id==='studio'));
      document.querySelector('.sidebar-bottom button[aria-label="Ustawienia"]').click();
      await until(()=>document.querySelectorAll('.settings-section').length===8);
      const sections=[...document.querySelectorAll('.settings-section')];
      if(sections.length!==8||sections.some(s=>s.open)||!sections[0].textContent.includes('Ukryj zakładki'))throw Error('Settings not collapsed');
      sections[0].querySelector('summary').click();if(!sections[0].open)throw Error('Settings disclosure failed');
      if(!sections.some(s=>s.querySelector('summary span').textContent==='Logowanie zaawansowane'))throw Error('Advanced login missing');
      document.querySelector('[data-nav-id="integrations"]').click();
      await until(()=>document.querySelector('.page-header h1')?.textContent==='Konfiguracja');
      return !document.querySelector('input[type="password"][autocomplete="off"][required]');
    })()`);
    if(navSmoke!==true)throw Error('Navigation renderer smoke failed');
    const originalSize=activeWindow.getSize();
    const oldRaid=activeAlerts.state().rules.find(r=>r.key==='raid');if(!oldRaid)throw Error('Raid rule missing');
    try{activeAlerts.save({...oldRaid,title:'DługiAlert'.repeat(18),template:'DługiTekst'.repeat(45)},'default');if(activeAlerts.test('raid')!==1)throw Error('Long queue fixture failed')}finally{activeAlerts.save(oldRaid,'default')}
    const longAlert=activeAlerts.state().queue.pending.find(x=>x.key==='raid');if(!longAlert)throw Error('Long queue fixture missing');
    activeWindow.setSize(710,440);
    const queueSmoke=await activeWindow.webContents.executeJavaScript(`(async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));const until=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await sleep(50)}throw Error('Queue UI timeout')};
      document.querySelector('[data-nav-id="queue"]').click();await until(()=>document.querySelector('.queue-page .queue-row')?.textContent.includes('DługiAlert'));
      const titles=()=>[...document.querySelectorAll('.queue-page .panel-heading h2')].map(e=>e.textContent);
      if(titles()[0]!=='Aktualnie odtwarzany'||!titles()[1].startsWith('Oczekujące')||titles()[2]!=='Historia alertów'||titles()[3]!=='Działanie alertów')throw Error('Queue panel order');
      const button=[...document.querySelectorAll('.queue-page button')].find(e=>e.textContent==='Dodaj testowy alert');button.click();await until(()=>[...document.querySelectorAll('.queue-page .queue-row')].some(e=>e.textContent.includes('Testowy alert')));
      if(!document.querySelector('.queue-page [role=status]')?.textContent.includes('oczekują'))throw Error('Offline queue message missing');
      const fits=()=>[...document.querySelectorAll('.content,.queue-page,.queue-page .panel')].every(e=>e.scrollWidth<=e.clientWidth+1);
      if(!fits())throw Error('Small queue overflow');
      document.querySelector('[data-nav-id="activity"]').click();await until(()=>document.querySelector('.page-header h1')?.textContent==='Aktywność');if(titles().length!==1||titles()[0]!=='Historia alertów'||[...document.querySelectorAll('.queue-page button')].some(e=>e.textContent==='Dodaj testowy alert'))throw Error('Activity must remain history-only');
      document.querySelector('[data-nav-id="queue"]').click();await until(()=>titles().length===4);return true;
    })()`);
    if(queueSmoke!==true)throw Error('Queue renderer smoke failed');
    activeAlerts.queueCommand({type:'skip',id:longAlert.id});
    activeWindow.setSize(originalSize[0]!,originalSize[1]!);
    if(!(await activeWindow.webContents.executeJavaScript('new Promise(r=>setTimeout(()=>r([...document.querySelectorAll(".content,.queue-page,.queue-page .panel")].every(e=>e.scrollWidth<=e.clientWidth+1)),150))')))throw Error('Large queue overflow');
    const passed = await activeWindow.webContents.executeJavaScript(
      'window.pssa.getStatus().then(async s => s.database === "ready" && s.schemaVersion === 5 && await window.pssa.setCompact(true) && (await window.pssa.getStatus()).compact === true && (await window.pssa.setLayout({...await window.pssa.getLayout(), page:"settings", sidebarWidth:280})).page === "settings" && (await window.pssa.getLayout()).sidebarWidth === 280 && (await window.pssa.alertState()).rules.length >= 8 && (await window.pssa.alertState()).twitch.overlayUrl.startsWith("http://127.0.0.1:18766/") && (await window.pssa.alertState()).queue.pendingCount === 1 && (await window.pssa.obsState()).phase === "offline" && (await window.pssa.liveState()).phase === "disconnected" && (await window.pssa.analyticsChannels()).length === 0 && (await window.pssa.libraryState()).assets.length === 0 && (await window.pssa.analyticsReport({channel:"42",from:1700000000000,to:1700604800000,category:"",source:"all"})).current.sessions === 0 && (await window.pssa.runtimeState()).mode === "studio" && (await window.pssa.diagnostics()).schema === 5)'
    )
    if (passed !== true) throw new Error('Smoke test failed')
    // Load the real served overlay in a separate isolated Chromium window and wait for ACK.
    const preview=new BrowserWindow({show:false,width:640,height:360,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}})
    preview.webContents.setWindowOpenHandler(()=>({action:'deny'}))
    preview.webContents.on('will-navigate',event=>event.preventDefault())
    try{
      await preview.loadURL(activeAlerts.state().twitch.overlayUrl)
      const deadline=Date.now()+20000
      let done=false,seen=false,audioPlayed=false
      while(Date.now()<deadline){
        const history=activeAlerts.state().queue.history
        if(history.some(x=>x.source==='test'&&x.status==='failed'))throw Error('Overlay smoke failed')
        if(history.some(x=>x.source==='test'&&x.status==='done')){done=true;break}
        if(await preview.webContents.executeJavaScript('document.getElementById("stage")?.textContent?.includes("Test PSSA") === true'))seen=true
        if(await preview.webContents.executeJavaScript('(()=>{const a=document.querySelector("#stage audio");return !!a&&a.readyState>=2&&!a.paused&&a.currentTime>0&&Math.abs(a.duration-.75)<.05&&a.volume===1})()'))audioPlayed=true
        await new Promise(resolve=>setTimeout(resolve,100))
      }
      if(!done||!seen||!audioPlayed)throw Error('Overlay smoke missing render, audio playback or ACK')
      // Deterministic PNG in isolated smoke directory.
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGN8fMCDgRTARJLqUQ2jGoaUBgAQ3wILGYFI4wAAAABJRU5ErkJggg==','base64')
      const asset=createHash('sha256').update(png).digest('hex')+'.png'
      mkdirSync(join(directory,'media'),{recursive:true});writeFileSync(join(directory,'media',asset),png)
      const scene:Scene={version:1,width:1920,height:1080,duration:1500,layers:[{...makeLayer('image','smoke-image',1500),asset},{...makeLayer('text','smoke-text',1500),text:'Multi-layer smoke'}]}
      const exercise=async(value:Scene,expected:'done'|'failed')=>{
        const previous=new Set(activeAlerts.state().queue.history.map(x=>x.id))
        const saved=await activeWindow.webContents.executeJavaScript('window.pssa.saveScene("raid",'+JSON.stringify(value)+',"Raid","default")')
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
    const measurement=runtime.beginMeasurement(false).active
    if(!measurement||measurement.samples!==1)throw Error('Measurement start smoke failed')
    const oldId=activeWindow.id
    hibernate();if(window||!activeWindow.isDestroyed())throw Error('Background did not release window')
    if(!dockDescriptor)throw Error('Dock descriptor unavailable');
    const descriptor=dockDescriptor;
    const control=(command:string,value?:unknown)=>new Promise<any>((resolve,reject)=>{const address=process.platform==='win32'?'\\\\.\\pipe\\'+descriptor.pipe:descriptor.pipe;const s=createConnection(address);let response='';s.setTimeout(3000,()=>{s.destroy();reject(Error('Dock smoke timeout'))});s.on('error',reject);s.on('connect',()=>s.write(JSON.stringify({token:descriptor.token,command,value})+'\n'));s.on('data',b=>response+=b.toString());s.on('end',()=>{try{resolve(JSON.parse(response))}catch(e){reject(e)}})});
    if(!(await control('volume',35)).ok||activeAlerts.state().queue.settings.volume!==35||window)throw Error('Dock volume in background failed');
    if(!(await control('mute',true)).state?.muted||!(await control('mute',false)).ok||!(await control('volume',100)).ok)throw Error('Dock mute smoke failed');
    await showWindow(false)
    const reopened:BrowserWindow|undefined=BrowserWindow.getAllWindows().find(w=>w.id!==oldId)
    if(!reopened||!(await reopened.webContents.executeJavaScript('window.pssa.getStatus().then(s=>s.database===\"ready\")')))throw Error('Background resume failed')
    if(!runtime.measurementState().active)throw Error('Measurement did not survive Background')
    const finished=runtime.measurementStop().recent.find(x=>x.id===measurement.id)
    if(!finished||finished.status!=='finished'||finished.samples<2||finished.ram.count<2)throw Error('Measurement report smoke failed')
    const logged=await reopened.webContents.executeJavaScript('window.pssa.rendererFault("error","Error: SECRET_SMOKE\\n at fn (C:/Private/index.js:22:4)").then(()=>window.pssa.crashState())')
    if(!Array.isArray(logged)||!logged.some((x:any)=>x.event==="renderer-error"&&x.frames?.includes("index.js:22:4"))||JSON.stringify(logged).includes('SECRET_SMOKE')||JSON.stringify(logged).includes('Private'))throw Error('Crash redaction smoke failed')
    app.quit()
  } else applyMode(runtime.state())
}

if(agentMode){
 const args=app.isPackaged?[]:[app.getAppPath()]
 const child=launchNodeAgent(directory,process.execPath,args,__dirname,false,app.getVersion())
 child.once('error',()=>app.exit(1));child.once('spawn',()=>{child.unref();app.exit(0)})
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  process.on('uncaughtExceptionMonitor',error=>crashes.write('uncaught-exception','',null,error.stack))
  process.on('unhandledRejection',error=>{crashes.write('unhandled-rejection','',null,error instanceof Error?error.stack:undefined);cleanup(true);app.exit(1)})
  app.on('render-process-gone',(_e,_contents,details)=>{if(details.reason!=='clean-exit')crashes.write('render-process-gone',details.reason,details.exitCode)})
  app.on('child-process-gone',(_e,details)=>{if(details.reason!=='clean-exit')crashes.write('child-process-gone',details.reason,details.exitCode)})
  try{const dumps=join(directory,'crash-dumps');mkdirSync(dumps,{recursive:true});app.setPath('crashDumps',dumps);crashReporter.start({uploadToServer:false,companyName:'Pan Szczesniak',productName:'PSSA'})}catch{crashes.write('crash-reporter-unavailable')}
  app.on('second-instance', (_event,argv) => {
    if(!cleaned&&!argv.includes('--pssa-background'))reveal()
  })
  app.on('window-all-closed', () => {if(!backgrounded)app.quit()})
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
