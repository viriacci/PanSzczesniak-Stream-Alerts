import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { parseRule, renderText, type AlertEvent, type AlertRule } from '../../shared/alerts.ts'
import { defaultQueueSettings,parseQueueSettings,parseQueueCommand,type QueueItem,type QueueSource,type QueueState,type QueueStatus,type Playback,type QueueSettings } from '../../shared/queue.ts'

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
 constructor(db:DatabaseSync,transport:Transport,now=Date.now){
  this.db=db;this.transport=transport;this.now=now
  const raw=db.prepare("SELECT value FROM settings WHERE key='queue.v1'").get()?.value
  try{this.settings=typeof raw==='string'?parseQueueSettings(JSON.parse(raw)):{...defaultQueueSettings}}catch{this.settings={...defaultQueueSettings}}
  // A crash may have interrupted playback; it cannot prove that OBS finished.
  db.prepare("UPDATE alert_queue SET status='failed',finished_at=?,reason='restart-limit' WHERE status='playing' AND attempts>=3").run(this.now())
  db.exec("UPDATE alert_queue SET status='pending',reason='restart' WHERE status='playing'")
 }
 private decode(row:any):QueueItem{
  const rule=parseRule(JSON.parse(row.rule_json))
  return {id:Number(row.id),source:row.source,key:row.rule_key,title:rule.title,text:row.text,rule,status:row.status,priority:row.priority,position:row.position,attempts:row.attempts,createdAt:row.created_at,finishedAt:row.finished_at,reason:row.reason}
 }
 private get(id:number){const row=this.db.prepare('SELECT * FROM alert_queue WHERE id=?').get(id);return row?this.decode(row):undefined}
 private pendingCount(){return Number(this.db.prepare("SELECT count(*) AS n FROM alert_queue WHERE status='pending'").get()?.n??0)}
 state():QueueState{
  const pending=this.db.prepare("SELECT * FROM alert_queue WHERE status='pending' ORDER BY priority DESC,position,id LIMIT 100").all().map(r=>this.decode(r))
  const history=this.db.prepare("SELECT * FROM alert_queue WHERE status IN ('done','skipped','failed','suppressed') ORDER BY finished_at DESC,id DESC LIMIT 100").all().map(r=>this.decode(r))
  return {settings:{...this.settings},current:this.current?this.get(this.current.id)??null:null,pending,pendingCount:this.pendingCount(),history,online:this.transport.online()}
 }
 enqueue(event:AlertEvent,rule:AlertRule,source:QueueSource='twitch'){
  return this.insert(source+':'+event.id,source,parseRule(rule),renderText(rule.template,event),event.count??event.months??0)
 }
 private insert(eventId:string,source:QueueSource,rule:AlertRule,text:string,count:number){
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
  this.tick()
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
  if(this.settings.paused||now<this.nextAt||!this.transport.online())return
  const row=this.db.prepare("SELECT * FROM alert_queue WHERE status='pending' ORDER BY priority DESC,position,id LIMIT 1").get()
  if(!row)return
  const item=this.decode(row),attempt=randomUUID()
  this.db.prepare("UPDATE alert_queue SET status='playing',attempts=attempts+1,reason='' WHERE id=?").run(item.id)
  this.current={id:item.id,attempt,deadline:now+item.rule.duration*1000+10000,rule:item.rule}
  if(!this.transport.send({attempt,rule:item.rule,text:item.text,volume:this.effective(item.rule)}))this.interrupted('overlay-disconnected')
 }
 acknowledge(attempt:string){
  if(this.current?.attempt!==attempt)return false
  this.finish('done','',false);return true
 }
 private interrupted(reason:string){
  const active=this.current;if(!active)return
  this.current=undefined;this.transport.cancel(active.attempt)
  const item=this.get(active.id)
  if(item&&item.attempts<3)this.db.prepare("UPDATE alert_queue SET status='pending',reason=? WHERE id=?").run(reason,active.id)
  else this.db.prepare("UPDATE alert_queue SET status='failed',finished_at=?,reason=? WHERE id=?").run(this.now(),reason,active.id)
  this.nextAt=this.now()+this.settings.gapMs
 }
 private finish(status:QueueStatus,reason:string,cancel:boolean){
  const active=this.current;if(!active)return
  this.db.prepare('UPDATE alert_queue SET status=?,finished_at=?,reason=? WHERE id=?').run(status,this.now(),reason,active.id)
  this.current=undefined
  if(cancel)this.transport.cancel(active.attempt)
  this.nextAt=this.now()+this.settings.gapMs
 }
 command(input:unknown){
  const command=parseQueueCommand(input)
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
  this.tick();return this.state()
 }
 stop(){this.stopped=true;if(this.current)this.interrupted('shutdown')}
}
