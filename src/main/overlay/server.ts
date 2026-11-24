import { createServer,type Server,type ServerResponse,type IncomingMessage } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat,realpath } from 'node:fs/promises'
import { extname,join,relative,isAbsolute } from 'node:path'
import { validMedia } from '../../shared/alerts.ts'
import { mediaTypes } from '../alerts/media.ts'
import type { Playback } from '../../shared/queue.ts'
const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#stage{position:absolute;inset:0;display:none}#image,#caption{position:absolute;transform:translate(-50%,-50%);box-sizing:border-box}#image{object-fit:contain}#caption{display:grid;place-items:center;text-align:center;font-family:Arial,sans-serif;overflow-wrap:anywhere;white-space:pre-wrap}</style></head><body><div id="stage"><img id="image"><div id="caption"></div></div><script src="client.js"></script></body></html>`
const js=`const stage=document.getElementById('stage'),image=document.getElementById('image'),caption=document.getElementById('caption');let timer,audio,animation,attempt;function clear(){clearTimeout(timer);animation?.cancel();stage.style.display='none';image.onerror=null;image.removeAttribute('src');image.style.display='none';caption.textContent='';attempt=undefined;if(audio){audio.onerror=null;audio.pause();audio.removeAttribute('src');audio=null}}function pos(el,p){el.style.left=p.x+'%';el.style.top=p.y+'%';el.style.width=p.width+'%';el.style.height=p.height+'%'}function finish(result='done'){const id=attempt;clear();if(id)fetch('ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attempt:id,result})}).catch(()=>{})}const source=new EventSource('events');source.onmessage=e=>{let p;try{p=JSON.parse(e.data)}catch{return}if(p.type==='cancel'){if(p.attempt===attempt)clear();return}if(p.type==='volume'){if(p.attempt===attempt&&audio)audio.volume=p.volume/100;return}if(p.type!=='play'||typeof p.attempt!=='string')return;clear();attempt=p.attempt;const l=p.rule.layout||{image:{x:50,y:38,width:30,height:40},caption:{x:50,y:68,width:40,height:10,font_size:32,font_color:'#ffffff',bg_color:'#843935',bg_opacity:90},anim_in:'fade',anim_out:'fade',anim_duration_ms:400};pos(image,l.image);pos(caption,l.caption);for(const [el,cfg] of [[image,l.image],[caption,l.caption]]){el.style.border=(cfg.border_width||0)+'px '+(cfg.border_style||'none')+' '+(cfg.border_color||'#000000')}caption.style.fontFamily=(l.caption.font_family||'Arial')+', sans-serif';caption.style.fontSize=l.caption.font_size+'px';caption.style.color=l.caption.font_color;caption.style.backgroundColor=l.caption.bg_color+Math.round(l.caption.bg_opacity*2.55).toString(16).padStart(2,'0');caption.textContent=p.text;const id=attempt;const mediaError=()=>{if(attempt===id)finish('media-error')};if(p.rule.image){image.onerror=mediaError;image.src='media/'+p.rule.image;image.style.display='block'}if(p.rule.audio){audio=new Audio('media/'+p.rule.audio);audio.onerror=mediaError;audio.volume=p.volume/100;audio.play().catch(mediaError)}stage.style.display='block';const frames={fade:[{opacity:0},{opacity:1}],slide_up:[{opacity:0,transform:'translateY(8%)'},{opacity:1,transform:'none'}],slide_down:[{opacity:0,transform:'translateY(-8%)'},{opacity:1,transform:'none'}],slide_left:[{opacity:0,transform:'translateX(-8%)'},{opacity:1,transform:'none'}],slide_right:[{opacity:0,transform:'translateX(8%)'},{opacity:1,transform:'none'}],slide_top:[{opacity:0,transform:'translateY(-8%)'},{opacity:1,transform:'none'}],slide_bottom:[{opacity:0,transform:'translateY(8%)'},{opacity:1,transform:'none'}],bounce:[{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'scale(1.06)'},{opacity:1,transform:'none'}],zoom:[{opacity:0,transform:'scale(.85)'},{opacity:1,transform:'none'}]};if(frames[l.anim_in])animation=stage.animate(frames[l.anim_in],{duration:Math.min(l.anim_duration_ms,p.rule.duration*500),fill:'both'});timer=setTimeout(()=>{if(frames[l.anim_out]){animation?.cancel();animation=stage.animate([...frames[l.anim_out]].reverse(),{duration:Math.min(l.anim_duration_ms,500),fill:'both'});timer=setTimeout(()=>finish(),Math.min(l.anim_duration_ms,500))}else finish()},p.rule.duration*1000)};source.onerror=clear;`
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
 online(){return [...this.streams].some(s=>!s.destroyed&&s.writableLength<=65536)}
 active(attempt:string){return this.playback?.attempt===attempt&&!this.playback.stream.destroyed&&this.streams.has(this.playback.stream)}
 private write(stream:ServerResponse,value:unknown){if(stream.destroyed||stream.writableLength>65536){stream.destroy();this.streams.delete(stream);return false}try{stream.write('data: '+JSON.stringify(value)+'\n\n');return true}catch{stream.destroy();this.streams.delete(stream);return false}}
 send(value:Playback){
  if(this.playback)return false
  for(const stream of this.streams){if(this.write(stream,{type:'play',...value})){this.playback={attempt:value.attempt,stream};return true}}
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
