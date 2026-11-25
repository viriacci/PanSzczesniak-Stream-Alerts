import type {Scene,Layer,Geometry} from './scene.ts'
// This function is intentionally self-contained: OBS receives the same implementation via toString().
export function createScenePlayer(root:HTMLElement,scene:Scene,text:string,mediaBase:string,volume:number,onError:()=>void,sample:(layer:Layer,time:number)=>Geometry,variables:Record<string,string>={}){
 let disposed=false,master=volume/100,failed=false
 const fail=()=>{if(!disposed&&!failed){failed=true;onError()}}
 root.replaceChildren()
 Object.assign(root.style,{position:'relative',overflow:'hidden',width:'100%',height:'100%'})
 const board=document.createElement('div')
 Object.assign(board.style,{position:'absolute',width:scene.width+'px',height:scene.height+'px',left:'50%',top:'50%',transformOrigin:'center',pointerEvents:'none'})
 root.append(board)
 const readiness:Promise<void>[]=[]
 const nodes=scene.layers.map(layer=>{
  const el=document.createElement('div')
  Object.assign(el.style,{position:'absolute',boxSizing:'border-box',left:layer.x+'%',top:layer.y+'%',width:layer.width+'%',height:layer.height+'%',display:'none',overflow:'hidden',border:layer.borderWidth+'px '+layer.borderStyle+' '+layer.borderColor,background:layer.background+Math.round(layer.backgroundOpacity*255/100).toString(16).padStart(2,'0'),borderRadius:layer.shape==='ellipse'?'50%':'0'})
  let media:HTMLMediaElement|undefined
  if(layer.kind==='text'){
   const vars:Record<string,string>={...variables,alert:text},value=layer.text.replace(/\{([a-z_]+)\}/g,(token:string,key:string)=>Object.hasOwn(vars,key)?vars[key]!:token),at=layer.accentAfter&&layer.accentColor?value.indexOf(layer.accentAfter):-1
   if(layer.accentVariable&&layer.accentColor){const content=document.createElement('span');let last=0;for(const m of layer.text.matchAll(/\{([a-z_]+)\}/g)){content.append(document.createTextNode(layer.text.slice(last,m.index)));const token=document.createElement('span');token.textContent=Object.hasOwn(vars,m[1]!)?vars[m[1]!]!:m[0];if(m[1]===layer.accentVariable)token.style.color=layer.accentColor;content.append(token);last=m.index!+m[0].length}content.append(document.createTextNode(layer.text.slice(last)));el.append(content)}else if(at>=0){const split=at+layer.accentAfter!.length,content=document.createElement('span'),accent=document.createElement('span');content.append(document.createTextNode(value.slice(0,split)));accent.textContent=value.slice(split);accent.style.color=layer.accentColor!;content.append(accent);el.append(content)}else el.textContent=value
   Object.assign(el.style,{color:layer.color,fontFamily:layer.font+', sans-serif',fontSize:layer.fontSize+'px',fontWeight:String(layer.fontWeight??400),textShadow:layer.shadow?'0 3px 12px #000c,0 1px 3px #000':'none',whiteSpace:'pre-wrap',overflowWrap:'anywhere',alignItems:'center',justifyContent:'center',textAlign:'center'})
  }else if(layer.kind==='image'&&layer.asset&&layer.visible){
   const image=document.createElement('img');image.alt='';image.onerror=()=>{if(!disposed&&layer.visible)fail()};if(layer.visible)readiness.push(new Promise<void>((resolve,reject)=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>reject(Error('Image load failed')),{once:true})}));image.src=mediaBase+layer.asset
   Object.assign(image.style,{width:'100%',height:'100%',objectFit:'contain'});el.append(image)
  }else if((layer.kind==='video'||layer.kind==='audio')&&layer.asset&&layer.visible){
   media=document.createElement(layer.kind==='video'?'video':'audio')
   media.preload=layer.visible?'auto':'none';if(layer.visible)readiness.push(new Promise<void>((resolve,reject)=>{media!.addEventListener('loadeddata',()=>resolve(),{once:true});media!.addEventListener('error',()=>reject(Error('Media load failed')),{once:true})}));media.src=mediaBase+layer.asset;media.onerror=()=>{if(!disposed&&layer.visible)fail()};media.volume=master*layer.volume/100
   if(media instanceof HTMLVideoElement){media.playsInline=true;Object.assign(media.style,{width:'100%',height:'100%',objectFit:'contain'})}
   el.append(media)
  }else if(layer.kind==='particles'){
   const cv=document.createElement('canvas');cv.width=640;cv.height=360;Object.assign(cv.style,{width:'100%',height:'100%'});el.append(cv)
  }
  board.append(el);return {layer,el,media,playing:false,started:false,lastDisplay:'none',lastOpacity:'',lastTransform:'',lastParticles:-Infinity,lastGeometry:undefined as Geometry|undefined,lastCrop:undefined as string|undefined}
 })
 function scale(){const s=Math.min(root.clientWidth/scene.width,root.clientHeight/scene.height);board.style.transform='translate(-50%, -50%) scale('+s+')'}
 const observer=new ResizeObserver(scale);observer.observe(root);scale()
 function effect(name:string,p:number){
  const q=Math.max(0,Math.min(1,p)),r=1-q
  if(name==='none')return {a:1,x:0,y:0,s:1}
  if(name==='slide_left')return {a:q,x:-20*r,y:0,s:1}
  if(name==='slide_right')return {a:q,x:20*r,y:0,s:1}
  if(name==='slide_up')return {a:q,x:0,y:-20*r,s:1}
  if(name==='slide_down')return {a:q,x:0,y:20*r,s:1}
  if(name==='zoom')return {a:q,x:0,y:0,s:.7+.3*q}
  if(name==='bounce')return {a:q,x:0,y:0,s:1-.35*r+.12*Math.sin(q*Math.PI*2)}
  return {a:q,x:0,y:0,s:1}
 }
 function paint(time:number,play=false,edit=false){
  if(disposed)return
  for(const node of nodes){
   const {layer:l,el,media}=node
   const active=l.visible&&(edit||time>=l.start&&time<l.end)
   const display=active&&l.kind!=='audio'?(l.kind==='text'?'flex':'block'):'none';if(node.lastDisplay!==display){el.style.display=display;node.lastDisplay=display}
   if(active){
    const a=effect(l.enter,edit||!l.enterMs?1:(time-l.start)/l.enterMs),b=effect(l.exit,edit||!l.exitMs?1:(l.end-time)/l.exitMs)
    const g=sample(l,time),previous=node.lastGeometry,crop=l.crop
    if(!previous||previous.x!==g.x)el.style.left=g.x+'%'
    if(!previous||previous.y!==g.y)el.style.top=g.y+'%'
    if(!previous||previous.width!==g.width)el.style.width=g.width+'%'
    if(!previous||previous.height!==g.height)el.style.height=g.height+'%'
    node.lastGeometry=g
    const clip=crop?'inset('+crop.top+'% '+crop.right+'% '+crop.bottom+'% '+crop.left+'%)':'none'
    if(node.lastCrop!==clip){el.style.clipPath=clip;node.lastCrop=clip}
    const opacity=String(g.opacity/100*a.a*b.a),transform='translate(-50%,-50%) translate('+(a.x+b.x)+'%,'+(a.y+b.y)+'%) rotate('+g.rotation+'deg) scale('+a.s*b.s+')'
    if(node.lastOpacity!==opacity){el.style.opacity=opacity;node.lastOpacity=opacity}if(node.lastTransform!==transform){el.style.transform=transform;node.lastTransform=transform}
    if(l.kind==='particles'&&(Math.abs(time-node.lastParticles)>=15||edit)){node.lastParticles=time;const cv=el.firstElementChild as HTMLCanvasElement,ctx=cv.getContext('2d');if(ctx){ctx.clearRect(0,0,cv.width,cv.height);const t=Math.max(0,time-l.start)/1000*(l.particleSpeed??100)/100;for(let i=0;i<(l.particleCount??48);i++){const phase=(t*(.15+(i%7)*.025)+((i*61)%101)/101)%1,x=((i*137.51)%cv.width)+Math.sin(t*2+i)*14,y=cv.height*(1-phase),size=3+i%8,shape=l.particleShape??'mixed',kind=shape==='mixed'?['circle','square','star','diamond'][i%4]:shape;ctx.save();ctx.translate(x,y);ctx.rotate(t*.6+i);ctx.globalAlpha=Math.sin(phase*Math.PI)*.9;ctx.fillStyle=l.color;ctx.beginPath();if(kind==='circle')ctx.arc(0,0,size,0,Math.PI*2);else if(kind==='square')ctx.rect(-size,-size,size*2,size*2);else{const n=kind==='star'?10:4;for(let j=0;j<n;j++){const a=j*Math.PI*2/n,r=kind==='star'&&j%2?size*.45:size;const px=Math.cos(a)*r,py=Math.sin(a)*r;if(j)ctx.lineTo(px,py);else ctx.moveTo(px,py)}ctx.closePath()}ctx.fill();ctx.restore()}}}
   }
   if(media){
    const should=active&&play&&time>=l.start&&time<l.end
    if(should&&!node.playing&&!node.started){
     node.started=true
     node.playing=true
     try{media.currentTime=Math.max(0,(time-l.start+(l.mediaOffsetMs??0))/1000)}catch{}
     void media.play().catch(()=>{if(!disposed&&node.playing)fail()})
    }else if(!should&&node.playing){node.playing=false;node.started=false;media.pause()}
    if(!play&&active&&media instanceof HTMLVideoElement&&media.readyState>=1){const target=Math.max(0,Math.min(Number.isFinite(media.duration)?media.duration:Infinity,(time-l.start+(l.mediaOffsetMs??0))/1000));if(Math.abs(media.currentTime-target)>.15)try{media.currentTime=target}catch{}}
   }
  }
 }
 const ready=Promise.all(readiness).then(()=>undefined);void ready.catch(()=>{})
 return {ready,paint,updateGeometry(next:Scene){for(const n of nodes){const l=next.layers.find(x=>x.id===n.layer.id);if(!l)continue;n.layer=l;n.lastGeometry=undefined;n.lastCrop=undefined;Object.assign(n.el.style,{left:l.x+'%',top:l.y+'%',width:l.width+'%',height:l.height+'%'})}},setVolume(value:number){master=Math.max(0,Math.min(100,value))/100;for(const n of nodes)if(n.media)n.media.volume=master*n.layer.volume/100},dispose(){disposed=true;observer.disconnect();for(const n of nodes)if(n.media){n.playing=false;n.media.onerror=null;n.media.pause();n.media.removeAttribute('src');n.media.load()}root.replaceChildren()}}
}
