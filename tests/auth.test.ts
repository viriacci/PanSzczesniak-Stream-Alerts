import {test} from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase} from '../src/main/database/index.ts'
import {Auth,scopes,type AuthDependencies,type Credentials} from '../src/main/twitch/auth.ts'

const credentials:Credentials={clientId:'clientid1234',secret:'secret1234',access:'old-access',refresh:'old-refresh',userId:'42',login:'test'}
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status})
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}
function fixture(request:typeof fetch){
 const db=openDatabase(':memory:')
 // Fake reversible storage only in tests; production passes Electron safeStorage.
 const storage={isEncryptionAvailable:()=>true,encryptString:(s:string)=>Buffer.from(s),decryptString:(b:Buffer)=>b.toString()}
 const write=(value:Credentials)=>db.prepare("INSERT INTO settings(key,value) VALUES ('twitch.secure.v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(storage.encryptString(JSON.stringify(value)).toString('base64'))
 write(credentials)
 const deps:AuthDependencies={storage,openExternal:async()=>{},request}
 const auth=new Auth(db,deps);assert.equal(auth.load(),true)
 return {db,auth,write}
}

test('a late 401 cannot refresh or retry a different login',async()=>{
 const late=deferred<Response>();let requests=0
 const f=fixture(async()=>{requests++;return late.promise})
 try{
  const old=f.auth.helix('users');const rejected=assert.rejects(old,/Sesja przerwana/)
  f.auth.logout();f.write({...credentials,access:'new-account',userId:'99'});f.auth.load()
  late.resolve(response({},401));await rejected
  assert.equal(requests,1);assert.equal(f.auth.identity?.userId,'99')
 }finally{f.auth.stop();f.db.close()}
})
test('concurrent and late 401 responses share a single token refresh',async()=>{
 const first=deferred<Response>(),second=deferred<Response>();let api=0,refresh=0
 const f=fixture(async(input,init)=>{
  const url=String(input)
  if(url.endsWith('/token')){refresh++;return response({access_token:'new-access',refresh_token:'new-refresh'})}
  if(url.endsWith('/validate'))return response({client_id:credentials.clientId,user_id:'42',login:'test',scopes})
  api++
  const headers=new Headers(init?.headers)
  if(headers.get('Authorization')==='Bearer new-access')return response({data:[]})
  return api===1?first.promise:second.promise
 })
 try{
  const a=f.auth.helix('users'),b=f.auth.helix('users')
  first.resolve(response({},401));await a
  second.resolve(response({},401));await b
  assert.equal(refresh,1);assert.equal(api,4)
 }finally{f.auth.stop();f.db.close()}
})
test('logout during refresh cannot restore credentials',async()=>{
 const refresh=deferred<Response>(),started=deferred<boolean>()
 const f=fixture(async(input)=>{
  if(String(input).endsWith('/token')){started.resolve(true);return refresh.promise}
  return response({},401)
 })
 try{
  const call=f.auth.helix('users');const rejected=assert.rejects(call,/Sesja przerwana/)
  await started.promise;f.auth.logout()
  refresh.resolve(response({access_token:'new-access',refresh_token:'new-refresh'}));await rejected
  assert.equal(f.auth.identity,undefined);assert.equal(f.auth.load(),false)
 }finally{f.auth.stop();f.db.close()}
})

test('public client reloads and rotates refresh token without a secret',async()=>{
 let refreshes=0
 const f=fixture(async(input,init)=>{
  const url=String(input)
  if(url.endsWith('/token')){
   refreshes++;const body=new URLSearchParams(String(init?.body));assert.equal(body.has('client_secret'),false);assert.equal(body.get('refresh_token'),'old-refresh')
   return response({access_token:'new-access',refresh_token:'rotated-refresh'})
  }
  if(url.endsWith('/validate'))return response({client_id:credentials.clientId,user_id:'42',login:'test',scopes})
  return new Headers(init?.headers).get('Authorization')==='Bearer new-access'?response({data:[]}):response({},401)
 })
 try{
  f.auth.stop();f.write({...credentials,secret:'',publicClient:true});assert.equal(f.auth.load(),true)
  await f.auth.helix('users');assert.equal(refreshes,1)
  const saved=f.db.prepare("SELECT value FROM settings WHERE key='twitch.secure.v1'").get()?.value
  assert.equal(JSON.parse(Buffer.from(String(saved),'base64').toString()).refresh,'rotated-refresh')
 }finally{f.auth.stop();f.db.close()}
})
