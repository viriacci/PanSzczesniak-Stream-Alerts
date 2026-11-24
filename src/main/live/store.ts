import type {DatabaseSync} from 'node:sqlite'
import type {LiveCounts,ViewerPoint} from '../../shared/live.ts'
export interface StreamObservation {id:string;startedAt:number;title:string;categoryId:string;category:string;viewers:number}
export function parseStream(value:any,now:number):StreamObservation{
 if(!value||typeof value.id!=='string'||!value.id||typeof value.started_at!=='string'||!Number.isSafeInteger(value.viewer_count)||value.viewer_count<0)throw Error('Invalid stream response')
 const startedAt=Date.parse(value.started_at)
 if(!Number.isFinite(startedAt)||startedAt>now+60000)throw Error('Invalid stream start')
 return {id:value.id,startedAt:Math.min(startedAt,now),title:typeof value.title==='string'?value.title:'',categoryId:typeof value.game_id==='string'?value.game_id:'',category:typeof value.game_name==='string'?value.game_name:'',viewers:value.viewer_count}
}
export function observe(db:DatabaseSync,channel:string,stream:StreamObservation|null,at:number){
 db.exec('BEGIN IMMEDIATE')
 try{
  if(!stream){
   db.prepare("UPDATE stream_sessions SET ended_at=max(started_at,coalesce(last_seen_at,started_at)),end_quality='last-seen' WHERE channel_id=? AND source='twitch' AND ended_at IS NULL").run(channel)
   db.exec('COMMIT');return null
  }
  db.prepare("UPDATE stream_sessions SET ended_at=max(started_at,coalesce(last_seen_at,started_at)),end_quality='last-seen' WHERE channel_id=? AND source='twitch' AND ended_at IS NULL AND external_id<>?").run(channel,stream.id)
  db.prepare("INSERT INTO stream_sessions(channel_id,external_id,source,started_at,title,category_id,category,last_seen_at) VALUES (?,?,'twitch',?,?,?,?,?) ON CONFLICT(channel_id,source,external_id) DO UPDATE SET title=excluded.title,category_id=excluded.category_id,category=excluded.category,last_seen_at=max(coalesce(stream_sessions.last_seen_at,0),excluded.last_seen_at),ended_at=NULL,end_quality='unknown'").run(channel,stream.id,stream.startedAt,stream.title,stream.categoryId,stream.category,at)
  const id=Number(db.prepare("SELECT id FROM stream_sessions WHERE channel_id=? AND external_id=? AND source='twitch'").get(channel,stream.id)?.id)
  db.prepare('INSERT OR IGNORE INTO viewer_samples(session_id,sampled_at,viewers,category_id,category) VALUES (?,?,?,?,?)').run(id,at,stream.viewers,stream.categoryId,stream.category)
  db.prepare('UPDATE stream_events SET session_id=? WHERE channel_id=? AND session_id IS NULL AND occurred_at>=? AND occurred_at<=?').run(id,channel,stream.startedAt,at)
  db.exec('COMMIT');return id
 }catch(e){db.exec('ROLLBACK');throw e}
}
export interface ObservedEvent {id:string;kind:string;at:number;count?:number;points?:number;chatter?:string}
export function recordEvent(db:DatabaseSync,channel:string,event:ObservedEvent){
 // Events received before the next viewer poll stay unassigned until the stream is confirmed.
 const session=db.prepare("SELECT id FROM stream_sessions WHERE channel_id=? AND source='twitch' AND started_at<=? AND coalesce(last_seen_at,started_at)>=? AND (ended_at IS NULL OR ended_at>=?) ORDER BY started_at DESC LIMIT 1").get(channel,event.at,event.at,event.at)
 return db.prepare("INSERT OR IGNORE INTO stream_events(session_id,source,external_id,kind,occurred_at,payload_json,channel_id,chatter_key) VALUES (?,'twitch',?,?,?,?,?,?)").run(session?.id??null,event.id,event.kind,event.at,JSON.stringify({count:event.count??0,points:event.points??0}),channel,event.chatter??null).changes===1
}
export function summarize(db:DatabaseSync,id:number){
 const stat=db.prepare('SELECT count(*) n,avg(viewers) average,max(viewers) peak FROM viewer_samples WHERE session_id=?').get(id)!
 const rows=db.prepare('SELECT sampled_at,viewers,category FROM viewer_samples WHERE session_id=? ORDER BY sampled_at DESC LIMIT 480').all(id).reverse()
 const points:ViewerPoint[]=rows.map(x=>({at:Number(x.sampled_at),viewers:Number(x.viewers),category:String(x.category)}))
 const counts:LiveCounts={follows:0,subs:0,prime:0,resubs:0,gifts:0,bits:0,raids:0,raidViewers:0,rewards:0,points:0,messages:0,chatters:0}
 const groups=db.prepare("SELECT kind,count(*) n,sum(coalesce(json_extract(payload_json,'$.count'),0)) amount,sum(coalesce(json_extract(payload_json,'$.points'),0)) points FROM stream_events WHERE session_id=? GROUP BY kind").all(id)
 for(const row of groups){const n=Number(row.n),amount=Number(row.amount)
  switch(row.kind){case 'follow':counts.follows=n;break;case 'sub':counts.subs=n;break;case 'prime_sub':counts.prime=n;break;case 'resub':counts.resubs=n;break;case 'gift':case 'mass_gift':counts.gifts+=amount;break;case 'bits':counts.bits=amount;break;case 'raid':counts.raids=n;counts.raidViewers=amount;break;case 'redemption':counts.rewards=n;counts.points=Number(row.points);break;case 'chat':counts.messages=n;break}
 }
 counts.chatters=Number(db.prepare("SELECT count(DISTINCT chatter_key) n FROM stream_events WHERE session_id=? AND kind='chat'").get(id)?.n??0)
 return {average:stat.average===null?null:Number(stat.average),peak:stat.peak===null?null:Number(stat.peak),samples:Number(stat.n),points,counts}
}
export function recordObs(db:DatabaseSync,id:number,at:number,metrics:unknown,bitrate:number|null){db.prepare('INSERT OR IGNORE INTO obs_samples VALUES (?,?,?,?)').run(id,at,JSON.stringify(metrics),bitrate)}
