import type {DatabaseSync} from 'node:sqlite'
import {createHash} from 'node:crypto'
import {DAY,parseFilter,type HistoricalSession,type ImportResult} from '../../shared/analytics.ts'
import {selectedSessions,report} from './store.ts'
const fields=['channel','externalId','startedAt','endedAt','title','categoryId','category','average','peak','provenance'] as const
function text(v:unknown,max:number){if(typeof v!=='string'||v.length>max||v.includes('\0'))throw Error('Invalid text');return v}
function parseSession(v:any,now:number):HistoricalSession{
 if(!v||typeof v!=='object')throw Error('Invalid session')
 const channel=text(v.channel,30),externalId=text(v.externalId,200),categoryId=text(v.categoryId,30)
 if(!/^\d{1,30}$/.test(channel)||!/^\d{0,30}$/.test(categoryId))throw Error('Invalid channel or category')
 const startedAt=v.startedAt,endedAt=v.endedAt
 if(!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(endedAt)||startedAt<946684800000||endedAt<=startedAt||endedAt>now+60000||endedAt-startedAt>14*DAY)throw Error('Invalid session timestamps')
 const metric=(x:unknown,integer:boolean)=>{if(x===null)return null;if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>100000000||integer&&!Number.isInteger(x))throw Error('Invalid viewer metric');return x}
 const average=metric(v.average,false),peak=metric(v.peak,true)
 if(average!==null&&peak!==null&&average>peak)throw Error('Average exceeds peak')
 return {channel,externalId,startedAt,endedAt,title:text(v.title,500),categoryId,category:text(v.category,200),average,peak,provenance:text(v.provenance,200)||'User-provided file'}
}
function csvRows(input:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false
 const push=()=>{row.push(cell);cell='';closed=false;if(row.length>fields.length)throw Error('Too many columns')}
 const end=()=>{push();if(row.some(x=>x!==''))rows.push(row);row=[];if(rows.length>10001)throw Error('Too many rows')}
 for(let i=0;i<input.length;i++){
  const ch=input[i]!
  if(quoted){if(ch==='"'){if(input[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=ch}
  else if(ch===',')push()
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&input[i+1]==='\n')i++;end()}
  else if(ch==='"'&&!cell&&!closed)quoted=true
  else{if(closed||ch==='"')throw Error('Malformed CSV');cell+=ch}
  if(cell.length>1000)throw Error('CSV cell too large')
 }
 if(quoted)throw Error('Unterminated CSV quote')
 if(row.length||cell||closed)end()
 return rows
}
const protect=(s:string)=>/^[\s]*[=+@-]|^[\t\r\n']/.test(s)?"'"+s:s
const unprotect=(s:string)=>s.startsWith("'")&&(/^[\s]*[=+@-]|^[\t\r\n']/.test(s.slice(1)))?s.slice(1):s
export function encodeCsv(rows:HistoricalSession[]){
 const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"'
 return '\uFEFF'+fields.join(',')+'\r\n'+rows.map(r=>fields.map(k=>{const v=r[k];return quote(v===null?'':typeof v==='number'?String(v):protect(v))}).join(',')).join('\r\n')+'\r\n'
}
export function decodeHistory(input:string,format:'csv'|'json',now=Date.now()){
 if(Buffer.byteLength(input,'utf8')>10*1024*1024)throw Error('Import exceeds 10 MB')
 const clean=input.replace(/^\uFEFF/,'')
 let items:unknown[]
 if(format==='json'){const v=JSON.parse(clean);if(!v||v.version!==1||!Array.isArray(v.sessions))throw Error('Unsupported JSON format');items=v.sessions}
 else{
  const rows=csvRows(clean),header=rows.shift()
  if(!header||header.join(',')!==fields.join(','))throw Error('Unsupported CSV header')
  items=rows.map(row=>{if(row.length!==fields.length)throw Error('Invalid CSV row');return Object.fromEntries(fields.map((k,i)=>{const v=row[i]!;return [k,k==='startedAt'||k==='endedAt'?(/^\d+$/.test(v)?Number(v):NaN):k==='average'||k==='peak'?(v===''?null:/^\d+(\.\d+)?$/.test(v)?Number(v):NaN):unprotect(v)]}))})
 }
 if(items.length>10000)throw Error('Too many sessions')
 return items.map(v=>parseSession(v,now))
}
export function importHistory(db:DatabaseSync,rows:HistoricalSession[],format:'csv'|'json',now=Date.now()):ImportResult{
 if(rows.length>10000)throw Error('Too many sessions')
 const safe=rows.map(r=>parseSession(r,now));let added=0,skipped=0
 const overlap=db.prepare("SELECT 1 FROM stream_sessions WHERE channel_id=? AND (external_id=? OR (started_at<? AND coalesce(ended_at,last_seen_at,started_at)>?) OR started_at=?) LIMIT 1")
 const insert=db.prepare("INSERT INTO stream_sessions(channel_id,external_id,source,started_at,ended_at,title,category_id,category,last_seen_at,end_quality) VALUES (?,?,?,?,?,?,?,?,?,'imported')")
 const summary=db.prepare('INSERT INTO imported_summaries(session_id,average,peak,provenance) VALUES (?,?,?,?)')
 db.exec('BEGIN IMMEDIATE')
 try{
  for(const row of safe){
   const id=row.externalId||'historical-'+createHash('sha256').update(row.channel+':'+row.startedAt+':'+row.endedAt).digest('hex')
   if(overlap.get(row.channel,id,row.endedAt,row.startedAt,row.startedAt)){skipped++;continue}
   const result=insert.run(row.channel,id,format==='csv'?'import_csv':'import_json',row.startedAt,row.endedAt,row.title,row.categoryId,row.category,row.endedAt)
   summary.run(result.lastInsertRowid,row.average,row.peak,row.provenance);added++
  }
  db.exec('COMMIT');return {added,skipped}
 }catch(e){db.exec('ROLLBACK');throw e}
}
export function exportHistory(db:DatabaseSync,value:unknown,format:'csv'|'json'){
 const f=parseFilter(value)
 const rows=selectedSessions(db,{...f,category:''}).filter(s=>s.startedAt>=f.from&&s.endedAt<=f.to&&s.endedAt>s.startedAt&&s.endQuality!=='unknown'&&(!f.category||(s.source==='twitch'?db.prepare("SELECT 1 FROM viewer_samples WHERE session_id=? AND (CASE WHEN category_id<>'' THEN 'id:'||category_id ELSE 'name:'||category END)=? LIMIT 1").get(s.id,f.category): (s.categoryId?'id:'+s.categoryId:'name:'+s.category)===f.category)))
 if(rows.length>10000)throw Error('Narrow the export range to 10000 sessions')
 const sessions:HistoricalSession[]=rows.map(({channel,externalId,startedAt,endedAt,title,categoryId,category,average,peak,provenance,endQuality})=>({channel,externalId,startedAt,endedAt,title,categoryId,category,average,peak,provenance:provenance+(endQuality==='last-seen'?' (end estimated)':'')}))
 const result=format==='csv'?encodeCsv(sessions):JSON.stringify({version:1,sessions,report:report(db,f)},null,2)
 if(Buffer.byteLength(result,'utf8')>10*1024*1024)throw Error('Narrow export range to 10 MB')
 return result
}
