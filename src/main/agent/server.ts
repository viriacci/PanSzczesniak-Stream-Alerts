import {createServer,type IncomingMessage,type ServerResponse} from 'node:http'
import {randomBytes,timingSafeEqual,randomUUID} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs'
import {join} from 'node:path'
import {spawn,execFile,type ChildProcess} from 'node:child_process'
export const AGENT_PORT=18767
export function agentKey(dir:string){
 mkdirSync(dir,{recursive:true});const path=join(dir,'agent.key')
 try{writeFileSync(path,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}
 const key=readFileSync(path,'utf8');if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid agent key');return key
}
export type DockCommand='start'|'stop'|'restart'|'refresh'|'auto-on'|'auto-off'
export class AgentController{
 private last=0
 private instance=''
 private pending?:{id:string;action:'stop'|'restart'|'refresh'}
 private closingInstance=''
 private restart=false
 private restartAfter=0
 private launchAt=0
 private child?:ChildProcess
 private failures:number[]=[]
 private desired=false
 autoLaunch=false
 detail=''
 private launch:()=>ChildProcess
 private now:()=>number
 constructor(launch:()=>ChildProcess,now=Date.now){this.launch=launch;this.now=now}
 running(){return this.last>0&&this.now()-this.last<8000}
 state(){return {running:this.running(),autoLaunch:this.autoLaunch,detail:this.detail,starting:this.launchAt>0&&this.now()-this.launchAt<12000}}
 heartbeat(instance:string){
  if(instance===this.closingInstance)return null
  if(this.instance!==instance){if(this.running())throw Error('Another instance is active');this.instance=instance;this.pending=undefined;this.restart=false}
  this.last=this.now();this.launchAt=0
  return this.pending??null
 }
 ack(instance:string,id:string){if(instance!==this.instance||this.pending?.id!==id||this.pending.action!=='refresh')return false;this.pending=undefined;return true}
 closing(instance:string){if(instance===this.instance&&instance!==this.closingInstance){this.closingInstance=instance;this.pending=undefined;this.last=0;this.restartAfter=this.now()+3000;if(!this.restart)this.desired=false}}
 private start(){
  if(this.running()||this.child||this.state().starting||this.now()<this.restartAfter)return
  const now=this.now();this.failures=this.failures.filter(t=>now-t<60000)
  if(this.failures.length>=3){this.detail='Limit restartów po awarii';this.desired=false;return}
  this.launchAt=now;this.desired=true;this.detail='Uruchamianie PSSA'
  try{
   const child=this.launch();this.child=child
   const exited=(failed:boolean)=>{if(this.child!==child)return;this.child=undefined;this.last=0;this.launchAt=0
    if(failed&&this.desired){this.failures.push(this.now());this.restart=true;this.restartAfter=this.now()+3000;this.detail='PSSA zakończyło się błędem'}else if(!this.restart)this.desired=false
   }
   child.once('error',()=>exited(true));child.once('exit',code=>exited(code!==0))
  }catch{this.launchAt=0;this.desired=false;this.detail='Nie udało się uruchomić PSSA'}
 }
 command(cmd:DockCommand){
  if(cmd==='auto-on'||cmd==='auto-off'){this.autoLaunch=cmd==='auto-on';return}
  if(cmd==='start'){if(!this.running()&&!this.child&&!this.state().starting)this.failures=[];this.start();return}
  if(cmd==='stop'){this.desired=false;this.restart=false;if(this.running())this.pending={id:randomUUID(),action:'stop'};this.detail='Zamykanie PSSA';return}
  if(cmd==='restart'){this.failures=[];if(this.running()){this.pending={id:randomUUID(),action:'restart'};this.restart=true;this.restartAfter=this.now()+3000;this.desired=false;this.detail='Restart PSSA'}else this.start();return}
  if(cmd==='refresh'&&this.running()){if(this.pending?.action!=='stop'&&this.pending?.action!=='restart')this.pending={id:randomUUID(),action:'refresh'};return}
  throw Error('PSSA nie działa')
 }
 tick(){if(this.restart&&!this.running()&&!this.child&&this.now()>=this.restartAfter){this.restart=false;this.start()}}
 obsStarted(){if(this.autoLaunch)this.start()}
}
const html=`<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PSSA Control</title><style>body{background:#101012;color:#f2f2f2;font:14px system-ui;margin:14px}h1{color:#e3c048;font-size:18px}button{background:#242428;color:#eee;border:1px solid #555;border-radius:5px;padding:9px;margin:3px;cursor:pointer}button:disabled{opacity:.4}#state{color:#e3c048}p{line-height:1.5}</style><h1>PSSA Control</h1><p id="state">Łączenie…</p><div id="actions"><button data-cmd="start">Uruchom</button><button data-cmd="stop">Zamknij</button><button data-cmd="restart">Restart</button><button data-cmd="refresh">Odśwież nakładkę</button></div><p id="notice" role="status"></p><script src="/dock.js"></script></html>`
const js=`const key=location.hash.slice(1);const state=document.getElementById('state'),notice=document.getElementById('notice');const buttons=[...document.querySelectorAll('button')];let busy=false,polling=false;async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Agent niedostępny lub brak uprawnień');return r.json()}async function poll(){if(polling)return;polling=true;try{const s=await api('/api/status');state.textContent=s.running?'PSSA aktywne':s.starting?'Uruchamianie…':'PSSA wyłączone';notice.textContent=s.detail||'';for(const b of buttons)b.disabled=busy||(b.dataset.cmd==='start'?(s.running||s.starting):!s.running)}catch{state.textContent='Agent niedostępny lub błędny klucz';buttons.forEach(b=>b.disabled=true)}finally{polling=false}}buttons.forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;buttons.forEach(x=>x.disabled=true);try{await api('/api/command',{command:b.dataset.cmd})}catch(e){notice.textContent=e.message}finally{busy=false;await poll()}});poll();setInterval(poll,2000);`
async function body(req:IncomingMessage){let raw='';for await(const c of req){raw+=String(c);if(raw.length>2048)throw Error('Request too large')}return JSON.parse(raw)}
function reply(res:ServerResponse,code:number,data:unknown){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data))}
export async function serveAgent(dir:string,launch:()=>ChildProcess,port=AGENT_PORT,watchObs=true){
 const key=agentKey(dir),controller=new AgentController(launch),settings=join(dir,'agent-settings.json')
 try{controller.autoLaunch=JSON.parse(readFileSync(settings,'utf8')).autoLaunch===true}catch{}
 let bound=port,obs=false,checking=false,lastCheck=0
 const server=createServer({headersTimeout:5000,requestTimeout:8000},(req,res)=>{void (async()=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer')
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'")
  const origin='http://127.0.0.1:'+bound
  if(req.headers.host!=='127.0.0.1:'+bound){reply(res,403,{});return}
  if(req.method==='GET'&&(req.url==='/dock'||req.url==='/dock.js')){res.writeHead(200,{'Content-Type':req.url==='/dock'?'text/html; charset=utf-8':'application/javascript'});res.end(req.url==='/dock'?html:js);return}
  const supplied=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+key)
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){reply(res,401,{});return}
  if(req.headers.origin&&req.headers.origin!==origin){reply(res,403,{});return}
  if(req.method==='GET'&&req.url==='/api/status'){reply(res,200,controller.state());return}
  if(req.method!=='POST'||req.headers['content-type']!=='application/json'){reply(res,405,{});return}
  const input=await body(req)
  if(req.url==='/api/heartbeat'||req.url==='/api/closing'||req.url==='/api/ack'){
   if(typeof input.instance!=='string'||!/^[a-f0-9-]{36}$/.test(input.instance)){reply(res,400,{});return}
   if(req.headers.origin){reply(res,403,{});return}
   if(req.url==='/api/closing'){controller.closing(input.instance);reply(res,200,{});return}
   if(req.url==='/api/ack'){if(typeof input.id!=='string'||!controller.ack(input.instance,input.id)){reply(res,409,{});return}reply(res,200,{});return}
   const command=controller.heartbeat(input.instance);reply(res,200,{command,...controller.state()});return
  }
  if(req.url==='/api/command'){
   if(!['start','stop','restart','refresh','auto-on','auto-off'].includes(input.command)){reply(res,400,{});return}
   controller.command(input.command)
   if(input.command==='auto-on'||input.command==='auto-off'){writeFileSync(settings+'.tmp',JSON.stringify({autoLaunch:controller.autoLaunch}));renameSync(settings+'.tmp',settings)}
   reply(res,200,controller.state());return
  }
  reply(res,404,{})
 })().catch(()=>{if(!res.headersSent)reply(res,400,{error:'Invalid request'});else res.end()})})
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);const a=server.address();if(a&&typeof a!=='string')bound=a.port;resolve()})})
 const timer=setInterval(()=>{controller.tick();if(!watchObs||process.platform!=='win32'||!controller.autoLaunch||checking||Date.now()-lastCheck<15000)return
  lastCheck=Date.now();checking=true;execFile(join(process.env.SystemRoot||'C:\\Windows','System32','tasklist.exe'),['/FI','IMAGENAME eq obs64.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:5000},(error,stdout)=>{checking=false;if(error)return;const active=/"obs64\.exe"/i.test(stdout);if(active&&!obs)controller.obsStarted();obs=active})
 },2000)
 return {url:'http://127.0.0.1:'+bound,dock:'http://127.0.0.1:'+bound+'/dock#'+key,close:()=>{clearInterval(timer);server.close();server.closeAllConnections()}}
}
export function launchProcess(exe:string,args:string[]){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;return spawn(exe,args,{env,detached:true,stdio:'ignore',windowsHide:true})}
