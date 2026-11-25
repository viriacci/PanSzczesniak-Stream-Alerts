import {test} from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase} from '../src/main/database/index.ts'
import {observe,recordEvent,recordObs,summarize} from '../src/main/live/store.ts'
import {report} from '../src/main/analytics/store.ts'
import {AlertQueue,type Transport} from '../src/main/alerts/queue.ts'
import {defaultRule} from '../src/shared/alerts.ts'
import type {Playback} from '../src/shared/queue.ts'

test('eight hours of simulated streaming: samples, chat dedup, queue ACK, reconnect and persisted history', {timeout:120000},()=>{
 const db=openDatabase(':memory:'),start=Date.parse('2026-10-01T00:00:00Z')
 let now=start,online=true,last:Playback|undefined
 const transport:Transport={online:()=>online,send:p=>{if(!online)return false;last=p;return true},active:attempt=>online&&last?.attempt===attempt,cancel:attempt=>{if(last?.attempt===attempt)last=undefined},volume:()=>{}}
 const q=new AlertQueue(db,transport,()=>now)
 const rule={...defaultRule('raid'),enabled:true}
 let alerts=0
 try{
  const stream={id:'session',startedAt:start,title:'Synthetic',categoryId:'1',category:'Game',viewers:20}
  const id=observe(db,'42',stream,start)!
  for(let second=0;second<28800;second++){
   now=start+second*1000
   if(second>0&&second%30===0)observe(db,'42',stream,now)
   if(second%5===0)recordObs(db,id,now,{cpu:3,fps:60},6000)
   const event={id:'chat-'+second,kind:'chat',at:now,chatter:'user-'+second%100}
   assert.equal(recordEvent(db,'42',event),true)
   if(second%100===0)assert.equal(recordEvent(db,'42',event),false)
   if(second%60===0){assert.equal(q.enqueue({id:'alert-'+second,kind:'raid',user:'User',count:3},rule),true);alerts++}
   if(second%60===2){online=false;q.tick();online=true}
   q.tick()
   if(second%60===8&&last){assert.equal(q.acknowledge(last.attempt),true);last=undefined}
  }
  now=start+28800*1000
  observe(db,'42',stream,now);observe(db,'42',null,now+1000)
  const s=summarize(db,id)
  assert.equal(s.samples,961);assert.equal(s.average,20);assert.equal(s.counts.messages,28800);assert.equal(s.counts.chatters,100)
  assert.equal(db.prepare('SELECT count(*) n FROM obs_samples').get()?.n,5760)
  assert.equal(db.prepare("SELECT count(*) n FROM alert_queue WHERE status='done'").get()?.n,alerts)
  assert.equal(q.state().pendingCount,0);assert.equal(q.state().current,null);assert.equal(q.nextDelay(),null)
  const analytics=report(db,{channel:'42',from:start,to:now+1000,category:'',source:'all'})
  assert.equal(analytics.current.events?.messages,28800);assert.equal(analytics.current.sessions,1);assert.equal(analytics.current.duration,28800*1000)
  assert.equal(db.prepare('PRAGMA integrity_check').get()?.integrity_check,'ok')
 }finally{q.stop();db.close()}
})
