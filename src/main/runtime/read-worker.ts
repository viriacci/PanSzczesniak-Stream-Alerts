import {parentPort,workerData} from 'node:worker_threads'
import {DatabaseSync} from 'node:sqlite'
import {report} from '../analytics/store.ts'
import {exportHistory} from '../analytics/transfer.ts'
import {libraryIndex,scanLibrary} from '../library/store.ts'
import {schemaVersion,SCHEMA_VERSION} from '../database/index.ts'
export type ReadTask={type:'analytics';filter:unknown}|{type:'export';filter:unknown;format:'csv'|'json'}|{type:'library';media:string}
export async function runReadTask(path:string,task:ReadTask){
 const db=new DatabaseSync(path,{readOnly:true})
 try{
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=1000; PRAGMA cache_size=-8192')
  if(schemaVersion(db)!==SCHEMA_VERSION)throw Error('Unexpected database schema')
  db.exec('BEGIN')
  if(task.type==='library'){
   const index=libraryIndex(db);db.exec('COMMIT')
   // All SQLite reads finish before asynchronous filesystem scanning.
   return await scanLibrary(index,task.media)
  }
  const result=task.type==='analytics'?report(db,task.filter):task.type==='export'?exportHistory(db,task.filter,task.format):(()=>{throw Error('Invalid read task')})()
  db.exec('COMMIT');return result
 }finally{db.close()}
}
if(parentPort){
 const port=parentPort
 void runReadTask(workerData.path,workerData.task).then(result=>port.postMessage({ok:true,result})).catch(()=>port.postMessage({ok:false}))
}
