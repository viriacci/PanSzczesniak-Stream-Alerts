import {CrashLog} from '../runtime/crashes'
import {serveAgent,launchProcess,agentKey} from './server'
type Options={directory:string;exe:string;args:string[];smoke:boolean;version?:string}
let log:CrashLog|undefined
async function main(){
 const o:Options=JSON.parse(process.argv[2]??'null')
 if(!o||typeof o.directory!=='string'||typeof o.exe!=='string'||!Array.isArray(o.args)||o.args.some(x=>typeof x!=='string')||typeof o.smoke!=='boolean')throw Error('Invalid agent options')
 log=new CrashLog(o.directory,typeof o.version==='string'?o.version:'unknown','agent')
 process.on('uncaughtExceptionMonitor',e=>log?.write('uncaught-exception','',null,e.stack))
 const server=await serveAgent(o.directory,()=>launchProcess(o.exe,o.args),o.smoke?0:undefined,!o.smoke)
 if(o.smoke){
  try{const r=await fetch(server.url+'/api/status',{headers:{Authorization:'Bearer '+agentKey(o.directory)},signal:AbortSignal.timeout(3000)})
   if(!r.ok||(await r.json()).running!==false)throw Error('Agent smoke failed')
  }finally{server.close()}
 }else{
  process.once('SIGINT',()=>server.close());process.once('SIGTERM',()=>server.close())
 }
}
void main().catch(e=>{log?.write('agent-start-failed','',null,e instanceof Error?e.stack:undefined);process.exitCode=1})
