import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultRule,parseRule,renderText,normalizeLayout} from '../src/shared/alerts.ts'
import {normalizeEvent,subscriptions} from '../src/main/twitch/events.ts'
import {openDatabase} from '../src/main/database/index.ts'
import {rules,saveRule} from '../src/main/alerts/store.ts'
import {importLegacy} from '../src/main/alerts/import.ts'
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

test('Twitch notifications normalize and group gifts',()=>{
 assert.equal(subscriptions('42').length,8)
 assert.deepEqual(normalizeEvent('e','channel.raid',{from_broadcaster_user_name:'X',viewers:8}),{id:'e',kind:'raid',user:'X',count:8})
 assert.equal(normalizeEvent('e','channel.chat.notification',{notice_type:'sub',sub:{is_prime:true}})?.kind,'prime_sub')
 assert.equal(normalizeEvent('e','channel.chat.notification',{notice_type:'sub_gift',sub_gift:{community_gift_id:'batch'}}),undefined)
 assert.equal(normalizeEvent('e','channel.chat.notification',{notice_type:'community_sub_gift',community_sub_gift:{total:10}})?.count,10)
})
test('rule validation rejects paths and invalid durations; text rendering is literal',()=>{
 const rule=defaultRule('raid')
 assert.throws(()=>parseRule({...rule,image:'../config.json'}))
 assert.throws(()=>parseRule({...rule,duration:NaN}))
 assert.equal(renderText('{user} {viewers}',{id:'e',kind:'raid',user:'<b>X</b>',count:4}),'<b>X</b> 4')
 assert.equal(normalizeLayout({caption:{font_size:999}})?.caption.font_size,160)
})
test('rules persist and reject invalid updates',()=>{
 const db=openDatabase(':memory:')
 try{assert.equal(rules(db).length,8);const rule={...defaultRule('raid'),enabled:true};saveRule(db,rule);assert.equal(rules(db).find(x=>x.key==='raid')?.enabled,true);assert.throws(()=>saveRule(db,{...rule,key:'../bad'}))}finally{db.close()}
})
test('legacy import copies only safe media and ignores credentials',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pssa-import-'))
 try{
  await mkdir(join(root,'media'));await writeFile(join(root,'media','x.gif'),'GIF89a')
  const file=join(root,'config.json')
  await writeFile(file,JSON.stringify({access_token:'secret',alerts:{raid:{enabled:true,gif_url:'media/x.gif',sound_url:'media/../secret.mp3',duration:6}},layouts:{raid:{text_template:'{user}'}}}))
  const result=await importLegacy(file,join(root,'target'))
  assert.equal(result.rules.length,1);assert.match(result.rules[0]!.image,/^[a-f0-9]{64}\.gif$/)
  assert.equal(result.rules[0]!.audio,'');assert.equal(result.warnings.length,1)
  assert.equal(result.rules[0]!.template,'{user}');assert.equal(JSON.stringify(result).includes('"access_token"'),false)
 }finally{await rm(root,{recursive:true,force:true})}
})

test('shared chat notifications do not trigger local sub alerts',()=>{
 assert.equal(normalizeEvent('e','channel.chat.notification',{notice_type:'sub',source_broadcaster_user_id:'99',broadcaster_user_id:'42'}),undefined)
})
test('media types cannot be swapped between image and audio',()=>{
 assert.throws(()=>parseRule({...defaultRule('raid'),image:'a'.repeat(64)+'.mp3'}))
 assert.throws(()=>parseRule({...defaultRule('raid'),audio:'a'.repeat(64)+'.png'}))
})

import {parseRewards,rewardImage} from '../src/shared/alerts.ts'
test('reward tiles prefer Twitch custom artwork with safe CDN fallback',()=>{const custom='https://static-cdn.jtvnw.net/custom-reward-images/abc/4x.png',fallback='https://static-cdn.jtvnw.net/default.png';const items=parseRewards([{id:'a',title:'A',cost:50,image:{url_4x:custom},default_image:{url_4x:fallback},background_color:'#aabbcc'},{id:'b',title:'B',cost:10,image:{url_4x:'https://evil.example/a.png'},default_image:{url_4x:fallback}}]);assert.equal(items[0]?.image,custom);assert.equal(items[0]?.color,'#aabbcc');assert.equal(items[1]?.image,fallback);assert.equal(rewardImage('https://static-cdn.jtvnw.net.evil.example/a'),undefined)})
