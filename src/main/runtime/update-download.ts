import type {UpdateAsset} from '../../shared/runtime.ts'
import {createHash} from 'node:crypto'
import {open,rename,rm,mkdtemp,copyFile,writeFile,stat} from 'node:fs/promises'
import {constants,createReadStream} from 'node:fs'
import {join} from 'node:path'

export function safeReleaseRedirect(value:string):boolean{
 try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com'].includes(u.hostname)}catch{return false}
}
export async function downloadRelease(asset:UpdateAsset,directory:string,request=fetch):Promise<string>{
 if(!/^PSSA-Setup-\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?-x64\.exe$/.test(asset.name)||!/^https:\/\/github\.com\/viriacci\/PanSzczesniak-Stream-Alerts\/releases\/download\/v?\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?\/PSSA-Setup-[a-z0-9.-]+-x64\.exe$/i.test(asset.url)||!Number.isSafeInteger(asset.size)||asset.size<1024||asset.size>500*1024*1024||!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('Nieprawidłowe metadane wydania.')
 const signal=AbortSignal.timeout(180000)
 let url=asset.url,response:Response|undefined
 for(let i=0;i<5;i++){
  response=await request(url,{redirect:'manual',signal,headers:{Accept:'application/octet-stream'}})
  if(![301,302,303,307,308].includes(response.status))break
  const next=response.headers.get('location')??'';await response.body?.cancel();if(!safeReleaseRedirect(next))throw Error('Nieprawidłowe przekierowanie pobierania.');url=next
 }
 if(!response?.ok||!response.body)throw Error('Nie udało się pobrać instalatora.')
 const partial=join(directory,asset.name+'.part'),target=join(directory,asset.name)
 const file=await open(partial,'wx',0o600);const hash=createHash('sha256');let size=0,success=false
 try{
  const reader=response.body.getReader()
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(!value)continue;size+=value.length;if(size>asset.size)throw Error('Nieprawidłowy rozmiar instalatora.');hash.update(value);let at=0;while(at<value.length){const {bytesWritten}=await file.write(value,at,value.length-at);if(!bytesWritten)throw Error('Nie można zapisać instalatora.');at+=bytesWritten}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  if(size!==asset.size||hash.digest('hex')!==asset.sha256)throw Error('Suma SHA256 instalatora jest niezgodna.')
  await file.sync();success=true
 }finally{await file.close();if(!success)await rm(partial,{force:true})}
 try{await rename(partial,target)}catch(e){await rm(partial,{force:true});throw e}
 return target
}

export async function saveManualInstaller(source:string,downloads:string,asset:UpdateAsset){
 if(!/^PSSA-Setup-\d+\.\d+\.\d+-x64\.exe$/.test(asset.name)||!/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isSafeInteger(asset.size)||asset.size<1024||asset.size>500*1024*1024)throw Error('Nieprawidłowe metadane instalatora Stable.')
 const dir=await mkdtemp(join(downloads,'PSSA-')),target=join(dir,asset.name)
 try{
  await copyFile(source,target,constants.COPYFILE_EXCL)
  if((await stat(target)).size!==asset.size)throw Error('Nieprawidłowy rozmiar instalatora.')
  const hash=createHash('sha256');for await(const chunk of createReadStream(target))hash.update(chunk)
  if(hash.digest('hex')!==asset.sha256)throw Error('Suma SHA256 instalatora jest niezgodna.')
  if(process.platform==='win32')await writeFile(target+':Zone.Identifier','[ZoneTransfer]\r\nZoneId=3\r\n',{encoding:'ascii'})
  return target
 }catch(e){await rm(dir,{recursive:true,force:true}).catch(()=>{});throw e}
}
