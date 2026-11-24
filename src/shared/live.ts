export interface ViewerPoint {at:number;viewers:number;category:string}
export interface LiveCounts {follows:number;subs:number;prime:number;resubs:number;gifts:number;bits:number;raids:number;raidViewers:number;rewards:number;points:number;messages:number;chatters:number}
export interface LiveState {phase:'disconnected'|'unknown'|'offline'|'live';channel:string;title:string;category:string;categoryId:string;startedAt:number|null;lastSampleAt:number|null;viewers:number|null;average:number|null;peak:number|null;samples:number;points:ViewerPoint[];counts:LiveCounts|null;detail:string;canManage:boolean;bitrate:number|null}
export interface Category {id:string;name:string}
export type LiveAction={type:'refresh'}|{type:'search';query:string}|{type:'update';title:string;categoryId:string}|{type:'marker';description:string}
export function parseLiveAction(value:unknown):LiveAction{
 if(!value||typeof value!=='object')throw Error('Invalid live action')
 const x=value as Record<string,unknown>
 if(x.type==='refresh')return {type:'refresh'}
 if(x.type==='search'&&typeof x.query==='string'&&x.query.trim().length>=2&&x.query.length<=100)return {type:'search',query:x.query.trim()}
 if(x.type==='update'&&typeof x.title==='string'&&x.title.trim().length>0&&x.title.length<=140&&typeof x.categoryId==='string'&&/^\d{0,30}$/.test(x.categoryId))return {type:'update',title:x.title.trim(),categoryId:x.categoryId}
 if(x.type==='marker'&&typeof x.description==='string'&&x.description.length<=140)return {type:'marker',description:x.description.trim()}
 throw Error('Invalid live action')
}
