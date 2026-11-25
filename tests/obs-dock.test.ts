import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createConnection} from 'node:net'
import {DockControl,dispatchDock,type DockHandlers} from '../src/main/obs/dock-control.ts'
test('dock commands are authenticated, restricted, and share authoritative volume',()=>{
 let volume=75,muted=false,tests=0,quit=0;const token='a'.repeat(64)
 const h:DockHandlers={state:()=>({version:'2',volume,muted,pending:tests,twitch:'disconnected',overlayUrl:''}),volume:v=>{volume=v},mute:v=>{muted=v},test:()=>{tests++},quit:()=>{quit++},reload:()=>{},show:()=>{}}
 const run=(command:string,value?:unknown)=>dispatchDock({token,command,value},token,h)
 assert.throws(()=>dispatchDock({token:'b'.repeat(64),command:'quit'},token,h));assert.equal(quit,0)
 assert.throws(()=>run('volume',101));assert.throws(()=>run('volume','50'));assert.throws(()=>run('exec'))
 assert.equal(run('volume',30).volume,30);assert.equal(run('mute',true).muted,true);assert.equal(run('test').pending,1);assert.equal(run('status').volume,30);run('quit');assert.equal(quit,1)
})
test('real local pipe authenticates command and returns state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pssa-dock-'));let volume=100
 const h:DockHandlers={state:()=>({version:'2',volume,muted:false,pending:0,twitch:'disconnected',overlayUrl:''}),volume:v=>{volume=v},mute:()=>{},test:()=>{},quit:()=>{},reload:()=>{},show:()=>{}}
 const dock=new DockControl(dir,'PSSA.exe',h)
 try{const d=await dock.start();assert.deepEqual(JSON.parse(await readFile(join(dir,'obs-dock.json'),'utf8')),d)
  const send=(token:string,command:string,value?:unknown)=>new Promise<any>((resolve,reject)=>{const socket=createConnection(process.platform==='win32'?'\\\\.\\pipe\\'+d.pipe:d.pipe);let data='';socket.setTimeout(3000,()=>{socket.destroy();reject(Error('timeout'))});socket.on('error',reject);socket.on('connect',()=>socket.write(JSON.stringify({token,command,value})+'\n'));socket.on('data',b=>data+=b.toString());socket.on('end',()=>{try{resolve(JSON.parse(data))}catch(e){reject(e)}})})
  assert.equal((await send('b'.repeat(64),'volume',20)).ok,false);assert.equal(volume,100);assert.equal((await send(d.token,'volume',45)).state.volume,45)
 }finally{dock.stop();await rm(dir,{recursive:true,force:true})}
})
