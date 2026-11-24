import {test} from 'node:test'
import assert from 'node:assert/strict'
import {makeLayer,parseScene,resizeDuration,snap,type Scene} from '../src/shared/scene.ts'
import {sceneForRule} from '../src/shared/scene-legacy.ts'
import {defaultRule,parseRule} from '../src/shared/alerts.ts'
import {createScenePlayer} from '../src/shared/scene-player.ts'
import {openDatabase} from '../src/main/database/index.ts'
import {saveRule,rules} from '../src/main/alerts/store.ts'
const fixture=():Scene=>({version:1,width:1920,height:1080,duration:5000,layers:[makeLayer('text','text-1',5000)]})
test('scene schema roundtrips and rejects duplicate ids, invalid timeline and unsafe assets',()=>{
 const s=fixture();assert.deepEqual(parseScene(s),s)
 assert.throws(()=>parseScene({...s,layers:[s.layers[0],s.layers[0]]}))
 assert.throws(()=>parseScene({...s,layers:[{...s.layers[0],end:6000}]}))
 assert.throws(()=>parseScene({...s,layers:[{...makeLayer('video','v',5000),asset:'../../secret.mp4'}]}))
 assert.throws(()=>parseScene({...s,layers:[{...makeLayer('image','v',5000),asset:'a'.repeat(64)+'.mp4'}]}))
 assert.throws(()=>parseScene({...s,layers:[{...s.layers[0],font:'Arial; color:red'}]}))
})
test('legacy rule converts to scene with original media, text, geometry and duration',()=>{
 const rule={...defaultRule('raid'),duration:7,image:'a'.repeat(64)+'.gif',audio:'b'.repeat(64)+'.mp3'}
 const scene=sceneForRule(rule)
 assert.equal(scene.duration,7000)
 assert.deepEqual(scene.layers.map(l=>l.kind),['image','text','audio'])
 assert.equal(scene.layers[0]?.asset,rule.image)
 assert.equal(scene.layers[1]?.text,'{alert}')
 assert.deepEqual(parseScene(scene),scene)
})
test('scene duration is authoritative; saved rules roundtrip without SQL migration',()=>{
 const db=openDatabase(':memory:')
 try{const scene=fixture(),rule={...defaultRule('raid'),duration:2,scene};assert.equal(parseRule(rule).duration,5);saveRule(db,rule);assert.deepEqual(rules(db).find(r=>r.key==='raid')?.scene,scene)}finally{db.close()}
})
test('shortening timeline keeps each layer valid and snapping bounded',()=>{
 const scene=fixture();scene.layers.push({...makeLayer('shape','shape',5000),start:4500})
 const smaller=resizeDuration(scene,1000)
 assert.equal(smaller.layers[1]?.start,999);assert.equal(smaller.layers[1]?.end,1000);assert.deepEqual(parseScene(smaller),smaller)
 assert.equal(snap(101,true),100);assert.equal(snap(-10,true),0);assert.equal(snap(49.3,true),50)
})
test('shared player source serializes as standalone browser JS',()=>{
 const source=createScenePlayer.toString()
 assert.equal(typeof new Function('return ('+source+')')(),'function')
})
