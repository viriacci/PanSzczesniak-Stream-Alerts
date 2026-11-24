import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PssaApi } from '../shared/contracts'

const api: PssaApi = {
  getLayout: () => ipcRenderer.invoke(IPC.getLayout),
  setLayout: value => ipcRenderer.invoke(IPC.setLayout, value),
  getStatus: () => ipcRenderer.invoke(IPC.status),
  setCompact: (value) => ipcRenderer.invoke(IPC.setCompact, value)
}
contextBridge.exposeInMainWorld('pssa', api)
