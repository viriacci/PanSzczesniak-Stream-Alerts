import {createHash,randomUUID} from 'node:crypto'
import type {ObsState,ObsMetrics} from '../../shared/obs.ts'
export function authentication(password:string,salt:string,challenge:string){
 const secret=createHash('sha256').update(password+salt).digest('base64')
 return createHash('sha256').update(secret+challenge).digest('base64')
}
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null
export function metrics(stats:any,stream:any,record:any):ObsMetrics{return {cpu:number(stats.cpuUsage),memory:number(stats.memoryUsage),fps:number(stats.activeFps),renderSkipped:number(stats.renderSkippedFrames),outputSkipped:number(stats.outputSkippedFrames),streaming:stream.outputActive===true,recording:record.outputActive===true,streamBytes:number(stream.outputBytes),streamMs:number(stream.outputDuration)}}
type Pending={resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}
export class ObsClient{
 private socket?:WebSocket
 private pending=new Map<string,Pending>()
 private reconnect?:ReturnType<typeof setTimeout>
 private deadline?:ReturnType<typeof setTimeout>
 private poll?:ReturnType<typeof setInterval>
 private config?:{port:number;password:string}
 private factory:(url:string)=>WebSocket
 private state:ObsState={phase:'offline',port:4455,configured:false,detail:'',scene:'',scenes:[],metrics:null}
 constructor(factory=(url:string)=>new WebSocket(url)){this.factory=factory}
 snapshot():ObsState{return {...this.state,scenes:[...this.state.scenes],metrics:this.state.metrics?{...this.state.metrics}:null}}
 connect(port:number,password:string){this.disconnect();this.config={port,password};this.state={...this.state,port,configured:true};this.open()}
 disconnect(){this.config=undefined;this.close();this.state={...this.state,phase:'offline',configured:false,detail:'',scene:'',scenes:[],metrics:null,sampledAt:undefined}}
 private close(){clearTimeout(this.reconnect);clearTimeout(this.deadline);clearInterval(this.poll);const s=this.socket;this.socket=undefined;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('OBS disconnected'))}this.pending.clear();try{s?.close()}catch{}}
 private lost(s:WebSocket,detail:string,retry=true){if(s!==this.socket)return;this.close();this.state={...this.state,phase:'error',detail,metrics:null,sampledAt:undefined,scene:'',scenes:[]};if(retry&&this.config)this.reconnect=setTimeout(()=>this.open(),5000)}
 private open(){
  const config=this.config;if(!config)return
  this.state={...this.state,phase:'connecting',detail:'Łączenie z OBS'}
  let s:WebSocket;try{s=this.factory('ws://127.0.0.1:'+config.port)}catch{this.state={...this.state,phase:'error',detail:'Nie można otworzyć WebSocket'};return}
  this.socket=s;this.deadline=setTimeout(()=>this.lost(s,'Timeout OBS'),8000)
  s.addEventListener('close',e=>this.lost(s,e.code===4009?'Błędne hasło OBS':'OBS rozłączony',e.code!==4009))
  s.addEventListener('error',()=>this.lost(s,'OBS niedostępny'))
  s.addEventListener('message',e=>{
   if(s!==this.socket||typeof e.data!=='string'||e.data.length>2_000_000)return
   let m:any;try{m=JSON.parse(e.data)}catch{return}
   if(!m||typeof m.d!=='object'||!m.d)return
   const d=m.d
   if(m.op===0&&this.state.phase==='connecting'){
    if(d.rpcVersion<1){this.lost(s,'Wymagany OBS WebSocket 5',false);return}
    const identify:Record<string,unknown>={rpcVersion:1,eventSubscriptions:0}
    if(d.authentication){if(typeof d.authentication.salt!=='string'||typeof d.authentication.challenge!=='string'){this.lost(s,'Nieprawidłowa autoryzacja',false);return}identify.authentication=authentication(config.password,d.authentication.salt,d.authentication.challenge)}
    try{s.send(JSON.stringify({op:1,d:identify}))}catch{this.lost(s,'Błąd identyfikacji')}
   }else if(m.op===2&&this.state.phase==='connecting'){
    clearTimeout(this.deadline);this.state={...this.state,phase:'connected',detail:'OBS WebSocket 5 aktywny'}
    const poll=()=>void this.refresh(s).catch(()=>{if(s===this.socket)this.lost(s,'Nie udało się pobrać stanu OBS')})
    poll();this.poll=setInterval(poll,5000)
   }else if(m.op===7&&typeof d.requestId==='string'){
    const p=this.pending.get(d.requestId);if(!p)return;this.pending.delete(d.requestId);clearTimeout(p.timer)
    if(d.requestStatus?.result===true)p.resolve(d.responseData??{})
    else p.reject(Error('OBS request failed: '+String(d.requestStatus?.code??'unknown')))
   }
  })
 }
 request(type:string,data:Record<string,unknown>={}):Promise<any>{
  const s=this.socket;if(!s||this.state.phase!=='connected'||this.pending.size>=32)return Promise.reject(Error('OBS not connected or busy'))
  const id=randomUUID()
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('OBS timeout'))},4000);this.pending.set(id,{resolve,reject,timer});try{s.send(JSON.stringify({op:6,d:{requestType:type,requestId:id,requestData:data}}))}catch{clearTimeout(timer);this.pending.delete(id);reject(Error('OBS send failed'))}})
 }
 private async refresh(s:WebSocket){
  const [stats,stream,record,scenes]=await Promise.all([this.request('GetStats'),this.request('GetStreamStatus'),this.request('GetRecordStatus'),this.request('GetSceneList')])
  if(s!==this.socket)return
  this.state={...this.state,metrics:metrics(stats,stream,record),sampledAt:Date.now(),scene:typeof scenes.currentProgramSceneName==='string'?scenes.currentProgramSceneName:'',scenes:Array.isArray(scenes.scenes)?scenes.scenes.map((x:any)=>x.sceneName).filter((x:unknown)=>typeof x==='string').slice(0,500):[]}
 }
 async setScene(name:string){if(!this.state.scenes.includes(name))throw Error('Unknown scene');await this.request('SetCurrentProgramScene',{sceneName:name})}
 async refreshOverlay(url:string){
  if(!url)throw Error('Overlay unavailable')
  const list=await this.request('GetInputList',{inputKind:'browser_source'})
  let count=0
  for(const input of (Array.isArray(list.inputs)?list.inputs:[]).slice(0,500)){
   if(typeof input.inputName!=='string')continue
   const settings=await this.request('GetInputSettings',{inputName:input.inputName})
   if(settings.inputSettings?.url!==url)continue
   await this.request('PressInputPropertiesButton',{inputName:input.inputName,propertyName:'refreshnocache'});count++
  }
  return count
 }
}
