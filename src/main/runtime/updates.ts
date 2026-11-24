import type {UpdateChannel,UpdateInfo} from '../../shared/runtime.ts'
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
export function selectRelease(input:unknown,current:string,channel:UpdateChannel):UpdateInfo{
 if(!Array.isArray(input)||!parseVersion(current))throw Error('Invalid release response')
 const entries=input.filter(r=>r&&r.draft===false&&typeof r.tag_name==='string'&&parseVersion(r.tag_name)&&r.tag_name.length<60&&(channel==='stable'?r.prerelease===false&&parseVersion(r.tag_name)!.rank===3:r.prerelease===true&&parseVersion(r.tag_name)!.rank>=1&&parseVersion(r.tag_name)!.rank<3||r.prerelease===false&&parseVersion(r.tag_name)!.rank===3))
 entries.sort((a,b)=>compareVersions(b.tag_name,a.tag_name))
 const latest=entries[0]
 if(!latest)return {state:'none',version:'',url:'',detail:'Brak opublikowanych wydań dla wybranego kanału.'}
 const version=String(latest.tag_name).replace(/^v/,'')
 if(compareVersions(version,current)<=0)return {state:'current',version,url:'',detail:'Brak nowszej wersji.'}
 return {state:'available',version,url:'https://github.com/'+repo+'/releases/tag/'+encodeURIComponent(latest.tag_name),detail:'Dostępne wydanie. Instalacja ręczna po weryfikacji podpisu.'}
}
export async function checkRelease(current:string,channel:UpdateChannel,request=fetch):Promise<UpdateInfo>{
 try{const r=await request(api,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok)throw Error('Release lookup failed');return selectRelease(await r.json(),current,channel)}
 catch{return {state:'error',version:'',url:'',detail:'Nie udało się sprawdzić wydań.'}}
}
