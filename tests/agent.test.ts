import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import type {ChildProcess} from 'node:child_process'
import {mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {AgentController,serveAgent,agentPort,saveAgentPort,AGENT_PORT} from '../src/main/agent/server.ts'
const child=()=>new EventEmitter() as unknown as ChildProcess
test('agent starts, gracefully restarts and rate limits crashed children',()=>{
 let time=100000;const children:ChildProcess[]=[]
 const a=new AgentController(()=>{const c=child();children.push(c);return c},()=>time)
 a.command('start');assert.equal(children.length,1)
 a.heartbeat('a');a.command('restart');assert.equal(a.heartbeat('a')?.action,'restart')
 a.closing('a');children[0]!.emit('exit',0);a.tick();assert.equal(children.length,1)
 time+=3000;a.tick();assert.equal(children.length,2)
 for(let i=0;i<3;i++){children.at(-1)!.emit('exit',1);time+=3000;a.tick()}
 assert.equal(children.length,4);assert.match(a.detail,/Limit/)
})
test('agent dock HTTP authentication and command delivery',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pssa-agent-'));let launches=0
 const agent=await serveAgent(dir,()=>{launches++;return child()},0,false)
 const key=agent.dock.split('#')[1]!,instance='a'.repeat(36)
 const api=(path:string,body?:unknown,origin?:string)=>fetch(agent.url+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined})
 try{
  assert.equal((await fetch(agent.url+'/dock')).status,200)
  assert.equal((await fetch(agent.url+'/api/status')).status,401)
  assert.equal((await api('/api/command',{command:'start'},'https://example.org')).status,403)
  assert.equal(launches,0)
  assert.equal((await api('/api/heartbeat',{instance})).status,200)
  assert.equal((await api('/api/command',{command:'refresh'},agent.url)).status,200)
  const result=await (await api('/api/heartbeat',{instance})).json()
  assert.equal(result.command.action,'refresh');assert.equal((await (await api('/api/heartbeat',{instance})).json()).command.id,result.command.id);assert.equal((await api('/api/ack',{instance,id:result.command.id})).status,200);assert.equal((await (await api('/api/heartbeat',{instance})).json()).command,null)
  assert.equal((await api('/api/command',{command:'stop'},agent.url)).status,200)
  assert.equal((await (await api('/api/heartbeat',{instance})).json()).command.action,'stop')
 }finally{agent.close();await rm(dir,{recursive:true,force:true})}
})

test('agent retains commands until acknowledgment and ignores stale closing heartbeats',()=>{
 let time=100000;const a=new AgentController(()=>child(),()=>time)
 a.heartbeat('old');a.command('refresh')
 const cmd=a.heartbeat('old')!
 assert.deepEqual(a.heartbeat('old'),cmd)
 assert.equal(a.ack('old','wrong'),false)
 assert.equal(a.ack('old',cmd.id),true)
 assert.equal(a.heartbeat('old'),null)
 a.command('restart');assert.equal(a.heartbeat('old')?.action,'restart')
 a.closing('old');assert.equal(a.heartbeat('old'),null);assert.equal(a.running(),false)
 time+=3000;a.heartbeat('new');a.closing('old');assert.equal(a.running(),true)
})

test('each Windows profile keeps an independent agent port descriptor',async()=>{
 const a=await mkdtemp(join(tmpdir(),'pssa-agent-a-')),b=await mkdtemp(join(tmpdir(),'pssa-agent-b-'))
 try{assert.equal(agentPort(a),AGENT_PORT);saveAgentPort(a,19201);saveAgentPort(b,19202);assert.equal(agentPort(a),19201);assert.equal(agentPort(b),19202);saveAgentPort(a,19203);assert.equal(agentPort(a),19203)}finally{await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true})}
})
