import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Overlay,mediaRange} from '../src/main/overlay/server.ts'
import {defaultRule} from '../src/shared/alerts.ts'

test('loopback overlay rejects missing key and delivers SSE events', {timeout:10000}, async()=>{
 const root=await mkdtemp(join(tmpdir(),'pssa-overlay-'))
 const overlay=new Overlay(root,0)
 try{
  await overlay.start()
  const url=overlay.url
  assert.match(url,/^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}\/$/)
  const forbidden=await fetch(new URL('/',url));assert.equal(forbidden.status,404);await forbidden.text()
  const page=await fetch(url);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy')??'',/default-src 'none'/);await page.text()
  const bad=await fetch(url+'media/config.json');assert.equal(bad.status,404);await bad.text()
  const stream=await fetch(url+'events',{signal:AbortSignal.timeout(5000)})
  const reader=stream.body!.getReader()
  try{await reader.read();assert.equal(overlay.send({attempt:'attempt-1',rule:defaultRule('raid'),text:'Test <b>',volume:50}),true);const msg=await reader.read();assert.match(new TextDecoder().decode(msg.value),/Test <b>/);assert.equal(overlay.active('attempt-1'),true);const ack=(id:string,origin=new URL(url).origin)=>fetch(url+'ack',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({attempt:id})});let result='';overlay.onAck=(id,outcome)=>{result=outcome;return id==='attempt-1'};assert.equal((await ack('attempt-1','https://example.com')).status,403);assert.equal((await ack('wrong')).status,409);assert.equal((await ack('attempt-1')).status,204);assert.equal(overlay.active('attempt-1'),false);assert.equal(result,'done');assert.equal(overlay.send({attempt:'attempt-2',rule:defaultRule('raid'),text:'Broken',volume:50}),true);await reader.read();overlay.onAck=(id,outcome)=>{result=outcome;return id==='attempt-2'};const failed=await fetch(url+'ack',{method:'POST',headers:{origin:new URL(url).origin,'Content-Type':'application/json'},body:JSON.stringify({attempt:'attempt-2',result:'media-error'})});assert.equal(failed.status,204);assert.equal(result,'media-error')}finally{await reader.cancel()}
 }finally{overlay.stop();await rm(root,{recursive:true,force:true})}
})

test('media ranges support seeks and reject invalid requests',async()=>{
 assert.deepEqual(mediaRange('bytes=2-4',10),{start:2,end:4})
 assert.deepEqual(mediaRange('bytes=-3',10),{start:7,end:9})
 assert.equal(mediaRange('bytes=10-',10),false)
 assert.equal(mediaRange('bytes=0-1,3-4',10),false)
 const root=await mkdtemp(join(tmpdir(),'pssa-ranges-')),overlay=new Overlay(root,0),name='a'.repeat(64)+'.webm'
 try{await writeFile(join(root,name),'0123456789');await overlay.start()
 const res=await fetch(overlay.url+'media/'+name,{headers:{Range:'bytes=2-4'}});assert.equal(res.status,206);assert.equal(res.headers.get('content-range'),'bytes 2-4/10');assert.equal(await res.text(),'234')
 const bad=await fetch(overlay.url+'media/'+name,{headers:{Range:'bytes=10-'}});assert.equal(bad.status,416)
 const foreign=await fetch(overlay.url+'events',{headers:{Origin:'https://example.org'}});assert.equal(foreign.status,403)
 }finally{overlay.stop();await rm(root,{recursive:true,force:true})}
})

test('built-in tone is content-addressed WAV served only under overlay key',async()=>{
 const {testTone,testToneName,queueTestRule}=await import('../src/main/alerts/test-tone.ts')
 const {createHash}=await import('node:crypto');const root=await mkdtemp(join(tmpdir(),'pssa-tone-')),overlay=new Overlay(root,0)
 try{await overlay.start();assert.equal(queueTestRule().audio,testToneName);assert.equal(testToneName,createHash('sha256').update(testTone).digest('hex')+'.wav');assert.equal(testTone.toString('ascii',0,4),'RIFF');assert.equal(testTone.readUInt32LE(40),36000);assert.ok(testTone.subarray(44).some(v=>v!==0));const res=await fetch(overlay.url+'media/'+testToneName);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'audio/wav');assert.deepEqual(Buffer.from(await res.arrayBuffer()),testTone);const range=await fetch(overlay.url+'media/'+testToneName,{headers:{Range:'bytes=0-43'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),testTone.subarray(0,44));assert.equal((await fetch(new URL('/media/'+testToneName,overlay.url))).status,404)
 }finally{overlay.stop();await rm(root,{recursive:true,force:true})}
})

test('another profile can bind a different loopback port without sharing media or keys',async()=>{
 const a=await mkdtemp(join(tmpdir(),'pssa-user-a-')),b=await mkdtemp(join(tmpdir(),'pssa-user-b-')),one=new Overlay(a,0),two=new Overlay(b,0),name='a'.repeat(64)+'.wav'
 try{
  await writeFile(join(a,name),'user-a');await writeFile(join(b,name),'user-b')
  await one.start();const occupied=Number(new URL(one.url).port)
  await assert.rejects(()=>two.start(undefined,occupied),{code:'EADDRINUSE'})
  await two.start(undefined,0)
  const page=await fetch(two.url);assert.equal(page.status,200);await page.text()
  const stream=await fetch(two.url+'events',{signal:AbortSignal.timeout(5000)});assert.match(stream.headers.get('content-type')??'',/text\/event-stream/)
  const reader=stream.body!.getReader();try{await reader.read();assert.equal(two.clients,1);assert.equal(one.clients,0);assert.equal(two.send({attempt:'fallback-port',rule:defaultRule('raid'),text:'Fallback playback',volume:100}),true);assert.match(new TextDecoder().decode((await reader.read()).value),/Fallback playback/)}finally{await reader.cancel()}
  assert.notEqual(new URL(one.url).port,new URL(two.url).port)
  assert.equal(await (await fetch(one.url+'media/'+name)).text(),'user-a')
  assert.equal(await (await fetch(two.url+'media/'+name)).text(),'user-b')
  const wrong=new URL(two.url);wrong.pathname=new URL(one.url).pathname+'media/'+name
  assert.equal((await fetch(wrong)).status,404)
 }finally{one.stop();two.stop();await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true})}
})
