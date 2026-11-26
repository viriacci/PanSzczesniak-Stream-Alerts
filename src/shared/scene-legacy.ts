import {makeLayer,type Scene,type Layer,type Animation} from './scene.ts'
import {normalizeLayout,validMedia,type AlertRule} from './alerts.ts'
export function titleStyle(layer:Layer,reward:boolean):Layer{
 return {...layer,accentVariable:undefined,font:'Segoe UI',fontSize:64,fontWeight:700,color:'#ffffff',shadow:true,backgroundOpacity:0,borderWidth:0,borderStyle:'none',accentColor:reward?'#e3c048':undefined,accentAfter:reward?' odbiera ':undefined}
}
export function sceneForRule(rule:AlertRule):Scene{
 if(rule.scene)return rule.scene
 const layout=normalizeLayout(rule.layout??{})!,duration=Math.round(rule.duration*1000)
 const anim=(v:string):Animation=>v==='slide_top'?'slide_up':v==='slide_bottom'?'slide_down':v as Animation
 const common={enter:anim(layout.anim_in),exit:anim(layout.anim_out),enterMs:Math.min(layout.anim_duration_ms,duration/2),exitMs:Math.min(500,layout.anim_duration_ms,duration/2)}
 const image={...makeLayer('image','legacy-image',duration),...common,asset:rule.image,x:layout.image.x,y:layout.image.y,width:layout.image.width,height:layout.image.height,borderWidth:layout.image.border_width,borderColor:layout.image.border_color,borderStyle:layout.image.border_style as 'none'}
 const caption={...makeLayer('text','legacy-caption',duration),...common,text:'{alert}',x:layout.caption.x,y:layout.caption.y,width:layout.caption.width,height:layout.caption.height,color:layout.caption.font_color,background:layout.caption.bg_color,backgroundOpacity:layout.caption.bg_opacity,font:layout.caption.font_family,fontSize:layout.caption.font_size,borderWidth:layout.caption.border_width,borderColor:layout.caption.border_color,borderStyle:layout.caption.border_style as 'none'}
 const modern=(!rule.layout||JSON.stringify(layout)===JSON.stringify(normalizeLayout({})))&&!rule.image
 const styled=modern?titleStyle({...caption,name:'Tytuł alertu',x:50,y:68,width:86,height:22},rule.key.startsWith('reward:')):caption
 const layers=[...(rule.image?[image]:[]),styled,...(rule.audio?[{...makeLayer('audio','legacy-audio',duration),asset:rule.audio,enter:'none' as const,exit:'none' as const}]:[])]
 return {version:1,width:1920,height:1080,duration,layers}
}

export function ruleMedia(rule:AlertRule,kind:'image'|'audio'){return rule.scene?rule.scene.layers.find(l=>l.kind===kind&&!l.locked)?.asset??'':rule[kind]}
export function assignRuleMedia(rule:AlertRule,kind:'image'|'audio',asset:string):AlertRule{
 if(!validMedia(asset)||asset&&!(kind==='image'?/\.(png|jpg|jpeg|gif|webp)$/i:/\.(mp3|wav|ogg|m4a)$/i).test(asset))throw Error('Invalid media')
 if(!rule.scene)return {...rule,[kind]:asset}
 const scene=rule.scene,layer=scene.layers.find(l=>l.kind===kind&&!l.locked)
 if(layer)return {...rule,scene:{...scene,layers:scene.layers.map(l=>l.id===layer.id?{...l,asset}:l)}}
 if(!asset)return rule
 if(scene.layers.some(l=>l.kind===kind)||scene.layers.length>=32)throw Error('Warstwa zablokowana lub osiągnięto limit warstw.')
 let id='quick-'+kind;for(let i=1;scene.layers.some(l=>l.id===id);i++)id='quick-'+kind+'-'+i
 const next={...makeLayer(kind,id,scene.duration),name:kind==='image'?'Grafika':'Dźwięk',asset,...(kind==='audio'?{enter:'none' as const,exit:'none' as const}: {})}
 return {...rule,scene:{...scene,layers:kind==='image'?[next,...scene.layers]:[...scene.layers,next]}}
}
