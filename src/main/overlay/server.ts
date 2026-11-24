import { createServer,type Server,type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat,realpath } from 'node:fs/promises'
import { extname,join,relative,isAbsolute } from 'node:path'
import { validMedia,type AlertRule } from '../../shared/alerts'
import { mediaTypes } from '../alerts/media'
const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#stage{position:absolute;inset:0;display:none}#image,#caption{position:absolute;transform:translate(-50%,-50%);box-sizing:border-box}#image{object-fit:contain}#caption{display:grid;place-items:center;text-align:center;font-family:Arial,sans-serif;overflow-wrap:anywhere;white-space:pre-wrap}</style></head><body><div id="stage"><img id="image"><div id="caption"></div></div><script src="client.js"></script></body></html>`
const js=`const stage=document.getElementById('stage'),image=document.getElementById('image'),caption=document.getElementById('caption');let timer,audio,animation;function clear(){clearTimeout(timer);animation?.cancel();stage.style.display='none';image.removeAttribute('src');image.style.display='none';caption.textContent='';if(audio){audio.pause();audio.removeAttribute('src');audio=null}}function pos(el,p){el.style.left=p.x+'%';el.style.top=p.y+'%';el.style.width=p.width+'%';el.style.height=p.height+'%'}const source=new EventSource('events');source.onmessage=e=>{let p;try{p=JSON.parse(e.data)}catch{return}clear();const l=p.rule.layout||{image:{x:50,y:38,width:30,height:40},caption:{x:50,y:68,width:40,height:10,font_size:32,font_color:'#ffffff',bg_color:'#843935',bg_opacity:90},anim_in:'fade',anim_out:'fade',anim_duration_ms:400};pos(image,l.image);pos(caption,l.caption);caption.style.fontSize=l.caption.font_size+'px';caption.style.color=l.caption.font_color;caption.style.backgroundColor=l.caption.bg_color+Math.round(l.caption.bg_opacity*2.55).toString(16).padStart(2,'0');caption.textContent=p.text;if(p.rule.image){image.src='media/'+p.rule.image;image.style.display='block'}if(p.rule.audio){audio=new Audio('media/'+p.rule.audio);audio.play().catch(()=>{})}stage.style.display='block';const frames={fade:[{opacity:0},{opacity:1}],slide_up:[{opacity:0,transform:'translateY(8%)'},{opacity:1,transform:'none'}],slide_down:[{opacity:0,transform:'translateY(-8%)'},{opacity:1,transform:'none'}],zoom:[{opacity:0,transform:'scale(.85)'},{opacity:1,transform:'none'}]};if(frames[l.anim_in])animation=stage.animate(frames[l.anim_in],{duration:Math.min(l.anim_duration_ms,p.rule.duration*500),fill:'both'});timer=setTimeout(()=>{if(frames[l.anim_out]){animation?.cancel();animation=stage.animate([...frames[l.anim_out]].reverse(),{duration:Math.min(l.anim_duration_ms,500),fill:'both'});timer=setTimeout(clear,Math.min(l.anim_duration_ms,500))}else clear()},p.rule.duration*1000)};source.onerror=clear;`
export class Overlay {
 private server?:Server
 private streams=new Set<ServerResponse>()
 private heartbeat?:ReturnType<typeof setInterval>
 private key=''
 constructor(private media:string){}
 get url(){return this.key?'http://127.0.0.1:18766/'+this.key+'/':''}
 get clients(){return this.streams.size}
 async start(key?:string){
  if(this.server)return
  this.key=key&&/^[a-f0-9]{64}$/.test(key)?key:randomBytes(32).toString('hex')
  const server=createServer((req,res)=>{void this.handle(req.method,req.url,req.headers.host,res).catch(()=>{if(!res.headersSent)res.writeHead(404);res.end()})})
  this.server=server
  try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(18766,'127.0.0.1',()=>{server.removeListener('error',reject);resolve()})})}catch(e){this.server=undefined;this.key='';throw e}
  server.on('error',()=>this.stop())
  this.heartbeat=setInterval(()=>{for(const s of this.streams){if(s.destroyed||s.writableLength>65536){s.destroy();this.streams.delete(s)}else s.write(': keepalive\n\n')}},15000)
 }
 stop(){clearInterval(this.heartbeat);for(const s of this.streams)s.end();this.streams.clear();this.server?.close();this.server=undefined;this.key=''}
 publish(rule:AlertRule,text:string){const data='data: '+JSON.stringify({rule,text})+'\n\n';let sent=0;for(const s of this.streams){if(s.destroyed||s.writableLength>65536){s.destroy();this.streams.delete(s)}else{s.write(data);sent++}}return sent}
 private async handle(method:string|undefined,url:string|undefined,host:string|undefined,res:ServerResponse){
  const prefix='/'+this.key+'/'
  if(method!=='GET'||host!=='127.0.0.1:18766'||!this.key||!url?.startsWith(prefix)){res.writeHead(404);res.end();return}
  const path=url.slice(prefix.length)
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer')
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'; frame-ancestors 'none'")
  if(path===''){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return}
  if(path==='client.js'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});res.end(js);return}
  if(path==='events'){if(this.streams.size>=10){res.writeHead(503);res.end();return}res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(': connected\n\n');this.streams.add(res);res.on('close',()=>this.streams.delete(res));return}
  if(path.startsWith('media/')){
   const name=path.slice(6),type=mediaTypes[extname(name).toLowerCase()]
   if(name&&validMedia(name)&&type){const root=await realpath(this.media),file=await realpath(join(root,name)),rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid path');const st=await stat(file);if(!st.isFile())throw Error('Invalid file');res.writeHead(200,{'Content-Type':type,'Content-Length':st.size});const stream=createReadStream(file);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return}
  }
  res.writeHead(404);res.end()
 }
}
