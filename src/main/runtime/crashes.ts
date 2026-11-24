import {appendFileSync,existsSync,readFileSync,renameSync,rmSync,statSync} from 'node:fs'
import {join} from 'node:path'
import type {CrashEntry} from '../../shared/performance.ts'
export function safeFrames(stack:unknown){
 if(typeof stack!=='string')return []
 return stack.slice(0,8192).split('\n').slice(1,21).flatMap(line=>{
  const m=/([A-Za-z0-9_.-]{1,120}\.(?:js|mjs|cjs|ts|tsx)):(\d{1,8}):(\d{1,8})\)?\s*$/.exec(line)
  return m?[m[1]+':'+m[2]+':'+m[3]]:[]
 })
}
export class CrashLog{
 private file:string
 private version:string
 private role:string
 constructor(directory:string,version:string,role:string){this.file=join(directory,role==='agent'?'agent-crashes.jsonl':'crashes.jsonl');this.version=version;this.role=role}
 write(event:string,reason='',exitCode:number|null=null,stack?:unknown){
  try{
   if(existsSync(this.file)&&statSync(this.file).size>1024*1024){rmSync(this.file+'.previous',{force:true});renameSync(this.file,this.file+'.previous')}
   const safe=(v:string)=>/^[a-zA-Z0-9_-]{0,64}$/.test(v)?v:'unknown'
   const data:CrashEntry={at:new Date().toISOString(),version:this.version,process:this.role,event:safe(event),reason:safe(reason),exitCode:Number.isSafeInteger(exitCode)?exitCode:null,frames:safeFrames(stack)}
   appendFileSync(this.file,JSON.stringify(data)+'\n',{mode:0o600})
  }catch{/* crash logging must not cause another crash */}
 }
 recent():CrashEntry[]{
  const data:CrashEntry[]=[]
  for(const p of [this.file+'.previous',this.file]){try{if(statSync(p).size>2*1024*1024)continue;for(const line of readFileSync(p,'utf8').split('\n'))try{const r=JSON.parse(line);if(r&&typeof r.event==='string'&&typeof r.at==='string')data.push(r)}catch{}}catch{}}
  return data.slice(-100).reverse()
 }
}
