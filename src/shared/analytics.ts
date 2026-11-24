import type {LiveCounts} from './live.ts'
export const DAY=86400000
export interface AnalyticsFilter {channel:string;from:number;to:number;category:string;source:'all'|'local'|'imported'}
export interface HistoricalSession {channel:string;externalId:string;startedAt:number;endedAt:number;title:string;categoryId:string;category:string;average:number|null;peak:number|null;provenance:string}
export interface SessionRow extends HistoricalSession {id:number;source:string;duration:number;samples:number;endQuality:string}
export interface CategoryStat {key:string;name:string;samples:number;average:number|null;peak:number|null}
export interface PeriodStats {sessions:number;localSessions:number;importedSessions:number;duration:number;averageDuration:number|null;average:number|null;peak:number|null;samples:number;importedAverage:number|null;importedPeak:number|null;importedAverageSessions:number;events:LiveCounts|null;unassigned:number;days:{day:string;sessions:number;duration:number;average:number|null;peak:number|null;samples:number}[];heatmap:{day:number;hour:number;samples:number;average:number}[];categories:CategoryStat[];best:SessionRow[]}
export interface AnalyticsReport {filter:AnalyticsFilter;current:PeriodStats;previous:PeriodStats;channels:string[];categories:CategoryStat[];sessions:SessionRow[];sessionCount:number}
export interface ImportResult {added:number;skipped:number}
export function parseFilter(value:unknown):AnalyticsFilter{
 if(!value||typeof value!=='object')throw Error('Invalid analytics filter')
 const v=value as Record<string,unknown>
 if(typeof v.channel!=='string'||!/^\d{1,30}$/.test(v.channel)||typeof v.from!=='number'||typeof v.to!=='number'||!Number.isSafeInteger(v.from)||!Number.isSafeInteger(v.to)||v.from<DAY*366||v.to<=v.from||v.to-v.from>366*DAY||v.to>4102444800000||typeof v.category!=='string'||v.category.length>220||!['all','local','imported'].includes(String(v.source)))throw Error('Invalid analytics range')
 return {channel:v.channel,from:v.from,to:v.to,category:v.category,source:v.source as AnalyticsFilter['source']}
}
export const categoryKey=(id:string,name:string)=>id?'id:'+id:'name:'+name
