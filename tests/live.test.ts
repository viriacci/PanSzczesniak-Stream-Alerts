import {test} from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase} from '../src/main/database/index.ts'
import {observe,recordEvent,summarize,parseStream} from '../src/main/live/store.ts'
import {LiveService,bitrateBetween} from '../src/main/live/service.ts'
import {parseLiveAction} from '../src/shared/live.ts'
import type {ObsState} from '../src/shared/obs.ts'
const start=1_700_000_000_000
const observation={id:'stream-1',startedAt:start,title:'Test',categoryId:'1',category:'Game',viewers:10}
const raw=(viewers:number,id='stream-1')=>({id,user_id:'42',started_at:new Date(start).toISOString(),title:'Test',game_id:'1',game_name:'Game',viewer_count:viewers})
test('session identity survives reconnect; no duplicate samples, category retained per observation',()=>{
 const db=openDatabase(':memory:')
 try{
  const id=observe(db,'42',observation,start+30000)!
  assert.equal(observe(db,'42',observation,start+30000),id)
  assert.equal(observe(db,'42',{...observation,viewers:20,categoryId:'2',category:'Next'},start+90000),id)
  const s=summarize(db,id);assert.equal(s.samples,2);assert.equal(s.average,15);assert.equal(s.peak,20);assert.equal(s.points[1]?.category,'Next')
  observe(db,'42',null,start+120000)
  const ended=db.prepare('SELECT ended_at,end_quality FROM stream_sessions WHERE id=?').get(id)
  assert.equal(ended?.ended_at,start+90000);assert.equal(ended?.end_quality,'last-seen')
  assert.equal(observe(db,'42',observation,start+150000),id)
  assert.equal(db.prepare('SELECT ended_at FROM stream_sessions WHERE id=?').get(id)?.ended_at,null)
  const next=observe(db,'42',{...observation,id:'stream-2',startedAt:start+180000},start+180000)
  assert.notEqual(next,id)
  assert.equal(db.prepare('SELECT ended_at FROM stream_sessions WHERE id=?').get(id)?.ended_at,start+150000)
 }finally{db.close()}
})
test('observed events attach only to confirmed session and correct channel; aggregate without duplicate gifts or chatters',()=>{
 const db=openDatabase(':memory:')
 try{
  recordEvent(db,'42',{id:'c1',kind:'chat',at:start+5000,chatter:'a'})
  const id=observe(db,'42',observation,start+30000)!
  assert.equal(recordEvent(db,'42',{id:'c1',kind:'chat',at:start+5000,chatter:'a'}),false)
  recordEvent(db,'42',{id:'c2',kind:'chat',at:start+7000,chatter:'a'})
  recordEvent(db,'42',{id:'c3',kind:'chat',at:start+8000,chatter:'b'})
  recordEvent(db,'42',{id:'g',kind:'mass_gift',at:start+9000,count:5})
  recordEvent(db,'42',{id:'b',kind:'bits',at:start+10000,count:250})
  recordEvent(db,'42',{id:'r',kind:'redemption',at:start+11000,points:500})
  recordEvent(db,'99',{id:'foreign',kind:'follow',at:start+11000})
  recordEvent(db,'42',{id:'future',kind:'follow',at:start+40000})
  const counts=summarize(db,id).counts
  assert.equal(counts.messages,3);assert.equal(counts.chatters,2);assert.equal(counts.gifts,5);assert.equal(counts.bits,250);assert.equal(counts.points,500);assert.equal(counts.follows,0)
  observe(db,'42',observation,start+60000);assert.equal(summarize(db,id).counts.follows,1)
 }finally{db.close()}
})
test('poll failures preserve open session and leave gaps, confirmed offline closes at last seen',async()=>{
 const db=openDatabase(':memory:');let now=start+30000,mode='live'
 const auth={identity:{userId:'42',login:'tester'},canManage:false,helix:async(path:string)=>{
  if(path.startsWith('channels?'))return {data:[{broadcaster_id:'42',title:'Offline title',game_id:'1',game_name:'Game'}]}
  if(mode==='error')throw Error('Network')
  return {data:mode==='live'?[raw(12)]:[]}
 }}
 const service=new LiveService(db,auth,()=>now)
 try{
  await service.poll();assert.equal(service.snapshot().phase,'live');assert.equal(service.snapshot().viewers,12)
  now+=30000;mode='error';await service.poll();assert.equal(service.snapshot().phase,'unknown');assert.equal(service.snapshot().viewers,null)
  assert.equal(db.prepare('SELECT ended_at FROM stream_sessions').get()?.ended_at,null)
  now+=30000;mode='live';await service.poll();assert.equal(service.snapshot().samples,2)
  now+=30000;mode='offline';await service.poll();assert.equal(service.snapshot().phase,'offline');assert.equal(service.snapshot().title,'Offline title')
  assert.equal(db.prepare('SELECT ended_at FROM stream_sessions').get()?.ended_at,start+90000)
 }finally{service.stop();db.close()}
})
test('OBS bitrate rejects resets and stale samples; only one stored sample per poll',async()=>{
 const db=openDatabase(':memory:');let now=start+30000
 const service=new LiveService(db,{identity:{userId:'42',login:'tester'},canManage:false,helix:async()=>({data:[raw(12)]})},()=>now)
 const obs=(at:number,bytes:number,ms:number):ObsState=>({phase:'connected',port:4455,configured:true,detail:'',scene:'Main',scenes:['Main'],sampledAt:at,metrics:{cpu:2,memory:100,fps:60,renderSkipped:0,outputSkipped:0,streaming:true,recording:false,streamBytes:bytes,streamMs:ms}})
 try{
  await service.poll();service.obs(obs(now,1000,1000));assert.equal(service.snapshot().bitrate,null)
  now+=5000;service.obs(obs(now,3751000,6000));assert.equal(service.snapshot().bitrate,6000)
  service.obs(obs(now,3751000,6000));assert.equal(db.prepare('SELECT count(*) n FROM obs_samples').get()?.n,2)
  now+=5000;service.obs(obs(now,10,100));assert.equal(service.snapshot().bitrate,null)
  assert.equal(bitrateBetween({at:0,bytes:1,duration:1},{at:20000,bytes:1000,duration:20000}),null)
 }finally{service.stop();db.close()}
})
test('chat collection stores no message content or raw user ID and filters shared chat',async()=>{
 const db=openDatabase(':memory:');let now=start+30000
 const service=new LiveService(db,{identity:{userId:'42',login:'tester'},canManage:false,helix:async()=>({data:[raw(12)]})},()=>now)
 try{
  await service.poll()
  const e={broadcaster_user_id:'42',chatter_user_id:'sensitive-user-id',message:{text:'private chat text'}}
  service.event('chat1','channel.chat.message',e,now)
  service.event('chat2','channel.chat.message',{...e,source_broadcaster_user_id:'99'},now)
  const rows=db.prepare('SELECT payload_json,chatter_key FROM stream_events').all()
  assert.equal(rows.length,1);assert.match(String(rows[0]?.chatter_key),/^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(rows).includes('private chat text'),false);assert.equal(JSON.stringify(rows).includes('sensitive-user-id'),false)
 }finally{service.stop();db.close()}
})
test('broadcast permissions and action validation',async()=>{
 const db=openDatabase(':memory:')
 let canManage=false;const calls:{path:string;body:unknown;method:unknown}[]=[]
 const auth={identity:{userId:'42',login:'tester'},get canManage(){return canManage},helix:async(path:string,body?:unknown,method?:unknown)=>{calls.push({path,body,method});if(path.startsWith('search/'))return {data:[{id:'10',name:'Game'}]};if(path.startsWith('streams?'))return {data:[raw(10)]};return null}}
 const service=new LiveService(db,auth,()=>start+30000)
 try{
  assert.throws(()=>parseLiveAction({type:'update',title:'x',categoryId:'http://bad'}))
  assert.throws(()=>parseStream({...raw(-1)},start+30000))
  await assert.rejects(service.action({type:'update',title:'Title',categoryId:'10'}))
  assert.deepEqual(await service.action({type:'search',query:'game'}),[{id:'10',name:'Game'}])
  canManage=true;await service.poll()
  await service.action({type:'update',title:'Title',categoryId:'10'})
  assert.ok(calls.some(c=>c.method==='PATCH'&&c.path==='channels?broadcaster_id=42'))
  await service.action({type:'marker',description:'Highlight'})
  assert.ok(calls.some(c=>c.method==='POST'&&c.path==='streams/markers'))
 }finally{service.stop();db.close()}
})
test('late response after account reset cannot write the old stream',async()=>{
 const db=openDatabase(':memory:');let resolve!:(x:unknown)=>void
 const response=new Promise<unknown>(r=>resolve=r)
 const auth={identity:{userId:'42',login:'tester'},canManage:false,helix:async()=>response}
 const service=new LiveService(db,auth,()=>start+30000)
 try{
  const pending=service.poll();service.reset();auth.identity={userId:'99',login:'other'}
  resolve({data:[raw(10)]});await pending
  assert.equal(db.prepare('SELECT count(*) n FROM stream_sessions').get()?.n,0)
 }finally{service.stop();db.close()}
})
