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
  try{await reader.read();assert.equal(overlay.publish(defaultRule('raid'),'Test <b>'),1);const msg=await reader.read();assert.match(new TextDecoder().decode(msg.value),/Test <b>/)}finally{await reader.cancel()}
 }finally{overlay.stop();await rm(root,{recursive:true,force:true})}
})
