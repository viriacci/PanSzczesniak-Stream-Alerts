import {readdir,lstat,unlink,rmdir} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
// Only folders created by mkdtemp('PSSA-update-') and strictly named installers.
export async function cleanUpdateFiles(root=tmpdir()):Promise<number>{
 let removed=0
 for(const entry of await readdir(root,{withFileTypes:true}).catch(()=>[])){
  if(!entry.isDirectory()||!/^PSSA-update-[A-Za-z0-9]{6}$/.test(entry.name))continue
  const dir=join(root,entry.name)
  try{
   const st=await lstat(dir);if(!st.isDirectory()||st.isSymbolicLink())continue
   for(const file of await readdir(dir,{withFileTypes:true})){
    if(!file.isFile()||!/^PSSA-Setup-\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?-x64\.exe(?:\.part)?$/.test(file.name))continue
    try{const p=join(dir,file.name),info=await lstat(p);if(!info.isFile()||info.isSymbolicLink())continue;await unlink(p);removed++}catch{/* Windows installer may still have an open handle; retry on next startup/tick. */}
   }
   await rmdir(dir).catch(()=>{})
  }catch{/* never recurse or touch unrelated files */}
 }
 return removed
}
