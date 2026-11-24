import type { LayoutPreferences } from './layout'

export const IPC = {
  status: 'pssa:system:status',
  setCompact: 'pssa:settings:compact',
  getLayout: 'pssa:layout:get',
  setLayout: 'pssa:layout:set'
} as const

export interface SystemStatus {
  version: string
  schemaVersion: number
  compact: boolean
  database: 'ready'
}

export interface PssaApi {
  getLayout(): Promise<LayoutPreferences>
  setLayout(value: LayoutPreferences): Promise<LayoutPreferences>
  getStatus(): Promise<SystemStatus>
  setCompact(value: boolean): Promise<boolean>
}

export function parseCompact(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Expected a boolean')
  return value
}
