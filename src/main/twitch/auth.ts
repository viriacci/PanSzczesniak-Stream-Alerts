import { safeStorage, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
export const scopes=['moderator:read:followers','bits:read','channel:read:redemptions','user:read:chat']
const redirect='http://localhost:3000'
export interface Credentials {clientId:string;secret:string;access:string;refresh:string;userId:string;login:string}
export class Auth {
 private credentials?:Credentials
 private refreshTask?:Promise<void>
 private cancel?:()=>void
 private generation=0
 constructor(private db:DatabaseSync){}
 get identity(){return this.credentials?{userId:this.credentials.userId,login:this.credentials.login}:undefined}
 load(){
  const raw=this.db.prepare("SELECT value FROM settings WHERE key='twitch.secure.v1'").get()?.value
  if(typeof raw!=='string')return false
  if(!safeStorage.isEncryptionAvailable())throw Error('Bezpieczny magazyn niedostępny')
  const data=JSON.parse(safeStorage.decryptString(Buffer.from(raw,'base64'))) as Credentials
  if(!data.clientId||!data.secret||!data.access||!data.refresh||!data.userId)throw Error('Nieprawidłowe dane logowania')
  this.credentials=data;return true
 }
 private persist(data:Credentials){
  if(!safeStorage.isEncryptionAvailable())throw Error('Bezpieczny magazyn niedostępny')
  const encrypted=safeStorage.encryptString(JSON.stringify(data)).toString('base64')
  this.db.prepare("INSERT INTO settings(key,value) VALUES ('twitch.secure.v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(encrypted)
  this.credentials=data
 }
 stop(){this.generation++;this.refreshTask=undefined;this.cancel?.();this.cancel=undefined;this.credentials=undefined}
 logout(){this.stop();this.db.prepare("DELETE FROM settings WHERE key='twitch.secure.v1'").run()}
 private async token(params:Record<string,string>){
  const response=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams(params),signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw Error('Twitch odrzucił autoryzację ('+response.status+')')
  const t=await response.json() as any
  if(typeof t.access_token!=='string'||typeof t.refresh_token!=='string')throw Error('Nieprawidłowa odpowiedź Twitch')
  return {access:t.access_token as string,refresh:t.refresh_token as string}
 }
 private async validate(access:string,clientId:string){
  const response=await fetch('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:'OAuth '+access},signal:AbortSignal.timeout(15000)})
  if(response.status===401)return null
  if(!response.ok)throw Error('Walidacja Twitch niedostępna')
  const v=await response.json() as any
  if(v.client_id!==clientId||typeof v.user_id!=='string'||typeof v.login!=='string'||!Array.isArray(v.scopes)||!scopes.every(s=>v.scopes.includes(s)))throw Error('Brak wymaganych uprawnień Twitch. Zaloguj ponownie.')
  return {userId:v.user_id as string,login:v.login as string}
 }
 async login(clientId:string,secret:string){
  if(!/^[a-zA-Z0-9]{10,128}$/.test(clientId)||!/^[a-zA-Z0-9]{10,128}$/.test(secret))throw Error('Sprawdź Client ID i Client Secret')
  if(!safeStorage.isEncryptionAvailable())throw Error('Bezpieczny magazyn niedostępny')
  this.stop();const generation=this.generation,state=randomBytes(32).toString('hex')
  const code=await new Promise<string>((resolve,reject)=>{
   let done=false
   const finish=(error?:Error,code?:string)=>{if(done)return;done=true;clearTimeout(timer);server.close();this.cancel=undefined;error?reject(error):resolve(code!)}
   const server=createServer((req,res)=>{
    let url:URL;try{url=new URL(req.url??'/',redirect)}catch{res.writeHead(400);res.end('Invalid callback');return}
    if(req.method!=='GET'||url.pathname!=='/'||url.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid callback');return}
    const code=url.searchParams.get('code')
    res.writeHead(code?200:400,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'})
    res.end(code?'Autoryzacja odebrana. Wróć do PSSA.':'Autoryzacja anulowana.')
    finish(code?undefined:Error('Autoryzacja anulowana'),code??undefined)
   })
   const timer=setTimeout(()=>finish(Error('Upłynął czas logowania')),180000)
   this.cancel=()=>finish(Error('Autoryzacja anulowana'))
   server.on('error',()=>finish(Error('Port 3000 niedostępny')))
   server.listen(3000,'127.0.0.1',()=>{
    const url=new URL('https://id.twitch.tv/oauth2/authorize')
    url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:scopes.join(' '),state,force_verify:'true'}).toString()
    shell.openExternal(url.href).catch(()=>finish(Error('Nie można otworzyć przeglądarki')))
   })
  })
  const t=await this.token({client_id:clientId,client_secret:secret,code,grant_type:'authorization_code',redirect_uri:redirect})
  const identity=await this.validate(t.access,clientId)
  if(!identity||generation!==this.generation)throw Error('Autoryzacja przerwana')
  this.persist({clientId,secret,...t,...identity})
 }
 async ensure(){
  const c=this.credentials;if(!c)throw Error('Zaloguj Twitch')
  const v=await this.validate(c.access,c.clientId)
  if(!v)await this.refresh()
  else if(v.userId!==c.userId)throw Error('Nieprawidłowa tożsamość Twitch')
 }
 private async refresh(){
  if(this.refreshTask)return this.refreshTask
  const c=this.credentials,g=this.generation;if(!c)throw Error('Zaloguj Twitch')
  const task=(async()=>{const t=await this.token({client_id:c.clientId,client_secret:c.secret,refresh_token:c.refresh,grant_type:'refresh_token'});const v=await this.validate(t.access,c.clientId);if(!v||v.userId!==c.userId||g!==this.generation)throw Error('Sesja przerwana');this.persist({...c,...t,...v})})()
  this.refreshTask=task
  try{await task}finally{if(this.refreshTask===task)this.refreshTask=undefined}
 }
 async helix(path:string,body?:unknown):Promise<any>{
  const request=()=>{const c=this.credentials;if(!c)throw Error('Zaloguj Twitch');return fetch('https://api.twitch.tv/helix/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+c.access,'Client-Id':c.clientId,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)})}
  let res=await request();if(res.status===401){await this.refresh();res=await request()}
  if(!res.ok)throw Error('Twitch API: '+res.status)
  return res.json()
 }
}
