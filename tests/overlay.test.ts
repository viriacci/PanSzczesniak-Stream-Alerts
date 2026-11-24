import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Overlay} from '../src/main/overlay/server.ts'
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
