export const kinds = ['redemption','raid','follow','sub','prime_sub','resub','gift','mass_gift','bits'] as const
export type AlertKind = typeof kinds[number]
export interface AlertEvent { id:string; kind:AlertKind; user:string; rewardId?:string; reward?:string; count?:number; months?:number }
export interface AlertRule { key:string; enabled:boolean; title:string; image:string; audio:string; duration:number; template:string; layout?:AlertLayout }
export interface Border {border_width:number;border_color:string;border_style:string}
export interface AlertLayout { image:{x:number;y:number;width:number;height:number}&Border; caption:{x:number;y:number;width:number;height:number;font_size:number;font_color:string;bg_color:string;bg_opacity:number;font_family:string}&Border; anim_in:string;anim_out:string;anim_duration_ms:number }
export interface TwitchState { phase:'disconnected'|'authorizing'|'connecting'|'connected'|'retrying'|'error'; login:string; detail:string; overlayUrl:string; clients:number }
export interface Reward {id:string;title:string;cost:number}
export interface AlertState { twitch:TwitchState; rules:AlertRule[]; rewards:Reward[] }
export const templates:Record<AlertKind,string>={redemption:'{user} odbiera {reward}',raid:'{user} najeżdża z {viewers} widzami!',follow:'{user} zaczyna obserwować!',sub:'{user} subskrybuje!',prime_sub:'{user} subskrybuje z Prime!',resub:'{user} odnawia subskrypcję ({months} mies.)!',gift:'{user} podarował subskrypcję!',mass_gift:'{user} podarował {count} subskrypcji!',bits:'{user} przekazuje {bits} Bits!'}
export function validKey(key:string):boolean {return (kinds as readonly string[]).includes(key)||/^reward:[a-zA-Z0-9_-]{1,128}$/.test(key)}
export function validMedia(name:string):boolean {return name===''||/^[a-f0-9]{64}\.(png|jpg|jpeg|gif|webp|mp3|wav|ogg|m4a|webm|mp4)$/i.test(name)}
export function defaultRule(key:string,title=key):AlertRule {return {key,title,enabled:false,image:'',audio:'',duration:5,template:templates[key.startsWith('reward:')?'redemption':key as AlertKind]??'{user}'}}
const num=(v:unknown,d:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):d
const color=(v:unknown,d:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:d
export function normalizeLayout(value:unknown):AlertLayout|undefined {
 if(!value||typeof value!=='object')return undefined
 const v=value as Record<string,any>, i=v.image??{},c=v.caption??{}
 const pos=(p:any,y:number,w:number,h:number)=>({x:num(p.x,50,0,100),y:num(p.y,y,0,100),width:num(p.width,w,1,100),height:num(p.height,h,1,100)})
 const anim=(a:unknown)=>typeof a==='string'&&['fade','slide_up','slide_down','slide_left','slide_right','slide_top','slide_bottom','zoom','bounce','none'].includes(a)?a:'fade'
 const border=(p:any)=>({border_width:num(p.border_width,0,0,30),border_color:color(p.border_color,'#000000'),border_style:typeof p.border_style==='string'&&['none','solid','dashed','dotted','double'].includes(p.border_style)?p.border_style:'none'})
 const font=typeof c.font_family==='string'&&/^[\p{L}\p{N} _-]{1,80}$/u.test(c.font_family)?c.font_family:'Arial'
 return {image:{...pos(i,38,30,40),...border(i)},caption:{...pos(c,68,40,10),...border(c),font_family:font,font_size:num(c.font_size,32,8,160),font_color:color(c.font_color,'#ffffff'),bg_color:color(c.bg_color,'#843935'),bg_opacity:num(c.bg_opacity,90,0,100)},anim_in:anim(v.anim_in),anim_out:anim(v.anim_out),anim_duration_ms:num(v.anim_duration_ms,600,0,3000)}
}
export function parseRule(value:unknown):AlertRule {
 if(!value||typeof value!=='object')throw Error('Nieprawidłowy alert')
 const v=value as Record<string,unknown>
 if(typeof v.key!=='string'||!validKey(v.key)||typeof v.enabled!=='boolean'||typeof v.title!=='string'||v.title.length>200||typeof v.template!=='string'||v.template.length>500||typeof v.image!=='string'||!validMedia(v.image)||typeof v.audio!=='string'||!validMedia(v.audio)||typeof v.duration!=='number'||!Number.isFinite(v.duration)||v.duration<1||v.duration>120)throw Error('Nieprawidłowe ustawienia alertu')
 return {key:v.key,enabled:v.enabled,title:v.title,template:v.template,image:v.image,audio:v.audio,duration:v.duration,layout:normalizeLayout(v.layout)}
}
export function renderText(template:string,event:AlertEvent):string {
 const vars:Record<string,string>={user:event.user,reward:event.reward??'',viewers:String(event.count??0),bits:String(event.count??0),count:String(event.count??0),months:String(event.months??0)}
 return template.replace(/\{([a-z_]+)\}/g,(token,key:string)=>vars[key]??token)
}
