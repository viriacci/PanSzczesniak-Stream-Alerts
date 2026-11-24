import {Worker} from 'node:worker_threads'
import {join} from 'node:path'
import type {ReadTask} from './read-worker'
export class ReadJobs{
 private active?:{worker:Worker;cancel:()=>void}
 private stopped=false
 constructor(private path:string,private bundleDirectory:string){}
 run<T>(task:ReadTask):Promise<T>{
  if(this.stopped||this.active)return Promise.reject(Error('Another report is active'))
  const entry=join(this.bundleDirectory.replace(/app\.asar(?=[\\/])/,'app.asar.unpacked'),'read-worker.js')
  return new Promise<T>((resolve,reject)=>{
   const worker=new Worker(entry,{workerData:{path:this.path,task},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:32}})
   let settled=false
   const finish=(error?:Error,value?:T)=>{if(settled)return;settled=true;clearTimeout(timer);if(this.active?.worker===worker)this.active=undefined;void worker.terminate().catch(()=>{});error?reject(error):resolve(value as T)}
   const timer=setTimeout(()=>finish(Error('Read task timeout')),60000)
   this.active={worker,cancel:()=>finish(Error('Read task cancelled'))}
   worker.once('message',m=>{if(m?.ok===true)finish(undefined,m.result as T);else finish(Error('Read task failed'))})
   worker.once('error',()=>finish(Error('Read task failed')))
   worker.once('exit',()=>finish(Error('Read task exited')))
  })
 }
 stop(){this.stopped=true;this.active?.cancel()}
}
