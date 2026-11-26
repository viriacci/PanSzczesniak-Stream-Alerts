import {parseTheme,type ThemeId} from './themes.ts'
import {isRegion,type Region,type Language} from './i18n.ts'
export type PerformanceMode='studio'|'streaming'|'background'
export type UpdateChannel='stable'|'beta'
export interface RuntimePreferences {mode:PerformanceMode;updates:UpdateChannel;autoCheck:boolean;onboarded:boolean;theme:ThemeId;language?:Language;region?:Region}
export interface Diagnostics {version:string;schema:number;platform:string;arch:string;electron:string;chromium:string;node:string;processes:number;memoryMB:number;cpu:number;databaseBytes:number;queuePending:number;overlayClients:number;twitch:string;obs:string;agent:boolean;restoreStatus:string;uptime:number}
export interface UpdateAsset {name:string;url:string;sha256:string;size:number}
export interface UpdateInfo {notes?:string;asset?:UpdateAsset;state:'available'|'current'|'none'|'error';version:string;url:string;detail:string}
export const defaults:RuntimePreferences={mode:'studio',updates:'stable',autoCheck:true,onboarded:false,theme:'pssa'}
export function parseRuntime(v:unknown):RuntimePreferences{
 if(!v||typeof v!=='object')throw Error('Invalid runtime settings')
 const x=v as Record<string,unknown>
 if(x.mode!=='studio'&&x.mode!=='streaming'&&x.mode!=='background'||x.updates!=='stable'&&x.updates!=='beta'||typeof x.autoCheck!=='boolean'||typeof x.onboarded!=='boolean')throw Error('Invalid runtime settings')
 return {mode:x.mode,updates:x.updates,autoCheck:x.autoCheck,onboarded:x.onboarded,theme:parseTheme(x.theme),...(isRegion(x.region)?{region:x.region}:{})}
}
