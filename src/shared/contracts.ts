import type { AlertState, AlertRule, Reward } from './alerts'
import type { LayoutPreferences } from './layout'

export const IPC = {
  alertState: 'pssa:alerts:state',
  twitchLogin: 'pssa:twitch:login',
  twitchLogout: 'pssa:twitch:logout',
  twitchConnect: 'pssa:twitch:connect',
  syncRewards: 'pssa:twitch:rewards',
  saveAlert: 'pssa:alerts:save',
  chooseMedia: 'pssa:alerts:media',
  importLegacy: 'pssa:alerts:import',
  testAlert: 'pssa:alerts:test',
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
  alertState(): Promise<AlertState>
  twitchLogin(clientId:string,secret:string): Promise<void>
  twitchLogout(): Promise<void>
  twitchConnect(): Promise<void>
  syncRewards(): Promise<Reward[]>
  saveAlert(rule:AlertRule): Promise<AlertRule>
  chooseMedia(kind:'image'|'audio'): Promise<string|null>
  importLegacy(): Promise<{count:number;warnings:string[]}|null>
  testAlert(key:string): Promise<number>
  getLayout(): Promise<LayoutPreferences>
  setLayout(value: LayoutPreferences): Promise<LayoutPreferences>
  getStatus(): Promise<SystemStatus>
  setCompact(value: boolean): Promise<boolean>
}

export function parseCompact(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Expected a boolean')
  return value
}
