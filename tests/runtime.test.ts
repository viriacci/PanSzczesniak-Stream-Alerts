import {outsideData,writeNew} from '../src/main/runtime/output.ts'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {openDatabase,setCompact,getCompact} from '../src/main/database/index.ts'
import {createBackup,validateBackup,restoreBackup,stageRestore,pendingRestore} from '../src/main/runtime/backup.ts'
import {preferences,savePreferences} from '../src/main/runtime/preferences.ts'
import {compareVersions,selectRelease,checkRelease} from '../src/main/runtime/updates.ts'
import {defaultRule} from '../src/shared/alerts.ts'
import {saveRule,rules} from '../src/main/alerts/store.ts'
const tmp=()=>mkdtempSync(join(tmpdir(),'pssa-runtime-'))
const asset=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')+'.gif'
test('portable backup restores SQLite and content-addressed media without exporting or overwriting credentials',()=>{
 const root=tmp(),db=openDatabase(':memory:'),dest=openDatabase(':memory:')
 try{
  const media=join(root,'media'),restored=join(root,'restored'),file=join(root,'copy.pssabackup'),bytes=Buffer.from('GIF89a'),name=asset(bytes)
  mkdirSync(media);writeFileSync(join(media,name),bytes)
  setCompact(db,true);saveRule(db,{...defaultRule('raid'),image:name,volume:24})
  db.prepare('INSERT INTO settings VALUES (?,?)').run('twitch.secure.v1','SECRET-MUST-NOT-LEAK')
  db.prepare('INSERT INTO settings VALUES (?,?)').run('overlay.key','PRIVATE-KEY')
  db.exec("INSERT INTO stream_sessions(channel_id,external_id,source,started_at,ended_at) VALUES ('42','session','twitch',1000,2000)")
  db.exec('INSERT INTO viewer_samples(session_id,sampled_at,viewers) VALUES (1,1500,30)')
  assert.equal(createBackup(db,media,file),1);assert.equal(validateBackup(file),1)
  const raw=new DatabaseSync(file,{readOnly:true})
  try{assert.equal(raw.prepare("SELECT count(*) n FROM settings WHERE key IN ('twitch.secure.v1','overlay.key')").get()?.n,0)}finally{raw.close()}
  assert.equal(readFileSync(file).includes(Buffer.from('SECRET-MUST-NOT-LEAK')),false)
  dest.prepare('INSERT INTO settings VALUES (?,?)').run('twitch.secure.v1','LOCAL-TOKEN')
  restoreBackup(dest,restored,file)
  assert.equal(getCompact(dest),true);assert.equal(rules(dest).find(r=>r.key==='raid')?.volume,24)
  assert.deepEqual(readFileSync(join(restored,name)),bytes)
  assert.equal(dest.prepare('SELECT viewers FROM viewer_samples').get()?.viewers,30)
  assert.equal(dest.prepare("SELECT value FROM settings WHERE key='twitch.secure.v1'").get()?.value,'LOCAL-TOKEN')
  assert.throws(()=>createBackup(db,media,file),/exists/)
 }finally{db.close();dest.close();rmSync(root,{recursive:true,force:true})}
})
test('tampered media rejects restore before database changes',()=>{
 const root=tmp(),db=openDatabase(':memory:')
 try{
  const media=join(root,'media'),bytes=Buffer.from('GIF89a'),name=asset(bytes),file=join(root,'bad.pssabackup')
  mkdirSync(media);writeFileSync(join(media,name),bytes);createBackup(db,media,file)
  const archive=new DatabaseSync(file)
  try{archive.prepare('UPDATE backup_media SET bytes=?').run(Buffer.from('wrong'))}finally{archive.close()}
  setCompact(db,true)
  assert.throws(()=>validateBackup(file),/checksum/)
  assert.throws(()=>restoreBackup(db,media,file),/checksum/)
  assert.equal(getCompact(db),true)
 }finally{db.close();rmSync(root,{recursive:true,force:true})}
})
test('staged restore preserves a pre-restore backup and applies exactly once',()=>{
 const root=tmp(),db=openDatabase(':memory:')
 try{
  const media=join(root,'media'),file=join(root,'source.pssabackup')
  setCompact(db,true);createBackup(db,media,file);setCompact(db,false)
  stageRestore(file,root)
  assert.throws(()=>stageRestore(file,root),/staged/)
  assert.match(pendingRestore(db,root),/Przywrócono/)
  assert.equal(getCompact(db),true);assert.equal(pendingRestore(db,root),'')
  const previous=readdirSync(root).find(x=>x.startsWith('before-restore-'))!
  assert.ok(previous)
  const old=new DatabaseSync(join(root,previous),{readOnly:true});try{assert.equal(getCompact(old),false)}finally{old.close()}
 }finally{db.close();rmSync(root,{recursive:true,force:true})}
})
test('runtime preferences persist and reject invalid modes',()=>{
 const db=openDatabase(':memory:')
 try{assert.equal(preferences(db).mode,'studio');const v={...preferences(db),mode:'streaming' as const,onboarded:true};savePreferences(db,v);assert.deepEqual(preferences(db),v);assert.throws(()=>savePreferences(db,{...v,mode:'turbo'}));assert.deepEqual(preferences(db),v)}finally{db.close()}
})
test('release selection follows channel, semantic version and fixed official repository URL',async()=>{
 const releases=[{tag_name:'v2.0.0-beta.9',draft:false,prerelease:true,html_url:'https://evil.example'},{tag_name:'v2.0.0-beta.10',draft:false,prerelease:true},{tag_name:'v1.9.0',draft:false,prerelease:false},{tag_name:'v3.0.0',draft:true,prerelease:false}]
 assert.equal(compareVersions('2.0.0-beta.10','2.0.0-beta.9'),1)
 assert.equal(compareVersions('2.0.0','2.0.0-rc.1'),1)
 assert.equal(selectRelease(releases,'2.0.0-beta.1','stable').state,'current')
 const beta=selectRelease(releases,'2.0.0-beta.1','beta')
 assert.equal(beta.version,'2.0.0-beta.10');assert.equal(beta.state,'available');assert.match(beta.url,/^https:\/\/github\.com\/viriacci\/PanSzczesniak-Stream-Alerts\/releases\/tag\//)
 assert.equal(selectRelease([],'2.0.0-beta.1','beta').state,'none')
 const fake=(async()=>new Response('bad',{status:503})) as typeof fetch
 assert.equal((await checkRelease('2.0.0-beta.1','beta',fake)).state,'error')
})

test('exports refuse app data and never overwrite an existing file',()=>{
 const root=tmp()
 try{const dir=join(root,'data');mkdirSync(dir);const internal=join(dir,'pssa.sqlite'),external=join(root,'report.json')
  writeFileSync(internal,'database')
  assert.throws(()=>outsideData(dir,internal))
  assert.equal(outsideData(dir,external),external)
  writeNew(external,'original');assert.throws(()=>writeNew(external,'replacement'));assert.equal(readFileSync(external,'utf8'),'original')
  assert.equal(readFileSync(internal,'utf8'),'database')
  assert.equal(readdirSync(root).some(x=>x.endsWith('.tmp')),false)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('backup rejects additional schema objects before restore',()=>{
 const root=tmp(),db=openDatabase(':memory:')
 try{const file=join(root,'copy.pssabackup');createBackup(db,join(root,'media'),file)
  const bad=new DatabaseSync(file);try{bad.exec('CREATE VIEW extra AS SELECT value FROM settings')}finally{bad.close()}
  assert.throws(()=>validateBackup(file),/schema/)
 }finally{db.close();rmSync(root,{recursive:true,force:true})}
})
test('release checker rejects excessive responses',async()=>{
 const fake=(async()=>new Response('x'.repeat(2*1024*1024+1))) as typeof fetch
 assert.equal((await checkRelease('2.0.0-beta.1','beta',fake)).state,'error')
})

test('v4 archives remain restorable after v5 index migration',()=>{
 const root=tmp(),db=openDatabase(':memory:')
 try{
  const file=join(root,'v4.pssabackup'),media=join(root,'media')
  setCompact(db,true);createBackup(db,media,file)
  const old=new DatabaseSync(file)
  try{old.exec('DROP INDEX alert_queue_history; DROP INDEX events_chat_by_session; DROP INDEX events_nonchat_by_session; PRAGMA user_version=4')}finally{old.close()}
  setCompact(db,false);assert.equal(validateBackup(file),0);restoreBackup(db,media,file);assert.equal(getCompact(db),true)
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version,5)
 }finally{db.close();rmSync(root,{recursive:true,force:true})}
})

import {releaseAsset} from '../src/main/runtime/updates.ts'
import {downloadRelease,safeReleaseRedirect} from '../src/main/runtime/update-download.ts'
test('release updater accepts only exact GitHub installer with digest, checks actual bytes',async()=>{const root=tmp();const bytes=Buffer.alloc(2048,42),sha256=createHash('sha256').update(bytes).digest('hex'),name='PSSA-Setup-2.0.0-rc.13-x64.exe',url='https://github.com/viriacci/PanSzczesniak-Stream-Alerts/releases/download/v2.0.0-rc.13/'+name;const release={tag_name:'v2.0.0-rc.13',assets:[{name,browser_download_url:url,size:bytes.length,digest:'sha256:'+sha256}]};try{const asset=releaseAsset(release,'2.0.0-rc.13')!;assert.ok(asset);assert.equal(releaseAsset({...release,assets:[{...release.assets[0],digest:null}]},'2.0.0-rc.13'),undefined);assert.equal(safeReleaseRedirect('https://release-assets.githubusercontent.com/a'),true);assert.equal(safeReleaseRedirect('https://release-assets.githubusercontent.com.evil.com/a'),false);await assert.rejects(()=>downloadRelease(asset,root,(async()=>new Response(Buffer.alloc(2048))) as typeof fetch),/SHA256/);assert.equal(readdirSync(root).length,0);const path=await downloadRelease(asset,root,(async()=>new Response(bytes)) as typeof fetch);assert.deepEqual(readFileSync(path),bytes)}finally{rmSync(root,{recursive:true,force:true})}})
