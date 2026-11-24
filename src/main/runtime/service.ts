import {GpuSampler} from './gpu'
import {Measurement} from './measurement'
import {makeSampler} from './counters'
import {CrashLog} from './crashes'
import {cpus,totalmem} from 'node:os'
import type {Sample} from '../../shared/performance'
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
 private measurement:Measurement
 private gpu=new GpuSampler()
 private gpuEnabled=false
 private agentPrevious?:{at:number;cpuSeconds:number;ramMB:number;pid:number}
 private crashes:CrashLog
 private agentCrashes:CrashLog
 private lastRendererFault=0
 private busy=false
 private stopped=false
 private update?:Promise<UpdateInfo>
 private cached:UpdateInfo={state:'none',version:'',url:'',detail:'Nie sprawdzano aktualizacji.'}
 private checkedAt=0
 private timer?:ReturnType<typeof setInterval>
 constructor(private db:DatabaseSync,private directory:string,private window:()=>BrowserWindow|undefined,private alerts:AlertsService,private obs:ObsService,private agent:AgentBridge|undefined,private restoreStatus:string,private onMode:(p:RuntimePreferences)=>void){
  this.crashes=new CrashLog(directory,app.getVersion(),'main');this.agentCrashes=new CrashLog(directory,app.getVersion(),'agent')
  const sample=makeSampler(()=>app.getAppMetrics())
  this.measurement=new Measurement(join(directory,'measurements'),()=>({version:app.getVersion(),cores:cpus().length,ramMB:Math.round(totalmem()/1048576),platform:process.platform,arch:process.arch,gpuEnabled:this.gpuEnabled}),(late,reset):Sample=>{
   const obs=this.obs.state(),m=obs.phase==='connected'&&obs.sampledAt&&Date.now()-obs.sampledAt<15000?obs.metrics:null
   const a=this.agent?.measurementPoint(),previous=this.agentPrevious;this.agentPrevious=a??undefined;const gpu=this.gpu.snapshot();const agentCpu=!reset&&a&&previous&&a.pid===previous.pid&&a.at>previous.at&&a.cpuSeconds>=previous.cpuSeconds?100*(a.cpuSeconds-previous.cpuSeconds)/((a.at-previous.at)/1000*cpus().length):null
   return {at:Date.now(),mode:this.state().mode,...sample(reset),timerLateMs:late,gpu:gpu?.value??null,gpuAt:gpu?.at??null,agentCpu,agentRamMB:a?.ramMB??null,obsCpu:m?.cpu??null,obsRamMB:m?.memory??null,obsFps:m?.fps??null,obsRenderSkipped:m?.renderSkipped??null,obsOutputSkipped:m?.outputSkipped??null,obsStreaming:m?.streaming??null,obsRecording:m?.recording??null,...this.alerts.telemetry(),agentOnline:this.agent?.snapshot().online??false,obsPhase:obs.phase}
  });this.measurement.onFinish=()=>this.stopCollectors()
 }
 measurementState(){return this.measurement.state()}
 async measurementStart(gpu:unknown){this.guard();if(typeof gpu!=='boolean')throw Error('Invalid GPU preference');if(this.measurement.active)throw Error('Measurement already active');const r=await dialog.showMessageBox(this.requireWindow(),{type:'question',title:'Rozpocząć pomiar?',message:'PSSA będzie zapisywać rzeczywiste pomiary co 10 sekund, także w tle.',detail:'Pomiar sam nie uruchamia transmisji, nie symuluje alertów, kończy się po maks. 24 godzinach lub po zamknięciu PSSA. Dane pozostają na komputerze.',buttons:['Anuluj','Rozpocznij pomiar'],defaultId:0,cancelId:0});if(r.response!==1||this.stopped)return this.measurement.state();this.gpuEnabled=gpu;this.agentPrevious=undefined;this.agent?.setMeasurement(true);if(gpu)this.gpu.start();try{return this.measurement.start()}catch(e){this.stopCollectors();throw e}}
 private stopCollectors(){this.gpu.stop();this.agent?.setMeasurement(false);this.agentPrevious=undefined}
 measurementStop(){try{return this.measurement.stop()}finally{this.stopCollectors()}}
 async measurementExport(id:unknown,format:unknown){this.guard();const data=this.measurement.export(id,format);const r=await dialog.showSaveDialog(this.requireWindow(),{defaultPath:'pssa-measurement.'+format,filters:[{name:'Raport',extensions:[String(format)]}]});if(r.canceled||!r.filePath||this.stopped)return false;writeNew(this.outside(r.filePath),data);return true}
 crashState(){return [...this.crashes.recent(),...this.agentCrashes.recent()].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100)}
 rendererFault(kind:unknown,stack:unknown){if(kind!=='error'&&kind!=='rejection'&&kind!=='react')throw Error('Invalid renderer fault');if(typeof stack!=='string'||stack.length>8192)throw Error('Invalid stack');if(Date.now()-this.lastRendererFault<1000)return;this.lastRendererFault=Date.now();this.crashes.write('renderer-'+kind,'',null,stack)}
 async crashExport(){this.guard();const data=JSON.stringify({version:app.getVersion(),diagnostics:this.diagnostics(),crashes:this.crashState()},null,2);const r=await dialog.showSaveDialog(this.requireWindow(),{defaultPath:'pssa-crashes.json',filters:[{name:'JSON',extensions:['json']}]});if(r.canceled||!r.filePath||this.stopped)return false;writeNew(this.outside(r.filePath),data);return true}
 state(){return preferences(this.db)}
 save(value:unknown){const old=this.state(),p=savePreferences(this.db,value);if(old.updates!==p.updates){this.cached={state:'none',version:'',url:'',detail:'Zmieniono kanał aktualizacji.'};this.checkedAt=0}this.onMode(p);return this.state()}
 start(){this.timer=setInterval(()=>{if(this.state().autoCheck&&Date.now()-this.checkedAt>=21600000)void this.check()},60000);if(this.state().autoCheck)void this.check()}
 stop(){this.stopped=true;clearInterval(this.timer);this.measurement.shutdown();this.stopCollectors()}
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
