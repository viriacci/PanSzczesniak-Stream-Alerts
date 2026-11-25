import {createServer,type Server,type Socket} from 'node:net'
import {randomBytes,timingSafeEqual} from 'node:crypto'
import {writeFileSync,renameSync,rmSync} from 'node:fs'
import {join} from 'node:path'

export interface DockState {version:string;volume:number;muted:boolean;pending:number;twitch:string;overlayUrl:string}
export interface DockHandlers {state:()=>DockState;volume:(value:number)=>void;mute:(value:boolean)=>void;test:()=>void;reload:()=>void;show:()=>void;quit:()=>void}
export interface DockDescriptor {exe:string;pipe:string;token:string;pid:number}
export function dispatchDock(value:unknown,token:string,handlers:DockHandlers):DockState{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid request')
 const x=value as Record<string,unknown>
 if(typeof x.token!=='string'||!/^[a-f0-9]{64}$/.test(x.token)||!timingSafeEqual(Buffer.from(x.token),Buffer.from(token)))throw Error('Unauthorized')
 switch(x.command){
  case 'status':break
  case 'volume':if(typeof x.value!=='number'||!Number.isInteger(x.value)||x.value<0||x.value>100)throw Error('Invalid volume');handlers.volume(x.value);break
  case 'mute':if(typeof x.value!=='boolean')throw Error('Invalid mute');handlers.mute(x.value);break
  case 'test':handlers.test();break
  case 'reload':handlers.reload();break
  case 'show':handlers.show();break
  case 'quit':handlers.quit();break
  default:throw Error('Invalid command')
 }
 return handlers.state()
}
export class DockControl{
 private server?:Server
 private sockets=new Set<Socket>()
 private address=''
 constructor(private dir:string,private exe:string,private handlers:DockHandlers){}
 async start():Promise<DockDescriptor>{
  const name='pssa-dock-'+randomBytes(16).toString('hex'),token=randomBytes(32).toString('hex')
  this.address=process.platform==='win32'?'\\\\.\\pipe\\'+name:join(this.dir,name+'.sock')
  const server=createServer(socket=>{
   if(this.sockets.size>=8){socket.destroy();return}
   this.sockets.add(socket);socket.setTimeout(2000,()=>socket.destroy())
   socket.on('error',()=>{});socket.on('close',()=>this.sockets.delete(socket))
   let raw=Buffer.alloc(0),handled=false
   socket.on('data',chunk=>{
    if(handled)return
    if(raw.length+chunk.length>4096){socket.destroy();return}
    raw=Buffer.concat([raw,chunk]);const end=raw.indexOf(10);if(end<0)return
    handled=true
    try{if(end!==raw.length-1)throw Error('Unexpected data');const state=dispatchDock(JSON.parse(raw.subarray(0,end).toString('utf8')),token,this.handlers);socket.end(JSON.stringify({ok:true,state})+'\n')}
    catch{socket.end('{"ok":false}\n')}
   })
  })
  this.server=server
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(this.address,()=>{server.removeListener('error',reject);resolve()})})
  server.on('error',()=>this.stop())
  const descriptor={exe:this.exe,pipe:process.platform==='win32'?name:this.address,token,pid:process.pid}
  const path=join(this.dir,'obs-dock.json'),tmp=path+'.'+randomBytes(8).toString('hex')
  try{writeFileSync(tmp,JSON.stringify(descriptor),{mode:0o600,flag:'wx'});renameSync(tmp,path)}catch(e){rmSync(tmp,{force:true});this.stop();throw e}
  return descriptor
 }
 stop(){for(const socket of this.sockets)socket.destroy();this.sockets.clear();this.server?.close();this.server=undefined}
}
