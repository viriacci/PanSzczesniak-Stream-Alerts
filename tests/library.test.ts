import {assertActiveProfile} from '../src/main/library/store.ts'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {openDatabase} from '../src/main/database/index.ts'
import {defaultRule,parseRule} from '../src/shared/alerts.ts'
import {makeLayer,type Scene} from '../src/shared/scene.ts'
import {pickVariant,parseVariants} from '../src/shared/variants.ts'
import {activeProfile,activate,config,libraryAction,libraryState,rememberAsset,profileForCategory,references} from '../src/main/library/store.ts'
import {saveRule,rules} from '../src/main/alerts/store.ts'
import {AlertQueue,type Transport} from '../src/main/alerts/queue.ts'
import {copyMedia} from '../src/main/alerts/media.ts'
const scene:Scene={version:1,width:1920,height:1080,duration:5000,layers:[makeLayer('text','text',5000)]}
const current=(db:ReturnType<typeof openDatabase>)=>rules(db).find(r=>r.key==='raid')!
test('profiles preserve independent rule snapshots and category mapping across switches',()=>{
 const db=openDatabase(':memory:')
 try{
  saveRule(db,{...defaultRule('raid'),enabled:true,volume:35})
  libraryAction(db,{type:'profile-create',name:'RDR2',categoryId:'123'})
  const id=config(db).profiles.find(p=>p.name==='RDR2')!.id
  assert.equal(profileForCategory(db,'123'),id)
  assert.throws(()=>libraryAction(db,{type:'profile-create',name:'Duplicate',categoryId:'123'}))
  assert.equal(activate(db,id),true);assert.equal(activeProfile(db),id)
  assert.equal(current(db).volume,35)
  saveRule(db,{...current(db),volume:72})
  assert.equal(activate(db,'default'),true);assert.equal(current(db).volume,35)
  activate(db,id);assert.equal(current(db).volume,72)
  assert.throws(()=>libraryAction(db,{type:'profile-delete',id}))
  assert.throws(()=>activate(db,'missing'));assert.equal(activeProfile(db),id)
 }finally{db.close()}
})
test('switching profiles leaves immutable queued playback rules untouched',()=>{
 const db=openDatabase(':memory:')
 const t:Transport={online:()=>false,send:()=>false,active:()=>false,cancel:()=>{},volume:()=>{}}
 const q=new AlertQueue(db,t)
 try{
  saveRule(db,{...defaultRule('raid'),enabled:true,volume:25})
  libraryAction(db,{type:'profile-create',name:'Another',categoryId:''})
  const id=config(db).profiles[1]!.id
  q.enqueue({id:'event',kind:'raid',user:'A',count:15},current(db))
  activate(db,id);saveRule(db,{...current(db),volume:90})
  const snapshot=JSON.parse(String(db.prepare('SELECT rule_json FROM alert_queue').get()?.rule_json))
  assert.equal(snapshot.volume,25);assert.equal(current(db).volume,90)
 }finally{q.stop();db.close()}
})
test('templates and variants copy scenes, preserve alert settings and validate weights',()=>{
 const db=openDatabase(':memory:')
 try{
  saveRule(db,{...defaultRule('raid'),scene,priority:9,volume:41})
  libraryAction(db,{type:'template-create',key:'raid',name:'Gold'})
  const id=config(db).templates[0]!.id
  libraryAction(db,{type:'template-apply',id,key:'follow'})
  assert.deepEqual(rules(db).find(r=>r.key==='follow')?.scene,scene)
  const command={type:'variant-save',key:'raid',name:'Large raid',templateId:id,weight:3,minCount:50,maxCount:null,minMonths:0,categoryId:'123'}
  assert.throws(()=>libraryAction(db,{...command,weight:0}))
  libraryAction(db,command)
  assert.equal(current(db).priority,9);assert.equal(current(db).volume,41)
  const variant=current(db).variants![0]!
  libraryAction(db,{type:'template-delete',id})
  assert.deepEqual(current(db).variants![0]!.scene,scene)
  libraryAction(db,{...command,id:variant.id,templateId:'',weight:8})
  assert.equal(current(db).variants![0]!.weight,8)
  libraryAction(db,{type:'variant-delete',key:'raid',id:variant.id})
  assert.equal(current(db).variants!.length,0)
 }finally{db.close()}
})
test('weighted variants enforce count, months and category; fallback is undefined',()=>{
 const base={id:'a',name:'A',scene,weight:1,minCount:10,maxCount:30,minMonths:2,categoryId:'123'}
 const variants=parseVariants([base,{...base,id:'b',weight:3}])
 assert.equal(pickVariant(variants,9,2,'123'),undefined)
 assert.equal(pickVariant(variants,31,2,'123'),undefined)
 assert.equal(pickVariant(variants,20,1,'123'),undefined)
 assert.equal(pickVariant(variants,20,2,''),undefined)
 assert.equal(pickVariant(variants,20,2,'123',()=>.1)?.id,'a')
 assert.equal(pickVariant(variants,20,2,'123',()=>.5)?.id,'b')
 assert.throws(()=>parseRule({...defaultRule('raid'),variants:[base,base]}))
})
test('media catalog deduplicates imported content, keeps metadata and detects referenced missing files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pssa-library-')),db=openDatabase(':memory:')
 try{
  const a=join(dir,'a.gif'),b=join(dir,'b.gif'),media=join(dir,'media')
  await writeFile(a,'GIF89a');await writeFile(b,'GIF89a')
  const id=await copyMedia(a,media,'image');assert.equal(await copyMedia(b,media,'image'),id)
  rememberAsset(db,id,'First.gif');rememberAsset(db,id,'Second.gif')
  libraryAction(db,{type:'asset-edit',id,name:'Dragon',folder:'Fantasy/Raid',tags:['gold','gold','raid']})
  saveRule(db,{...defaultRule('raid'),image:id})
  libraryAction(db,{type:'profile-create',name:'Backup',categoryId:''})
  const before=await libraryState(db,media)
  assert.equal(before.assets.length,1);assert.equal(before.assets[0]?.name,'Dragon')
  assert.deepEqual(before.assets[0]?.tags,['gold','raid']);assert.equal(before.assets[0]?.references,2)
  await rm(join(media,id));const after=await libraryState(db,media)
  assert.equal(after.assets[0]?.missing,true);assert.equal(after.assets[0]?.bytes,null)
  assert.equal(references(db).get(id),2)
  assert.throws(()=>libraryAction(db,{type:'asset-edit',id:'../secret',name:'Bad',folder:'',tags:[]}))
 }finally{db.close();await rm(dir,{recursive:true,force:true})}
})

test('a stale editor cannot save into another active profile',()=>{
 const db=openDatabase(':memory:')
 try{
  assert.doesNotThrow(()=>assertActiveProfile(db,'default'))
  libraryAction(db,{type:'profile-create',name:'New',categoryId:''})
  const id=config(db).profiles[1]!.id;activate(db,id)
  assert.throws(()=>assertActiveProfile(db,'default'),/profile changed/)
  assert.doesNotThrow(()=>assertActiveProfile(db,id))
 }finally{db.close()}
})
