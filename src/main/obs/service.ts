import type {ObsState} from '../../shared/obs'
import {safeStorage} from 'electron'
import type {DatabaseSync} from 'node:sqlite'
import {parseObsAction} from '../../shared/obs'
import {ObsClient} from './client'
export class ObsService{
 private client:ObsClient
 constructor(private db:DatabaseSync,onTelemetry:(state:ObsState)=>void=()=>{}){this.client=new ObsClient(undefined,onTelemetry)}
 start(){try{const row=this.db.prepare("SELECT value FROM settings WHERE key='obs.secure.v1'").get();if(typeof row?.value!=='string'||!safeStorage.isEncryptionAvailable())return;const v=JSON.parse(safeStorage.decryptString(Buffer.from(row.value,'base64')));const command=parseObsAction({type:'connect',...v});if(command.type==='connect')this.client.connect(command.port,command.password)}catch{/* explicit reconnect required */}}
 stop(){this.client.disconnect()}
 state(){return this.client.snapshot()}
 async action(value:unknown,overlay:string){
  const cmd=parseObsAction(value)
  if(cmd.type==='connect'){
   if(!safeStorage.isEncryptionAvailable())throw Error('Secure storage unavailable')
   const secret=safeStorage.encryptString(JSON.stringify({port:cmd.port,password:cmd.password})).toString('base64')
   this.db.prepare("INSERT INTO settings(key,value) VALUES ('obs.secure.v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(secret)
   this.client.connect(cmd.port,cmd.password);return 0
  }
  if(cmd.type==='disconnect'){this.client.disconnect();this.db.prepare("DELETE FROM settings WHERE key='obs.secure.v1'").run();return 0}
  if(cmd.type==='scene'){await this.client.setScene(cmd.name);return 0}
  return this.client.refreshOverlay(overlay)
 }
}
