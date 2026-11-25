import {makeLayer,type Scene,type Animation} from './scene.ts'
import {normalizeLayout,type AlertRule} from './alerts.ts'
export function sceneForRule(rule:AlertRule):Scene{
 if(rule.scene)return rule.scene
 const layout=normalizeLayout(rule.layout??{})!,duration=Math.round(rule.duration*1000)
 const anim=(v:string):Animation=>v==='slide_top'?'slide_up':v==='slide_bottom'?'slide_down':v as Animation
 const common={enter:anim(layout.anim_in),exit:anim(layout.anim_out),enterMs:Math.min(layout.anim_duration_ms,duration/2),exitMs:Math.min(500,layout.anim_duration_ms,duration/2)}
 const image={...makeLayer('image','legacy-image',duration),...common,asset:rule.image,x:layout.image.x,y:layout.image.y,width:layout.image.width,height:layout.image.height,borderWidth:layout.image.border_width,borderColor:layout.image.border_color,borderStyle:layout.image.border_style as 'none'}
 const caption={...makeLayer('text','legacy-caption',duration),...common,text:'{alert}',x:layout.caption.x,y:layout.caption.y,width:layout.caption.width,height:layout.caption.height,color:layout.caption.font_color,background:layout.caption.bg_color,backgroundOpacity:layout.caption.bg_opacity,font:layout.caption.font_family,fontSize:layout.caption.font_size,borderWidth:layout.caption.border_width,borderColor:layout.caption.border_color,borderStyle:layout.caption.border_style as 'none'}
 const modern=!rule.layout&&!rule.image&&!rule.audio
 const styled=modern?{...caption,name:'Tytuł alertu',x:50,y:68,width:86,height:22,font:'Segoe UI',fontSize:64,fontWeight:700,shadow:true,backgroundOpacity:0,borderWidth:0,borderStyle:'none' as const,...(rule.key.startsWith('reward:')?{accentColor:'#e3c048',accentAfter:' odbiera '}: {})}:caption
 const layers=[...(rule.image?[image]:[]),styled,...(rule.audio?[{...makeLayer('audio','legacy-audio',duration),asset:rule.audio,enter:'none' as const,exit:'none' as const}]:[])]
 return {version:1,width:1920,height:1080,duration,layers}
}
