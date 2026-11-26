import {readFileSync,readdirSync} from 'node:fs'
import {join,relative} from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
const codes=['pl','en','de']
const catalogs=codes.map(code=>JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url),'utf8')))
const keys=Object.keys(catalogs[0].translations).sort()
const keySet=new Set(keys)
const vars=s=>[...s.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>m[1]).sort()
for(const [i,c] of catalogs.entries()){
 assert.equal(c.meta.code,codes[i]);assert.equal(c.meta.schemaVersion,1)
 assert.deepEqual(Object.keys(c.translations).sort(),keys)
 for(const key of keys){assert.equal(typeof c.translations[key],'string');assert.ok(c.translations[key].trim());assert.deepEqual(vars(c.translations[key]),vars(catalogs[0].translations[key]),codes[i]+': '+key)}
}
function* walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())yield* walk(path);else yield path}}
const used=new Set(),missing=[],candidates={}
function check(key,path,line){used.add(key);if(!keySet.has(key))missing.push(path+':'+line+' '+key)}
// Explicit dynamic families are checked as well as direct calls.
const families={
 'nav.':['queue','rewards','alerts','studio','profiles','library','dashboard','analytics','integrations','diagnostics','documentation','settings'],
 'nav.desc.':['studio','library','diagnostics','documentation','settings'],
 'nav.group.':['main','extra','analytics','system'],
 'queue.status.':['pending','playing','done','skipped','failed','suppressed'],
 'queue.source.':['twitch','test','replay'],
 'queue.reason.':['disabled','minimum','cooldown','capacity','manual','restart','shutdown','overlay-disconnected','ack-timeout','restart-limit','media-error','transport-error'],
 'alert.type.':['raid','follow','sub','prime_sub','resub','gift','mass_gift','bits'],
 'alert.hint.':['raidUser','viewers','followUser','subUser','months','donor','count','bits','rewardUser','reward','user'],
 'studio.kind.':['text','image','video','audio','shape','particles'],
 'studio.variable.':['alert','user','reward','viewers','bits','count','months'],
 'studio.geometry.':['x','y','width','height','rotation','opacity','top','right','bottom','left'],
 'studio.animation.':['none','fade','slide_left','slide_right','slide_up','slide_down','zoom','bounce'],
 'studio.border.':['none','solid','dashed','dotted','double'],
 'region.':['auto','pl-PL','en-US','en-GB','de-DE'],
 'analytics.event.':['follows','subs','prime','resubs','gifts','bits','raids','raidViewers','rewards','points','messages','chatters'],
 'runtime.mode.':['studio','streaming','background'],
 'obs.phase.':['offline','connecting','connected','error'],
 'dock.twitch.':['disconnected','authorizing','connecting','connected','retrying','error'],
 'alert.default.':['redemption','raid','follow','sub','prime_sub','resub','gift','mass_gift','bits'],
 'agent.dock.':['unavailable','running','starting','offline','badKey','connecting','start','stop','restart','refresh'],
 'diag.':['version','schema','platform','arch','electron','chromium','node','processes','memoryMB','cpu','databaseBytes','queuePending','overlayClients','twitch','obs','agent','restoreStatus','uptime']
}
for(const [prefix,entries] of Object.entries(families))for(const suffix of entries)check(prefix+suffix,'dynamic family',0)
for(const path of walk('src/renderer/src')){
 if(!/\.tsx?$/.test(path))continue
 const source=readFileSync(path,'utf8'),file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
 const hard=[]
 function visit(node){
  const line=()=>file.getLineAndCharacterOfPosition(node.getStart(file)).line+1
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['t','tr'].includes(node.expression.text)&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text,path,line())
  if(ts.isJsxText(node)||ts.isStringLiteral(node)){
   const value=node.text.trim();if(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(value)&&value.length>2)hard.push(line()+': '+value.slice(0,100))
  }
  ts.forEachChild(node,visit)
 }
 visit(file);if(hard.length)candidates[path]=hard
}
for(const path of walk('setup')){
 if(!/\.(cs|xaml)$/.test(path))continue
 const source=readFileSync(path,'utf8')
 for(const match of source.matchAll(/(?:L\.T\(\s*"([^"]+)"|\{DynamicResource ((?:setup|common)\.[\w.-]+)\})/g))check(match[1]??match[2],path,source.slice(0,match.index).split('\n').length)
}
for(const path of ['obs-dock/pssa-dock.cpp','src/main/runtime/service.ts','src/shared/messages.ts']){
 const source=readFileSync(path,'utf8')
 for(const m of source.matchAll(/(?:dtr\("([^"]+)"\)|updateText\('([^']+)'|"((?:message\.)[\w.-]+)")/g))check(m[1]??m[2]??m[3],path,source.slice(0,m.index).split('\n').length)
}
assert.deepEqual(missing,[],'Missing referenced translation keys')
console.log('Validated '+keys.length+' keys in '+codes.length+' languages; '+used.size+' statically referenced or enumerated.')
console.log('Polish literal candidates (includes intentional persisted text and untranslated modules):')
for(const [path,lines] of Object.entries(candidates))console.log(relative('.',path)+': '+lines.length+' candidates')
