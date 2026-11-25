import {cpus,freemem,totalmem,availableParallelism} from 'node:os'
import {performance} from 'node:perf_hooks'
export interface CpuPoint {idle:number;total:number}
export function systemPoint():CpuPoint{let idle=0,total=0;for(const c of cpus()){idle+=c.times.idle;total+=Object.values(c.times).reduce((a,b)=>a+b,0)}return {idle,total}}
export function cpuDelta(before:CpuPoint|undefined,after:CpuPoint){if(!before||after.total<=before.total)return null;return Math.max(0,Math.min(100,100*(1-(after.idle-before.idle)/(after.total-before.total))))}
type ProcessPoint={pid:number;creationTime:number;cpu:{cumulativeCPUUsage?:number};memory:{workingSetSize:number}}
export function appCpuDelta(before:Map<string,number>,after:ProcessPoint[],seconds:number,cores:number){if(seconds<=0||!before.size||after.some(p=>p.cpu.cumulativeCPUUsage===undefined)||[...before.keys()].some(key=>!after.some(p=>p.pid+':'+p.creationTime===key)))return null;let used=0;for(const p of after){const old=before.get(p.pid+':'+p.creationTime);if(old!==undefined)used+=Math.max(0,p.cpu.cumulativeCPUUsage!-old);else if(Date.now()-p.creationTime<=seconds*1000)used+=p.cpu.cumulativeCPUUsage!}return Math.max(0,Math.min(100,100*used/(seconds*cores)))}
export function makeSampler(metrics:()=>ProcessPoint[]){
 let prev:CpuPoint|undefined,points=new Map<string,number>(),at=0,elu=performance.eventLoopUtilization()
 const cores=cpus().length||availableParallelism()
 return (reset:boolean)=>{
  const now=performance.now(),system=systemPoint(),p=metrics(),current=performance.eventLoopUtilization(),span=now-at
  const value={spanMs:reset?0:Math.round(span),systemCpu:reset?null:cpuDelta(prev,system),systemRamMB:Math.round((totalmem()-freemem())/1048576),appCpu:reset?null:appCpuDelta(points,p,span/1000,cores),appRamMB:Math.round(p.reduce((a,b)=>a+b.memory.workingSetSize,0)/1024),appProcesses:p.length,eventLoop:reset?null:100*performance.eventLoopUtilization(current,elu).utilization}
  prev=system;at=now;elu=current;points=new Map(p.filter(x=>x.cpu.cumulativeCPUUsage!==undefined).map(x=>[x.pid+':'+x.creationTime,x.cpu.cumulativeCPUUsage!]))
  return value
 }
}
