import {deviceTokens} from './device.ts'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
export const scopes=['moderator:read:followers','bits:read','channel:read:redemptions','user:read:chat']
export const broadcastScope='channel:manage:broadcast'
const redirect='http://localhost:3000'
export interface Credentials {clientId:string;secret:string;access:string;refresh:string;userId:string;login:string;grantedScopes?:string[];publicClient?:boolean}
export interface AuthDependencies {
 storage:{isEncryptionAvailable():boolean;encryptString(value:string):Buffer;decryptString(value:Buffer):string}
 openExternal(url:string):Promise<void>
 request:typeof fetch
}
export class Auth {
 private db:DatabaseSync
 private deps:AuthDependencies
 private credentials?:Credentials
 private refreshTask?:Promise<void>
 private cancel?:()=>void
 private generation=0
 constructor(db:DatabaseSync,deps:AuthDependencies){this.db=db;this.deps=deps}
 get canManage(){return this.credentials?.grantedScopes?.includes(broadcastScope)===true}
 get identity(){return this.credentials?{userId:this.credentials.userId,login:this.credentials.login}:undefined}
 private assertGeneration(g:number){if(g!==this.generation)throw Error('Sesja przerwana')}
 load(){
  const raw=this.db.prepare("SELECT value FROM settings WHERE key='twitch.secure.v1'").get()?.value
  if(typeof raw!=='string')return false
  if(!this.deps.storage.isEncryptionAvailable())throw Error('Bezpieczny magazyn niedostępny')
  const data=JSON.parse(this.deps.storage.decryptString(Buffer.from(raw,'base64'))) as Credentials
  if(!data||!['clientId','access','refresh','userId','login'].every(key=>typeof data[key as keyof Credentials]==='string'&&String(data[key as keyof Credentials]).length>0)||typeof data.secret!=='string'||(!data.secret&&data.publicClient!==true))throw Error('Nieprawidłowe dane logowania')
  this.credentials=data;return true
 }
 private persist(data:Credentials){
  if(!this.deps.storage.isEncryptionAvailable())throw Error('Bezpieczny magazyn niedostępny')
  const encrypted=this.deps.storage.encryptString(JSON.stringify(data)).toString('base64')
  this.db.prepare("INSERT INTO settings(key,value) VALUES ('twitch.secure.v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(encrypted)
  this.credentials=data
 }
 stop(){this.generation++;this.refreshTask=undefined;this.cancel?.();this.cancel=undefined;this.credentials=undefined}
 logout(){this.stop();this.db.prepare("DELETE FROM settings WHERE key='twitch.secure.v1'").run()}
 private async token(params:Record<string,string>){
  const response=await this.deps.request('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams(params),redirect:'error',signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw Error('Twitch odrzucił autoryzację ('+response.status+')')
  const t=await response.json() as any
  if(typeof t.access_token!=='string'||!t.access_token||typeof t.refresh_token!=='string'||!t.refresh_token)throw Error('Nieprawidłowa odpowiedź Twitch')
  return {access:t.access_token as string,refresh:t.refresh_token as string}
 }
 private async validate(access:string,clientId:string){
  const response=await this.deps.request('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:'OAuth '+access},redirect:'error',signal:AbortSignal.timeout(15000)})
  if(response.status===401)return null
  if(!response.ok)throw Error('Walidacja Twitch niedostępna')
  const v=await response.json() as any
  if(v.client_id!==clientId||typeof v.user_id!=='string'||typeof v.login!=='string'||!Array.isArray(v.scopes)||!scopes.every(s=>v.scopes.includes(s)))throw Error('Brak wymaganych uprawnień Twitch. Zaloguj ponownie.')
  return {userId:v.user_id as string,login:v.login as string,grantedScopes:v.scopes.filter((s:unknown)=>typeof s==='string') as string[]}
 }
 async login(clientId:string,secret:string){
  if(!/^[a-zA-Z0-9]{10,128}$/.test(clientId)||!/^[a-zA-Z0-9]{10,128}$/.test(secret))throw Error('Sprawdź Client ID i Client Secret')
  if(!this.deps.storage.isEncryptionAvailable())throw Error('Bezpieczny magazyn niedostępny')
  this.logout();const generation=this.generation,state=randomBytes(32).toString('hex')
  const code=await new Promise<string>((resolve,reject)=>{
   let done=false,claimed=false
   const finish=(error?:Error,code?:string)=>{if(done)return;done=true;clearTimeout(timer);server.close();server.closeAllConnections();this.cancel=undefined;error?reject(error):resolve(code!)}
   const server=createServer({requestTimeout:10000,headersTimeout:5000},(req,res)=>{
    let url:URL;try{url=new URL(req.url??'/',redirect)}catch{res.writeHead(400);res.end('Invalid callback');return}
    if(req.method!=='GET'||!['localhost:3000','127.0.0.1:3000'].includes(req.headers.host??'')||url.origin!==redirect||url.pathname!=='/'||url.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid callback');return}
    if(claimed){res.writeHead(409);res.end('Callback already accepted');return}
    claimed=true
    const code=url.searchParams.get('code')
    res.writeHead(code?200:400,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Connection':'close','Referrer-Policy':'no-referrer'})
    res.end(code?'Autoryzacja odebrana. Wróć do PSSA.':'Autoryzacja anulowana.',()=>finish(code?undefined:Error('Autoryzacja anulowana'),code??undefined))
   })
   const timer=setTimeout(()=>finish(Error('Upłynął czas logowania')),180000)
   this.cancel=()=>finish(Error('Autoryzacja anulowana'))
   server.on('error',()=>finish(Error('Port 3000 niedostępny')))
   server.listen(3000,'127.0.0.1',()=>{
    if(done){server.close();return}
    const url=new URL('https://id.twitch.tv/oauth2/authorize')
    url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:[...scopes,broadcastScope].join(' '),state,force_verify:'true'}).toString()
    this.deps.openExternal(url.href).catch(()=>finish(Error('Nie można otworzyć przeglądarki')))
   })
  })
  this.assertGeneration(generation)
  const t=await this.token({client_id:clientId,client_secret:secret,code,grant_type:'authorization_code',redirect_uri:redirect})
  this.assertGeneration(generation)
  const identity=await this.validate(t.access,clientId)
  this.assertGeneration(generation)
  if(!identity)throw Error('Autoryzacja przerwana')
  this.persist({clientId,secret,...t,...identity})
 }
 async deviceLogin(clientId:string,onCode:(code:string)=>void){
  if(!this.deps.storage.isEncryptionAvailable())throw Error('Bezpieczny magazyn niedostępny')
  this.logout();const g=this.generation,controller=new AbortController()
  this.cancel=()=>controller.abort()
  try{const t=await deviceTokens(clientId,[...scopes,broadcastScope],this.deps,controller.signal,onCode);this.assertGeneration(g)
   const identity=await this.validate(t.access,clientId);this.assertGeneration(g);if(!identity)throw Error('Autoryzacja przerwana')
   this.persist({clientId,secret:'',publicClient:true,...t,...identity})
  }finally{if(g===this.generation)this.cancel=undefined}
 }
 async ensure(){
  const c=this.credentials,g=this.generation;if(!c)throw Error('Zaloguj Twitch')
  const v=await this.validate(c.access,c.clientId);this.assertGeneration(g)
  if(!v){if(this.credentials?.access===c.access)await this.refresh(g)}
  else if(v.userId!==c.userId)throw Error('Nieprawidłowa tożsamość Twitch')
  else if(this.credentials===c&&JSON.stringify(c.grantedScopes)!==JSON.stringify(v.grantedScopes))this.persist({...c,grantedScopes:v.grantedScopes})
  this.assertGeneration(g)
 }
 private async refresh(g:number){
  this.assertGeneration(g)
  if(this.refreshTask)return this.refreshTask
  const c=this.credentials;if(!c)throw Error('Zaloguj Twitch')
  const task=(async()=>{const t=await this.token({client_id:c.clientId,...(c.publicClient?{}:{client_secret:c.secret}),refresh_token:c.refresh,grant_type:'refresh_token'});this.assertGeneration(g);const v=await this.validate(t.access,c.clientId);this.assertGeneration(g);if(!v||v.userId!==c.userId)throw Error('Sesja przerwana');this.persist({...c,...t,...v})})()
  this.refreshTask=task
  try{await task}finally{if(this.refreshTask===task)this.refreshTask=undefined}
 }
 async helix(path:string,body?:unknown,method?:'GET'|'POST'|'PATCH'):Promise<any>{
  const g=this.generation
  const request=()=>{this.assertGeneration(g);const c=this.credentials;if(!c)throw Error('Zaloguj Twitch');return {access:c.access,response:this.deps.request('https://api.twitch.tv/helix/'+path,{method:method??(body?'POST':'GET'),headers:{Authorization:'Bearer '+c.access,'Client-Id':c.clientId,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)})}}
  const first=request();let res=await first.response;this.assertGeneration(g)
  if(res.status===401){if(this.credentials?.access===first.access)await this.refresh(g);res=await request().response;this.assertGeneration(g)}
  if(!res.ok)throw Error('Twitch API: '+res.status)
  const result=res.status===204?null:await res.json();this.assertGeneration(g);return result
 }
}
