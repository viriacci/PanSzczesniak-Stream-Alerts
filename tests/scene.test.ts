import {nextSceneFrame} from '../src/shared/scene-schedule.ts'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {makeLayer,parseScene,resizeDuration,snap,type Scene} from '../src/shared/scene.ts'
import {sceneForRule,titleStyle} from '../src/shared/scene-legacy.ts'
import {defaultRule,parseRule,normalizeLayout} from '../src/shared/alerts.ts'
import {createScenePlayer} from '../src/shared/scene-player.ts'
import {openDatabase} from '../src/main/database/index.ts'
import {saveRule,rules,saveScene} from '../src/main/alerts/store.ts'
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

test('saving scene preserves the latest alert settings',()=>{
 const db=openDatabase(':memory:')
 try{saveRule(db,{...defaultRule('raid'),enabled:true,priority:9,volume:32,template:'New {user}'})
 const saved=saveScene(db,'raid',fixture(),'Old title')
 assert.equal(saved.enabled,true);assert.equal(saved.priority,9);assert.equal(saved.volume,32);assert.equal(saved.template,'New {user}');assert.deepEqual(saved.scene,fixture())
 }finally{db.close()}
})

test('scene scheduler sleeps through static layers and wakes at precise boundaries',()=>{
 const base=fixture(),layer={...base.layers[0]!,enter:'none' as const,exit:'none' as const,start:1000,end:4000}
 const scene={...base,layers:[layer]}
 assert.equal(nextSceneFrame(scene,0),1000)
 assert.equal(nextSceneFrame(scene,1000),3000)
 assert.equal(nextSceneFrame(scene,4000),1000)
 const animated={...scene,layers:[{...layer,enter:'fade' as const,enterMs:300,exit:'fade' as const,exitMs:300}]}
 assert.equal(nextSceneFrame(animated,1000),16)
 assert.equal(nextSceneFrame(animated,1300),2400)
 assert.equal(nextSceneFrame(animated,3700),16)
 const particles={...scene,layers:[{...layer,kind:'particles' as const}]}
 assert.equal(nextSceneFrame(particles,1200),33)
 assert.equal(typeof new Function('return ('+nextSceneFrame.toString()+')')(),'function')
})
test('rules cache invalidates after update and does not retain rolled back profile data',()=>{
 const db=openDatabase(':memory:')
 try{const a=rules(db);assert.equal(a,rules(db));db.exec('BEGIN IMMEDIATE');saveRule(db,{...defaultRule('raid'),volume:27});assert.equal(rules(db).find(x=>x.key==='raid')?.volume,27);db.exec('ROLLBACK');assert.equal(rules(db).find(x=>x.key==='raid')?.volume,100)}
 finally{db.close()}
})

import {sampleLayer,scaleMedia,fitMediaSize,retimeLayer} from '../src/shared/scene.ts'
import {testEvent,renderText} from '../src/shared/alerts.ts'
test('keyframes interpolate, move with timeline, retain image ratio, and validate crop',()=>{const l={...fixture().layers[0]!,crop:{top:10,right:5,bottom:0,left:0},keyframes:[{...sampleLayer(fixture().layers[0]!,0),time:0,easing:'linear' as const},{...sampleLayer(fixture().layers[0]!,0),x:90,time:1000,easing:'linear' as const}]};assert.equal(sampleLayer(l,500).x,70);assert.deepEqual(parseScene({...fixture(),layers:[l]}).layers[0],l);assert.equal(retimeLayer(l,500,5000,500).keyframes?.[0]?.time,500);assert.throws(()=>parseScene({...fixture(),layers:[{...l,crop:{top:0,bottom:0,left:60,right:60}}]}));const m=fitMediaSize(800,600,1920,1080),r=scaleMedia(m.width,m.height,10,2,true);assert.ok(Math.abs(r.width/r.height-m.width/m.height)<1e-9);const raid=defaultRule('raid');assert.match(renderText(raid.template,testEvent(raid,'test')),/25/);assert.equal(sceneForRule(raid).layers[0]?.backgroundOpacity,0)})

test('default legacy layout gets modern title; custom saved scenes stay intact; explicit title style preserves identity and timeline',()=>{const raid=defaultRule('raid'),l=sceneForRule({...raid,layout:normalizeLayout({})}).layers[0]!;assert.equal(l.backgroundOpacity,0);assert.equal(l.fontWeight,700);const old={...fixture().layers[0]!,backgroundOpacity:90,background:'#843935',start:500};const scene={...fixture(),layers:[old]};assert.deepEqual(sceneForRule({...raid,scene}),scene);const styled=titleStyle(old,true);assert.equal(styled.id,old.id);assert.equal(styled.start,500);assert.equal(styled.backgroundOpacity,0);assert.equal(styled.accentColor,'#e3c048');assert.equal(parseScene({...scene,layers:[styled]}).layers[0]?.fontWeight,700)})
