import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PssaApi } from '../shared/contracts'

const api: PssaApi = {
  queueCommand:command=>ipcRenderer.invoke(IPC.queueCommand,command),
  alertState:()=>ipcRenderer.invoke(IPC.alertState),
  twitchLogin:(id,secret)=>ipcRenderer.invoke(IPC.twitchLogin,id,secret),
  twitchLogout:()=>ipcRenderer.invoke(IPC.twitchLogout),
  twitchConnect:()=>ipcRenderer.invoke(IPC.twitchConnect),
  syncRewards:()=>ipcRenderer.invoke(IPC.syncRewards),
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
