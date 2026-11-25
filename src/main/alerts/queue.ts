import {queueTestRule} from './test-tone.ts'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { parseRule, renderText, type AlertEvent, type AlertRule } from '../../shared/alerts.ts'
import { defaultQueueSettings,parseQueueSettings,parseQueueCommand,type QueueItem,type QueueSummary,type QueueSource,type QueueState,type QueueStatus,type Playback,type QueueSettings } from '../../shared/queue.ts'

// Partial index predicate must remain identical to schema migration 5.
export const historyQueryTail=" FROM alert_queue INDEXED BY alert_queue_history WHERE status IN ('done','skipped','failed','suppressed') ORDER BY finished_at DESC,id DESC LIMIT 100"

export interface Transport {
 online():boolean
 send(value:Playback):boolean
 active(attempt:string):boolean
 cancel(attempt:string):void
 volume(attempt:string,volume:number):void
}
interface Active {id:number;attempt:string;deadline:number;rule:AlertRule}
export class AlertQueue {
 private db:DatabaseSync
 private transport:Transport
 private now:()=>number
 private settings:QueueSettings
 private current?:Active
 private nextAt=0
 private stopped=false
 private hasPending=false
 private revision=0
 private totals={done:0,failed:0,suppressed:0,retried:0}
 telemetry(){return {...this.totals,queuePending:this.pendingCount(),queuePlaying:!!this.current}}
 private cached?:{revision:number;online:boolean;state:QueueState}
 get version(){return this.revision}
 onChange:()=>void=()=>{}
 private changed(){this.revision++;this.cached=undefined;this.onChange()}
 // Null means no timer: wake on a new event, command, or transport change.
 nextDelay():number|null{
  if(this.stopped)return null
  const now=this.now()
  if(this.current)return this.transport.active(this.current.attempt)?Math.max(0,this.current.deadline-now):0
  if(!this.hasPending||this.settings.paused||!this.transport.online())return null
  return Math.max(0,this.nextAt-now)
 }
 constructor(db:DatabaseSync,transport:Transport,now=Date.now){
  this.db=db;this.transport=transport;this.now=now
  const raw=db.prepare("SELECT value FROM settings WHERE key='queue.v1'").get()?.value
  try{this.settings=typeof raw==='string'?parseQueueSettings(JSON.parse(raw)):{...defaultQueueSettings}}catch{this.settings={...defaultQueueSettings}}
  // A crash may have interrupted playback; it cannot prove that OBS finished.
  db.prepare("UPDATE alert_queue SET status='failed',finished_at=?,reason='restart-limit' WHERE status='playing' AND attempts>=3").run(this.now())
  db.exec("UPDATE alert_queue SET status='pending',reason='restart' WHERE status='playing'");this.hasPending=this.pendingCount()>0
 }
 private decode(row:any):QueueItem{
  const rule=parseRule(JSON.parse(row.rule_json))
  return {id:Number(row.id),source:row.source,key:row.rule_key,title:rule.title,text:row.text,rule,status:row.status,priority:row.priority,position:row.position,attempts:row.attempts,createdAt:row.created_at,finishedAt:row.finished_at,reason:row.reason}
 }
 private get(id:number){const row=this.db.prepare('SELECT * FROM alert_queue WHERE id=?').get(id);return row?this.decode(row):undefined}
 private pendingCount(){return Number(this.db.prepare("SELECT count(*) AS n FROM alert_queue WHERE status='pending'").get()?.n??0)}
 private summary(row:any):QueueSummary{return {id:Number(row.id),source:row.source,key:row.rule_key,title:typeof row.title==='string'?row.title:row.rule_key,text:row.text,status:row.status,priority:row.priority,position:row.position,attempts:row.attempts,createdAt:row.created_at,finishedAt:row.finished_at,reason:row.reason}}
 state():QueueState{
  const online=this.transport.online();if(this.cached?.revision===this.revision&&this.cached.online===online)return this.cached.state
  const fields="id,source,rule_key,json_extract(rule_json,'$.title') AS title,text,status,priority,position,attempts,created_at,finished_at,reason"
  const current=this.current?this.db.prepare('SELECT '+fields+' FROM alert_queue WHERE id=?').get(this.current.id):undefined
  const pending=this.db.prepare('SELECT '+fields+" FROM alert_queue WHERE status='pending' ORDER BY priority DESC,position,id LIMIT 100").all().map(r=>this.summary(r))
  const history=this.db.prepare('SELECT '+fields+historyQueryTail).all().map(r=>this.summary(r))
  const state={settings:{...this.settings},current:current?this.summary(current):null,pending,pendingCount:this.pendingCount(),history,online};this.cached={revision:this.revision,online,state};return state
 }
 enqueue(event:AlertEvent,rule:AlertRule,source:QueueSource='twitch'){
  return this.insert(source+':'+event.id,source,parseRule(rule),renderText(rule.template,event),event.count??event.months??0)
 }
 private insert(eventId:string,source:QueueSource,rule:AlertRule,text:string,count:number){
  // Only the chosen scene is part of an immutable playback snapshot.
  rule={...rule,variants:[]}
  if(this.stopped)throw Error('Queue stopped')
  if(this.db.prepare('SELECT id FROM alert_queue WHERE event_id=?').get(eventId))return false
  const now=this.now()
  let reason=''
  if(source==='twitch'){
   if(!rule.enabled)reason='disabled'
   else if(count<rule.minCount)reason='minimum'
   else if(rule.cooldown>0&&this.db.prepare("SELECT 1 FROM alert_queue WHERE rule_key=? AND source='twitch' AND status NOT IN ('suppressed','failed') AND created_at>? LIMIT 1").get(rule.key,now-rule.cooldown*1000))reason='cooldown'
  }
  if(!reason&&this.pendingCount()+(this.current?1:0)>=1000)reason='capacity'
  const position=Number(this.db.prepare('SELECT coalesce(max(id),0)+1 AS n FROM alert_queue').get()?.n??1)
  this.db.prepare('INSERT INTO alert_queue(event_id,source,rule_key,rule_json,text,status,priority,position,created_at,finished_at,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
   .run(eventId,source,rule.key,JSON.stringify(rule),text,reason?'suppressed':'pending',rule.priority,position,now,reason?now:null,reason)
  if(!reason)this.hasPending=true;else this.totals.suppressed++;this.changed();this.tick()
  return !reason
 }
 private effective(rule:AlertRule){return this.settings.muted?0:Math.round(rule.volume*this.settings.volume/100)}
 tick(){
  if(this.stopped)return
  const now=this.now()
  if(this.current){
   if(!this.transport.active(this.current.attempt)){this.interrupted('overlay-disconnected');return}
   if(now>=this.current.deadline){this.finish('failed','ack-timeout',true);return}
   return
  }
  if(!this.hasPending||this.settings.paused||now<this.nextAt||!this.transport.online())return
  const row=this.db.prepare("SELECT * FROM alert_queue WHERE status='pending' ORDER BY priority DESC,position,id LIMIT 1").get()
  if(!row){this.hasPending=false;return}
  const item=this.decode(row),attempt=randomUUID()
  this.db.prepare("UPDATE alert_queue SET status='playing',attempts=attempts+1,reason='' WHERE id=?").run(item.id)
  this.current={id:item.id,attempt,deadline:now+item.rule.duration*1000+10000,rule:item.rule};this.changed()
  try{if(!this.transport.send({attempt,rule:item.rule,text:item.text,volume:this.effective(item.rule)}))this.interrupted('overlay-disconnected')}catch{if(this.current)this.interrupted('transport-error')}
 }
 acknowledge(attempt:string,result:'done'|'media-error'='done'){
  if(this.current?.attempt!==attempt)return false
  this.finish(result==='done'?'done':'failed',result==='done'?'':'media-error',false);return true
 }
 private interrupted(reason:string){
  const active=this.current;if(!active)return
  const item=this.get(active.id)
  if(item&&item.attempts<3){this.totals.retried++;this.db.prepare("UPDATE alert_queue SET status='pending',reason=? WHERE id=?").run(reason,active.id)}
  else {this.totals.failed++;this.db.prepare("UPDATE alert_queue SET status='failed',finished_at=?,reason=? WHERE id=?").run(this.now(),reason,active.id)}
  this.hasPending=true;this.changed();this.current=undefined;try{this.transport.cancel(active.attempt)}catch{/* transport already lost */}
  this.nextAt=this.now()+this.settings.gapMs
 }
 private finish(status:QueueStatus,reason:string,cancel:boolean){
  const active=this.current;if(!active)return
  this.db.prepare('UPDATE alert_queue SET status=?,finished_at=?,reason=? WHERE id=?').run(status,this.now(),reason,active.id)
  if(status==='done')this.totals.done++;if(status==='failed')this.totals.failed++
  this.current=undefined;this.changed()
  if(cancel)try{this.transport.cancel(active.attempt)}catch{/* transport already lost */}
  this.nextAt=this.now()+this.settings.gapMs
 }
 command(input:unknown){
  const command=parseQueueCommand(input)
  if(command.type==='test'){
   const rule=queueTestRule()
   if(!this.enqueue({id:randomUUID(),kind:'redemption',user:'Test PSSA'},rule,'test'))throw Error('Queue is full')
   return this.state()
  }
  if(command.type==='settings'){
   this.db.prepare("INSERT INTO settings(key,value) VALUES ('queue.v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(command.settings))
   this.settings=command.settings
   if(this.current)this.transport.volume(this.current.attempt,this.effective(this.current.rule))
  }else{
   const item=this.get(command.id);if(!item)throw Error('Alert not found')
   switch(command.type){
    case 'skip':
     if(item.status==='playing'&&this.current?.id===item.id)this.finish('skipped','manual',true)
     else if(item.status==='pending')this.db.prepare("UPDATE alert_queue SET status='skipped',finished_at=?,reason='manual' WHERE id=?").run(this.now(),item.id)
     else throw Error('Alert is not pending')
     break
    case 'replay':
     if(item.status==='pending'||item.status==='playing')throw Error('Alert is still active')
     if(!this.insert('replay:'+randomUUID(),'replay',item.rule,item.text,0))throw Error('Queue is full')
     break
    case 'priority':
     if(item.status!=='pending')throw Error('Alert is not pending')
     this.db.prepare('UPDATE alert_queue SET priority=? WHERE id=?').run(command.priority,item.id);break
    case 'move':{
     if(item.status!=='pending')throw Error('Alert is not pending')
     const list=this.db.prepare("SELECT id,position FROM alert_queue WHERE status='pending' AND priority=? ORDER BY position,id").all(item.priority)
     const i=list.findIndex(x=>x.id===item.id),other=list[i+command.direction]
     if(other){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('UPDATE alert_queue SET position=? WHERE id=?').run(other.position!,item.id);this.db.prepare('UPDATE alert_queue SET position=? WHERE id=?').run(item.position,other.id!);this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}}
     break
    }
   }
  }
  this.changed();this.tick();return this.state()
 }
 stop(){this.stopped=true;if(this.current)this.interrupted('shutdown')}
}
