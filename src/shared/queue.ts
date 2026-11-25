import type { AlertRule } from './alerts.ts'
export type QueueStatus='pending'|'playing'|'done'|'skipped'|'failed'|'suppressed'
export type QueueSource='twitch'|'test'|'replay'
export interface QueueItem {variables?:Record<string,string>;id:number;source:QueueSource;key:string;title:string;text:string;rule:AlertRule;status:QueueStatus;priority:number;position:number;attempts:number;createdAt:number;finishedAt:number|null;reason:string}
export interface QueueSettings {paused:boolean;muted:boolean;volume:number;gapMs:number}
export type QueueSummary=Omit<QueueItem,'rule'|'variables'>
export interface QueueState {settings:QueueSettings;current:QueueSummary|null;pending:QueueSummary[];pendingCount:number;history:QueueSummary[];online:boolean}
export interface Playback {variables?:Record<string,string>;attempt:string;rule:AlertRule;text:string;volume:number}
export type QueueCommand={type:'test'}|{type:'settings';settings:QueueSettings}|{type:'skip'|'replay'|'delete-history';id:number}|{type:'move';id:number;direction:-1|1}|{type:'priority';id:number;priority:number}
export const defaultQueueSettings:QueueSettings={paused:false,muted:false,volume:100,gapMs:500}
export function intRange(v:unknown,min:number,max:number):v is number{return typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max}
export function parseQueueSettings(v:unknown):QueueSettings{
 if(!v||typeof v!=='object')throw Error('Invalid queue settings')
 const x=v as Record<string,unknown>
 if(typeof x.paused!=='boolean'||typeof x.muted!=='boolean'||!intRange(x.volume,0,100)||!intRange(x.gapMs,0,10000))throw Error('Invalid queue settings')
 return {paused:x.paused,muted:x.muted,volume:x.volume,gapMs:x.gapMs}
}
export function parseQueueCommand(v:unknown):QueueCommand{
 if(!v||typeof v!=='object')throw Error('Invalid queue command')
 const x=v as Record<string,unknown>
 if(x.type==='test')return {type:'test'}
 if(x.type==='settings')return {type:'settings',settings:parseQueueSettings(x.settings)}
 if(!intRange(x.id,1,Number.MAX_SAFE_INTEGER))throw Error('Invalid queue id')
 if(x.type==='skip'||x.type==='replay'||x.type==='delete-history')return {type:x.type,id:x.id}
 if(x.type==='move'&&(x.direction===-1||x.direction===1))return {type:x.type,id:x.id,direction:x.direction}
 if(x.type==='priority'&&intRange(x.priority,0,10))return {type:x.type,id:x.id,priority:x.priority}
 throw Error('Invalid queue command')
}
