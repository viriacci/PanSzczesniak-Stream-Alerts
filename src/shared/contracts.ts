import type {AnalyticsFilter,AnalyticsReport,ImportResult} from './analytics'
import type {LibraryAction,LibraryState} from './library'
import type {Scene} from './scene'
import type {LiveState,LiveAction,Category} from './live'
import type { ObsState,ObsAction,AgentState,AgentAction } from './obs'
import type { QueueCommand, QueueState } from './queue'
import type { AlertState, AlertRule, Reward } from './alerts'
import type { LayoutPreferences } from './layout'

export const IPC = {
  analyticsChannels:'pssa:analytics:channels',
  analyticsReport:'pssa:analytics:report',
  analyticsImport:'pssa:analytics:import',
  analyticsExport:'pssa:analytics:export',
  libraryState:'pssa:library:state',
  libraryAction:'pssa:library:action',
  liveState:'pssa:live:state',
  liveAction:'pssa:live:action',
  obsState:'pssa:obs:state',
  obsAction:'pssa:obs:action',
  agentState:'pssa:agent:state',
  agentAction:'pssa:agent:action',
  queueCommand:'pssa:queue:command',
  alertState: 'pssa:alerts:state',
  twitchLogin: 'pssa:twitch:login',
  twitchLogout: 'pssa:twitch:logout',
  twitchConnect: 'pssa:twitch:connect',
  syncRewards: 'pssa:twitch:rewards',
  saveScene:'pssa:scene:save',
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
  analyticsChannels():Promise<string[]>
  analyticsReport(filter:AnalyticsFilter):Promise<AnalyticsReport>
  analyticsImport():Promise<ImportResult|null>
  analyticsExport(filter:AnalyticsFilter,format:'csv'|'json'):Promise<boolean>
  libraryState():Promise<LibraryState>
  libraryAction(value:LibraryAction):Promise<void>
  liveState():Promise<LiveState>
  liveAction(command:LiveAction):Promise<Category[]|null>
  obsState():Promise<ObsState>
  obsAction(command:ObsAction):Promise<number>
  agentState():Promise<AgentState>
  agentAction(command:AgentAction):Promise<void>
  queueCommand(command:QueueCommand):Promise<QueueState>
  alertState(): Promise<AlertState>
  twitchLogin(clientId:string,secret:string): Promise<void>
  twitchLogout(): Promise<void>
  twitchConnect(): Promise<void>
  syncRewards(): Promise<Reward[]>
  saveScene(key:string,scene:Scene,title:string):Promise<AlertRule>
  saveAlert(rule:AlertRule): Promise<AlertRule>
  chooseMedia(kind:'image'|'audio'|'video'): Promise<string|null>
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
