import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile, realpath, rename, rm } from 'node:fs/promises'
import { basename, extname, join, relative, isAbsolute } from 'node:path'
export const imageExt=['.png','.jpg','.jpeg','.gif','.webp']
export const videoExt=['.mp4','.webm']
export const audioExt=['.mp3','.wav','.ogg','.m4a']
export const mediaTypes:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm'}
export async function copyMedia(source:string,target:string,kind:'image'|'audio'|'video'){
 const ext=extname(source).toLowerCase()
 if(!(kind==='image'?imageExt:kind==='video'?videoExt:audioExt).includes(ext))throw Error('Nieobsługiwany format')
 const st=await stat(source);if(!st.isFile()||st.size>50*1024*1024)throw Error('Plik przekracza 50 MB lub nie jest plikiem')
 const bytes=await readFile(source);if(bytes.length>50*1024*1024)throw Error('Plik przekracza 50 MB')
 const name=createHash('sha256').update(bytes).digest('hex')+ext
 await mkdir(target,{recursive:true})
 const destination=join(target,name),temporary=join(target,'.'+randomUUID()+'.tmp')
 try{const existing=await stat(destination);if(!existing.isFile()||existing.size>50*1024*1024)throw Error('Nieprawidłowy plik docelowy');const old=await readFile(destination);if(createHash('sha256').update(old).digest('hex')===name.slice(0,64))return name}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
 try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,destination)}finally{await rm(temporary,{force:true}).catch(()=>{})}
 return name
}
export async function legacyMedia(root:string,url:unknown,target:string,kind:'image'|'audio'|'video'){
 if(typeof url!=='string'||!url)return ''
 const normalized=url.replace(/\\/g,'/')
 if(!normalized.startsWith('media/')||normalized!== 'media/'+basename(normalized))throw Error('Nieprawidłowa ścieżka')
 const base=await realpath(join(root,'media')),source=await realpath(join(base,basename(normalized))),rel=relative(base,source)
 if(rel.startsWith('..')||isAbsolute(rel))throw Error('Plik poza katalogiem')
 return copyMedia(source,target,kind)
}
