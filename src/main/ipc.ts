import {installObsDock,obsDockStatus} from './obs/dock-install'
import type {RuntimeService} from './runtime/service'
import type { ObsService } from './obs/service'
import type { AgentBridge } from './agent/bridge'
import type { AlertsService } from './alerts/service'
import { validKey } from '../shared/alerts'
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import { IPC, parseCompact, type SystemStatus } from '../shared/contracts'
import { getCompact, setCompact, schemaVersion } from './database'
import { getLayout, setLayout } from './database/layout'
import { isTrustedDocument } from './security/ipc-policy'

export function registerIpc(window: BrowserWindow, db: DatabaseSync, document: string, version: string, alerts:AlertsService,obs:ObsService,agent:AgentBridge|undefined,runtime:RuntimeService): () => void {
  function authorize(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame
    if (window.isDestroyed() || event.sender !== window.webContents ||
        !frame || frame !== window.webContents.mainFrame ||
        !isTrustedDocument(frame.url, document)) {
      throw new Error('Unauthorized IPC sender')
    }
  }

  ipcMain.handle(IPC.status, (event, ...args: unknown[]): SystemStatus => {
    authorize(event)
    if (args.length !== 0) throw new Error('Unexpected arguments')
    return { version, schemaVersion: schemaVersion(db), compact: getCompact(db), database: 'ready' }
  })
  ipcMain.handle(IPC.setCompact, (event, ...args: unknown[]): boolean => {
    authorize(event)
    if (args.length !== 1) throw new Error('Expected one argument')
    return setCompact(db, parseCompact(args[0]))
  })
  ipcMain.handle(IPC.getLayout, (event, ...args: unknown[]) => {
    authorize(event)
    if (args.length !== 0) throw new Error('Unexpected arguments')
    return getLayout(db)
  })
  ipcMain.handle(IPC.setLayout, (event, ...args: unknown[]) => {
    authorize(event)
    if (args.length !== 1) throw new Error('Expected one argument')
    return setLayout(db, args[0])
  })
  const handlers: [string,number,(...args:any[])=>unknown][] = [
   [IPC.obsDockStatus,0,()=>obsDockStatus()],
   [IPC.installObsDock,0,async()=>{const ok=await installObsDock(window);if(ok)runtime.clearDockUpdateReminder();return ok}],
   [IPC.updateDownload,1,value=>runtime.downloadUpdate(value)],
   [IPC.updateDockReminder,0,()=>runtime.dockUpdateReminder()],
   [IPC.measurementState,0,()=>runtime.measurementState()],
   [IPC.measurementStart,1,gpu=>runtime.measurementStart(gpu)],
   [IPC.measurementStop,0,()=>runtime.measurementStop()],
   [IPC.measurementExport,2,(id,format)=>runtime.measurementExport(id,format)],
   [IPC.crashState,0,()=>runtime.crashState()],
   [IPC.crashExport,0,()=>runtime.crashExport()],
   [IPC.rendererFault,2,(kind,stack)=>runtime.rendererFault(kind,stack)],
   [IPC.runtimeState,0,()=>runtime.state()],
   [IPC.runtimeSave,1,value=>runtime.save(value)],
   [IPC.backupCreate,0,()=>runtime.backup()],
   [IPC.backupRestore,0,()=>runtime.restore()],
   [IPC.diagnostics,0,()=>runtime.diagnostics()],
   [IPC.diagnosticsExport,0,()=>runtime.exportDiagnostics()],
   [IPC.updateCheck,0,()=>runtime.check()],
   [IPC.updateInfo,0,()=>runtime.updateInfo()],
   [IPC.updateOpen,0,()=>runtime.openUpdate()],
   [IPC.alertState,0,()=>alerts.state()],
   [IPC.alertPoll,1,revision=>alerts.poll(revision)],
   [IPC.analyticsChannels,0,()=>alerts.analyticsChannels()],
   [IPC.analyticsReport,1,filter=>alerts.analyticsReport(filter)],
   [IPC.analyticsImport,0,()=>{runtime.requireOffline();return alerts.analyticsImport(()=>runtime.requireOffline())}],
   [IPC.analyticsExport,2,(filter,format)=>alerts.analyticsExport(filter,format)],
   [IPC.libraryState,0,()=>alerts.libraryState()],
   [IPC.libraryAction,1,value=>alerts.libraryAction(value)],
   [IPC.liveState,0,()=>alerts.liveState()],
   [IPC.liveAction,1,command=>alerts.liveAction(command)],
   [IPC.obsState,0,()=>obs.state()],
   [IPC.obsAction,1,command=>obs.action(command,alerts.overlayUrl())],
   [IPC.agentState,0,()=>agent?.snapshot()??{online:false,running:false,dockUrl:'',autoLaunch:false,startup:false,detail:'Agent unavailable'}],
   [IPC.agentAction,1,command=>{if(!agent||!['enable','startup-on','startup-off','auto-on','auto-off'].includes(command))throw Error('Invalid agent command');return agent.action(command)}],
   [IPC.queueCommand,1,command=>alerts.queueCommand(command)],
   [IPC.twitchDeviceLogin,0,()=>alerts.deviceLogin()],
   [IPC.twitchLogin,2,(id,secret)=>{if(typeof id!=='string'||typeof secret!=='string')throw Error('Invalid credentials');return alerts.login(id,secret)}],
   [IPC.twitchLogout,0,()=>alerts.logout()],
   [IPC.twitchConnect,0,()=>alerts.connect()],
   [IPC.syncRewards,0,()=>alerts.sync()],
   [IPC.saveAlert,2,(rule,profile)=>alerts.save(rule,profile)],
   [IPC.saveScene,4,(key,scene,title,profile)=>alerts.saveScene(key,scene,title,profile)],
   [IPC.chooseMedia,1,kind=>{if(kind!=='image'&&kind!=='audio'&&kind!=='video')throw Error('Invalid media kind');return alerts.choose(kind)}],
   [IPC.importLegacy,0,()=>alerts.import()],
   [IPC.testAlert,1,key=>{if(typeof key!=='string'||!validKey(key))throw Error('Invalid alert');return alerts.test(key)}]
  ]
  const dialogs=new Set<string>([IPC.installObsDock,IPC.updateDownload,IPC.measurementStart,IPC.measurementExport,IPC.crashExport,IPC.backupCreate,IPC.backupRestore,IPC.diagnosticsExport,IPC.analyticsImport,IPC.analyticsExport,IPC.chooseMedia,IPC.importLegacy])
  let dialogOpen=false
  for(const [channel,count,handler] of handlers)ipcMain.handle(channel,async(event,...args:unknown[])=>{authorize(event);if(args.length!==count)throw Error('Invalid arguments');if(!dialogs.has(channel))return handler(...args);if(dialogOpen)throw Error('Another file operation is active');dialogOpen=true;try{return await handler(...args)}finally{dialogOpen=false}})
  return () => {
    for(const [channel] of handlers)ipcMain.removeHandler(channel)
    ipcMain.removeHandler(IPC.getLayout)
    ipcMain.removeHandler(IPC.setLayout)
    ipcMain.removeHandler(IPC.status)
    ipcMain.removeHandler(IPC.setCompact)
  }
}
