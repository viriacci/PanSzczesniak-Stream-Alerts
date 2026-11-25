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
