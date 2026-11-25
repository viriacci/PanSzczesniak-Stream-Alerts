import {test} from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase} from '../src/main/database/index.ts'
import {AlertQueue,type Transport} from '../src/main/alerts/queue.ts'
import {defaultRule,type AlertEvent} from '../src/shared/alerts.ts'
import {defaultQueueSettings,type Playback} from '../src/shared/queue.ts'

function fixture(){
 const db=openDatabase(':memory:');let clock=100000,connected=false,active='',last:Playback|undefined,volume=-1
 const transport:Transport={online:()=>connected,send:p=>{if(!connected)return false;active=p.attempt;last=p;return true},active:id=>connected&&active===id,cancel:id=>{if(active===id)active=''},volume:(id,v)=>{if(active===id)volume=v}}
 const q=new AlertQueue(db,transport,()=>clock)
 const event=(id:string,count=5):AlertEvent=>({id,kind:'raid',user:id,count})
 const rule={...defaultRule('raid'),enabled:true}
 return {db,q,transport,event,rule,connect:(v:boolean)=>{connected=v},advance:(ms:number)=>{clock+=ms;q.tick()},now:()=>clock,last:()=>last,volume:()=>volume,ack:()=>{const id=active;assert.equal(q.acknowledge(id),true);active=''}}
}

test('offline queue, priority, pause, gap and ACK prevent overlapping playback',()=>{
 const f=fixture()
 try{
  f.q.enqueue(f.event('a'),{...f.rule,priority:2})
  f.q.enqueue(f.event('b'),{...f.rule,priority:9})
  f.connect(true);f.q.tick();assert.equal(f.q.state().current?.text.includes('b'),true)
  const token=f.last()!.attempt;f.q.tick();assert.equal(f.last()!.attempt,token)
  assert.equal(f.q.acknowledge('wrong'),false)
  f.q.command({type:'settings',settings:{...defaultQueueSettings,paused:true}})
  f.ack();f.advance(1000);assert.equal(f.q.state().current,null)
  f.q.command({type:'settings',settings:defaultQueueSettings})
  assert.equal(f.q.state().current?.text.includes('a'),true);f.ack()
  assert.equal(f.q.state().history.filter(x=>x.status==='done').length,2)
 }finally{f.q.stop();f.db.close()}
})

test('persistent deduplication, filters, manual ordering and replay',()=>{
 const f=fixture()
 try{
  assert.equal(f.q.enqueue(f.event('a'),{...f.rule,cooldown:10}),true)
  assert.equal(f.q.enqueue(f.event('a'),f.rule),false)
  assert.equal(f.q.enqueue(f.event('b'),{...f.rule,cooldown:10}),false)
  assert.equal(f.q.enqueue(f.event('c',1),{...f.rule,minCount:2}),false)
  assert.equal(f.q.enqueue(f.event('disabled'),{...f.rule,enabled:false}),false)
  assert.equal(f.q.enqueue(f.event('d'),f.rule),true)
  let state=f.q.state();assert.equal(state.pendingCount,2);assert.equal(state.history.length,3)
  const d=state.pending[1]!.id
  state=f.q.command({type:'move',id:d,direction:-1});assert.equal(state.pending[0]!.id,d)
  state=f.q.command({type:'skip',id:d});assert.equal(state.pendingCount,1)
  state=f.q.command({type:'replay',id:d});assert.equal(state.pendingCount,2)
  f.q.stop()
  const q2=new AlertQueue(f.db,f.transport,f.now)
  assert.equal(q2.enqueue(f.event('a'),f.rule),false);assert.equal(q2.state().pendingCount,2)
  q2.stop()
 }finally{f.db.close()}
})

test('disconnect retries are bounded; stale ACK cannot finish next attempt',()=>{
 const f=fixture()
 try{
  f.connect(true);f.q.enqueue(f.event('a'),f.rule)
  const first=f.last()!.attempt
  for(let i=0;i<3;i++){
   f.connect(false);f.q.tick()
   f.connect(true);f.advance(500)
   if(i<2){assert.notEqual(f.last()!.attempt,first);assert.equal(f.q.acknowledge(first),false)}
  }
  assert.equal(f.q.state().pendingCount,0);assert.equal(f.q.state().history[0]?.status,'failed')
 }finally{f.q.stop();f.db.close()}
})

test('mute, volume, skip and watchdog',()=>{
 const f=fixture()
 try{
  f.connect(true);f.q.enqueue(f.event('a'),{...f.rule,volume:50})
  assert.equal(f.last()?.volume,50)
  f.q.command({type:'settings',settings:{...defaultQueueSettings,muted:true}})
  assert.equal(f.volume(),0)
  f.q.command({type:'settings',settings:{...defaultQueueSettings,volume:40}})
  assert.equal(f.volume(),20)
  f.q.command({type:'skip',id:f.q.state().current!.id});assert.equal(f.q.state().history[0]?.status,'skipped')
  f.q.enqueue(f.event('b'),f.rule);f.advance(500);f.advance(16000)
  assert.equal(f.q.state().history[0]?.reason,'ack-timeout')
 }finally{f.q.stop();f.db.close()}
})

test('1000 queued alerts survive and excess is explicitly suppressed',()=>{
 const f=fixture()
 try{
  for(let i=0;i<1000;i++)assert.equal(f.q.enqueue(f.event('event-'+i),f.rule),true)
  assert.equal(f.q.enqueue(f.event('overflow'),f.rule),false)
  assert.equal(f.q.state().pendingCount,1000);assert.equal(f.q.state().history[0]?.reason,'capacity')
 }finally{f.q.stop();f.db.close()}
})

test('media failure is not recorded as successful playback',()=>{
 const f=fixture()
 try{
  f.connect(true);f.q.enqueue(f.event('broken'),f.rule)
  assert.equal(f.q.acknowledge(f.last()!.attempt,'media-error'),true)
  assert.equal(f.q.state().history[0]?.status,'failed')
  assert.equal(f.q.state().history[0]?.reason,'media-error')
 }finally{f.q.stop();f.db.close()}
})
test('1000 queued events drain sequentially with unique playback attempts',()=>{
 const f=fixture()
 try{
  for(let i=0;i<1000;i++)f.q.enqueue(f.event('drain-'+i),f.rule)
  f.connect(true);f.q.tick()
  const attempts=new Set<string>()
  for(let i=0;i<1000;i++){
   assert.ok(f.q.state().current)
   const attempt=f.last()!.attempt;assert.equal(attempts.has(attempt),false);attempts.add(attempt)
   f.ack();f.advance(500)
  }
  assert.equal(f.q.state().pendingCount,0)
  assert.equal(f.q.state().current,null)
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM alert_queue WHERE status='done'").get()?.n,1000)
 }finally{f.q.stop();f.db.close()}
})

test('queue summary excludes heavyweight scene snapshots without losing replay',()=>{
 const f=fixture()
 try{f.q.enqueue(f.event('summary'),f.rule);const item=f.q.state().pending[0]!
 assert.equal(Object.hasOwn(item,'rule'),false)
 f.q.command({type:'skip',id:item.id});f.q.command({type:'replay',id:item.id});assert.equal(f.q.state().pendingCount,1)
 }finally{f.q.stop();f.db.close()}
})

test('idle queue performs no SQL and reuses snapshots; mutation and reconnect invalidate cache',()=>{
 const f=fixture()
 try{
  f.connect(true);const before=f.q.state(),prepare=f.db.prepare.bind(f.db);let reads=0
  f.db.prepare=((sql:string)=>{reads++;return prepare(sql)}) as typeof f.db.prepare
  for(let i=0;i<14400;i++)f.q.tick()
  for(let i=0;i<1000;i++)assert.equal(f.q.state(),before)
  assert.equal(reads,0)
  f.q.enqueue(f.event('new'),f.rule);assert.notEqual(f.q.state(),before);assert.ok(f.q.state().current)
  f.ack();assert.equal(f.q.state().history[0]?.status,'done')
  f.connect(false);assert.equal(f.q.state().online,false)
 }finally{f.q.stop();f.db.close()}
})

test('queue only schedules work for pending online alerts, gap, active deadline and disconnect',()=>{
 const f=fixture()
 try{
  assert.equal(f.q.nextDelay(),null)
  f.q.enqueue(f.event('a'),f.rule);assert.equal(f.q.nextDelay(),null)
  f.connect(true);assert.equal(f.q.nextDelay(),0);f.q.tick()
  assert.equal(f.q.nextDelay(),15000)
  f.q.enqueue(f.event('b'),f.rule);f.ack();assert.equal(f.q.nextDelay(),500)
  f.advance(500);assert.ok(f.q.state().current)
  f.connect(false);assert.equal(f.q.nextDelay(),0);f.q.tick();assert.equal(f.q.nextDelay(),null)
  f.connect(true);f.advance(500);f.ack();f.advance(500);assert.equal(f.q.nextDelay(),null)
 }finally{f.q.stop();f.db.close()}
})

test('independent test waits offline and observes volume, mute, ACK and replay',()=>{
 const f=fixture();try{
  const pending=f.q.command({type:'test'});assert.equal(pending.pendingCount,1);assert.equal(pending.pending[0]?.title,'Testowy alert');assert.equal(pending.pending[0]?.source,'test');assert.equal(f.last(),undefined)
  f.q.command({type:'settings',settings:{...defaultQueueSettings,paused:true,volume:40}});f.connect(true);f.q.tick();assert.equal(f.last(),undefined)
  f.q.command({type:'settings',settings:{...defaultQueueSettings,volume:40}});assert.match(f.last()!.rule.audio,/^[a-f0-9]{64}\\.wav$/);assert.equal(f.last()!.volume,40)
  f.q.command({type:'settings',settings:{...defaultQueueSettings,volume:40,muted:true}});assert.equal(f.volume(),0);f.ack();assert.equal(f.q.state().history[0]?.status,'done')
  f.q.command({type:'replay',id:f.q.state().history[0]!.id});f.advance(500);assert.equal(f.last()!.volume,0);f.ack()
 }finally{f.q.stop();f.db.close()}
})
