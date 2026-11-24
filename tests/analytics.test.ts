import {test} from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase} from '../src/main/database/index.ts'
import {observe,recordEvent} from '../src/main/live/store.ts'
import {report} from '../src/main/analytics/store.ts'
import {decodeHistory,encodeCsv,importHistory,exportHistory} from '../src/main/analytics/transfer.ts'
import {DAY,parseFilter,type HistoricalSession,type AnalyticsFilter} from '../src/shared/analytics.ts'
const start=Date.parse('2026-10-10T00:00:00Z'),now=start+10*DAY
const filter:AnalyticsFilter={channel:'42',from:start,to:start+DAY,category:'',source:'all'}
const hist=(changes:Partial<HistoricalSession>={}):HistoricalSession=>({channel:'42',externalId:'old',startedAt:start+3600000,endedAt:start+7200000,title:'Historical',categoryId:'1',category:'Game',average:20,peak:40,provenance:'User CSV',...changes})
const stream=(id='stream',startedAt=start+10800000,viewers=10,categoryId='1')=>({id,startedAt,title:'Live',categoryId,category:categoryId==='1'?'Game':'Next',viewers})
test('source-aware reports separate sampled and imported averages, and preserve missing values',()=>{
 const db=openDatabase(':memory:')
 try{
  importHistory(db,[hist()],'json',now)
  observe(db,'42',stream(),start+10800000)
  observe(db,'42',stream('stream',start+10800000,30),start+10830000)
  observe(db,'42',null,start+10900000)
  const r=report(db,filter)
  assert.equal(r.current.sessions,2);assert.equal(r.current.average,20);assert.equal(r.current.samples,2)
  assert.equal(r.current.importedAverage,20);assert.equal(r.current.importedPeak,40)
  assert.equal(r.current.peak,30);assert.equal(r.previous.average,null);assert.equal(r.previous.events,null)
  assert.equal(r.current.days[0]?.samples,2);assert.equal(r.current.heatmap[0]?.samples,2)
  assert.equal(report(db,{...filter,source:'imported'}).current.average,null)
 }finally{db.close()}
})
test('range boundaries clip time and avoid inventing partial imported averages',()=>{
 const db=openDatabase(':memory:')
 try{
  importHistory(db,[hist({startedAt:start-DAY/2,endedAt:start+DAY/2})],'csv',now)
  const r=report(db,filter);assert.equal(r.current.duration,DAY/2);assert.equal(r.current.importedAverage,null)
  assert.equal(r.previous.duration,DAY/2)
  assert.equal(report(db,{...filter,from:start+DAY/2,to:start+DAY}).current.sessions,0)
 }finally{db.close()}
})
test('local data wins over overlapping imports even when collected later',()=>{
 const db=openDatabase(':memory:')
 try{
  assert.deepEqual(importHistory(db,[hist()],'csv',now),{added:1,skipped:0})
  assert.deepEqual(importHistory(db,[hist()],'json',now),{added:0,skipped:1})
  observe(db,'42',stream('old',start+3600000,5),start+3600000)
  assert.equal(report(db,filter).current.importedSessions,0)
  assert.equal(report(db,filter).current.localSessions,1)
  assert.equal(db.prepare('SELECT count(*) n FROM imported_summaries').get()?.n,1)
 }finally{db.close()}
})
test('category filters use per-sample category; event aggregation does not fabricate game attribution',()=>{
 const db=openDatabase(':memory:')
 try{
  observe(db,'42',stream(),start+10800000)
  recordEvent(db,'42',{id:'c1',kind:'chat',at:start+10800000,chatter:'a'})
  recordEvent(db,'42',{id:'c2',kind:'chat',at:start+10800000,chatter:'a'})
  recordEvent(db,'42',{id:'b',kind:'bits',at:start+10800000,count:250})
  observe(db,'42',stream('stream',start+10800000,50,'2'),start+10830000)
  const r=report(db,filter);assert.equal(r.current.events?.messages,2);assert.equal(r.current.events?.chatters,1);assert.equal(r.current.events?.bits,250)
  const filtered=report(db,{...filter,category:'id:2'})
  assert.equal(filtered.current.average,50);assert.equal(filtered.current.samples,1);assert.equal(filtered.current.events,null);assert.equal(filtered.categories.length,2)
 }finally{db.close()}
})
test('CSV roundtrip handles multiline quotes and protects formula cells; invalid imports are atomic',()=>{
 const row=hist({title:'=SUM(1,2)\n"hello"',category:"'Game",average:null})
 const encoded=encodeCsv([row]);assert.ok(encoded.includes("'=SUM"))
 assert.deepEqual(decodeHistory(encoded,'csv',now),[row])
 const db=openDatabase(':memory:')
 try{
  assert.throws(()=>importHistory(db,[row,hist({average:50,peak:20})],'json',now))
  assert.equal(db.prepare('SELECT count(*) n FROM stream_sessions').get()?.n,0)
  assert.throws(()=>decodeHistory('channel,bad\n42,1','csv',now))
  assert.throws(()=>parseFilter({...filter,to:start+367*DAY}))
 }finally{db.close()}
})
test('JSON and CSV exports are importable without leaking settings or raw chat identifiers',()=>{
 const db=openDatabase(':memory:')
 try{
  importHistory(db,[hist()],'json',now)
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').run('secret','do-not-export')
  const json=exportHistory(db,filter,'json');assert.equal(json.includes('do-not-export'),false)
  assert.deepEqual(decodeHistory(json,'json',now),[hist()])
  assert.deepEqual(decodeHistory(exportHistory(db,filter,'csv'),'csv',now),[hist()])
 }finally{db.close()}
})
