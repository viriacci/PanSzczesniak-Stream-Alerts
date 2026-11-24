import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import { IPC, parseCompact, type SystemStatus } from '../shared/contracts'
import { getCompact, setCompact, schemaVersion } from './database'
import { isTrustedDocument } from './security/ipc-policy'

export function registerIpc(window: BrowserWindow, db: DatabaseSync, document: string, version: string): () => void {
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
  return () => {
    ipcMain.removeHandler(IPC.status)
    ipcMain.removeHandler(IPC.setCompact)
  }
}
