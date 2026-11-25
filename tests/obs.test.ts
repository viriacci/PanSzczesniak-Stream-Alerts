import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {ObsClient,authentication,metrics} from '../src/main/obs/client.ts'
import {parseObsAction} from '../src/shared/obs.ts'
class Socket extends EventTarget{
 sent:any[]=[]
 close(){}
 send(raw:string){this.sent.push(JSON.parse(raw))}
 receive(op:number,d:unknown){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({op,d})}))}
}
const settle=()=>new Promise<void>(r=>setImmediate(r))
test('OBS authentication and IPC validation',()=>{
 const hash=(s:string)=>createHash('sha256').update(s).digest('base64')
 assert.equal(authentication('p','s','c'),hash(hash('ps')+'c'))
 assert.throws(()=>parseObsAction({type:'connect',port:0,password:''}))
 assert.throws(()=>parseObsAction({type:'arbitrary'}))
 assert.equal(metrics({}, {}, {}).cpu,null)
})
test('OBS v5 handshake, status polling, scene whitelist and refresh only PSSA sources',async()=>{
 const socket=new Socket(),client=new ObsClient(url=>{assert.equal(url,'ws://127.0.0.1:4455');return socket as unknown as WebSocket})
 const reply=(request:any,data:unknown)=>socket.receive(7,{requestId:request.d.requestId,requestStatus:{result:true,code:100},responseData:data})
 try{
  client.connect(4455,'password')
  socket.receive(0,{rpcVersion:1,authentication:{salt:'salt',challenge:'challenge'}})
  assert.equal(socket.sent[0].d.authentication,authentication('password','salt','challenge'))
  socket.receive(2,{negotiatedRpcVersion:1})
  for(const request of socket.sent.slice(1)){
   const result:Record<string,unknown>={GetStats:{cpuUsage:3,activeFps:60},GetStreamStatus:{outputActive:true,outputBytes:2000},GetRecordStatus:{outputActive:false},GetSceneList:{currentProgramSceneName:'Main',scenes:[{sceneName:'Main'},{sceneName:'BRB'}]}}
   reply(request,result[request.d.requestType])
  }
  await settle();assert.equal(client.snapshot().metrics?.fps,60);assert.equal(client.snapshot().metrics?.streaming,true)
  await assert.rejects(client.setScene('Unknown'))
  const scene=client.setScene('BRB');reply(socket.sent.at(-1),{});await scene
  const refresh=client.refreshOverlay('http://127.0.0.1:18766/key/')
  reply(socket.sent.at(-1),{inputs:[{inputName:'PSSA'},{inputName:'Other'}]});await settle()
  reply(socket.sent.at(-1),{inputSettings:{url:'http://127.0.0.1:18766/key/'}});await settle()
  assert.equal(socket.sent.at(-1).d.requestType,'PressInputPropertiesButton')
  reply(socket.sent.at(-1),{});await settle()
  reply(socket.sent.at(-1),{inputSettings:{url:'https://example.com'}})
  assert.equal(await refresh,1)
  assert.equal(socket.sent.filter(x=>x.d.requestType==='PressInputPropertiesButton').length,1)
 }finally{client.disconnect()}
})

test('refresh cannot continue on a replacement OBS connection',async()=>{
 const sockets:Socket[]=[],client=new ObsClient(()=>{const s=new Socket();sockets.push(s);return s as unknown as WebSocket})
 try{
  client.connect(4455,'');const first=sockets[0]!
  first.receive(0,{rpcVersion:1});first.receive(2,{negotiatedRpcVersion:1})
  const refresh=client.refreshOverlay('http://127.0.0.1:18766/key/')
  const rejected=assert.rejects(refresh,/connection changed/)
  const last=first.sent.at(-1)
  first.receive(7,{requestId:last.d.requestId,requestStatus:{result:true},responseData:{inputs:[{inputName:'PSSA'}]}})
  client.connect(4456,'');const next=sockets[1]!
  next.receive(0,{rpcVersion:1});next.receive(2,{negotiatedRpcVersion:1})
  await rejected
  assert.equal(next.sent.some(x=>x.d.requestType==='GetInputSettings'),false)
 }finally{client.disconnect()}
})

test('telemetry is delivered on fresh OBS samples and disconnect, not by a separate timer',async()=>{
 const socket=new Socket(),received:import('../src/shared/obs.ts').ObsState[]=[]
 const client=new ObsClient(()=>socket as unknown as WebSocket,s=>received.push(s))
 try{
  client.connect(4455,'');socket.receive(0,{rpcVersion:1});socket.receive(2,{negotiatedRpcVersion:1})
  for(const r of socket.sent.slice(1))socket.receive(7,{requestId:r.d.requestId,requestStatus:{result:true},responseData:{}})
  await settle();assert.equal(received.filter(s=>s.sampledAt!==undefined).length,1)
  client.disconnect();assert.equal(received.at(-1)?.metrics,null)
 }finally{client.disconnect()}
})
