import { AlertsService } from './alerts/service'
import { app, BrowserWindow, dialog, session, screen } from 'electron'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'
import { readWindowState, writeWindowState } from './window-state'
import { openDatabase } from './database'
import { registerIpc } from './ipc'
import { createLogger } from './logger'

const smoke = process.argv.includes('--smoke-test')
const directory = smoke
  ? mkdtempSync(join(tmpdir(), 'pssa-smoke-'))
  : join(app.getPath('appData'), 'PSSA 2 Dev')
mkdirSync(directory, { recursive: true })
app.setPath('userData', directory)
app.setName('PSSA 2 Dev')
const log = createLogger(directory)
let window: BrowserWindow | undefined
let db: DatabaseSync | undefined
let disposeIpc: (() => void) | undefined
let cleaned = false
let alerts:AlertsService|undefined

function cleanup(): void {
  if (cleaned) return
  cleaned = true
  try{disposeIpc?.()}catch{console.warn('PSSA: IPC cleanup failed')}
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
  disposeIpc = registerIpc(window, db, document, app.getVersion(),alerts)
  if (devUrl) await window.loadURL(document)
  else await window.loadFile(file)
  log('ready')
  if (smoke) {
    // Exercise the actual preload and IPC bridge in the loaded renderer.
    const passed = await window.webContents.executeJavaScript(
      'window.pssa.getStatus().then(async s => s.database === "ready" && s.schemaVersion === 2 && await window.pssa.setCompact(true) && (await window.pssa.getStatus()).compact === true && (await window.pssa.setLayout({...await window.pssa.getLayout(), page:"settings", sidebarWidth:280})).page === "settings" && (await window.pssa.getLayout()).sidebarWidth === 280 && (await window.pssa.alertState()).rules.length >= 8 && (await window.pssa.alertState()).twitch.overlayUrl.startsWith("http://127.0.0.1:18766/") && await window.pssa.testAlert("raid") === 1 && (await window.pssa.alertState()).queue.pendingCount === 1)'
    )
    if (passed !== true) throw new Error('Smoke test failed')
    app.quit()
  } else {
    window.show()
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore()
      window.focus()
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
