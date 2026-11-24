import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PssaApi } from '../shared/contracts'

const api: PssaApi = {
  getStatus: () => ipcRenderer.invoke(IPC.status),
  setCompact: (value) => ipcRenderer.invoke(IPC.setCompact, value)
}
contextBridge.exposeInMainWorld('pssa', api)
