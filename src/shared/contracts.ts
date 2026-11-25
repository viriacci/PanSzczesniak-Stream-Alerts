import type {MeasurementState,CrashEntry} from './performance'
import type {RuntimePreferences,Diagnostics,UpdateInfo} from './runtime'
import type {AnalyticsFilter,AnalyticsReport,ImportResult} from './analytics'
import type {LibraryAction,LibraryState} from './library'
import type {Scene} from './scene'
import type {LiveState,LiveAction,Category} from './live'
import type { ObsState,ObsAction,AgentState,AgentAction } from './obs'
import type { QueueCommand, QueueState } from './queue'
import type { AlertState, AlertRule, Reward } from './alerts'
import type { LayoutPreferences } from './layout'

export const IPC = {
  measurementState:'pssa:measurement:state',
  measurementStart:'pssa:measurement:start',
  measurementStop:'pssa:measurement:stop',
  measurementExport:'pssa:measurement:export',
  crashState:'pssa:crash:state',
  crashExport:'pssa:crash:export',
  rendererFault:'pssa:crash:renderer',
  runtimeState:'pssa:runtime:state',
  runtimeSave:'pssa:runtime:save',
  backupCreate:'pssa:backup:create',
  backupRestore:'pssa:backup:restore',
  diagnostics:'pssa:diagnostics:state',
  diagnosticsExport:'pssa:diagnostics:export',
  updateCheck:'pssa:update:check',
  updateInfo:'pssa:update:info',
  updateOpen:'pssa:update:open',
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
  alertPoll:'pssa:alerts:poll',
  twitchDeviceLogin: 'pssa:twitch:device',
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
  measurementState():Promise<MeasurementState>
  measurementStart(gpu:boolean):Promise<MeasurementState>
  measurementStop():Promise<MeasurementState>
  measurementExport(id:string,format:'csv'|'json'):Promise<boolean>
  crashState():Promise<CrashEntry[]>
  crashExport():Promise<boolean>
  rendererFault(kind:'error'|'rejection'|'react',stack:string):Promise<void>
  runtimeState():Promise<RuntimePreferences>
  runtimeSave(value:RuntimePreferences):Promise<RuntimePreferences>
  backupCreate():Promise<{media:number}|null>
  backupRestore():Promise<boolean>
  diagnostics():Promise<Diagnostics>
  diagnosticsExport():Promise<boolean>
  updateCheck():Promise<UpdateInfo>
  updateInfo():Promise<UpdateInfo>
  updateOpen():Promise<void>
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
  alertPoll(revision:number):Promise<{revision:number;state:AlertState|null}>
  twitchDeviceLogin():Promise<void>
  twitchLogin(clientId:string,secret:string): Promise<void>
  twitchLogout(): Promise<void>
  twitchConnect(): Promise<void>
  syncRewards(): Promise<Reward[]>
  saveScene(key:string,scene:Scene,title:string,profile:string):Promise<AlertRule>
  saveAlert(rule:AlertRule,profile:string): Promise<AlertRule>
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
