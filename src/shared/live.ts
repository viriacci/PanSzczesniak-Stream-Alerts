export interface ViewerPoint {at:number;viewers:number;category:string}
export interface LiveCounts {follows:number;subs:number;prime:number;resubs:number;gifts:number;bits:number;raids:number;raidViewers:number;rewards:number;points:number;messages:number;chatters:number}
export interface LiveState {tags?:string[];phase:'disconnected'|'unknown'|'offline'|'live';channel:string;title:string;category:string;categoryId:string;startedAt:number|null;lastSampleAt:number|null;viewers:number|null;average:number|null;peak:number|null;samples:number;points:ViewerPoint[];counts:LiveCounts|null;detail:string;canManage:boolean;bitrate:number|null}
export interface Category {id:string;name:string;image?:string}
export function validTags(v:unknown):v is string[]{return Array.isArray(v)&&v.length<=10&&v.every(t=>typeof t==='string'&&/^[\p{L}\p{N}]{1,25}$/u.test(t))&&new Set(v.map(t=>t.toLowerCase())).size===v.length}
export function channelTags(v:unknown):string[]{return Array.isArray(v)?v.filter((t):t is string=>typeof t==='string'&&/^[\p{L}\p{N}]{1,25}$/u.test(t)).slice(0,10):[]}
export type LiveAction={type:'refresh'}|{type:'search';query:string}|{type:'update';title:string;categoryId:string;tags?:string[]}
export function parseLiveAction(value:unknown):LiveAction{
 if(!value||typeof value!=='object')throw Error('Invalid live action')
 const x=value as Record<string,unknown>
 if(x.type==='refresh')return {type:'refresh'}
 if(x.type==='search'&&typeof x.query==='string'&&x.query.trim().length>=2&&x.query.length<=100)return {type:'search',query:x.query.trim()}
 if(x.type==='update'&&typeof x.title==='string'&&x.title.trim().length>0&&x.title.length<=140&&typeof x.categoryId==='string'&&/^\d{0,30}$/.test(x.categoryId)){if(x.tags!==undefined&&!validTags(x.tags))throw Error('Invalid channel tags');return {type:'update',title:x.title.trim(),categoryId:x.categoryId,...(x.tags!==undefined?{tags:x.tags as string[]}:{})}}
 throw Error('Invalid live action')
}
