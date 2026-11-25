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
import {checkRelease,compareVersions,installerAllowed} from './updates'
import {cleanUpdateFiles} from './update-cleanup'
import {downloadRelease} from './update-download'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {type Diagnostics,type RuntimePreferences,type UpdateInfo,type UpdateChannel} from '../../shared/runtime'
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
 private update?:{channel:UpdateChannel;promise:Promise<UpdateInfo>}
 private cached:UpdateInfo={state:'none',version:'',url:'',detail:'Nie sprawdzano aktualizacji.'}
 private checkedAt=0
 private downloading=false
 private timer?:ReturnType<typeof setInterval>
 constructor(private db:DatabaseSync,private directory:string,private window:()=>BrowserWindow|undefined,private alerts:AlertsService,private obs:ObsService,private agent:AgentBridge|undefined,private restoreStatus:string,private onMode:(p:RuntimePreferences)=>void,private lookupRelease=checkRelease){
  this.crashes=new CrashLog(directory,app.getVersion(),'main');this.agentCrashes=new CrashLog(directory,app.getVersion(),'agent')
  const sample=makeSampler(()=>app.getAppMetrics())
  this.measurement=new Measurement(join(directory,'measurements'),()=>({version:app.getVersion(),cores:cpus().length,ramMB:Math.round(totalmem()/1048576),platform:process.platform,arch:process.arch,gpuEnabled:this.gpuEnabled}),(late,reset):Sample=>{
   const obs=this.obs.state(),m=obs.phase==='connected'&&obs.sampledAt&&Date.now()-obs.sampledAt<15000?obs.metrics:null
   const a=this.agent?.measurementPoint(),previous=this.agentPrevious;this.agentPrevious=a??undefined;const gpu=this.gpu.snapshot();const agentCpu=!reset&&a&&previous&&a.pid===previous.pid&&a.at>previous.at&&a.cpuSeconds>=previous.cpuSeconds?100*(a.cpuSeconds-previous.cpuSeconds)/((a.at-previous.at)/1000*cpus().length):null
   return {at:Date.now(),mode:this.state().mode,...sample(reset),timerLateMs:late,gpu:gpu?.value??null,gpuAt:gpu?.at??null,agentCpu,agentRamMB:a?.ramMB??null,obsCpu:m?.cpu??null,obsRamMB:m?.memory??null,obsFps:m?.fps??null,obsRenderSkipped:m?.renderSkipped??null,obsOutputSkipped:m?.outputSkipped??null,obsStreaming:m?.streaming??null,obsRecording:m?.recording??null,...this.alerts.telemetry(),agentOnline:this.agent?.snapshot().online??false,obsPhase:obs.phase}
  });this.measurement.onFinish=()=>this.stopCollectors()
 }
 measurementState(){return this.measurement.state()}
 async measurementStart(gpu:unknown){this.guard();if(typeof gpu!=='boolean')throw Error('Invalid GPU preference');if(this.measurement.active)throw Error('Measurement already active');const r=await dialog.showMessageBox(this.requireWindow(),{type:'question',title:'Rozpocząć pomiar?',message:'PSSA będzie zapisywać rzeczywiste pomiary co 10 sekund, także w tle.',detail:'Pomiar sam nie uruchamia transmisji, nie symuluje alertów, kończy się po maks. 24 godzinach lub po zamknięciu PSSA. Dane pozostają na komputerze.',buttons:['Anuluj','Rozpocznij pomiar'],defaultId:0,cancelId:0});if(r.response!==1||this.stopped)return this.measurement.state();return this.beginMeasurement(gpu)}
 // Internal start path; renderer can only invoke the confirmation-gated IPC.
 beginMeasurement(gpu:boolean){if(this.stopped||this.measurement.active)throw Error('Measurement unavailable');this.gpuEnabled=gpu;this.agentPrevious=undefined;this.agent?.setMeasurement(true);if(gpu)this.gpu.start();try{return this.measurement.start()}catch(e){this.stopCollectors();throw e}}
 private stopCollectors(){this.gpu.stop();this.agent?.setMeasurement(false);this.agentPrevious=undefined}
 measurementStop(){try{return this.measurement.stop()}finally{this.stopCollectors()}}
 async measurementExport(id:unknown,format:unknown){this.guard();const data=this.measurement.export(id,format);const r=await dialog.showSaveDialog(this.requireWindow(),{defaultPath:'pssa-measurement.'+format,filters:[{name:'Raport',extensions:[String(format)]}]});if(r.canceled||!r.filePath||this.stopped)return false;writeNew(this.outside(r.filePath),data);return true}
 crashState(){return [...this.crashes.recent(),...this.agentCrashes.recent()].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100)}
 rendererFault(kind:unknown,stack:unknown){if(kind!=='error'&&kind!=='rejection'&&kind!=='react')throw Error('Invalid renderer fault');if(typeof stack!=='string'||stack.length>8192)throw Error('Invalid stack');if(Date.now()-this.lastRendererFault<1000)return;this.lastRendererFault=Date.now();this.crashes.write('renderer-'+kind,'',null,stack)}
 async crashExport(){this.guard();const data=JSON.stringify({version:app.getVersion(),diagnostics:this.diagnostics(),crashes:this.crashState()},null,2);const r=await dialog.showSaveDialog(this.requireWindow(),{defaultPath:'pssa-crashes.json',filters:[{name:'JSON',extensions:['json']}]});if(r.canceled||!r.filePath||this.stopped)return false;writeNew(this.outside(r.filePath),data);return true}
 state(){return preferences(this.db)}
 save(value:unknown){const old=this.state(),p=savePreferences(this.db,value);if(old.updates!==p.updates){this.cached={state:'none',version:'',url:'',detail:'Zmieniono kanał aktualizacji.'};this.checkedAt=0;this.update=undefined}this.onMode(p);if(p.autoCheck&&(!old.autoCheck||old.updates!==p.updates))void this.check();return this.state()}
 start(){void cleanUpdateFiles();let cleanupRetries=3;this.timer=setInterval(()=>{if(!this.downloading&&cleanupRetries>0){cleanupRetries--;void cleanUpdateFiles()}if(this.state().autoCheck&&Date.now()-this.checkedAt>=21600000)void this.check()},60000);if(this.state().autoCheck)void this.check()}
 stop(failed=false){this.stopped=true;clearInterval(this.timer);this.measurement.shutdown(failed);this.stopCollectors()}
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
 async check(){
  if(this.stopped)return this.cached
  const channel=this.state().updates
  if(this.update?.channel===channel)return this.update.promise
  const promise:Promise<UpdateInfo>=Promise.resolve().then(()=>this.lookupRelease(app.getVersion(),channel)).then(value=>{
   if(!this.stopped&&this.update?.promise===promise&&channel===this.state().updates){this.cached=value;this.checkedAt=Date.now()}
   return this.cached
  }).finally(()=>{if(this.update?.promise===promise)this.update=undefined})
  this.update={channel,promise};return promise
 }
 updateInfo(){return this.cached}
 private async updateSafe(){
  if(this.stopped)throw Error('Aplikacja zamykana.')
  try{this.requireOffline()}catch{throw Error('Zakończ transmisję, nagrywanie i kolejkę alertów przed aktualizacją.')}
  if(process.platform!=='win32'||!app.isPackaged)throw Error('Instalator dostępny dla Windows x64.')
  const exe=join(process.env.SystemRoot??'C:\\Windows','System32','tasklist.exe')
  const {stdout}=await promisify(execFile)(exe,['/FI','IMAGENAME eq obs64.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:5000})
  if(/"obs64\.exe"/i.test(stdout))throw Error('Zamknij OBS przed aktualizacją PSSA.')
  if(this.stopped)throw Error('Aplikacja zamykana.')
  if(this.agent?.snapshot().online)throw Error('Zakończ niezależnego Agenta przed aktualizacją.')
 }
 private async trustedInstaller(file:string){
  const quote=(v:string)=>"'"+v.replaceAll("'","''")+"'"
  const script="$ErrorActionPreference='Stop'; $a=Get-AuthenticodeSignature -LiteralPath "+quote(process.execPath)+"; $b=Get-AuthenticodeSignature -LiteralPath "+quote(file)+"; if($a.Status -eq 'Valid' -and $b.Status -eq 'Valid' -and $a.SignerCertificate.Thumbprint -eq $b.SignerCertificate.Thumbprint){'trusted'}elseif($b.Status -eq 'NotSigned'){'unsigned'}else{'untrusted'}"
  try{const {stdout}=await promisify(execFile)(join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:20000});const value=stdout.trim();return value==='trusted'?'trusted':value==='unsigned'?'unsigned':'untrusted'}catch{return 'untrusted'}
 }
 dockUpdateReminder(){try{const row=this.db.prepare("SELECT value FROM settings WHERE key='update.obs.reminder'").get();return typeof row?.value==='string'&&compareVersions(app.getVersion(),row.value)>=0}catch{return false}}
 clearDockUpdateReminder(){this.db.prepare("DELETE FROM settings WHERE key='update.obs.reminder'").run()}
 async downloadUpdate(alsoDock:unknown,version:unknown,sha256:unknown):Promise<'cancelled'|'manual'|'launched'>{
  if(typeof alsoDock!=='boolean'||this.downloading||this.stopped)throw Error('Aktualizacja niedostępna.')
  const info=this.cached;if(info.state!=='available'||!info.asset)throw Error('Wydanie nie zawiera instalatora ze zweryfikowaną sumą SHA256.')
  if(typeof version!=='string'||typeof sha256!=='string'||version!==info.version||sha256!==info.asset.sha256)throw Error('Wydanie zmieniło się. Zamknij okno i sprawdź aktualizację ponownie.')
  const channel=this.state().updates
  const assertCurrent=()=>{if(this.stopped||this.state().updates!==channel||this.cached.version!==info.version||this.cached.asset?.sha256!==info.asset!.sha256)throw Error('Wydanie lub kanał aktualizacji zmienił się. Sprawdź ponownie.')}
  this.downloading=true;let dir='',keep=false
  try{
   await this.updateSafe()
   const choice=await dialog.showMessageBox(this.requireWindow(),{type:'question',title:'Aktualizacja PSSA',message:'Pobrać PSSA '+info.version+'?',detail:'Zapisz rozpoczętą edycję. PSSA sprawdzi sumę SHA256 oraz podpis instalatora. OBS musi pozostać zamknięty.',buttons:['Anuluj','Pobierz'],defaultId:0,cancelId:0})
   if(choice.response!==1)return 'cancelled'
   assertCurrent()
   dir=await mkdtemp(join(tmpdir(),'PSSA-update-'))
   const file=await downloadRelease(info.asset,dir)
   const trusted=await this.trustedInstaller(file)
   if(!installerAllowed(trusted,info.version))throw Error('Nie można potwierdzić podpisu instalatora. Automatyczne uruchomienie zablokowane. Sprawdź wydanie na GitHubie.')
   assertCurrent()
   await this.updateSafe()
   const confirm=await dialog.showMessageBox(this.requireWindow(),{type:'question',title:trusted==='trusted'?'Instalator zweryfikowany':'Niepodpisany instalator Beta',message:'Uruchomić instalator i zakończyć PSSA?',detail:trusted==='trusted'?'Podpis i suma SHA256 są zgodne. Instalator zachowa istniejący katalog programu.':'SHA256 pobranego pliku jest zgodne z oficjalnym wydaniem GitHub, ale instalator nie ma podpisu cyfrowego. Uruchom tylko jeśli ufasz wydawcy. Windows może poprosić o dodatkowe potwierdzenie.',buttons:['Anuluj',trusted==='trusted'?'Zainstaluj':'Uruchom niepodpisany instalator'],defaultId:0,cancelId:0})
   if(confirm.response!==1)return 'cancelled'
   await this.updateSafe()
   assertCurrent()
   const result=await shell.openPath(file);if(result)throw Error('Nie można uruchomić instalatora: '+result)
   keep=true;if(alsoDock)this.db.prepare("INSERT INTO settings(key,value) VALUES ('update.obs.reminder',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(info.version);setTimeout(()=>app.quit(),100);return 'launched'
  }finally{this.downloading=false;if(dir&&!keep)await rm(dir,{recursive:true,force:true}).catch(()=>{})}
 }
 async openUpdate(){if(this.cached.state!=='available'||!this.cached.url.startsWith('https://github.com/viriacci/PanSzczesniak-Stream-Alerts/releases/tag/'))throw Error('No update');await shell.openExternal(this.cached.url)}
}
