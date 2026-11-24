import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventSub} from '../src/main/twitch/eventsub.ts'
import type {AlertEvent} from '../src/shared/alerts.ts'
class Socket extends EventTarget {
 closed=false
 close(){this.closed=true;this.dispatchEvent(new Event('close'))}
 message(type:string,payload:any,extra:Record<string,unknown>={}){
  this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({metadata:{message_type:type,...extra},payload})}))
 }
}
const settle=()=>new Promise<void>(r=>setImmediate(r))
test('EventSub reconnect keeps old socket until welcome, avoids resubscription and duplicates',async()=>{
 const sockets:Socket[]=[],events:AlertEvent[]=[],states:string[]=[]
 let calls=0
 const client=new EventSub({identity:{userId:'42',login:'test'},helix:async()=>{calls++;return {}}},phase=>states.push(phase),e=>events.push(e),()=>{const s=new Socket();sockets.push(s);return s as unknown as WebSocket})
 try{
  client.start();const old=sockets[0]!
  old.message('session_welcome',{session:{id:'old',keepalive_timeout_seconds:10}});await settle();assert.equal(calls,8)
  const event={event:{user_name:'viewer'}}
  const meta={message_id:'one',subscription_type:'channel.follow'}
  old.message('notification',event,meta)
  old.message('session_reconnect',{session:{reconnect_url:'wss://eventsub.wss.twitch.tv/ws?reconnect=1'}})
  assert.equal(old.closed,false);const next=sockets[1]!
  next.message('session_welcome',{session:{id:'next',keepalive_timeout_seconds:10}});await settle()
  assert.equal(old.closed,true);assert.equal(calls,8)
  next.message('notification',event,meta);next.message('notification',event,{...meta,message_id:'two'})
  assert.equal(events.length,2);assert.equal(states.at(-1),'connected')
  next.message('session_reconnect',{session:{reconnect_url:'wss://example.org/ws'}})
  assert.equal(sockets.length,2)
  client.stop();next.message('notification',event,{...meta,message_id:'three'});assert.equal(events.length,2)
 }finally{client.stop()}
})
