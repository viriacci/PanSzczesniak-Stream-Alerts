export const IPC = {
  status: 'pssa:system:status',
  setCompact: 'pssa:settings:compact'
} as const

export interface SystemStatus {
  version: string
  schemaVersion: number
  compact: boolean
  database: 'ready'
}

export interface PssaApi {
  getStatus(): Promise<SystemStatus>
  setCompact(value: boolean): Promise<boolean>
}

export function parseCompact(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Expected a boolean')
  return value
}
