import { readFile,stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { defaultRule, kinds, normalizeLayout, parseRule, validKey, type AlertRule } from '../../shared/alerts.ts'
import { legacyMedia } from './media.ts'
export async function importLegacy(file:string,target:string){
 const st=await stat(file);if(!st.isFile()||st.size>5*1024*1024)throw Error('Nieprawidłowy plik konfiguracji')
 const contents=await readFile(file,'utf8');if(Buffer.byteLength(contents,'utf8')>5*1024*1024)throw Error('Plik konfiguracji przekracza limit')
 const raw=JSON.parse(contents.replace(/^\uFEFF/,'')) as any
 if(!raw||typeof raw!=='object'||(!raw.alerts&&!raw.rewards))throw Error('Nie rozpoznano konfiguracji PSSA')
 const result:AlertRule[]=[],warnings:string[]=[]
 const rewardEntries=Object.entries(raw.rewards??{});if(rewardEntries.length>1000)throw Error('Zbyt wiele reguł w konfiguracji')
 const add=async(key:string,v:any,layout:any)=>{
  if(!validKey(key)||!v||typeof v!=='object')return
  const rule=defaultRule(key,typeof v.title==='string'?v.title.slice(0,200):key)
  rule.enabled=key.startsWith('reward:')||v.enabled===true
  const d=Number(v.duration??raw.default_duration_seconds);if(Number.isFinite(d))rule.duration=Math.max(1,Math.min(120,d))
  rule.layout=normalizeLayout(layout)
  if(typeof layout?.text_template==='string')rule.template=layout.text_template.slice(0,500)
  for(const [field,old] of [['image','gif_url'],['audio','sound_url']] as const){
   try{rule[field]=await legacyMedia(dirname(file),v[old],target,field)}catch{warnings.push(key+': brak lub nieobsługiwany plik '+field)}
  }
  result.push(parseRule(rule))
 }
 for(const kind of kinds)if(kind!=='redemption'&&raw.alerts?.[kind])await add(kind,raw.alerts[kind],raw.layouts?.[kind])
 for(const [id,value] of rewardEntries)await add('reward:'+id,value,raw.layouts?.redemption)
 return {rules:result,warnings}
}
