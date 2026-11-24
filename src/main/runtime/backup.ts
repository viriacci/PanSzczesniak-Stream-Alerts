import {DatabaseSync,type SQLInputValue} from 'node:sqlite'
import {createHash,randomUUID} from 'node:crypto'
import {mkdirSync,readdirSync,readFileSync,writeFileSync,renameSync,rmSync,lstatSync,existsSync,copyFileSync,statSync} from 'node:fs'
import {join,resolve,dirname,extname} from 'node:path'
import {openDatabase,SCHEMA_VERSION,schemaVersion} from '../database/index.ts'
import {parseRule,validMedia} from '../../shared/alerts.ts'
import {parseQueueSettings} from '../../shared/queue.ts'
import {parseRuntime} from '../../shared/runtime.ts'
import {config,activeProfile} from '../library/store.ts'
const tables=['stream_sessions','viewer_samples','stream_events','obs_samples','imported_summaries','alert_queue'] as const
const settingKeys=['compact','layout.v1','window.v1','alerts.v1','queue.v1','library.v1','library.active','live.chat.salt','runtime.v1']
const maxArchive=1024*1024*1024,maxFile=50*1024*1024
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex')
const validName=(v:string)=>!!v&&validMedia(v)
function regular(path:string){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink())throw Error('Not a regular file');return s}
function columns(db:DatabaseSync,table:string){return db.prepare('PRAGMA table_info('+table+')').all().map(x=>String(x.name))}
function copyData(from:DatabaseSync,to:DatabaseSync){
 for(const t of tables){
  const cols=columns(to,t),sql=cols.join(','),ins=to.prepare('INSERT INTO '+t+'('+sql+') VALUES ('+cols.map(()=>'?').join(',')+')')
  for(const row of from.prepare('SELECT '+sql+' FROM '+t).iterate())ins.run(...cols.map(k=>row[k] as SQLInputValue))
 }
 const insert=to.prepare('INSERT INTO settings(key,value) VALUES (?,?)')
 for(const key of settingKeys){const v=from.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;if(typeof v==='string'){if(Buffer.byteLength(v)>32*1024*1024)throw Error('Setting too large');insert.run(key,v)}}
}
function validateData(db:DatabaseSync){
 const read=(key:string)=>db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value
 const a=read('alerts.v1');if(typeof a==='string'){const v=JSON.parse(a);if(!Array.isArray(v)||v.length>1024)throw Error('Invalid rules');v.forEach(parseRule)}
 const q=read('queue.v1');if(typeof q==='string')parseQueueSettings(JSON.parse(q))
 const runtime=read('runtime.v1');if(typeof runtime==='string')parseRuntime(JSON.parse(runtime))
 if(config(db).active!==activeProfile(db))throw Error('Invalid profile')
 for(const row of db.prepare('SELECT rule_json FROM alert_queue').iterate())parseRule(JSON.parse(String(row.rule_json)))
 const salt=read('live.chat.salt');if(salt!==undefined&&(typeof salt!=='string'||! /^[a-f0-9]{64}$/.test(salt)))throw Error('Invalid salt')
 if(db.prepare('PRAGMA foreign_key_check').get())throw Error('Invalid foreign keys')
}
function openArchive(path:string){
 if(regular(path).size>maxArchive)throw Error('Backup too large')
 const db=new DatabaseSync(path,{readOnly:true})
 try{db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON')
  if(schemaVersion(db)!==SCHEMA_VERSION||db.prepare('PRAGMA quick_check').get()?.quick_check!=='ok'||db.prepare("SELECT value FROM backup_manifest WHERE key='format'").get()?.value!=='pssa-backup-v1')throw Error('Unsupported or damaged backup')
  for(const t of [...tables,'settings','backup_manifest','backup_media'])if(db.prepare("SELECT type FROM sqlite_schema WHERE name=?").get(t)?.type!=='table')throw Error('Invalid archive table')
  return db
 }catch(e){db.close();throw e}
}
function readAssets(db:DatabaseSync,visit:(name:string,bytes:Uint8Array)=>void){
 let total=0,count=0
 for(const row of db.prepare('SELECT name,length(bytes) size FROM backup_media ORDER BY name').iterate()){
  const name=String(row.name),size=Number(row.size)
  if(!validName(name)||!Number.isSafeInteger(size)||size<1||size>maxFile||++count>10000||(total+=size)>maxArchive)throw Error('Invalid media entry')
  const bytes=db.prepare('SELECT bytes FROM backup_media WHERE name=?').get(name)?.bytes
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==size||hash(bytes)!==name.slice(0,64))throw Error('Invalid media checksum')
  visit(name,bytes)
 }
}
export function createBackup(db:DatabaseSync,media:string,destination:string){
 if(existsSync(destination))throw Error('Destination already exists')
 const temp=destination+'.'+randomUUID()+'.tmp'
 let out:DatabaseSync|undefined
 try{
  out=openDatabase(temp);out.exec('PRAGMA journal_mode=DELETE; CREATE TABLE backup_manifest(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; CREATE TABLE backup_media(name TEXT PRIMARY KEY,bytes BLOB NOT NULL) STRICT; BEGIN IMMEDIATE')
  copyData(db,out);validateData(out)
  out.prepare("INSERT INTO backup_manifest VALUES ('format','pssa-backup-v1'),('created',?)").run(new Date().toISOString())
  const insert=out.prepare('INSERT INTO backup_media VALUES (?,?)');let total=0,count=0
  if(existsSync(media)){
   for(const e of readdirSync(media,{withFileTypes:true})){
    if(!e.isFile()||!validName(e.name))continue
    const path=join(media,e.name),size=regular(path).size
    if(size<1||size>maxFile||++count>10000||(total+=size)>maxArchive)throw Error('Media exceeds archive limit')
    const bytes=readFileSync(path);if(hash(bytes)!==e.name.slice(0,64))throw Error('Corrupt media')
    insert.run(e.name,bytes)
   }
  }
  out.exec('COMMIT');out.close();out=undefined
  if(statSync(temp).size>maxArchive)throw Error('Backup exceeds 1 GB')
  // Windows rename is non-overwriting only when target doesn't exist; exclusive copy prevents overwrite on all platforms.
  copyFileSync(temp,destination,1);rmSync(temp,{force:true})
  return count
 }finally{try{out?.close()}catch{}rmSync(temp,{force:true});rmSync(temp+'-journal',{force:true});rmSync(temp+'-wal',{force:true});rmSync(temp+'-shm',{force:true})}
}
export function validateBackup(path:string){
 const src=openArchive(path),tmp=new DatabaseSync(':memory:')
 try{
  // Build a fresh known schema rather than trusting SQL objects in an imported file.
  tmp.exec('PRAGMA foreign_keys=ON')
  // use normal database constructor to migrate below via helper
  return validateCopy(src)
 }finally{tmp.close();src.close()}
}
function validateCopy(src:DatabaseSync){
 const clean=openDatabase(':memory:')
 try{copyData(src,clean);validateData(clean);let count=0;readAssets(src,()=>count++);return count}finally{clean.close()}
}
export function restoreBackup(db:DatabaseSync,media:string,path:string){
 const src=openArchive(path)
 try{
  validateCopy(src);mkdirSync(media,{recursive:true})
  // Content-addressed media is additive. Never delete the old library.
  readAssets(src,(name,bytes)=>{
   const target=join(media,name)
   if(existsSync(target)){regular(target);if(hash(readFileSync(target))===name.slice(0,64))return;throw Error('Existing media corrupt; repair before restore')}
   writeFileSync(target,bytes,{flag:'wx',mode:0o600})
  })
  db.exec('BEGIN IMMEDIATE')
  try{
   for(const t of [...tables].reverse())db.exec('DELETE FROM '+t)
   const del=db.prepare('DELETE FROM settings WHERE key=?');for(const key of settingKeys)del.run(key)
   copyData(src,db);validateData(db)
   // Old pending alerts are historical, not commands to replay after restoring.
   db.exec("UPDATE alert_queue SET status='skipped',reason='restored-backup',finished_at=created_at WHERE status IN ('pending','playing')")
   db.exec('COMMIT')
  }catch(e){db.exec('ROLLBACK');throw e}
 }finally{src.close()}
}
export function pendingRestore(db:DatabaseSync,directory:string){
 const pending=join(directory,'restore.pending.pssabackup')
 if(!existsSync(pending))return ''
 const safety=join(directory,'before-restore-'+Date.now()+'.pssabackup')
 try{createBackup(db,join(directory,'media'),safety);restoreBackup(db,join(directory,'media'),pending);rmSync(pending);return 'Przywrócono dane. Kopia sprzed operacji pozostała w katalogu aplikacji.'}
 catch{try{renameSync(pending,join(directory,'restore.failed-'+Date.now()+'.pssabackup'))}catch{}return 'Przywracanie nie powiodło się. Zachowano dotychczasową bazę.'}
}
export function stageRestore(source:string,directory:string){
 const dest=join(directory,'restore.pending.pssabackup')
 if(existsSync(dest)||resolve(source)===resolve(dest))throw Error('Restore already staged')
 regular(source);if(statSync(source).size>maxArchive)throw Error('Backup too large')
 const temp=dest+'.'+randomUUID()+'.tmp'
 try{copyFileSync(source,temp,1);validateBackup(temp);renameSync(temp,dest)}finally{rmSync(temp,{force:true})}
}
