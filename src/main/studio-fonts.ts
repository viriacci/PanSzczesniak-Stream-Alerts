import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {join} from 'node:path'
let cached:string[]|undefined,task:Promise<string[]>|undefined
export async function studioFonts():Promise<string[]>{
 if(cached)return cached
 if(task)return task
 if(process.platform!=='win32')return []
 task=(async()=>{
  try{
   const script="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); Add-Type -AssemblyName System.Drawing; $fonts=New-Object System.Drawing.Text.InstalledFontCollection; try { ConvertTo-Json -InputObject @($fonts.Families | ForEach-Object {$_.Name}) -Compress } finally {$fonts.Dispose()}"
   const {stdout}=await promisify(execFile)(join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:10000,maxBuffer:1024*1024})
   const a:unknown=JSON.parse(stdout.trim())
   if(!Array.isArray(a))return []
   cached=[...new Set(a.filter((x):x is string=>typeof x==='string'&&x.length<=80&&/^[\p{L}\p{N} _-]+$/u.test(x)))].slice(0,2000).sort((a,b)=>a.localeCompare(b))
   return cached
  }catch{return []}
 })()
 try{return await task}finally{task=undefined}
}
