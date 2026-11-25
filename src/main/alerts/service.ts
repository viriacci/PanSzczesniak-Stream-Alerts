import {publicClientId} from '../twitch/public-client'
import {ReadJobs} from '../runtime/read-jobs'
import type {AnalyticsReport} from '../../shared/analytics'
import type {LibraryState} from '../../shared/library'
import {outsideData,writeNew} from '../runtime/output'
import {assertActiveProfile} from '../library/store'
import {channels} from '../analytics/store'
import {decodeHistory,importHistory} from '../analytics/transfer'
import {readFile,stat} from 'node:fs/promises'
import {extname} from 'node:path'
import {libraryAction,rememberAsset,activeProfile} from '../library/store'
import {pickVariant} from '../../shared/variants'
import {basename} from 'node:path'
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
import { rules,saveRule,saveRules,saveScene } from './store'
import { copyMedia,imageExt,audioExt,videoExt } from './media'
import { importLegacy } from './import'
import { parseRewards,defaultRule,type AlertState,type AlertEvent,type TwitchState,type Reward,type AlertRule } from '../../shared/alerts'
export class AlertsService {
 private auth:Auth
 private live:LiveService
 private events:EventSub
 private overlay:Overlay
 private queue:AlertQueue
 private ticker?:ReturnType<typeof setTimeout>
 private wakeQueued=false
 private phase:TwitchState['phase']='disconnected'
 private detail=''
 private deviceCode=''
 private rewards:Reward[]=[]
 private media:string
 private directory:string
 private reads:ReadJobs
 private dialogBusy=false
 private stopped=false
 private generation=0
 private snapshotVersion=0
 private lastSnapshot?:AlertState
 private validation?:ReturnType<typeof setInterval>
 constructor(private db:DatabaseSync,dir:string,private window:()=>BrowserWindow|undefined,private documents:string){
  this.directory=dir;this.reads=new ReadJobs(join(dir,'pssa.sqlite'),__dirname);this.media=join(dir,'media');this.auth=new Auth(db,{storage:safeStorage,openExternal:url=>shell.openExternal(url),request:fetch});this.live=new LiveService(db,this.auth);this.overlay=new Overlay(this.media);this.queue=new AlertQueue(db,this.overlay);this.overlay.onAck=(id,result)=>this.queue.acknowledge(id,result);this.overlay.onClientsChanged=()=>this.wake();this.queue.onChange=()=>this.wake()
  this.events=new EventSub(this.auth,(phase,detail)=>{this.phase=phase;this.detail=detail},e=>this.dispatch(e),undefined,(id,type,event,at,normalized)=>{try{this.live.event(id,type,event,at,normalized)}catch{this.detail='Błąd zapisu statystyk'}})
 }
 async start(auto=true){
  const raw=this.db.prepare("SELECT value FROM settings WHERE key='overlay.key'").get()?.value
  const key=typeof raw==='string'&&/^[a-f0-9]{64}$/.test(raw)?raw:randomBytes(32).toString('hex')
  this.db.prepare("INSERT INTO settings(key,value) VALUES ('overlay.key',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key)
  try{await this.overlay.start(key)}catch{this.detail='Port overlay 18766 zajęty'}
  if(auto){try{if(this.auth.load())void this.connect().catch(()=>{})}catch{this.phase='error';this.detail='Zapisana sesja wymaga ponownego logowania'}}
  this.live.start()
  this.wake()
  this.validation=setInterval(()=>{const generation=this.generation;if(this.auth.identity)void this.auth.ensure().catch(()=>{if(this.stopped||generation!==this.generation)return;this.events.stop();this.phase='error';this.detail='Sesja Twitch wymaga ponownego połączenia'})},3600000)
 }
 stop(){this.stopped=true;this.reads.stop();this.generation++;clearInterval(this.validation);clearTimeout(this.ticker);this.live.stop();try{this.queue.stop()}finally{this.events.stop();this.auth.stop();this.overlay.stop()}}
 private requireWindow(){const w=this.window();if(!w||w.isDestroyed())throw Error('Window unavailable');return w}
 private wake(){
  if(this.stopped||this.wakeQueued)return;this.wakeQueued=true
  queueMicrotask(()=>{this.wakeQueued=false;if(this.stopped)return;clearTimeout(this.ticker);this.ticker=undefined
   const delay=this.queue.nextDelay();if(delay===null)return
   this.ticker=setTimeout(()=>{this.ticker=undefined;try{this.queue.tick();this.wake()}catch{this.detail='Błąd silnika kolejki';if(!this.stopped)this.ticker=setTimeout(()=>this.wake(),1000)}},Math.max(1,delay))
  })
 }
 telemetry(){return {...this.queue.telemetry(),overlayClients:this.overlay.clients,twitchPhase:this.phase}}
 state():AlertState{return {profileId:activeProfile(this.db),twitch:{phase:this.phase,login:this.auth.identity?.login??'',detail:this.detail,overlayUrl:this.overlay.url,clients:this.overlay.clients,publicLogin:!!publicClientId,deviceCode:this.deviceCode},rules:rules(this.db),rewards:this.rewards,queue:this.queue.state()}}
 poll(since:unknown){
  if(typeof since!=='number'||!Number.isSafeInteger(since)||since< -1)throw Error('Invalid snapshot revision')
  const next=this.state(),last=this.lastSnapshot
  if(!last||next.profileId!==last.profileId||next.rules!==last.rules||next.rewards!==last.rewards||next.queue!==last.queue||JSON.stringify(next.twitch)!==JSON.stringify(last.twitch)){this.lastSnapshot=next;this.snapshotVersion++}
  return {revision:this.snapshotVersion,state:since===this.snapshotVersion?null:this.lastSnapshot!}
 }
 async deviceLogin(){if(!publicClientId)throw Error('Publiczny Client ID PSSA nie został skonfigurowany');return this.login(publicClientId,'',true)}
 async login(clientId:string,secret:string,device=false){
  if(this.phase==='authorizing')throw Error('Autoryzacja już trwa')
  this.generation++;const g=this.generation;this.live.reset();this.events.stop();this.rewards=[];this.phase='authorizing';this.detail='Dokończ logowanie w przeglądarce';this.deviceCode=''
  try{if(device)await this.auth.deviceLogin(clientId,code=>{if(g===this.generation)this.deviceCode=code});else await this.auth.login(clientId,secret);this.deviceCode='';if(g!==this.generation||this.stopped)return;this.phase='connecting';await this.connect()}
  catch{if(g===this.generation&&!this.stopped){this.phase='error';this.deviceCode='';this.detail=device?'Logowanie nie powiodło się. Spróbuj ponownie.':'Logowanie nie powiodło się. Sprawdź dane i redirect URI.'}throw Error('Logowanie Twitch nie powiodło się')}
 }
 async connect(){if(this.phase==='authorizing')throw Error('Autoryzacja trwa');this.events.stop();const g=++this.generation;this.phase='connecting';this.detail='Sprawdzanie sesji';try{await this.auth.ensure();if(this.stopped||g!==this.generation)return;this.events.start();void this.live.poll();void this.sync().catch(()=>{})}catch{if(g===this.generation&&!this.stopped){this.phase='error';this.detail='Nie można zweryfikować sesji Twitch'}throw Error('Nie można połączyć z Twitch')}}
 logout(){this.deviceCode='';this.generation++;this.live.reset();this.events.stop();this.auth.logout();this.rewards=[];this.phase='disconnected';this.detail=''}
 async sync(){const id=this.auth.identity?.userId;if(!id)throw Error('Zaloguj Twitch');const g=this.generation
  const data=await this.auth.helix('channel_points/custom_rewards?broadcaster_id='+encodeURIComponent(id))
  if(this.stopped||g!==this.generation)throw Error('Sesja zmieniona')
  this.rewards=parseRewards(data.data)
  return this.rewards
 }
 saveScene(key:unknown,value:unknown,title:unknown,profile:unknown){assertActiveProfile(this.db,profile);return saveScene(this.db,key,value,title)}
 save(value:unknown,profile:unknown){assertActiveProfile(this.db,profile);return saveRule(this.db,value)}
 async choose(kind:'image'|'audio'|'video'){
  if(this.dialogBusy||this.stopped)throw Error('Dialog unavailable');this.dialogBusy=true
  try{const result=await dialog.showOpenDialog(this.requireWindow(),{properties:['openFile'],filters:[{name:kind==='image'?'Grafiki':kind==='video'?'Wideo':'Dźwięki',extensions:(kind==='image'?imageExt:kind==='video'?videoExt:audioExt).map(x=>x.slice(1))}]})
  if(result.canceled||!result.filePaths[0])return null
  const id=await copyMedia(result.filePaths[0],this.media,kind);if(this.stopped)throw Error('App stopping');rememberAsset(this.db,id,basename(result.filePaths[0]));return id}finally{this.dialogBusy=false}
 }
 async import(){
  if(this.dialogBusy||this.stopped)throw Error('Dialog unavailable');this.dialogBusy=true;const profile=activeProfile(this.db)
  try{const result=await dialog.showOpenDialog(this.requireWindow(),{title:'Import konfiguracji PSSA 1.x',defaultPath:join(this.documents,'PanSzczesniak Stream Alerts','config.json'),properties:['openFile'],filters:[{name:'Konfiguracja JSON',extensions:['json']}]})
  if(result.canceled||!result.filePaths[0])return null
  const data=await importLegacy(result.filePaths[0],this.media)
  if(this.stopped)throw Error('Aplikacja zamykana');assertActiveProfile(this.db,profile)
  const map=new Map(rules(this.db).map(x=>[x.key,x]));for(const rule of data.rules)map.set(rule.key,rule);saveRules(this.db,[...map.values()])
  return {count:data.rules.length,warnings:data.warnings}}finally{this.dialogBusy=false}
 }
 overlayUrl(){return this.overlay.url}
 libraryState(){return this.reads.run<LibraryState>({type:'library',media:this.media})}
 libraryAction(value:unknown){libraryAction(this.db,value)}
 analyticsChannels(){return [...new Set([...channels(this.db),...(this.auth.identity?[this.auth.identity.userId]:[])])]}
 analyticsReport(value:unknown){return this.reads.run<AnalyticsReport>({type:'analytics',filter:value})}
 async analyticsImport(guard:()=>void=()=>{}){
  if(this.dialogBusy||this.stopped)throw Error('Dialog unavailable');this.dialogBusy=true
  try{const result=await dialog.showOpenDialog(this.requireWindow(),{title:'Import historii transmisji PSSA',properties:['openFile'],filters:[{name:'Historia CSV / JSON',extensions:['csv','json']}]});const path=result.filePaths[0];if(result.canceled||!path)return null
   const ext=extname(path).toLowerCase();if(ext!=='.csv'&&ext!=='.json')throw Error('Invalid format')
   const info=await stat(path);if(!info.isFile()||info.size>10*1024*1024)throw Error('Import too large')
   const content=await readFile(path,'utf8');if(Buffer.byteLength(content)>10*1024*1024)throw Error('Import too large');if(this.stopped)throw Error('App stopping');if(this.live.snapshot().phase==='live'||this.live.snapshot().phase==='unknown'||this.queue.state().current||this.queue.state().pendingCount)throw Error('Import unavailable during streaming')
   guard();const format=ext==='.csv'?'csv':'json';return importHistory(this.db,decodeHistory(content,format),format)
  }finally{this.dialogBusy=false}
 }
 async analyticsExport(value:unknown,format:unknown){
  if(this.dialogBusy||this.stopped||format!=='csv'&&format!=='json')throw Error('Invalid export');this.dialogBusy=true
  try{const data=await this.reads.run<string>({type:'export',filter:value,format});if(this.stopped)throw Error('App stopping');const result=await dialog.showSaveDialog(this.requireWindow(),{title:'Eksport statystyk PSSA',defaultPath:'pssa-history.'+format,filters:[{name:format.toUpperCase(),extensions:[format]}]});if(result.canceled||!result.filePath)return false;if(this.stopped)throw Error('App stopping');writeNew(outsideData(this.directory,result.filePath),data);return true}finally{this.dialogBusy=false}
 }
 liveState(){return this.live.snapshot()}
 liveAction(value:unknown){return this.live.action(value)}
 observeObs(state:ObsState){this.live.obs(state)}
 reloadOverlay(){return this.overlay.reload()}
 queueCommand(command:unknown){return this.queue.command(command)}
 test(key:string){const rule=rules(this.db).find(x=>x.key===key)??defaultRule(key);const kind=key.startsWith('reward:')?'redemption':key as AlertEvent['kind'];const event:AlertEvent={id:randomUUID(),kind,user:'Test PSSA',reward:rule.title,count:5,months:3};return this.queue.enqueue(event,rule,'test')?1:0}
 private dispatch(event:AlertEvent){if(this.stopped)return;try{const key=event.kind==='redemption'?'reward:'+event.rewardId:event.kind;const rule=rules(this.db).find(x=>x.key===key);if(rule){const category=rule.variants?.length?this.live.categoryId(): '',variant=pickVariant(rule.variants??[],event.count??0,event.months??0,category);this.queue.enqueue(event,variant?{...rule,scene:variant.scene,duration:variant.scene.duration/1000,variants:[]}:{...rule,variants:[]})}else if(event.kind==='redemption'&&event.rewardId)this.queue.enqueue(event,defaultRule(key,event.reward??key))}catch{this.detail='Błąd odczytu reguły alertu'}}
}
