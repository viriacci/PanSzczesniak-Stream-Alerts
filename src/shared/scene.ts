export const layerKinds=['text','image','video','audio','shape','particles'] as const
export type LayerKind=typeof layerKinds[number]
export const animations=['none','fade','slide_left','slide_right','slide_up','slide_down','zoom','bounce'] as const
export type Animation=typeof animations[number]
export type GeometryKey='x'|'y'|'width'|'height'|'rotation'|'opacity'
export const geometryKeys:GeometryKey[]=['x','y','width','height','rotation','opacity']
export type Geometry=Pick<Layer,GeometryKey>
export interface Keyframe extends Geometry {time:number;easing:'linear'|'smooth'|'hold'}
export interface Crop {top:number;right:number;bottom:number;left:number}
export interface Layer {mediaOffsetMs?:number;crop?:Crop;keyframes?:Keyframe[];fontWeight?:number;shadow?:boolean;accentColor?:string;accentAfter?:string;id:string;name:string;kind:LayerKind;x:number;y:number;width:number;height:number;rotation:number;opacity:number;visible:boolean;locked:boolean;start:number;end:number;enter:Animation;exit:Animation;enterMs:number;exitMs:number;asset:string;text:string;color:string;background:string;backgroundOpacity:number;font:string;fontSize:number;borderWidth:number;borderColor:string;borderStyle:'none'|'solid'|'dashed'|'dotted'|'double';volume:number;shape:'rect'|'ellipse'}
export interface Scene {version:1;width:number;height:number;duration:number;layers:Layer[]}
const number=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid scene number');return v}
const str=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid scene text');return v}
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw Error('Invalid scene flag');return v}
const color=(v:unknown)=>{const s=str(v,7);if(!/^#[0-9a-f]{6}$/i.test(s))throw Error('Invalid color');return s}
function one<T extends string>(v:unknown,values:readonly T[]):T{if(typeof v!=='string'||!values.includes(v as T))throw Error('Invalid scene option');return v as T}
export function makeLayer(kind:LayerKind,id:string,duration:number):Layer{return {id,name:kind,kind,x:50,y:50,width:kind==='text'?50:30,height:kind==='text'?15:30,rotation:0,opacity:100,visible:true,locked:false,start:0,end:duration,enter:'fade',exit:'fade',enterMs:300,exitMs:300,asset:'',text:'{alert}',color:'#ffffff',background:'#101012',backgroundOpacity:kind==='shape'?100:0,font:'Arial',fontSize:42,borderWidth:0,borderColor:'#ffffff',borderStyle:'none',volume:100,shape:'rect'}}
export function parseScene(input:unknown):Scene{
 if(!input||typeof input!=='object')throw Error('Invalid scene')
 const v=input as Record<string,unknown>;if(v.version!==1||!Array.isArray(v.layers)||v.layers.length>32)throw Error('Invalid scene layers')
 const duration=number(v.duration,1000,120000),width=number(v.width,320,3840),height=number(v.height,180,2160)
 if(![duration,width,height].every(Number.isInteger))throw Error('Invalid resolution/duration')
 const ids=new Set<string>()
 const layers=v.layers.map((item:unknown):Layer=>{
  if(!item||typeof item!=='object')throw Error('Invalid layer')
  const a=item as Record<string,unknown>,id=str(a.id,80),kind=one(a.kind,layerKinds)
  if(!/^[a-zA-Z0-9_-]+$/.test(id)||ids.has(id))throw Error('Duplicate or invalid layer ID');ids.add(id)
  const start=number(a.start,0,duration),end=number(a.end,start+1,duration),asset=str(a.asset,80)
  const formats=kind==='image'?'png|jpg|jpeg|gif|webp':kind==='video'?'mp4|webm':kind==='audio'?'mp3|wav|ogg|m4a':''
  if(asset&&(!formats||!new RegExp('^[a-f0-9]{64}\\.('+formats+')$','i').test(asset)))throw Error('Invalid layer media')
  const font=str(a.font,80);if(!/^[\p{L}\p{N} _-]+$/u.test(font))throw Error('Invalid font')
  const optional:Partial<Layer>={}
  if(a.mediaOffsetMs!==undefined)optional.mediaOffsetMs=number(a.mediaOffsetMs,0,86400000)
  if(a.crop!==undefined){if(!a.crop||typeof a.crop!=='object')throw Error('Invalid crop');const c=a.crop as Record<string,unknown>;const crop={top:number(c.top,0,99),right:number(c.right,0,99),bottom:number(c.bottom,0,99),left:number(c.left,0,99)};if(crop.left+crop.right>=100||crop.top+crop.bottom>=100)throw Error('Invalid crop');optional.crop=crop}
  if(a.keyframes!==undefined){if(!Array.isArray(a.keyframes)||a.keyframes.length>120)throw Error('Invalid keyframes');let previous=-1;optional.keyframes=a.keyframes.map((v:unknown)=>{if(!v||typeof v!=='object')throw Error('Invalid keyframe');const k=v as Record<string,unknown>,time=number(k.time,start,end);if(!Number.isInteger(time)||time<=previous)throw Error('Invalid keyframe time');previous=time;return {time,x:number(k.x,0,100),y:number(k.y,0,100),width:number(k.width,1,100),height:number(k.height,1,100),rotation:number(k.rotation,-360,360),opacity:number(k.opacity,0,100),easing:one(k.easing,['linear','smooth','hold'] as const)}})}
  if(a.fontWeight!==undefined)optional.fontWeight=number(a.fontWeight,100,900)
  if(a.shadow!==undefined)optional.shadow=bool(a.shadow)
  if(a.accentColor!==undefined)optional.accentColor=color(a.accentColor)
  if(a.accentAfter!==undefined)optional.accentAfter=str(a.accentAfter,80)
  return {...optional,id,kind,name:str(a.name,100),x:number(a.x,0,100),y:number(a.y,0,100),width:number(a.width,1,100),height:number(a.height,1,100),rotation:number(a.rotation,-360,360),opacity:number(a.opacity,0,100),visible:bool(a.visible),locked:bool(a.locked),start,end,enter:one(a.enter,animations),exit:one(a.exit,animations),enterMs:number(a.enterMs,0,Math.min(3000,end-start)),exitMs:number(a.exitMs,0,Math.min(3000,end-start)),asset,text:str(a.text,500),color:color(a.color),background:color(a.background),backgroundOpacity:number(a.backgroundOpacity,0,100),font,fontSize:number(a.fontSize,8,300),borderWidth:number(a.borderWidth,0,30),borderColor:color(a.borderColor),borderStyle:one(a.borderStyle,['none','solid','dashed','dotted','double'] as const),volume:number(a.volume,0,100),shape:one(a.shape,['rect','ellipse'] as const)}
 })
 return {version:1,width,height,duration,layers}
}
export function resizeDuration(scene:Scene,duration:number):Scene{
 const d=Math.max(1000,Math.min(120000,Math.round(duration)))
 return {...scene,duration:d,layers:scene.layers.map(l=>{const end=l.end===scene.duration?d:Math.min(d,l.end),start=Math.min(l.start,end-1);return retimeLayer(l,start,end)})}
}
export function snap(value:number,enabled:boolean){const clamped=Math.max(0,Math.min(100,value));return enabled?Math.round(clamped/2)*2:Math.round(clamped*10)/10}

export function sampleLayer(l:Layer,time:number):Geometry{
 const base={x:l.x,y:l.y,width:l.width,height:l.height,rotation:l.rotation,opacity:l.opacity}
 const frames=l.keyframes??[]
 if(!frames.length)return base
 const geometry=(k:Keyframe)=>({x:k.x,y:k.y,width:k.width,height:k.height,rotation:k.rotation,opacity:k.opacity})
 if(time<=frames[0]!.time)return geometry(frames[0]!)
 const last=frames[frames.length-1]!
 if(time>=last.time)return geometry(last)
 for(let i=1;i<frames.length;i++){const b=frames[i]!,a=frames[i-1]!;if(time>b.time)continue;let t=(time-a.time)/(b.time-a.time);if(a.easing==='hold')t=time===b.time?1:0;else if(a.easing==='smooth')t=t*t*(3-2*t);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,width:a.width+(b.width-a.width)*t,height:a.height+(b.height-a.height)*t,rotation:a.rotation+(b.rotation-a.rotation)*t,opacity:a.opacity+(b.opacity-a.opacity)*t}}
 return base
}
export function retimeLayer(l:Layer,start:number,end:number,shift=0):Layer{
 const frames=l.keyframes?.map(k=>({...k,time:k.time+shift})).filter(k=>k.time>=start&&k.time<=end)
 return {...l,start,end,enterMs:Math.min(l.enterMs,end-start),exitMs:Math.min(l.exitMs,end-start),...(frames?{keyframes:frames}:{}),...((l.kind==='video'||l.kind==='audio')&&(l.mediaOffsetMs!==undefined||start!==l.start+shift)?{mediaOffsetMs:Math.max(0,Math.min(86400000,(l.mediaOffsetMs??0)+start-l.start-shift))}:{})}
}
export function fitMediaSize(w:number,h:number,sceneWidth:number,sceneHeight:number){
 const ratio=w/h*sceneHeight/sceneWidth
 if(!Number.isFinite(ratio)||ratio<=0)return {width:30,height:30}
 const width=Math.min(60,60*ratio),height=width/ratio
 return {width:Math.max(1,width),height:Math.max(1,height)}
}
export function scaleMedia(w:number,h:number,dx:number,dy:number,lock:boolean){
 if(!lock)return {width:Math.max(1,Math.min(100,w+dx)),height:Math.max(1,Math.min(100,h+dy))}
 const factor=Math.abs(dx/w)>Math.abs(dy/h)?1+dx/w:1+dy/h
 const s=Math.max(Math.max(1/w,1/h),Math.min(Math.min(100/w,100/h),factor))
 return {width:w*s,height:h*s}
}
