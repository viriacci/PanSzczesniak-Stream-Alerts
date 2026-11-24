import { normalizeEvent, subscriptions } from './events'
import type { Auth } from './auth'
import type { AlertEvent } from '../../shared/alerts'
export class EventSub {
 private sockets=new Set<WebSocket>()
 private current?:WebSocket
 private pending?:WebSocket
 private timers=new Map<WebSocket,ReturnType<typeof setTimeout>>()
 private retry?:ReturnType<typeof setTimeout>
 private stopped=true
 private attempts=0
 private seen=new Map<string,number>()
 constructor(private auth:Auth,private state:(phase:'connecting'|'connected'|'retrying'|'error',detail:string)=>void,private emit:(e:AlertEvent)=>void){}
 start(){this.stop();this.stopped=false;this.attempts=0;this.seen.clear();this.connect('wss://eventsub.wss.twitch.tv/ws',false)}
 stop(){this.stopped=true;clearTimeout(this.retry);this.retry=undefined;for(const s of this.sockets)this.close(s);this.current=undefined;this.pending=undefined}
 private close(s:WebSocket){clearTimeout(this.timers.get(s));this.timers.delete(s);this.sockets.delete(s);try{s.close()}catch{}}
 private watchdog(s:WebSocket,seconds:number){clearTimeout(this.timers.get(s));this.timers.set(s,setTimeout(()=>{this.close(s);this.lost(s)},seconds*1000+2000))}
 private lost(s:WebSocket){
  if(this.stopped)return
  if(s===this.pending){this.pending=undefined;if(this.current&&this.current!==s){this.close(this.current);this.current=undefined}}
  else if(s===this.current){this.current=undefined;if(this.pending)return}
  else return
  if(this.retry)return
  this.state('retrying','Ponowne połączenie…')
  this.retry=setTimeout(()=>{this.retry=undefined;if(!this.stopped)this.connect('wss://eventsub.wss.twitch.tv/ws',false)},Math.min(60000,1000*2**Math.min(this.attempts++,6))+Math.random()*500)
 }
 private connect(url:string,migrated:boolean){
  if(this.stopped)return
  try{const u=new URL(url);if(u.protocol!=='wss:'||u.hostname!=='eventsub.wss.twitch.tv'||u.username||u.password||u.port)throw Error('Invalid reconnect URL')}catch{this.state('error','Nieprawidłowy adres EventSub');return}
  const s=new WebSocket(url);this.sockets.add(s);if(migrated)this.pending=s;else{this.current=s;this.state('connecting','Łączenie EventSub…')}
  let interval=10,welcomed=false
  this.watchdog(s,15)
  s.addEventListener('message',event=>{void (async()=>{
   if(this.stopped||!this.sockets.has(s)||typeof event.data!=='string')return
   let m:any;try{m=JSON.parse(event.data)}catch{return}
   if(welcomed)this.watchdog(s,interval)
   switch(m.metadata?.message_type){
    case 'session_welcome':{
     if(welcomed)return;welcomed=true;interval=Math.max(5,Math.min(120,Number(m.payload?.session?.keepalive_timeout_seconds)||10));this.watchdog(s,interval)
     if(migrated){const old=this.current;this.current=s;this.pending=undefined;if(old&&old!==s)this.close(old)}
     else{
      const identity=this.auth.identity,session=m.payload?.session?.id;if(!identity||typeof session!=='string')throw Error('Brak sesji Twitch')
      const results=await Promise.allSettled(subscriptions(identity.userId).map(sub=>this.auth.helix('eventsub/subscriptions',{...sub,transport:{method:'websocket',session_id:session}})))
      if(!this.sockets.has(s)||this.stopped)return
      const failed=results.filter(x=>x.status==='rejected').length
      if(failed===results.length){this.state('error','Twitch odrzucił wszystkie subskrypcje');this.stop();return}
      this.attempts=0;this.state('connected',failed?('Nieaktywne subskrypcje: '+failed):'EventSub aktywny');return
     }
     this.attempts=0;this.state('connected','EventSub aktywny');return
    }
    case 'session_reconnect':if(s===this.current&&!this.pending&&typeof m.payload?.session?.reconnect_url==='string')this.connect(m.payload.session.reconnect_url,true);return
    case 'revocation':this.state('error','Twitch cofnął subskrypcję. Połącz ponownie.');this.stop();return
    case 'notification':{
     const id=m.metadata?.message_id;if(typeof id!=='string'||this.seen.has(id))return
     this.seen.set(id,Date.now());if(this.seen.size>10000){const first=this.seen.keys().next().value;if(first)this.seen.delete(first)}
     const normalized=normalizeEvent(id,m.metadata.subscription_type,m.payload?.event);if(normalized)this.emit(normalized)
    }
   }
  })().catch(()=>{if(this.sockets.has(s)){this.close(s);this.lost(s)}})})
  s.addEventListener('close',()=>{if(this.sockets.has(s)){this.close(s);this.lost(s)}})
  s.addEventListener('error',()=>{if(this.sockets.has(s)){this.close(s);this.lost(s)}})
 }
}
