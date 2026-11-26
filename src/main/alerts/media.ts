import { createHash, randomUUID } from 'node:crypto'
import { mkdir, stat, lstat, realpath, rename, rm } from 'node:fs/promises'
import {createReadStream,createWriteStream} from 'node:fs'
import {Transform} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import { basename, extname, join, relative, isAbsolute } from 'node:path'
export const imageExt=['.png','.jpg','.jpeg','.gif','.webp']
export const videoExt=['.mp4','.webm']
export const audioExt=['.mp3','.wav','.ogg','.m4a']
export const mediaTypes:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm'}
const maxMediaBytes=50*1024*1024
async function hashFile(path:string){
 const hash=createHash('sha256');let size=0
 for await(const chunk of createReadStream(path)){size+=chunk.length;if(size>maxMediaBytes)throw Error('Plik przekracza 50 MB');hash.update(chunk)}
 if(!size)throw Error('Pusty plik multimedialny')
 return hash.digest('hex')
}
export async function copyMedia(source:string,target:string,kind:'image'|'audio'|'video'){
 const ext=extname(source).toLowerCase()
 if(!(kind==='image'?imageExt:kind==='video'?videoExt:audioExt).includes(ext))throw Error('Nieobsługiwany format')
 const st=await stat(source);if(!st.isFile()||st.size>maxMediaBytes||st.size===0)throw Error('Plik jest pusty, przekracza 50 MB lub nie jest plikiem')
 await mkdir(target,{recursive:true})
 const temporary=join(target,'.'+randomUUID()+'.tmp')
 const hash=createHash('sha256');let size=0
 const meter=new Transform({transform(chunk:Buffer,_encoding,callback){size+=chunk.length;if(size>maxMediaBytes){callback(Error('Plik przekracza 50 MB'));return}hash.update(chunk);callback(null,chunk)}})
 try{
  await pipeline(createReadStream(source),meter,createWriteStream(temporary,{flags:'wx',mode:0o600}))
  if(!size)throw Error('Pusty plik multimedialny')
  const digest=hash.digest('hex'),name=digest+ext,destination=join(target,name)
  try{
   const existing=await lstat(destination)
   if(!existing.isFile()||existing.isSymbolicLink()||existing.size>maxMediaBytes)throw Error('Nieprawidłowy plik docelowy')
   if(existing.size===size&&await hashFile(destination)===digest)return name
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  await rename(temporary,destination)
  return name
 }finally{await rm(temporary,{force:true}).catch(()=>{})}
}
export async function legacyMedia(root:string,url:unknown,target:string,kind:'image'|'audio'|'video'){
 if(typeof url!=='string'||!url)return ''
 const normalized=url.replace(/\\/g,'/')
 if(!normalized.startsWith('media/')||normalized!== 'media/'+basename(normalized))throw Error('Nieprawidłowa ścieżka')
 const base=await realpath(join(root,'media')),source=await realpath(join(base,basename(normalized))),rel=relative(base,source)
 if(rel.startsWith('..')||isAbsolute(rel))throw Error('Plik poza katalogiem')
 return copyMedia(source,target,kind)
}

export async function resolveLibraryFile(dir:string,id:unknown){
 if(typeof id!=='string'||!(/^[a-f0-9]{64}\.[a-z0-9]+$/i.test(id))||!Object.hasOwn(mediaTypes,extname(id).toLowerCase()))throw Error('Invalid media id')
 const root=await realpath(dir),candidate=join(root,id),entry=await lstat(candidate)
 if(!entry.isFile()||entry.isSymbolicLink())throw Error('Invalid media file')
 const file=await realpath(candidate),rel=relative(root,file)
 if(rel!==id||isAbsolute(rel))throw Error('Invalid media path')
 return file
}
