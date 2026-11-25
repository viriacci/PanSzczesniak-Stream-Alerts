import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const root=resolve(process.argv[2]??'.')
const load=p=>import(pathToFileURL(resolve(root,p)).href)
const {openDatabase}=await load('src/main/database/index.ts')
const {AlertQueue}=await load('src/main/alerts/queue.ts')
const {defaultRule}=await load('src/shared/alerts.ts')
const {rules,saveRules}=await load('src/main/alerts/store.ts')
const {makeLayer}=await load('src/shared/scene.ts')
const db=openDatabase(':memory:')
const queue=new AlertQueue(db,{online:()=>true,send:()=>false,active:()=>false,cancel:()=>{},volume:()=>{}})
try{
 const scene={version:1,width:1920,height:1080,duration:5000,layers:Array.from({length:16},(_,i)=>makeLayer('text','l'+i,5000))}
 saveRules(db,Array.from({length:64},(_,i)=>({...defaultRule('reward:'+i),scene})))
 for(let i=0;i<200;i++)queue.enqueue({id:'event-'+i,kind:'raid',user:'Test'}, {...defaultRule('raid'),scene})
 rules(db);queue.state();queue.tick()
 let queries=0;const prepare=db.prepare.bind(db);db.prepare=(sql)=>{queries++;return prepare(sql)}
 const measure=(name,n,fn)=>{queries=0;const cpu=process.cpuUsage(),start=performance.now();for(let i=0;i<n;i++)fn();const used=process.cpuUsage(cpu);return {name,iterations:n,wallMs:Math.round((performance.now()-start)*100)/100,cpuMs:(used.user+used.system)/1000,sqlPrepares:queries}}
 const results=[measure('idleTick',14400,()=>queue.tick()),measure('unchangedQueueSnapshot',1000,()=>queue.state()),measure('unchangedRules',500,()=>rules(db))]
 if(typeof queue.telemetry==='function')results.push(measure('unchangedQueueTelemetry',1000,()=>queue.telemetry()))
 console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,results},null,2))
}finally{queue.stop();db.close()}
