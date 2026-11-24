import {LiveService} from '../live/service'
import type {ObsState} from '../../shared/obs'
import { dialog, safeStorage, shell, type BrowserWindow } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { randomBytes,randomUUID } from 'node:crypto'
import { Auth } from '../twitch/auth'
import { EventSub } from '../twitch/eventsub'
import { AlertQueue } from './queue'
import { Overlay } from '../overlay/server'
import { rules,saveRule,saveRules } from './store'
import { copyMedia,imageExt,audioExt,videoExt } from './media'
import { importLegacy } from './import'
import { defaultRule,type AlertState,type AlertEvent,type TwitchState,type Reward,type AlertRule } from '../../shared/alerts'
export class AlertsService {
 private auth:Auth
 private live:LiveService
 private events:EventSub
 private overlay:Overlay
 private queue:AlertQueue
 private ticker?:ReturnType<typeof setInterval>
 private phase:TwitchState['phase']='disconnected'
 private detail=''
 private rewards:Reward[]=[]
 private media:string
 private dialogBusy=false
 private stopped=false
 private generation=0
 private validation?:ReturnType<typeof setInterval>
 constructor(private db:DatabaseSync,dir:string,private window:BrowserWindow,private documents:string){
  this.media=join(dir,'media');this.auth=new Auth(db,{storage:safeStorage,openExternal:url=>shell.openExternal(url),request:fetch});this.live=new LiveService(db,this.auth);this.overlay=new Overlay(this.media);this.queue=new AlertQueue(db,this.overlay);this.overlay.onAck=(id,result)=>this.queue.acknowledge(id,result)
  this.events=new EventSub(this.auth,(phase,detail)=>{this.phase=phase;this.detail=detail},e=>this.dispatch(e),undefined,(id,type,event,at,normalized)=>{try{this.live.event(id,type,event,at,normalized)}catch{this.detail='Błąd zapisu statystyk'}})
 }
 async start(auto=true){
  const raw=this.db.prepare("SELECT value FROM settings WHERE key='overlay.key'").get()?.value
  const key=typeof raw==='string'&&/^[a-f0-9]{64}$/.test(raw)?raw:randomBytes(32).toString('hex')
  this.db.prepare("INSERT INTO settings(key,value) VALUES ('overlay.key',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key)
  try{await this.overlay.start(key)}catch{this.detail='Port overlay 18766 zajęty'}
  if(auto){try{if(this.auth.load())void this.connect().catch(()=>{})}catch{this.phase='error';this.detail='Zapisana sesja wymaga ponownego logowania'}}
  this.live.start()
  this.ticker=setInterval(()=>{try{this.queue.tick()}catch{this.detail='Błąd silnika kolejki'}},250)
  this.validation=setInterval(()=>{const generation=this.generation;if(this.auth.identity)void this.auth.ensure().catch(()=>{if(this.stopped||generation!==this.generation)return;this.events.stop();this.phase='error';this.detail='Sesja Twitch wymaga ponownego połączenia'})},3600000)
 }
 stop(){this.stopped=true;this.generation++;clearInterval(this.validation);clearInterval(this.ticker);this.live.stop();try{this.queue.stop()}finally{this.events.stop();this.auth.stop();this.overlay.stop()}}
 state():AlertState{return {twitch:{phase:this.phase,login:this.auth.identity?.login??'',detail:this.detail,overlayUrl:this.overlay.url,clients:this.overlay.clients},rules:rules(this.db),rewards:this.rewards,queue:this.queue.state()}}
 async login(clientId:string,secret:string){
  if(this.phase==='authorizing')throw Error('Autoryzacja już trwa')
  this.generation++;const g=this.generation;this.live.reset();this.events.stop();this.rewards=[];this.phase='authorizing';this.detail='Dokończ logowanie w przeglądarce'
  try{await this.auth.login(clientId,secret);if(g!==this.generation||this.stopped)return;this.phase='connecting';await this.connect()}
  catch{if(g===this.generation&&!this.stopped){this.phase='error';this.detail='Logowanie nie powiodło się. Sprawdź dane i redirect URI.'}throw Error('Logowanie Twitch nie powiodło się')}
 }
 async connect(){if(this.phase==='authorizing')throw Error('Autoryzacja trwa');this.events.stop();const g=++this.generation;this.phase='connecting';this.detail='Sprawdzanie sesji';try{await this.auth.ensure();if(this.stopped||g!==this.generation)return;this.events.start();void this.live.poll()}catch{if(g===this.generation&&!this.stopped){this.phase='error';this.detail='Nie można zweryfikować sesji Twitch'}throw Error('Nie można połączyć z Twitch')}}
 logout(){this.generation++;this.live.reset();this.events.stop();this.auth.logout();this.rewards=[];this.phase='disconnected';this.detail=''}
 async sync(){const id=this.auth.identity?.userId;if(!id)throw Error('Zaloguj Twitch');const g=this.generation
  const data=await this.auth.helix('channel_points/custom_rewards?broadcaster_id='+encodeURIComponent(id))
  if(this.stopped||g!==this.generation)throw Error('Sesja zmieniona')
  this.rewards=(Array.isArray(data.data)?data.data:[]).filter((x:any)=>typeof x.id==='string'&&typeof x.title==='string').map((x:any)=>({id:x.id,title:x.title,cost:Number(x.cost)||0}))
  return this.rewards
 }
 save(value:unknown){return saveRule(this.db,value)}
 async choose(kind:'image'|'audio'|'video'){
  if(this.dialogBusy||this.stopped)throw Error('Dialog unavailable');this.dialogBusy=true
  try{const result=await dialog.showOpenDialog(this.window,{properties:['openFile'],filters:[{name:kind==='image'?'Grafiki':kind==='video'?'Wideo':'Dźwięki',extensions:(kind==='image'?imageExt:kind==='video'?videoExt:audioExt).map(x=>x.slice(1))}]})
  if(result.canceled||!result.filePaths[0])return null
  return await copyMedia(result.filePaths[0],this.media,kind)}finally{this.dialogBusy=false}
 }
 async import(){
  if(this.dialogBusy||this.stopped)throw Error('Dialog unavailable');this.dialogBusy=true
  try{const result=await dialog.showOpenDialog(this.window,{title:'Import konfiguracji PSSA 1.x',defaultPath:join(this.documents,'PanSzczesniak Stream Alerts','config.json'),properties:['openFile'],filters:[{name:'Konfiguracja JSON',extensions:['json']}]})
  if(result.canceled||!result.filePaths[0])return null
  const data=await importLegacy(result.filePaths[0],this.media)
  if(this.stopped)throw Error('Aplikacja zamykana')
  const map=new Map(rules(this.db).map(x=>[x.key,x]));for(const rule of data.rules)map.set(rule.key,rule);saveRules(this.db,[...map.values()])
  return {count:data.rules.length,warnings:data.warnings}}finally{this.dialogBusy=false}
 }
 overlayUrl(){return this.overlay.url}
 liveState(){return this.live.snapshot()}
 liveAction(value:unknown){return this.live.action(value)}
 observeObs(state:ObsState){this.live.obs(state)}
 reloadOverlay(){return this.overlay.reload()}
 queueCommand(command:unknown){return this.queue.command(command)}
 test(key:string){const rule=rules(this.db).find(x=>x.key===key)??defaultRule(key);const kind=key.startsWith('reward:')?'redemption':key as AlertEvent['kind'];const event:AlertEvent={id:randomUUID(),kind,user:'Test PSSA',reward:rule.title,count:5,months:3};return this.queue.enqueue(event,rule,'test')?1:0}
 private dispatch(event:AlertEvent){if(this.stopped)return;try{const key=event.kind==='redemption'?'reward:'+event.rewardId:event.kind;const rule=rules(this.db).find(x=>x.key===key);if(rule)this.queue.enqueue(event,rule);else if(event.kind==='redemption'&&event.rewardId)this.queue.enqueue(event,defaultRule(key,event.reward??key))}catch{this.detail='Błąd odczytu reguły alertu'}}
}
