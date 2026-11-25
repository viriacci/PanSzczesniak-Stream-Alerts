import type {DatabaseSync} from 'node:sqlite'
import {DAY,categoryKey,parseFilter,type AnalyticsFilter,type AnalyticsReport,type PeriodStats,type SessionRow,type CategoryStat} from '../../shared/analytics.ts'
import type {LiveCounts} from '../../shared/live.ts'
const n=(x:unknown)=>Number(x)
const nullable=(x:unknown)=>x==null?null:Number(x)
const day=(at:number)=>new Date(at).toISOString().slice(0,10)
export function channels(db:DatabaseSync){return db.prepare('SELECT DISTINCT channel_id FROM stream_sessions ORDER BY channel_id LIMIT 1000').all().map(r=>String(r.channel_id)).filter(id=>/^\d{1,30}$/.test(id))}
export function selectedSessions(db:DatabaseSync,f:AnalyticsFilter):SessionRow[]{
 const rows=db.prepare(`SELECT s.*,i.average imported_avg,i.peak imported_peak,i.provenance,
 (SELECT count(*) FROM viewer_samples v WHERE v.session_id=s.id AND v.sampled_at>=? AND v.sampled_at<? AND (?='' OR (CASE WHEN v.category_id<>'' THEN 'id:'||v.category_id ELSE 'name:'||v.category END)=?)) samples,
 (SELECT avg(viewers) FROM viewer_samples v WHERE v.session_id=s.id AND v.sampled_at>=? AND v.sampled_at<? AND (?='' OR (CASE WHEN v.category_id<>'' THEN 'id:'||v.category_id ELSE 'name:'||v.category END)=?)) local_avg,
 (SELECT max(viewers) FROM viewer_samples v WHERE v.session_id=s.id AND v.sampled_at>=? AND v.sampled_at<? AND (?='' OR (CASE WHEN v.category_id<>'' THEN 'id:'||v.category_id ELSE 'name:'||v.category END)=?)) local_peak
 FROM stream_sessions s LEFT JOIN imported_summaries i ON i.session_id=s.id
 WHERE s.channel_id=? AND s.started_at<? AND coalesce(s.ended_at,s.last_seen_at,s.started_at)>=?
 AND (?='all' OR (?='local' AND s.source='twitch') OR (?='imported' AND s.source<>'twitch'))
 AND (s.source='twitch' OR NOT EXISTS(SELECT 1 FROM stream_sessions local WHERE local.channel_id=s.channel_id AND local.source='twitch' AND (local.external_id=s.external_id OR local.started_at=s.started_at OR (local.started_at<coalesce(s.ended_at,s.started_at) AND coalesce(local.ended_at,local.last_seen_at,local.started_at)>s.started_at))))
 ORDER BY s.started_at DESC LIMIT 20001`).all(f.from,f.to,f.category,f.category,f.from,f.to,f.category,f.category,f.from,f.to,f.category,f.category,f.channel,f.to,f.from,f.source,f.source,f.source)
 if(rows.length>20000)throw Error('Too many sessions; narrow range')
 return rows.filter(r=>!(n(r.ended_at??r.last_seen_at??r.started_at)===f.from&&n(r.started_at)<f.from)).filter(r=>!f.category||(r.source==='twitch'?n(r.samples)>0:categoryKey(String(r.category_id),String(r.category))===f.category)).map(r=>{
  const startedAt=n(r.started_at),endedAt=n(r.ended_at??r.last_seen_at??r.started_at),local=r.source==='twitch',complete=startedAt>=f.from&&endedAt<=f.to
  return {id:n(r.id),channel:String(r.channel_id),externalId:String(r.external_id??''),startedAt,endedAt,title:String(r.title),categoryId:String(r.category_id),category:String(r.category),source:String(r.source),provenance:local?'PSSA / Twitch':String(r.provenance??'Unknown import'),duration:Math.max(0,Math.min(endedAt,f.to)-Math.max(startedAt,f.from)),average:local?nullable(r.local_avg):complete?nullable(r.imported_avg):null,peak:local?nullable(r.local_peak):complete?nullable(r.imported_peak):null,samples:n(r.samples),endQuality:String(r.end_quality)}
 })
}
export function period(db:DatabaseSync,f:AnalyticsFilter){
 const sessions=selectedSessions(db,f),locals=sessions.filter(s=>s.source==='twitch'),imports=sessions.filter(s=>s.source!=='twitch')
 const sum=(rows:SessionRow[])=>rows.reduce((a,s)=>a+s.duration,0)
 const samples=locals.reduce((a,s)=>a+s.samples,0)
 const avg=samples?locals.reduce((a,s)=>a+(s.average??0)*s.samples,0)/samples:null
 const peakOf=(rows:SessionRow[])=>rows.reduce<number|null>((a,s)=>s.peak===null?a:a===null?s.peak:Math.max(a,s.peak),null)
 const withAvg=imports.filter(s=>s.average!==null&&s.duration>0),importWeight=sum(withAvg)
 const days=new Map<string,PeriodStats['days'][number]>()
 for(let at=Math.floor(f.from/DAY)*DAY;at<f.to;at+=DAY){const d=day(at);days.set(d,{day:d,sessions:0,duration:0,average:null,peak:null,samples:0})}
 for(const s of sessions){
  const start=days.get(day(s.startedAt));if(start)start.sessions++
  for(let at=Math.floor(Math.max(f.from,s.startedAt)/DAY)*DAY;at<Math.min(f.to,s.endedAt);at+=DAY){const d=days.get(day(at));if(d)d.duration+=Math.max(0,Math.min(at+DAY,f.to,s.endedAt)-Math.max(at,f.from,s.startedAt))}
 }
 const categories:CategoryStat[]=[],heatmap:PeriodStats['heatmap']=[]
 let events:LiveCounts|null=null,unassigned=0
 if(f.source!=='imported'){
  const where=" FROM viewer_samples v JOIN stream_sessions s ON s.id=v.session_id WHERE s.source='twitch' AND s.channel_id=? AND v.sampled_at>=? AND v.sampled_at<? AND (?='' OR (CASE WHEN v.category_id<>'' THEN 'id:'||v.category_id ELSE 'name:'||v.category END)=?)"
  const args=[f.channel,f.from,f.to,f.category,f.category] as const
  for(const row of db.prepare("SELECT strftime('%Y-%m-%d',v.sampled_at/1000,'unixepoch') day,count(*) n,avg(viewers) a,max(viewers) p"+where+" GROUP BY day").all(...args)){const d=days.get(String(row.day));if(d){d.samples=n(row.n);d.average=nullable(row.a);d.peak=nullable(row.p)}}
  for(const row of db.prepare("SELECT strftime('%w',v.sampled_at/1000,'unixepoch') day,strftime('%H',v.sampled_at/1000,'unixepoch') hour,count(*) n,avg(viewers) a"+where+" GROUP BY day,hour").all(...args))heatmap.push({day:(n(row.day)+6)%7,hour:n(row.hour),samples:n(row.n),average:n(row.a)})
  for(const row of db.prepare("SELECT CASE WHEN v.category_id<>'' THEN 'id:'||v.category_id ELSE 'name:'||v.category END k,max(v.category) name,count(*) n,avg(viewers) a,max(viewers) p"+where+" GROUP BY k ORDER BY n DESC LIMIT 1000").all(...args))categories.push({key:String(row.k),name:String(row.name)||'Bez kategorii',samples:n(row.n),average:nullable(row.a),peak:nullable(row.p)})
  // Events are session-attributed, not category-attributed; omit when category filter is active.
  if(!f.category&&locals.length){
   events={follows:0,subs:0,prime:0,resubs:0,gifts:0,bits:0,raids:0,raidViewers:0,rewards:0,points:0,messages:0,chatters:0}
   const eventWhere=" FROM stream_events e JOIN stream_sessions s ON s.id=e.session_id WHERE e.source='twitch' AND s.source='twitch' AND s.channel_id=? AND e.occurred_at>=? AND e.occurred_at<?"
   for(const row of db.prepare("SELECT e.kind,count(*) n,sum(coalesce(json_extract(e.payload_json,'$.count'),0)) amount,sum(coalesce(json_extract(e.payload_json,'$.points'),0)) points"+eventWhere+" GROUP BY e.kind").all(f.channel,f.from,f.to)){
    const count=n(row.n),amount=n(row.amount)
    switch(row.kind){case 'follow':events.follows=count;break;case 'sub':events.subs=count;break;case 'prime_sub':events.prime=count;break;case 'resub':events.resubs=count;break;case 'gift':case 'mass_gift':events.gifts+=amount;break;case 'bits':events.bits=amount;break;case 'raid':events.raids=count;events.raidViewers=amount;break;case 'redemption':events.rewards=count;events.points=n(row.points);break;case 'chat':events.messages=count;break}
   }
   events.chatters=n(db.prepare("SELECT count(DISTINCT e.chatter_key) n"+eventWhere+" AND e.kind='chat'").get(f.channel,f.from,f.to)?.n??0)
  }
  if(!f.category)unassigned=n(db.prepare("SELECT count(*) n FROM stream_events WHERE source='twitch' AND channel_id=? AND session_id IS NULL AND occurred_at>=? AND occurred_at<?").get(f.channel,f.from,f.to)?.n??0)
 }
 // Imported category summaries have no fabricated sample counts or daily/heatmap data.
 for(const s of imports){const k=categoryKey(s.categoryId,s.category);if(!categories.some(c=>c.key===k))categories.push({key:k,name:s.category||'Bez kategorii',samples:0,average:null,peak:null})}
 const stats:PeriodStats={sessions:sessions.length,localSessions:locals.length,importedSessions:imports.length,duration:sum(sessions),averageDuration:sessions.length?sum(sessions)/sessions.length:null,average:avg,peak:peakOf(locals),samples,importedAverage:importWeight?withAvg.reduce((a,s)=>a+s.average!*s.duration,0)/importWeight:null,importedPeak:peakOf(imports),importedAverageSessions:withAvg.length,events,unassigned,days:[...days.values()],heatmap,categories,best:locals.filter(s=>s.average!==null).sort((a,b)=>b.average!-a.average!).slice(0,10)}
 return {stats,sessions}
}
export function report(db:DatabaseSync,value:unknown):AnalyticsReport{
 const f=parseFilter(value),current=period(db,f),length=f.to-f.from,previous=period(db,{...f,from:f.from-length,to:f.from})
 const categories=f.category?period(db,{...f,category:''}).stats.categories:current.stats.categories
 return {filter:f,current:current.stats,previous:previous.stats,channels:channels(db),categories,sessions:current.sessions.slice(0,200),sessionCount:current.sessions.length}
}
