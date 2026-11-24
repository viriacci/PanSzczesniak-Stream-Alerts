import {parseVariants} from '../../shared/variants.ts'
import {randomUUID} from 'node:crypto'
import type {DatabaseSync} from 'node:sqlite'
import {defaultRule,parseRule,validKey,validMedia,type AlertRule} from '../../shared/alerts.ts'
import {parseScene,type Scene} from '../../shared/scene.ts'
import {sceneForRule} from '../../shared/scene-legacy.ts'
import {rules,saveRules,saveScene,saveRule} from '../alerts/store.ts'
import {mediaKind,type LibraryAction,type LibraryState,type Asset,type Profile,type SceneTemplate} from '../../shared/library.ts'
import {readdir,stat,realpath} from 'node:fs/promises'
import {join,relative,isAbsolute} from 'node:path'
type ProfileRecord=Profile&{rules:AlertRule[]}
type Metadata={name:string;folder:string;tags:string[]}
type Config={active:string;profiles:ProfileRecord[];templates:SceneTemplate[];metadata:Record<string,Metadata>}
const key='library.v1'
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v)
const validAsset=(v:unknown):v is string=>typeof v==='string'&&!!v&&validMedia(v)
const label=(v:unknown,max=100)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f]/.test(v))throw Error('Invalid name');return v.trim()}
const category=(v:unknown)=>{if(typeof v!=='string'||!/^\d{0,30}$/.test(v))throw Error('Invalid category');return v}
function metadata(v:any):Metadata{
 if(typeof v.folder!=='string'||v.folder.length>120||/[\x00-\x1f]/.test(v.folder)||!Array.isArray(v.tags)||v.tags.length>12)throw Error('Invalid metadata')
 return {name:label(v.name,200),folder:v.folder.trim(),tags:[...new Set<string>(v.tags.map((t:unknown)=>label(t,40)))]}
}
export function config(db:DatabaseSync):Config{
 const raw=db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value
 if(typeof raw!=='string')return {active:'default',profiles:[{id:'default',name:'Domyślny',categoryId:'',rules:[]}],templates:[],metadata:{}}
 const v=JSON.parse(raw)
 if(!v||!Array.isArray(v.profiles)||v.profiles.length<1||v.profiles.length>30||!Array.isArray(v.templates)||v.templates.length>100||!v.metadata||typeof v.metadata!=='object')throw Error('Invalid library configuration')
 const profiles:ProfileRecord[]=v.profiles.map((p:any)=>{if(!validId(p.id)||!Array.isArray(p.rules)||p.rules.length>1024)throw Error('Invalid profile');return {id:p.id,name:label(p.name),categoryId:category(p.categoryId),rules:p.rules.map(parseRule)}})
 const templates:SceneTemplate[]=v.templates.map((t:any)=>{if(!validId(t.id))throw Error('Invalid template');return {id:t.id,name:label(t.name),scene:parseScene(t.scene)}})
 if(!profiles.some(p=>p.id===v.active)||new Set(profiles.map(p=>p.id)).size!==profiles.length)throw Error('Invalid active profile')
 const entries=Object.entries(v.metadata);if(entries.length>10000)throw Error('Too many asset records')
 const meta:Record<string,Metadata>={}
 for(const [id,m] of entries)if(validAsset(id))meta[id]=metadata(m)
 return {active:v.active,profiles,templates,metadata:meta}
}
export function activeProfile(db:DatabaseSync){const id=db.prepare("SELECT value FROM settings WHERE key='library.active'").get()?.value;return typeof id==='string'?id:'default'}
function persist(db:DatabaseSync,c:Config){const json=JSON.stringify(c);if(Buffer.byteLength(json,'utf8')>32*1024*1024)throw Error('Library configuration exceeds 32 MB');db.prepare("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,json);db.prepare("INSERT INTO settings(key,value) VALUES ('library.active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(c.active)}
function refsForRule(r:AlertRule){return [r.image,r.audio,...(r.scene?.layers.map(l=>l.asset)??[]),...(r.variants??[]).flatMap(v=>v.scene.layers.map(l=>l.asset))].filter(validAsset)}
export function references(db:DatabaseSync,c=config(db)){
 const refs=new Map<string,number>();const add=(ids:string[])=>{for(const id of new Set(ids))if(validAsset(id))refs.set(id,(refs.get(id)??0)+1)}
 for(const r of rules(db))add(refsForRule(r))
 for(const p of c.profiles)if(p.id!==c.active)for(const r of p.rules)add(refsForRule(r))
 for(const t of c.templates)add(t.scene.layers.map(l=>l.asset))
 // Retain references in queued and historical immutable playback snapshots.
 for(const row of db.prepare('SELECT DISTINCT rule_json FROM alert_queue').iterate())add(refsForRule(parseRule(JSON.parse(String(row.rule_json)))))
 return refs
}
export function profileForCategory(db:DatabaseSync,id:string){if(!id)return null;const c=config(db);return c.profiles.find(p=>p.categoryId===id)?.id??null}
export function activate(db:DatabaseSync,id:string){
 const c=config(db);if(c.active===id)return false
 const next=c.profiles.find(p=>p.id===id),old=c.profiles.find(p=>p.id===c.active)
 if(!next||!old)throw Error('Profile not found')
 db.exec('BEGIN IMMEDIATE');try{old.rules=rules(db);saveRules(db,next.rules);next.rules=[];c.active=id;persist(db,c);db.exec('COMMIT');return true}catch(e){db.exec('ROLLBACK');throw e}
}
export function libraryAction(db:DatabaseSync,value:unknown){
 if(!value||typeof value!=='object')throw Error('Invalid library action')
 const x=value as LibraryAction,c=config(db)
 if(x.type==='profile-activate'){if(!validId(x.id))throw Error('Invalid profile');activate(db,x.id);return}
 if(x.type==='asset-edit'){if(!validAsset(x.id))throw Error('Invalid media');if(!c.metadata[x.id]&&Object.keys(c.metadata).length>=10000)throw Error('Library full');c.metadata[x.id]=metadata(x)}
 else if(x.type==='profile-create'){
  if(c.profiles.length>=30)throw Error('Profile limit')
  const cat=category(x.categoryId);if(cat&&c.profiles.some(p=>p.categoryId===cat))throw Error('Category already assigned')
  c.profiles.push({id:randomUUID(),name:label(x.name),categoryId:cat,rules:rules(db)})
 }else if(x.type==='profile-edit'){
  const p=c.profiles.find(p=>p.id===x.id);if(!p)throw Error('Profile not found')
  const cat=category(x.categoryId);if(cat&&c.profiles.some(y=>y.id!==p.id&&y.categoryId===cat))throw Error('Category already assigned')
  p.name=label(x.name);p.categoryId=cat
 }else if(x.type==='profile-delete'){
  if(x.id===c.active||x.id==='default'||!c.profiles.some(p=>p.id===x.id))throw Error('Cannot delete profile')
  c.profiles=c.profiles.filter(p=>p.id!==x.id)
 }else if(x.type==='template-create'){
  if(c.templates.length>=100||typeof x.key!=='string'||!validKey(x.key))throw Error('Invalid template')
  const r=rules(db).find(r=>r.key===x.key);if(!r)throw Error('Alert not found')
  c.templates.push({id:randomUUID(),name:label(x.name),scene:parseScene(sceneForRule(r))})
 }else if(x.type==='template-apply'){
  const t=c.templates.find(t=>t.id===x.id);if(!t||typeof x.key!=='string'||!validKey(x.key))throw Error('Template not found')
  saveScene(db,x.key,t.scene,x.key);return
 }else if(x.type==='template-delete'){if(!c.templates.some(t=>t.id===x.id))throw Error('Template not found');c.templates=c.templates.filter(t=>t.id!==x.id)}
 else if(x.type==='variant-save'||x.type==='variant-delete'){
  if(typeof x.key!=='string'||!validKey(x.key))throw Error('Invalid alert')
  const r=rules(db).find(r=>r.key===x.key);if(!r)throw Error('Alert not found')
  const variants=r.variants??[]
  if(x.type==='variant-delete'){if(!variants.some(v=>v.id===x.id))throw Error('Variant not found');saveRule(db,{...r,variants:variants.filter(v=>v.id!==x.id)});return}
  const old=x.id===undefined?undefined:variants.find(v=>v.id===x.id)
  if(x.id!==undefined&&!old)throw Error('Variant not found')
  const t=c.templates.find(t=>t.id===x.templateId)
  if(!t&&!(old&&x.templateId===''))throw Error('Template not found')
  const v={id:old?.id??randomUUID(),name:x.name,scene:t?.scene??old!.scene,weight:x.weight,minCount:x.minCount,maxCount:x.maxCount,minMonths:x.minMonths,categoryId:x.categoryId}
  saveRule(db,{...r,variants:parseVariants([...variants.filter(y=>y.id!==v.id),v])});return
 }
 else throw Error('Invalid library action')
 persist(db,c)
}
export function rememberAsset(db:DatabaseSync,id:string,name:string){
 if(!validAsset(id))throw Error('Invalid media')
 const c=config(db);if(c.metadata[id])return
 if(Object.keys(c.metadata).length>=10000)return
 c.metadata[id]={name:label(name.replace(/[\x00-\x1f]/g,'').slice(0,200)||id,200),folder:'',tags:[]};persist(db,c)
}
export async function libraryState(db:DatabaseSync,dir:string):Promise<LibraryState>{
 const c=config(db),refs=references(db,c),ids=new Set([...Object.keys(c.metadata),...refs.keys()])
 let root:string|undefined
 try{root=await realpath(dir);for(const e of await readdir(root,{withFileTypes:true}))if(e.isFile()&&validAsset(e.name))ids.add(e.name)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
 const assets:Asset[]=[]
 const all=[...ids].sort();if(all.length>10000)throw Error('Library index limit exceeded (10000 assets)')
 for(const id of all){
  let bytes:number|null=null
  if(root)try{const file=await realpath(join(root,id)),rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid media path');const st=await stat(file);if(st.isFile())bytes=st.size}catch{}
  assets.push({id,...(c.metadata[id]??{name:id,folder:'',tags:[]}),kind:mediaKind(id),bytes,missing:bytes===null,references:refs.get(id)??0})
 }
 return {assets,activeProfile:c.active,profiles:c.profiles.map(({id,name,categoryId})=>({id,name,categoryId})),templates:c.templates}
}

export function assertActiveProfile(db:DatabaseSync,expected:unknown){if(typeof expected!=='string'||expected!==activeProfile(db))throw Error('Active profile changed; reopen editor')}
