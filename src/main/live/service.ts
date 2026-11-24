import {createHash,randomBytes} from 'node:crypto'
import type {DatabaseSync} from 'node:sqlite'
import type {Auth} from '../twitch/auth.ts'
import type {AlertEvent} from '../../shared/alerts.ts'
import type {ObsState} from '../../shared/obs.ts'
import {parseLiveAction,type LiveState,type Category} from '../../shared/live.ts'
import {observe,parseStream,recordEvent,recordObs,summarize} from './store.ts'

export function bitrateBetween(before:{at:number;bytes:number;duration:number},after:{at:number;bytes:number;duration:number}):number|null{
 const elapsed=after.at-before.at
 if(elapsed<=0||elapsed>15000||after.bytes<before.bytes||after.duration<before.duration)return null
 return Math.round((after.bytes-before.bytes)*8/elapsed)
}
function blank():LiveState{return {phase:'disconnected',channel:'',title:'',category:'',categoryId:'',startedAt:null,lastSampleAt:null,viewers:null,average:null,peak:null,samples:0,points:[],counts:null,detail:'',canManage:false,bitrate:null}}
type LiveAuth=Pick<Auth,'identity'|'helix'|'canManage'>
export class LiveService{
 private db:DatabaseSync
 private auth:LiveAuth
 private now:()=>number
 private current=blank()
 private id:number|null=null
 private generation=0
 private task?:Promise<void>
 private timer?:ReturnType<typeof setInterval>
 private stopped=false
 private salt:string
 private lastObs?:{at:number;bytes:number;duration:number}
 private lastObsAt=0
 private lastSummary=0
 private summaryDirty=false
 private pollAgain=false
 constructor(db:DatabaseSync,auth:LiveAuth,now=Date.now){
  this.db=db;this.auth=auth;this.now=now
  const row=db.prepare("SELECT value FROM settings WHERE key='live.chat.salt'").get()
  this.salt=typeof row?.value==='string'&&/^[a-f0-9]{64}$/.test(row.value)?row.value:randomBytes(32).toString('hex')
  db.prepare("INSERT INTO settings(key,value) VALUES ('live.chat.salt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(this.salt)
 }
 start(){if(this.timer)return;this.stopped=false;void this.poll();this.timer=setInterval(()=>void this.poll(),30000)}
 stop(){this.stopped=true;clearInterval(this.timer);this.timer=undefined;this.reset()}
 reset(){this.generation++;this.task=undefined;this.id=null;this.current=blank();this.lastObs=undefined;this.lastObsAt=0;this.lastSummary=0;this.summaryDirty=false;this.pollAgain=false}
 categoryId(){return this.current.phase==='live'?this.current.categoryId:''}
 snapshot():LiveState{
  if(this.id!==null&&this.summaryDirty&&this.now()-this.lastSummary>=5000){Object.assign(this.current,summarize(this.db,this.id));this.lastSummary=this.now();this.summaryDirty=false}
  return {...this.current,canManage:this.auth.canManage,points:[...this.current.points],counts:this.current.counts?{...this.current.counts}:null}
 }
 poll(force=false):Promise<void>{
  if(this.stopped)return Promise.resolve()
  if(this.task){if(force)this.pollAgain=true;return this.task}
  const identity=this.auth.identity
  if(!identity){this.reset();return Promise.resolve()}
  const g=this.generation,channel=identity.userId
  const valid=()=>!this.stopped&&g===this.generation&&this.auth.identity?.userId===channel
  const work=async()=>{
   try{
    const data=await this.auth.helix('streams?user_id='+encodeURIComponent(channel))
    if(!valid())return
    if(!Array.isArray(data?.data)||data.data.length>1||data.data.length===1&&(!data.data[0]||typeof data.data[0]!=='object'))throw Error('Invalid stream response')
    const at=this.now(),raw=data.data[0]
    if(raw&&raw.user_id!==channel)throw Error('Invalid stream channel')
    const stream=raw?parseStream(raw,at):null
    const previous=this.id
    this.id=observe(this.db,channel,stream,at)
    if(previous!==this.id){this.lastObs=undefined;this.lastObsAt=0}
    if(stream&&this.id!==null){
     this.current={...blank(),phase:'live',channel:identity.login,title:stream.title,category:stream.category,categoryId:stream.categoryId,startedAt:stream.startedAt,lastSampleAt:at,viewers:stream.viewers,...summarize(this.db,this.id),bitrate:previous===this.id?this.current.bitrate:null}
     this.lastSummary=at;this.summaryDirty=false
    }else{
     this.current={...blank(),phase:'offline',channel:identity.login,lastSampleAt:at,detail:'Kanał nie nadaje'}
     try{const result=await this.auth.helix('channels?broadcaster_id='+encodeURIComponent(channel));if(!valid())return;const info=result?.data?.[0];if(info?.broadcaster_id===channel){this.current.title=typeof info.title==='string'?info.title:'';this.current.category=typeof info.game_name==='string'?info.game_name:'';this.current.categoryId=typeof info.game_id==='string'?info.game_id:''}}catch{/* offline remains confirmed */}
    }
   }catch{if(valid()){this.current={...this.current,phase:'unknown',channel:identity.login,viewers:null,bitrate:null,detail:'Brak aktualnych danych Twitch; zapis nie jest uzupełniany zerami'};this.lastObs=undefined}}
  }
  const task=work();this.task=task
  void task.finally(()=>{if(this.task===task){this.task=undefined;if(this.pollAgain&&!this.stopped){this.pollAgain=false;void this.poll()}}})
  return task
 }
 event(id:string,type:string,raw:unknown,at:number,normalized?:AlertEvent){
  const identity=this.auth.identity;if(this.stopped||!identity||!raw||typeof raw!=='object'||!Number.isSafeInteger(at)||at>this.now()+60000)return
  const e=raw as Record<string,any>,channel=identity.userId
  if(type==='stream.online'||type==='stream.offline'){if(e.broadcaster_user_id===channel)void this.poll(true);return}
  if(type==='channel.chat.message'){
   if(e.broadcaster_user_id!==channel||typeof e.chatter_user_id!=='string'||!e.chatter_user_id)return
   if(e.source_broadcaster_user_id&&e.source_broadcaster_user_id!==channel)return
   const chatter=createHash('sha256').update(this.salt+':'+channel+':'+e.chatter_user_id).digest('hex')
   if(recordEvent(this.db,channel,{id,kind:'chat',at,chatter}))this.summaryDirty=true;return
  }
  if(!normalized)return
  const broadcaster=type==='channel.raid'?e.to_broadcaster_user_id:e.broadcaster_user_id
  if(broadcaster!==channel)return
  const cost=e.reward?.cost
  if(recordEvent(this.db,channel,{id,kind:normalized.kind,at,count:normalized.count,points:typeof cost==='number'&&Number.isSafeInteger(cost)&&cost>=0?cost:0}))this.summaryDirty=true
 }
 obs(state:ObsState){
  const m=state.metrics,at=state.sampledAt
  if(this.stopped||this.id===null||this.current.phase!=='live'||!m||!m.streaming||!at||at>this.now()+1000||at<(this.current.startedAt??0)||this.now()-at>15000||this.now()-(this.current.lastSampleAt??0)>90000){this.lastObs=undefined;this.current.bitrate=null;return}
  if(at<=this.lastObsAt)return
  this.lastObsAt=at
  let bitrate:number|null=null
  if(m.streamBytes!==null&&m.streamMs!==null){
   const next={at,bytes:m.streamBytes,duration:m.streamMs}
   if(this.lastObs)bitrate=bitrateBetween(this.lastObs,next)
   this.lastObs=next
  }else this.lastObs=undefined
  this.current.bitrate=bitrate;recordObs(this.db,this.id,at,m,bitrate)
 }
 async action(value:unknown):Promise<Category[]|null>{
  const action=parseLiveAction(value)
  if(action.type==='refresh'){await this.poll();if(this.current.phase==='unknown'||this.current.phase==='disconnected')throw Error('No fresh Twitch data');return null}
  const identity=this.auth.identity;if(!identity)throw Error('Twitch not connected')
  const g=this.generation,channel=identity.userId
  if(action.type==='search'){
   const result=await this.auth.helix('search/categories?first=20&query='+encodeURIComponent(action.query))
   if(g!==this.generation||this.auth.identity?.userId!==channel)throw Error('Session changed')
   return (Array.isArray(result?.data)?result.data:[]).filter((v:any)=>typeof v.id==='string'&&typeof v.name==='string').slice(0,20).map((v:any)=>({id:v.id,name:v.name}))
  }
  if(!this.auth.canManage)throw Error('Reconnect Twitch with broadcast permission')
  if(action.type==='update')await this.auth.helix('channels?broadcaster_id='+encodeURIComponent(channel),{title:action.title,game_id:action.categoryId},'PATCH')
  else {
   if(this.current.phase!=='live')throw Error('Stream not live')
   await this.auth.helix('streams/markers',{user_id:channel,description:action.description},'POST')
  }
  if(g!==this.generation||this.auth.identity?.userId!==channel)throw Error('Session changed')
  await this.poll(true);return null
 }
}
