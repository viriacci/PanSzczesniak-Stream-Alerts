import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PssaApi } from '../shared/contracts'

const api: PssaApi = {
  libraryState:()=>ipcRenderer.invoke(IPC.libraryState),
  libraryAction:value=>ipcRenderer.invoke(IPC.libraryAction,value),
  liveState:()=>ipcRenderer.invoke(IPC.liveState),
  liveAction:command=>ipcRenderer.invoke(IPC.liveAction,command),
  obsState:()=>ipcRenderer.invoke(IPC.obsState),
  obsAction:command=>ipcRenderer.invoke(IPC.obsAction,command),
  agentState:()=>ipcRenderer.invoke(IPC.agentState),
  agentAction:command=>ipcRenderer.invoke(IPC.agentAction,command),
  queueCommand:command=>ipcRenderer.invoke(IPC.queueCommand,command),
  alertState:()=>ipcRenderer.invoke(IPC.alertState),
  twitchLogin:(id,secret)=>ipcRenderer.invoke(IPC.twitchLogin,id,secret),
  twitchLogout:()=>ipcRenderer.invoke(IPC.twitchLogout),
  twitchConnect:()=>ipcRenderer.invoke(IPC.twitchConnect),
  syncRewards:()=>ipcRenderer.invoke(IPC.syncRewards),
  saveScene:(key,scene,title)=>ipcRenderer.invoke(IPC.saveScene,key,scene,title),
  saveAlert:rule=>ipcRenderer.invoke(IPC.saveAlert,rule),
  chooseMedia:kind=>ipcRenderer.invoke(IPC.chooseMedia,kind),
  importLegacy:()=>ipcRenderer.invoke(IPC.importLegacy),
  testAlert:key=>ipcRenderer.invoke(IPC.testAlert,key),
  getLayout: () => ipcRenderer.invoke(IPC.getLayout),
  setLayout: value => ipcRenderer.invoke(IPC.setLayout, value),
  getStatus: () => ipcRenderer.invoke(IPC.status),
  setCompact: (value) => ipcRenderer.invoke(IPC.setCompact, value)
}
contextBridge.exposeInMainWorld('pssa', api)
