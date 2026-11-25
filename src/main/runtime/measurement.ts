import {appendFileSync,existsSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import type {MeasurementHeader,MeasurementSummary,MeasurementState,MetricSummary,Sample} from '../../shared/performance.ts'
const intervalMs=10000,maxSamples=8640,maxFile=8*1024*1024
type End={type:'end';at:number;status:'finished'|'limit'|'error'}
type Session={header:MeasurementHeader;samples:Sample[];end?:End}
export function metric(values:(number|null)[],weights?:number[]):MetricSummary{
 const v=values.filter((x):x is number=>typeof x==='number'&&Number.isFinite(x)).sort((a,b)=>a-b)
 const valid=values.map((value,i)=>({value,weight:weights?.[i]??1})).filter(x=>typeof x.value==='number'&&Number.isFinite(x.value)&&Number.isFinite(x.weight)&&x.weight>0),sum=valid.reduce((a,b)=>a+b.weight,0)
 return {mean:sum?valid.reduce((a,b)=>a+b.value!*b.weight,0)/sum:null,p95:v.length?v[Math.ceil(v.length*.95)-1]!:null,peak:v.at(-1)??null,count:v.length}
}
export function counterIncrease(values:(number|null)[]){let prev:number|null=null,sum=0,intervals=0;for(const n of values){if(typeof n!=='number'||!Number.isFinite(n)||n<0){prev=null;continue}if(prev!==null&&n>=prev){sum+=n-prev;intervals++}prev=n}return intervals?sum:null}
export function summarizeMeasurement(s:Session,active=false):MeasurementSummary{
 const a=s.samples,last=a.at(-1),first=a[0],gpu=new Map<number,number>();for(const x of a)if(x.gpuAt!==null&&Number.isFinite(x.gpuAt)&&x.gpu!==null&&Number.isFinite(x.gpu))gpu.set(x.gpuAt,x.gpu)
 return {...s.header,status:active?'running':s.end?.status??'interrupted',endedAt:s.end?.at??(active?null:last?.at??s.header.startedAt),samples:a.length,durationMs:Math.max(0,(s.end?.at??last?.at??s.header.startedAt)-s.header.startedAt),cpu:metric(a.map(x=>x.appCpu),a.map(x=>x.spanMs)),ram:metric(a.map(x=>x.appRamMB)),systemCpu:metric(a.map(x=>x.systemCpu),a.map(x=>x.spanMs)),systemRam:metric(a.map(x=>x.systemRamMB)),loop:metric(a.map(x=>x.eventLoop),a.map(x=>x.spanMs)),gpu:metric([...gpu.values()]),agentCpu:metric(a.map(x=>x.agentCpu)),agentRam:metric(a.map(x=>x.agentRamMB)),obsFps:metric(a.map(x=>x.obsFps)),obsCpu:metric(a.map(x=>x.obsCpu)),obsRam:metric(a.map(x=>x.obsRamMB)),timerLag:metric(a.map(x=>x.timerLateMs)),queuePeak:a.reduce((max,x)=>Math.max(max,x.queuePending),0),obsRenderDelta:counterIncrease(a.map(x=>x.obsRenderSkipped)),obsOutputDelta:counterIncrease(a.map(x=>x.obsOutputSkipped)),done:Math.max(0,(last?.done??0)-(first?.done??0)),failed:Math.max(0,(last?.failed??0)-(first?.failed??0)),suppressed:Math.max(0,(last?.suppressed??0)-(first?.suppressed??0)),retried:Math.max(0,(last?.retried??0)-(first?.retried??0))}
}
export function parseSession(raw:string):Session{
 const lines=raw.split('\n'),first=JSON.parse(lines.shift()??'null')
 if(first?.type!=='header'||!validId(first.data?.id)||typeof first.data.version!=='string'||!Number.isFinite(first.data.startedAt))throw Error('Invalid session')
 const s:Session={header:first.data,samples:[]}
 for(const line of lines){if(!line)continue;try{const row=JSON.parse(line);if(row.type==='sample'&&Number.isFinite(row.data?.at)&&s.samples.length<maxSamples)s.samples.push(row.data);else if(row.type==='end'&&['finished','limit','error'].includes(row.status)&&Number.isFinite(row.at))s.end=row}catch{/* partial final write after crash */}}
 return s
}
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)
export class Measurement{
 onFinish:()=>void=()=>{}
 private session?:Session
 private timer?:ReturnType<typeof setTimeout>
 private expected=0
 private stopped=false
 private cache=new Map<string,{mtime:number;summary:MeasurementSummary}>()
 private readonly directory:string
 private readonly makeHeader:()=>Omit<MeasurementHeader,'id'|'startedAt'|'intervalMs'>
 private readonly readSample:(late:number,reset:boolean)=>Sample
 private readonly now:()=>number
 constructor(directory:string,header:()=>Omit<MeasurementHeader,'id'|'startedAt'|'intervalMs'>,sample:(late:number,reset:boolean)=>Sample,now=Date.now){this.directory=directory;this.makeHeader=header;this.readSample=sample;this.now=now}
 private path(id:string){if(!validId(id))throw Error('Invalid measurement ID');return join(this.directory,id+'.jsonl')}
 private append(id:string,row:unknown){appendFileSync(this.path(id),JSON.stringify(row)+'\n',{mode:0o600})}
 private read(id:string){const p=this.path(id);if(statSync(p).size>maxFile)throw Error('Measurement too large');return parseSession(readFileSync(p,'utf8'))}
 start(){
  if(this.stopped||this.session)throw Error('Measurement already active or unavailable')
  mkdirSync(this.directory,{recursive:true});if(readdirSync(this.directory).filter(x=>x.endsWith('.jsonl')).length>=100)throw Error('Measurement storage full; archive old files')
  const header={...this.makeHeader(),id:randomUUID(),startedAt:this.now(),intervalMs}
  writeFileSync(this.path(header.id),JSON.stringify({type:'header',data:header})+'\n',{flag:'wx',mode:0o600})
  this.session={header,samples:[]}
  try{this.capture(true);this.schedule()}catch{this.finish('error',false);throw Error('Measurement initialization failed')}
  return this.state()
 }
 get active(){return !!this.session}
 private capture(reset=false){const s=this.session;if(!s)return;const data=this.readSample(reset?0:Math.max(0,this.now()-this.expected),reset);this.append(s.header.id,{type:'sample',data});s.samples.push(data)}
 private schedule(){if(!this.session||this.stopped)return;this.expected=this.now()+intervalMs;this.timer=setTimeout(()=>{try{this.capture();if(this.session&&(this.session.samples.length>=maxSamples||this.now()-this.session.header.startedAt>=86400000))this.finish('limit',false);else this.schedule()}catch{try{this.finish('error',false)}catch{/* disk unavailable */}}},intervalMs);this.timer.unref?.()}
 private finish(status:End['status'],sample=true){
  clearTimeout(this.timer);this.timer=undefined
  const s=this.session;if(!s)return
  if(sample&&s.samples.length<maxSamples){try{this.capture()}catch{status='error'}}
  try{this.append(s.header.id,{type:'end',status,at:this.now()})}finally{this.session=undefined;this.onFinish()}
 }
 stop(){this.finish('finished');return this.state()}
 shutdown(failed=false){this.stopped=true;try{this.finish(failed?'error':'finished',!failed)}catch{/* persisted samples remain recoverable */}}
 state():MeasurementState{
  const recent:MeasurementSummary[]=[]
  if(existsSync(this.directory)){
   const ids=readdirSync(this.directory).filter(x=>x.endsWith('.jsonl')&&validId(x.slice(0,-6))).map(x=>x.slice(0,-6)).filter(x=>x!==this.session?.header.id)
   const ordered=ids.map(id=>({id,at:statSync(this.path(id)).mtimeMs})).sort((a,b)=>b.at-a.at).slice(0,20)
   for(const {id,at} of ordered)try{const old=this.cache.get(id);if(old&&old.mtime===at)recent.push(old.summary);else{const summary=summarizeMeasurement(this.read(id));this.cache.set(id,{mtime:at,summary});recent.push(summary)}}catch{}
  }
  return {active:this.session?summarizeMeasurement(this.session,true):null,recent}
 }
 export(id:unknown,format:unknown){
  if(!validId(id)||format!=='json'&&format!=='csv')throw Error('Invalid export')
  const s=id===this.session?.header.id?this.session:this.read(id)
  if(format==='json')return JSON.stringify({summary:summarizeMeasurement(s,id===this.session?.header.id),samples:s.samples},null,2)
  const keys=['at','spanMs','mode','systemCpu','systemRamMB','appCpu','appRamMB','appProcesses','eventLoop','timerLateMs','gpu','gpuAt','agentCpu','agentRamMB','obsCpu','obsRamMB','obsFps','obsRenderSkipped','obsOutputSkipped','obsStreaming','obsRecording','queuePending','queuePlaying','done','failed','suppressed','retried','overlayClients','agentOnline','twitchPhase','obsPhase']
  return keys.join(',')+'\n'+s.samples.map(row=>keys.map(k=>{const v=row[k as keyof Sample];if(v==null)return '';if(typeof v==='number'||typeof v==='boolean')return String(v);return typeof v==='string'&&/^[a-zA-Z0-9_-]{1,32}$/.test(v)?v:''}).join(',')).join('\n')+'\n'
 }
}
