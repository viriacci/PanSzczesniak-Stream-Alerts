export interface ObsCandidate {path:string;source:string;versions:string[];portable:boolean}
export interface ObsVersion {major:number;label:string}
export function obsVersion(values:readonly string[]):ObsVersion|null{
 for(const value of values){
  if(typeof value!=='string')continue
  const m=value.trim().match(/^(?:OBS(?: Studio)?\s+)?(\d{1,2})(?:[.,]\s*(\d+)(?:[.,]\s*(\d+))?(?:[.,]\s*\d+)?(?:[-+ ].*)?)?$/i)
  if(!m)continue
  const major=Number(m[1]);if(major<20||major>99)continue
  return {major,label:m[2]===undefined?String(major):[major,Number(m[2]),...(m[3]===undefined?[]:[Number(m[3])])].join('.')}
 }
 return null
}
export function dockLayout(major:number):'legacy'|'modern'{
 if(!Number.isInteger(major)||major<31||major>33)throw Error('Wtyczka wymaga OBS Studio 31–33 x64. Wykryto: '+major+'.')
 return major>=33?'modern':'legacy'
}
export function parseCandidates(value:unknown):ObsCandidate[]{
 if(!Array.isArray(value))return []
 const seen=new Set<string>(),result:ObsCandidate[]=[]
 for(const item of value){
  if(!item||typeof item!=='object'||typeof item.path!=='string'||!/[\\/]obs64\.exe$/i.test(item.path)||!Array.isArray(item.versions)||typeof item.source!=='string')continue
  const key=item.path.toLowerCase();if(seen.has(key))continue;seen.add(key)
  result.push({path:item.path,source:item.source,versions:item.versions.filter((v:unknown)=>typeof v==='string'),portable:item.portable===true})
 }
 return result
}

export type DockInstallStatus='missing'|'update'|'current'|'unavailable'
export function compareDockHashes(bundled:string|null,installed:readonly string[]):DockInstallStatus{
 if(!bundled)return 'unavailable'
 if(!installed.length)return 'missing'
 return installed.length===1&&installed[0]===bundled?'current':'update'
}

export const dockReplacementCommands=[
 "function Get-DockHash([string]$path) { $sha=[Security.Cryptography.SHA256]::Create(); try { $stream=[IO.File]::OpenRead($path); try { [BitConverter]::ToString($sha.ComputeHash($stream)) } finally { $stream.Dispose() } } finally { $sha.Dispose() } }",
 "$stage=$target+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'",
 "$backup=$target+'.'+[Guid]::NewGuid().ToString('N')+'.bak'",
 "try {",
 "try { [IO.File]::Copy($dll,$stage,$false); $expected=Get-DockHash $dll; if($expected -ne (Get-DockHash $stage)){exit 14} } catch { [Console]::Error.WriteLine($_.Exception.ToString()); exit 15 }",
 "try { if([IO.File]::Exists($target)){[IO.File]::Replace($stage,$target,$backup,$true)}else{[IO.File]::Move($stage,$target)} } catch { [Console]::Error.WriteLine($_.Exception.ToString()); exit 16 }",
 "try { if($expected -ne (Get-DockHash $target)){throw 'DLL checksum mismatch'} } catch { [Console]::Error.WriteLine($_.Exception.ToString()); if([IO.File]::Exists($backup)){[IO.File]::Replace($backup,$target,$stage,$true)};exit 14 }",
 "if([IO.File]::Exists($backup)){[IO.File]::Delete($backup)}",
 "} finally { if([IO.File]::Exists($stage)){[IO.File]::Delete($stage)} }",
 "try { if([IO.File]::Exists($old)){[IO.File]::Delete($old)} } catch { [Console]::Error.WriteLine($_.Exception.ToString()); exit 17 }",
] as const
