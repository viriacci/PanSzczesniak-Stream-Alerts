export interface ObsMetrics {cpu:number|null;memory:number|null;fps:number|null;renderSkipped:number|null;outputSkipped:number|null;streaming:boolean;recording:boolean;streamBytes:number|null;streamMs:number|null}
export interface ObsState {phase:'offline'|'connecting'|'connected'|'error';port:number;configured:boolean;detail:string;scene:string;scenes:string[];metrics:ObsMetrics|null}
export interface AgentState {online:boolean;running:boolean;dockUrl:string;autoLaunch:boolean;startup:boolean;detail:string}
export type ObsAction={type:'connect';port:number;password:string}|{type:'disconnect'}|{type:'scene';name:string}|{type:'refresh'}
export type AgentAction='enable'|'startup-on'|'startup-off'|'auto-on'|'auto-off'
export function parseObsAction(value:unknown):ObsAction{
 if(!value||typeof value!=='object')throw Error('Invalid OBS command')
 const x=value as Record<string,unknown>
 if(x.type==='disconnect'||x.type==='refresh')return {type:x.type}
 if(x.type==='connect'&&typeof x.port==='number'&&Number.isInteger(x.port)&&x.port>=1&&x.port<=65535&&typeof x.password==='string'&&x.password.length<=512)return {type:'connect',port:x.port,password:x.password}
 if(x.type==='scene'&&typeof x.name==='string'&&x.name.length>0&&x.name.length<=256)return {type:'scene',name:x.name}
 throw Error('Invalid OBS command')
}
