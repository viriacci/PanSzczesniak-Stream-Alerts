import {app} from 'electron'
import {randomUUID} from 'node:crypto'
import {agentKey,AGENT_PORT,launchProcess} from './server'
import type {AgentAction,AgentState} from '../../shared/obs'
export class AgentBridge{
 private key:string
 private instance=randomUUID()
 private timer?:ReturnType<typeof setInterval>
 private busy=false
 private stopped=false
 private lastRefresh=''
 private state:AgentState={online:false,running:false,dockUrl:'',autoLaunch:false,startup:false,detail:''}
 constructor(private directory:string,private refresh:()=>Promise<number>){this.key=agentKey(directory)}
 private args(){return app.isPackaged?['--pssa-agent']:[app.getAppPath(),'--pssa-agent']}
 private async api(path:string,body?:unknown){
  const r=await fetch('http://127.0.0.1:'+AGENT_PORT+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(1500),redirect:'error'})
  if(!r.ok)throw Error('Agent unavailable');return r.json()
 }
 private async poll(){
  if(this.busy||this.stopped)return;this.busy=true
  try{
   const h=await this.api('/api/heartbeat',{instance:this.instance})
   if(this.stopped)return
   const cmd=h.command
   if(cmd?.action==='stop'||cmd?.action==='restart'){await this.api('/api/closing',{instance:this.instance});if(!this.stopped)app.quit();return}
   if(cmd?.action==='refresh'&&typeof cmd.id==='string'){
    if(this.lastRefresh!==cmd.id){await this.refresh();this.lastRefresh=cmd.id}
    await this.api('/api/ack',{instance:this.instance,id:cmd.id})
   }
   const s=await this.api('/api/status')
   if(this.stopped)return
   this.state={...this.state,online:true,running:s.running===true,autoLaunch:s.autoLaunch===true,dockUrl:'http://127.0.0.1:'+AGENT_PORT+'/dock#'+this.key,detail:typeof s.detail==='string'?s.detail:''}
  }catch{this.state={...this.state,online:false,running:false,detail:'Agent nieaktywny'}}
  finally{this.busy=false}
 }
 start(){void this.poll();this.timer=setInterval(()=>void this.poll(),2000)}
 stop(){this.stopped=true;clearInterval(this.timer);void this.api('/api/closing',{instance:this.instance}).catch(()=>{})}
 snapshot(){return {...this.state,startup:app.isPackaged&&process.platform==='win32'&&app.getLoginItemSettings({path:process.execPath,args:this.args()}).openAtLogin}}
 async action(cmd:AgentAction){
  if(cmd==='enable'){if(!this.state.online){const child=launchProcess(process.execPath,this.args());child.on('error',()=>{this.state.detail='Nie udało się uruchomić Agenta'});child.unref()}return}
  if(cmd==='startup-on'||cmd==='startup-off'){
   if(!app.isPackaged||process.platform!=='win32')throw Error('Startup requires installed Windows app')
   app.setLoginItemSettings({openAtLogin:cmd==='startup-on',path:process.execPath,args:this.args()});return
  }
  if(cmd==='auto-on'||cmd==='auto-off'){await this.api('/api/command',{command:cmd});return}
  throw Error('Invalid agent action')
 }
}
