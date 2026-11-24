import {outsideData,writeNew} from './output'
import {app,dialog,shell,type BrowserWindow} from 'electron'
import type {DatabaseSync} from 'node:sqlite'
import type {AlertsService} from '../alerts/service'
import type {ObsService} from '../obs/service'
import type {AgentBridge} from '../agent/bridge'
import {join} from 'node:path'
import {statSync,existsSync} from 'node:fs'
import {createBackup,stageRestore} from './backup'
import {preferences,savePreferences} from './preferences'
import {checkRelease} from './updates'
import {type Diagnostics,type RuntimePreferences,type UpdateInfo} from '../../shared/runtime'
import {schemaVersion} from '../database'
export class RuntimeService{
 private busy=false
 private stopped=false
 private update?:Promise<UpdateInfo>
 private cached:UpdateInfo={state:'none',version:'',url:'',detail:'Nie sprawdzano aktualizacji.'}
 private checkedAt=0
 private timer?:ReturnType<typeof setInterval>
 constructor(private db:DatabaseSync,private directory:string,private window:()=>BrowserWindow|undefined,private alerts:AlertsService,private obs:ObsService,private agent:AgentBridge|undefined,private restoreStatus:string,private onMode:(p:RuntimePreferences)=>void){}
 state(){return preferences(this.db)}
 save(value:unknown){const old=this.state(),p=savePreferences(this.db,value);if(old.updates!==p.updates){this.cached={state:'none',version:'',url:'',detail:'Zmieniono kanał aktualizacji.'};this.checkedAt=0}this.onMode(p);return this.state()}
 start(){this.timer=setInterval(()=>{if(this.state().autoCheck&&Date.now()-this.checkedAt>=21600000)void this.check()},60000);if(this.state().autoCheck)void this.check()}
 stop(){this.stopped=true;clearInterval(this.timer)}
 private requireWindow(){const w=this.window();if(!w||w.isDestroyed())throw Error('Window unavailable');return w}
 private guard(){if(this.busy||this.stopped)throw Error('Runtime operation unavailable')}
 requireOffline(){const l=this.alerts.liveState(),a=this.alerts.state(),m=this.obs.state().metrics;if(a.queue.current||a.queue.pendingCount||l.phase==='live'||l.phase==='unknown'||m?.streaming||m?.recording)throw Error('Stop streaming before backup or restore')}
 private outside(path:string){return outsideData(this.directory,path)}
 async backup(){
  this.guard();this.requireOffline();this.busy=true
  try{const r=await dialog.showSaveDialog(this.requireWindow(),{title:'Kopia zapasowa PSSA',defaultPath:'PSSA-'+new Date().toISOString().slice(0,10)+'.pssabackup',filters:[{name:'PSSA Backup',extensions:['pssabackup']}]})
   if(r.canceled||!r.filePath)return null
   const target=this.outside(r.filePath);if(this.stopped)throw Error('App stopping');this.requireOffline()
   return {media:createBackup(this.db,join(this.directory,'media'),target)}
  }finally{this.busy=false}
 }
 async restore(){
  this.guard();this.requireOffline();this.busy=true
  try{const r=await dialog.showOpenDialog(this.requireWindow(),{title:'Przywracanie PSSA',properties:['openFile'],filters:[{name:'PSSA Backup',extensions:['pssabackup']}]})
   if(r.canceled||!r.filePaths[0])return false
   const confirm=await dialog.showMessageBox(this.requireWindow(),{type:'warning',title:'Przywrócić kopię?',message:'Przy następnym uruchomieniu statystyki i ustawienia zostaną zastąpione.',detail:'PSSA utworzy kopię stanu przed operacją. Lokalne dane logowania pozostaną, a stare oczekujące alerty nie zostaną odtworzone.',buttons:['Anuluj','Przywróć po restarcie'],defaultId:0,cancelId:0})
   if(confirm.response!==1||this.stopped)return false
   this.requireOffline();stageRestore(r.filePaths[0],this.directory);return true
  }finally{this.busy=false}
 }
 diagnostics():Diagnostics{
  const processes=app.getAppMetrics(),a=this.alerts.state(),obs=this.obs.state(),db=join(this.directory,'pssa.sqlite')
  let bytes=0;for(const p of [db,db+'-wal'])if(existsSync(p))bytes+=statSync(p).size
  return {version:app.getVersion(),schema:schemaVersion(this.db),platform:process.platform,arch:process.arch,electron:process.versions.electron??'',chromium:process.versions.chrome??'',node:process.versions.node,processes:processes.length,memoryMB:Math.round(processes.reduce((sum,p)=>sum+p.memory.workingSetSize,0)/1024),cpu:Math.round(processes.reduce((sum,p)=>sum+p.cpu.percentCPUUsage,0)*10)/10,databaseBytes:bytes,queuePending:a.queue.pendingCount,overlayClients:a.twitch.clients,twitch:a.twitch.phase,obs:obs.phase,agent:this.agent?.snapshot().online??false,restoreStatus:this.restoreStatus,uptime:Math.floor(process.uptime())}
 }
 async exportDiagnostics(){
  this.guard();this.busy=true
  try{const r=await dialog.showSaveDialog(this.requireWindow(),{defaultPath:'pssa-diagnostics.json',filters:[{name:'JSON',extensions:['json']}]});if(r.canceled||!r.filePath)return false;const target=this.outside(r.filePath);if(this.stopped)return false;writeNew(target,JSON.stringify(this.diagnostics(),null,2));return true}finally{this.busy=false}
 }
 async check(){if(this.stopped)return this.cached;if(this.update)return this.update
  const channel=this.state().updates
  const task=checkRelease(app.getVersion(),channel);this.update=task
  try{const value=await task;if(!this.stopped&&channel===this.state().updates){this.cached=value;this.checkedAt=Date.now()}return value}finally{if(this.update===task)this.update=undefined}
 }
 updateInfo(){return this.cached}
 async openUpdate(){if(this.cached.state!=='available'||!this.cached.url.startsWith('https://github.com/viriacci/PanSzczesniak-Stream-Alerts/releases/tag/'))throw Error('No update');await shell.openExternal(this.cached.url)}
}
