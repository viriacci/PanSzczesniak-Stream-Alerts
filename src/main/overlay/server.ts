import { createServer,type Server,type ServerResponse,type IncomingMessage } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat,realpath } from 'node:fs/promises'
import { extname,join,relative,isAbsolute } from 'node:path'
import { validMedia } from '../../shared/alerts.ts'
import { mediaTypes } from '../alerts/media.ts'
import type { Playback } from '../../shared/queue.ts'
import {createScenePlayer} from '../../shared/scene-player.ts'
import {sceneForRule} from '../../shared/scene-legacy.ts'
const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body,#stage{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}</style></head><body><div id="stage"></div><script src="client.js"></script></body></html>`
const js=`const createScenePlayer=${createScenePlayer.toString()};const stage=document.getElementById('stage');let player,attempt,frame,start;function clear(){cancelAnimationFrame(frame);player?.dispose();player=undefined;attempt=undefined}function finish(result='done'){const id=attempt;clear();if(id)fetch('ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attempt:id,result})}).catch(()=>{})}const source=new EventSource('events');source.onmessage=e=>{let p;try{p=JSON.parse(e.data)}catch{return}if(p.type==='reload'){clear();source.close();location.reload();return}if(p.type==='cancel'){if(p.attempt===attempt)clear();return}if(p.type==='volume'){if(p.attempt===attempt)player?.setVolume(p.volume);return}if(p.type!=='play'||typeof p.attempt!=='string'||!p.scene)return;clear();attempt=p.attempt;const id=attempt;try{player=createScenePlayer(stage,p.scene,p.text,'media/',p.volume,()=>{if(id===attempt)finish('media-error')});start=performance.now();const tick=now=>{if(id!==attempt)return;const elapsed=now-start;if(elapsed>=p.scene.duration){finish();return}player.paint(elapsed,true);frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick)}catch{finish('media-error')}};source.onerror=clear;`
export class Overlay {
 private server?:Server
 private streams=new Set<ServerResponse>()
 private heartbeat?:ReturnType<typeof setInterval>
 private key=''
 private boundPort=0
 private media:string
 private port:number
 private playback?:{attempt:string;stream:ServerResponse}
 onAck:(attempt:string,result:'done'|'media-error')=>boolean=()=>false
 constructor(media:string,port=18766){this.media=media;this.port=port}
 get url(){return this.key?'http://127.0.0.1:'+this.boundPort+'/'+this.key+'/':''}
 get clients(){return this.streams.size}
 async start(key?:string){
  if(this.server)return
  this.key=key&&/^[a-f0-9]{64}$/.test(key)?key:randomBytes(32).toString('hex')
  const server=createServer({headersTimeout:5000,requestTimeout:10000},(req,res)=>{void this.handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(404);res.end()})})
  this.server=server
  try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(this.port,'127.0.0.1',()=>{server.removeListener('error',reject);const addr=server.address();if(addr&&typeof addr!=='string')this.boundPort=addr.port;resolve()})})}catch(e){this.server=undefined;this.key='';throw e}
  server.on('error',()=>this.stop())
  this.heartbeat=setInterval(()=>{for(const s of this.streams){if(s.destroyed||s.writableLength>65536){s.destroy();this.streams.delete(s)}else s.write(': keepalive\n\n')}},15000)
 }
 stop(){this.playback=undefined;clearInterval(this.heartbeat);for(const s of this.streams)s.end();this.streams.clear();this.server?.close();this.server?.closeAllConnections();this.server=undefined;this.key=''}
 reload(){let count=0;for(const stream of this.streams)if(this.write(stream,{type:'reload'}))count++;return count}
 online(){return [...this.streams].some(s=>!s.destroyed&&s.writableLength<=65536)}
 active(attempt:string){return this.playback?.attempt===attempt&&!this.playback.stream.destroyed&&this.streams.has(this.playback.stream)}
 private write(stream:ServerResponse,value:unknown){if(stream.destroyed||stream.writableLength>65536){stream.destroy();this.streams.delete(stream);return false}try{stream.write('data: '+JSON.stringify(value)+'\n\n');return true}catch{stream.destroy();this.streams.delete(stream);return false}}
 send(value:Playback){
  if(this.playback)return false
  for(const stream of this.streams){if(this.write(stream,{type:'play',...value,scene:sceneForRule(value.rule)})){this.playback={attempt:value.attempt,stream};return true}}
  return false
 }
 cancel(attempt:string){const p=this.playback;if(p?.attempt!==attempt)return;this.playback=undefined;this.write(p.stream,{type:'cancel',attempt})}
 volume(attempt:string,volume:number){const p=this.playback;if(p?.attempt===attempt)this.write(p.stream,{type:'volume',attempt,volume})}
 private async acknowledge(req:IncomingMessage,res:ServerResponse){
  if(req.headers.origin!=='http://127.0.0.1:'+this.boundPort||req.headers['content-type']!=='application/json'){res.writeHead(403);res.end();return}
  let body='';for await(const chunk of req){body+=String(chunk);if(body.length>1024){res.writeHead(413);res.end();return}}
  let attempt:unknown,result:unknown;try{const value=JSON.parse(body);attempt=value.attempt;result=value.result??'done'}catch{res.writeHead(400);res.end();return}
  if(result!=='done'&&result!=='media-error'){res.writeHead(400);res.end();return}
  if(typeof attempt!=='string'||!this.active(attempt)||!this.onAck(attempt,result)){res.writeHead(409);res.end();return}
  this.playback=undefined;res.writeHead(204);res.end()
 }
 private async handle(req:IncomingMessage,res:ServerResponse){
  const {method,url,headers:{host}}=req
  const prefix='/'+this.key+'/'
  if(host!=='127.0.0.1:'+this.boundPort||!this.key||!url?.startsWith(prefix)){res.writeHead(404);res.end();return}
  const path=url.slice(prefix.length)
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer')
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'; frame-ancestors 'none'")
  if(path==='ack'&&method==='POST'){await this.acknowledge(req,res);return}
  if(method!=='GET'){res.writeHead(405);res.end();return}
  if(path===''){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return}
  if(path==='client.js'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});res.end(js);return}
  if(path==='events'){if(this.streams.size>=10){res.writeHead(503);res.end();return}res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(': connected\n\n');this.streams.add(res);res.on('close',()=>this.streams.delete(res));res.on('error',()=>{this.streams.delete(res);res.destroy()});return}
  if(path.startsWith('media/')){
   const name=path.slice(6),type=mediaTypes[extname(name).toLowerCase()]
   if(name&&validMedia(name)&&type){const root=await realpath(this.media),file=await realpath(join(root,name)),rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid path');const st=await stat(file);if(!st.isFile())throw Error('Invalid file');res.writeHead(200,{'Content-Type':type,'Content-Length':st.size});const stream=createReadStream(file);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return}
  }
  res.writeHead(404);res.end()
 }
}
