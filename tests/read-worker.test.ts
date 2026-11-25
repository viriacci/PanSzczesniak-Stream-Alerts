import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {openDatabase} from '../src/main/database/index.ts'
import {observe} from '../src/main/live/store.ts'
import {copyMedia} from '../src/main/alerts/media.ts'
import {rememberAsset} from '../src/main/library/store.ts'
import {runReadTask} from '../src/main/runtime/read-worker.ts'
import {DAY} from '../src/shared/analytics.ts'
test('read tasks preserve live data, export privacy and media metadata',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pssa-reads-')),path=join(dir,'pssa.sqlite'),db=openDatabase(path)
 try{
  const start=Date.parse('2026-10-10T00:00:00Z'),filter={channel:'42',from:start,to:start+DAY,category:'',source:'all'}
  observe(db,'42',{id:'live',startedAt:start+1000,title:'Live',categoryId:'1',category:'Game',viewers:15},start+1000)
  observe(db,'42',null,start+61000)
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').run('secret','do-not-export')
  const report=await runReadTask(path,{type:'analytics',filter})
  assert.ok(typeof report==='object'&&'current' in report)
  assert.equal(report.current.samples,1);assert.equal(report.current.average,15)
  const json=await runReadTask(path,{type:'export',filter,format:'json'})
  assert.equal(typeof json,'string');assert.ok(!String(json).includes('do-not-export'))
  const source=join(dir,'one.gif'),media=join(dir,'media');await writeFile(source,'GIF89a')
  const id=await copyMedia(source,media,'image');rememberAsset(db,id,'One.gif')
  const catalog=await runReadTask(path,{type:'library',media})
  assert.ok(typeof catalog==='object'&&'assets' in catalog)
  assert.equal(catalog.assets[0]?.id,id);assert.equal(catalog.assets[0]?.name,'One.gif')
  await assert.rejects(runReadTask(path,{type:'analytics',filter:{...filter,to:start+400*DAY}}))
  db.prepare('UPDATE settings SET value=? WHERE key=?').run('still-writeable','secret')
  assert.equal(db.prepare('SELECT value FROM settings WHERE key=?').get('secret')?.value,'still-writeable')
 }finally{db.close();await rm(dir,{recursive:true,force:true})}
})
