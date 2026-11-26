import {CrashLog} from '../runtime/crashes'
import {serveAgent,launchProcess,agentKey,agentPort,saveAgentPort} from './server'
type Options={directory:string;exe:string;args:string[];smoke:boolean;version?:string;catalogRoot?:string;fallbackRoot?:string}
let log:CrashLog|undefined
async function main(){
 const o:Options=JSON.parse(process.argv[2]??'null')
 if(!o||typeof o.directory!=='string'||typeof o.exe!=='string'||!Array.isArray(o.args)||o.args.some(x=>typeof x!=='string')||typeof o.smoke!=='boolean')throw Error('Invalid agent options')
 log=new CrashLog(o.directory,typeof o.version==='string'?o.version:'unknown','agent')
 process.on('uncaughtExceptionMonitor',e=>log?.write('uncaught-exception','',null,e.stack))
 const launch=()=>launchProcess(o.exe,o.args),port=o.smoke?0:agentPort(o.directory)
 let server
 try{server=await serveAgent(o.directory,launch,port,!o.smoke,o.catalogRoot,o.fallbackRoot)}catch(e){
  if(o.smoke||(e as NodeJS.ErrnoException).code!=='EADDRINUSE')throw e
  const existing=await fetch('http://127.0.0.1:'+port+'/api/status',{headers:{Authorization:'Bearer '+agentKey(o.directory)},signal:AbortSignal.timeout(1500),redirect:'error'}).catch(()=>null)
  if(existing?.ok){await existing.body?.cancel();return}
  await existing?.body?.cancel()
  server=await serveAgent(o.directory,launch,0,true,o.catalogRoot,o.fallbackRoot)
 }
 if(!o.smoke)try{saveAgentPort(o.directory,Number(new URL(server.url).port))}catch(e){server.close();throw e}
 if(o.smoke){
  try{const r=await fetch(server.url+'/api/status',{headers:{Authorization:'Bearer '+agentKey(o.directory)},signal:AbortSignal.timeout(3000)})
   if(!r.ok||(await r.json()).running!==false)throw Error('Agent smoke failed')
  }finally{server.close()}
 }else{
  process.once('SIGINT',()=>server.close());process.once('SIGTERM',()=>server.close())
 }
}
void main().catch(e=>{log?.write('agent-start-failed','',null,e instanceof Error?e.stack:undefined);process.exitCode=1})
