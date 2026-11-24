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

export function registerIpc(window: BrowserWindow, db: DatabaseSync, document: string, version: string, alerts:AlertsService,obs:ObsService,agent?:AgentBridge): () => void {
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
   [IPC.alertState,0,()=>alerts.state()],
   [IPC.libraryState,0,()=>alerts.libraryState()],
   [IPC.libraryAction,1,value=>alerts.libraryAction(value)],
   [IPC.liveState,0,()=>alerts.liveState()],
   [IPC.liveAction,1,command=>alerts.liveAction(command)],
   [IPC.obsState,0,()=>obs.state()],
   [IPC.obsAction,1,command=>obs.action(command,alerts.overlayUrl())],
   [IPC.agentState,0,()=>agent?.snapshot()??{online:false,running:false,dockUrl:'',autoLaunch:false,startup:false,detail:'Agent unavailable'}],
   [IPC.agentAction,1,command=>{if(!agent||!['enable','startup-on','startup-off','auto-on','auto-off'].includes(command))throw Error('Invalid agent command');return agent.action(command)}],
   [IPC.queueCommand,1,command=>alerts.queueCommand(command)],
   [IPC.twitchLogin,2,(id,secret)=>{if(typeof id!=='string'||typeof secret!=='string')throw Error('Invalid credentials');return alerts.login(id,secret)}],
   [IPC.twitchLogout,0,()=>alerts.logout()],
   [IPC.twitchConnect,0,()=>alerts.connect()],
   [IPC.syncRewards,0,()=>alerts.sync()],
   [IPC.saveAlert,1,rule=>alerts.save(rule)],
   [IPC.saveScene,3,(key,scene,title)=>alerts.saveScene(key,scene,title)],
   [IPC.chooseMedia,1,kind=>{if(kind!=='image'&&kind!=='audio'&&kind!=='video')throw Error('Invalid media kind');return alerts.choose(kind)}],
   [IPC.importLegacy,0,()=>alerts.import()],
   [IPC.testAlert,1,key=>{if(typeof key!=='string'||!validKey(key))throw Error('Invalid alert');return alerts.test(key)}]
  ]
  for(const [channel,count,handler] of handlers)ipcMain.handle(channel,(event,...args:unknown[])=>{authorize(event);if(args.length!==count)throw Error('Invalid arguments');return handler(...args)})
  return () => {
    for(const [channel] of handlers)ipcMain.removeHandler(channel)
    ipcMain.removeHandler(IPC.getLayout)
    ipcMain.removeHandler(IPC.setLayout)
    ipcMain.removeHandler(IPC.status)
    ipcMain.removeHandler(IPC.setCompact)
  }
}
