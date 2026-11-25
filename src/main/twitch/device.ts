import {setTimeout as sleep} from 'node:timers/promises'
export interface DeviceDependencies{request:typeof fetch;openExternal:(url:string)=>Promise<void>;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}
export async function deviceTokens(clientId:string,scopes:string[],deps:DeviceDependencies,signal:AbortSignal,onCode:(code:string)=>void){
 if(!/^[a-zA-Z0-9]{10,128}$/.test(clientId))throw Error('Brak publicznego Client ID PSSA')
 const request=(url:string,body:Record<string,string>)=>deps.request(url,{method:'POST',body:new URLSearchParams(body),redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])})
 const res=await request('https://id.twitch.tv/oauth2/device',{client_id:clientId,scopes:scopes.join(' ')})
 if(!res.ok)throw Error('Nie można rozpocząć logowania Twitch')
 const v=await res.json() as any
 if(typeof v.device_code!=='string'||!v.device_code||v.device_code.length>512||typeof v.user_code!=='string'||!/^[A-Z0-9-]{4,20}$/i.test(v.user_code)||typeof v.verification_uri!=='string'||!Number.isFinite(v.expires_in)||v.expires_in<=0||!Number.isFinite(v.interval)||v.interval<=0)throw Error('Nieprawidłowa odpowiedź Twitch')
 const uri=new URL(v.verification_uri)
 if(uri.protocol!=='https:'||uri.hostname!=='www.twitch.tv'&&uri.hostname!=='twitch.tv'||uri.port||uri.username||uri.password||uri.pathname!=='/activate')throw Error('Nieprawidłowy adres Twitch')
 signal.throwIfAborted();onCode(v.user_code);await deps.openExternal(uri.href)
 const until=Date.now()+Math.min(v.expires_in,1800)*1000;let interval=Math.max(5,v.interval)*1000
 const wait=deps.wait??((ms,s)=>sleep(ms,undefined,{signal:s}))
 while(Date.now()<until){
  await wait(interval,signal);signal.throwIfAborted();if(Date.now()>=until)break
  const token=await request('https://id.twitch.tv/oauth2/token',{client_id:clientId,scopes:scopes.join(' '),device_code:v.device_code,grant_type:'urn:ietf:params:oauth:grant-type:device_code'})
  const data=await token.json() as any;signal.throwIfAborted()
  if(token.ok){if(typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token)throw Error('Nieprawidłowy token Twitch');return {access:data.access_token as string,refresh:data.refresh_token as string}}
  if(data.message==='authorization_pending')continue
  if(data.message==='slow_down'||token.status===429){interval+=5000;continue}
  throw Error('Autoryzacja Twitch odrzucona lub wygasła')
 }
 throw Error('Czas logowania upłynął')
}
