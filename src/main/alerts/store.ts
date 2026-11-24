import type { DatabaseSync } from 'node:sqlite'
import { defaultRule, kinds, parseRule, type AlertRule } from '../../shared/alerts.ts'
export function rules(db:DatabaseSync):AlertRule[]{
 const raw=db.prepare("SELECT value FROM settings WHERE key='alerts.v1'").get()?.value
 const map=new Map(kinds.filter(k=>k!=='redemption').map(k=>[k as string,defaultRule(k)]))
 if(typeof raw==='string'){
  let list:unknown;try{list=JSON.parse(raw)}catch{throw Error('Uszkodzona konfiguracja alertów')}
  if(!Array.isArray(list))throw Error('Uszkodzona konfiguracja alertów')
  for(const item of list){const rule=parseRule(item);map.set(rule.key,rule)}
 }
 return [...map.values()]
}
export function saveRules(db:DatabaseSync,list:AlertRule[]){
 const safe=list.map(parseRule)
 db.prepare("INSERT INTO settings(key,value) VALUES ('alerts.v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(safe))
}
export function saveRule(db:DatabaseSync,value:unknown){
 const rule=parseRule(value),map=new Map(rules(db).map(x=>[x.key,x]));map.set(rule.key,rule);saveRules(db,[...map.values()]);return rule
}
