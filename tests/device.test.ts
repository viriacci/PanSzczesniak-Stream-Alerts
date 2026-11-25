import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deviceTokens} from '../src/main/twitch/device.ts'
test('public Twitch device flow polls pending and never sends a client secret',async()=>{
 let calls=0,opened='',code=''
 const result=await deviceTokens('publicclient123',['user:read:chat'],{request:async(url,init)=>{
  assert.ok(!String(init?.body).includes('client_secret'));calls++
  if(String(url).endsWith('/device'))return Response.json({device_code:'device1',user_code:'ABCD1234',verification_uri:'https://www.twitch.tv/activate?device-code=ABCD1234',expires_in:1800,interval:5})
  return calls===2?Response.json({message:'authorization_pending'},{status:400}):Response.json({access_token:'access',refresh_token:'refresh'})
 },openExternal:async url=>{opened=url},wait:async()=>{}},new AbortController().signal,c=>{code=c})
 assert.equal(calls,3);assert.equal(code,'ABCD1234');assert.match(opened,/^https:\/\/www.twitch.tv\/activate/);assert.deepEqual(result,{access:'access',refresh:'refresh'})
})
test('device flow rejects a non-Twitch authorization URL',async()=>{
 await assert.rejects(deviceTokens('publicclient123',[],{request:async()=>Response.json({device_code:'device1',user_code:'ABCD1234',verification_uri:'https://example.com/activate',expires_in:1800,interval:5}),openExternal:async()=>assert.fail('must not open'),wait:async()=>{}},new AbortController().signal,()=>{}))
})
