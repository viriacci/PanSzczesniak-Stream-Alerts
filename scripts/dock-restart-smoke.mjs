import {spawn} from 'node:child_process'
import {createConnection} from 'node:net'
import {readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import assert from 'node:assert/strict'

if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true')throw Error('Run only on disposable Windows CI')
const exe=resolve(process.argv[2])
const descriptor=join(process.env.APPDATA,'PSSA 2 Dev','obs-dock.json')
async function read(){try{return JSON.parse(await readFile(descriptor,'utf8'))}catch{return null}}
function send(d,command,value){
 return new Promise((resolve,reject)=>{
  const s=createConnection('\\\\.\\pipe\\'+d.pipe);let data=''
  s.setTimeout(2000,()=>s.destroy(Error('pipe timeout')))
  s.on('error',reject);s.on('connect',()=>s.write(JSON.stringify({token:d.token,command,value})+'\n'))
  s.on('data',b=>data+=b.toString());s.on('end',()=>{try{resolve(JSON.parse(data))}catch(e){reject(e)}})
 })
}
async function until(fn,label,ms=35000){
 const end=Date.now()+ms
 while(Date.now()<end){try{const result=await fn();if(result)return result}catch{}await delay(250)}
 throw Error(label+' timeout')
}
async function ready(oldToken){
 return until(async()=>{const d=await read();if(!d||d.token===oldToken||d.exe.toLowerCase()!==exe.toLowerCase())return null;const reply=await send(d,'status');return reply.ok&&reply.state.version==='2.0.0-rc.15'?d:null},'new instance')
}
function alive(pid){try{process.kill(pid,0);return true}catch{return false}}
const old=await read()
const child=spawn(exe,['--pssa-background'],{windowsHide:true,stdio:'ignore'})
let current
try{
 current=await ready(old?.token);const first=current
 assert.equal(first.pid,child.pid)
 const before=await send(first,'volume',47);assert.equal(before.state.volume,47)
 assert.equal((await send(first,'restart')).ok,true)
 current=await ready(first.token)
 assert.notEqual(current.pid,first.pid);assert.notEqual(current.token,first.token)
 await until(()=>!alive(first.pid),'old process exit')
 const status=await send(current,'status');assert.equal(status.state.volume,47);assert.equal(status.state.overlayUrl,before.state.overlayUrl);assert.ok(status.state.overlayUrl)
 assert.equal((await send(current,'volume',100)).state.volume,100)
 assert.equal((await send(current,'quit')).ok,true)
 await until(()=>!alive(current.pid),'new process exit')
 console.log('Real background restart, fresh authenticated pipe, persistent overlay URL and volume verified.')
}finally{
 const d=await read();if(d?.exe?.toLowerCase()===exe.toLowerCase())try{await send(d,'quit')}catch{}
 if(child.exitCode===null)await delay(1500)
 if(child.exitCode===null)child.kill()
}
