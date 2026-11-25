import {realpathSync,linkSync,writeFileSync,rmSync} from 'node:fs'
import {dirname,basename,resolve,join,relative,isAbsolute} from 'node:path'
import {randomUUID} from 'node:crypto'
export function outsideData(directory:string,path:string){
 const target=join(realpathSync(dirname(resolve(path))),basename(path))
 const rel=relative(realpathSync(directory),target)
 if(rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))))throw Error('Choose a file outside app data')
 return target
}
// Publish a complete file atomically and without replacing an existing name.
export function publishNew(temp:string,destination:string){linkSync(temp,destination)}
export function writeNew(path:string,data:string){
 const temp=path+'.'+randomUUID()+'.tmp'
 try{writeFileSync(temp,data,{flag:'wx',mode:0o600});publishNew(temp,path)}finally{rmSync(temp,{force:true})}
}
