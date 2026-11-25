import {themes} from '../src/shared/themes.ts'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readdirSync,readFileSync,appendFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Measurement,metric,counterIncrease,parseSession,summarizeMeasurement} from '../src/main/runtime/measurement.ts'
import {cpuDelta,appCpuDelta} from '../src/main/runtime/counters.ts'
import {CrashLog,safeFrames} from '../src/main/runtime/crashes.ts'
import {parseRuntime,defaults} from '../src/shared/runtime.ts'
import type {Sample} from '../src/shared/performance.ts'
test('themes migrate old preferences and reject arbitrary theme IDs',()=>{
 const {theme,...old}=defaults
 assert.equal(parseRuntime(old).theme,'pssa')
 assert.equal(parseRuntime({...old,theme:'vivionyx'}).theme,'vivionyx')
 assert.deepEqual(themes.vivionyx.colors,['#141414','#843935','#ae9278'])
 assert.equal(parseRuntime({...old,theme:'shiroe'}).theme,'shiroe')
 assert.throws(()=>parseRuntime({...old,theme:'<script>'}))
})
test('CPU delta uses actual counters, unavailable intervals remain null',()=>{
 assert.equal(cpuDelta(undefined,{idle:40,total:100}),null)
 assert.ok(Math.abs(cpuDelta({idle:0,total:0},{idle:80,total:100})!-20)<1e-9)
 const p={pid:1,creationTime:0,cpu:{cumulativeCPUUsage:3},memory:{workingSetSize:1024}}
 assert.equal(appCpuDelta(new Map([['1:0',1]]),[p],10,4),5)
 assert.equal(appCpuDelta(new Map([['1:0',1]]),[],10,4),null)
})
function sample(at:number,reset:boolean):Sample{return {at,spanMs:reset?0:10000,mode:'background',systemCpu:reset?null:25,systemRamMB:8000,appCpu:reset?null:0.2,appRamMB:120,appProcesses:2,eventLoop:reset?null:1,timerLateMs:0,gpu:40,gpuAt:1,agentCpu:null,agentRamMB:null,obsCpu:2,obsRamMB:400,obsFps:60,obsRenderSkipped:0,obsOutputSkipped:0,obsStreaming:true,obsRecording:false,queuePending:0,queuePlaying:false,done:reset?0:3,failed:0,suppressed:0,retried:0,overlayClients:1,agentOnline:false,twitchPhase:'connected',obsPhase:'connected'}}
test('measurement opt in, persistence, summary, comparison data and interrupted recovery',()=>{
 const root=mkdtempSync(join(tmpdir(),'pssa-measurement-'));let at=1000,finished=0
 const header=()=>({version:'2.0.0-rc.3',cores:4,ramMB:16000,platform:'win32',arch:'x64',gpuEnabled:true})
 const m=new Measurement(root,header,(_late,reset)=>sample(at,reset),()=>at)
 m.onFinish=()=>finished++
 try{assert.equal(m.state().active,null);assert.equal(readdirSync(root).length,0)
  const a=m.start().active!;assert.equal(a.samples,1);assert.equal(a.cpu.mean,null);assert.throws(()=>m.start())
  at+=10000;const s=m.stop().recent[0]!;assert.equal(s.status,'finished');assert.equal(s.samples,2);assert.equal(s.done,3);assert.equal(s.cpu.mean,.2);assert.equal(s.gpu.count,1);assert.equal(finished,1)
  assert.match(m.export(s.id,'csv'),/appCpu/);assert.equal(JSON.parse(m.export(s.id,'json')).samples.length,2);assert.throws(()=>m.export('../x','json'))
  const file=join(root,s.id+'.jsonl'),lines=readFileSync(file,'utf8').trimEnd().split('\n')
  const recovered=parseSession(lines.slice(0,-1).join('\n')+'\n{"type":')
  assert.equal(summarizeMeasurement(recovered).status,'interrupted')
  assert.equal(metric([null,2,4]).mean,3);assert.equal(metric([null]).peak,null);assert.equal(metric([10,20],[1,3]).mean,17.5);assert.equal(counterIncrease([null,10,13,2,5,null,100,101]),7);assert.equal(counterIncrease([null,10]),null)
 }finally{m.shutdown();rmSync(root,{recursive:true,force:true})}
})
test('crash logs exclude error text and private paths',()=>{
 const root=mkdtempSync(join(tmpdir(),'pssa-crash-'))
 try{const c=new CrashLog(root,'2.0.0-rc.3','main')
  const stack='Error: secret TOKEN\n    at fn (C:\\Users\\Private\\index.js:23:4)\n    at fn (C:\\private\\other.ts:1:9)'
  assert.deepEqual(safeFrames(stack),['index.js:23:4','other.ts:1:9'])
  c.write('uncaught-exception','',null,stack);const text=readFileSync(join(root,'crashes.jsonl'),'utf8');assert.ok(!text.includes('TOKEN'));assert.ok(!text.includes('Private'));assert.equal(c.recent()[0]?.frames.length,2)
 }finally{rmSync(root,{recursive:true,force:true})}
})
