import type {UpdateAsset,UpdateChannel,UpdateInfo} from '../../shared/runtime.ts'
const repo='viriacci/PanSzczesniak-Stream-Alerts'
const api='https://api.github.com/repos/'+repo+'/releases?per_page=30'
export function parseVersion(tag:string){
 const m=/^v?(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})(?:-(dev|beta|rc)\.(0|[1-9]\d{0,5}))?$/.exec(tag)
 return m?{core:[Number(m[1]),Number(m[2]),Number(m[3])],rank:m[4]==='dev'?0:m[4]==='beta'?1:m[4]==='rc'?2:3,number:Number(m[5]??0)}:null
}
export function compareVersions(a:string,b:string){
 const x=parseVersion(a),y=parseVersion(b);if(!x||!y)throw Error('Invalid version')
 for(let i=0;i<3;i++){const d=x.core[i]!-y.core[i]!;if(d)return Math.sign(d)}
 return Math.sign(x.rank-y.rank||x.number-y.number)
}
export function releaseAsset(release:any,version:string):UpdateAsset|undefined{
 const name='PSSA-Setup-'+version+'-x64.exe'
 const url='https://github.com/'+repo+'/releases/download/'+encodeURIComponent(release.tag_name)+'/'+name
 if(!Array.isArray(release.assets))return undefined
 const asset=release.assets.find((x:any)=>x&&x.name===name&&x.browser_download_url===url)
 if(!asset||!Number.isSafeInteger(asset.size)||asset.size<1024||asset.size>500*1024*1024||typeof asset.digest!=='string'||!/^sha256:[a-f0-9]{64}$/i.test(asset.digest))return undefined
 return {name,url,size:asset.size,sha256:asset.digest.slice(7).toLowerCase()}
}
export function selectRelease(input:unknown,current:string,channel:UpdateChannel):UpdateInfo{
 if(!Array.isArray(input)||!parseVersion(current))throw Error('Invalid release response')
 const entries=input.filter(r=>r&&r.draft===false&&typeof r.tag_name==='string'&&parseVersion(r.tag_name)&&r.tag_name.length<60&&(channel==='stable'?r.prerelease===false&&parseVersion(r.tag_name)!.rank===3:r.prerelease===true&&parseVersion(r.tag_name)!.rank>=1&&parseVersion(r.tag_name)!.rank<3||r.prerelease===false&&parseVersion(r.tag_name)!.rank===3))
 entries.sort((a,b)=>compareVersions(b.tag_name,a.tag_name))
 const latest=entries[0]
 if(!latest)return {state:'none',version:'',url:'',detail:'Brak opublikowanych wydań dla wybranego kanału.'}
 const version=String(latest.tag_name).replace(/^v/,'')
 if(compareVersions(version,current)<=0)return {state:'current',version,url:'',detail:'Brak nowszej wersji.'}
 return {state:'available',version,url:'https://github.com/'+repo+'/releases/tag/'+encodeURIComponent(latest.tag_name),notes:typeof latest.body==='string'?latest.body.slice(0,12000):'',asset:releaseAsset(latest,version),detail:'Dostępna aktualizacja PSSA.'}
}
export async function checkRelease(current:string,channel:UpdateChannel,request=fetch):Promise<UpdateInfo>{
 try{const r=await request(api,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok)throw Error('Release lookup failed');const reader=r.body?.getReader();if(!reader)throw Error('Empty response');let size=0;const chunks:Uint8Array[]=[];try{for(;;){const {value,done}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>2*1024*1024){await reader.cancel();throw Error('Release response too large')}chunks.push(value)}}}finally{reader.releaseLock()}return selectRelease(JSON.parse(Buffer.concat(chunks).toString('utf8')),current,channel)}
 catch{return {state:'error',version:'',url:'',detail:'Nie udało się sprawdzić wydań.'}}
}

// Unsigned builds are permitted only for explicit prerelease consent. Stable must be signed by the trusted publisher.
export function installerAllowed(trust:'trusted'|'unsigned'|'untrusted',version:string):boolean{
 const parsed=parseVersion(version)
 return !!parsed&&(trust==='trusted'||trust==='unsigned'&&(parsed.rank===1||parsed.rank===2))
}
