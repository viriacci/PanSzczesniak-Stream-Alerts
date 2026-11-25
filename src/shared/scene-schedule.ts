import type {Scene} from './scene.ts'
// Pure, self-contained, also serialized into the OBS browser script.
export function nextSceneFrame(scene:Scene,elapsed:number){
 let delay=Math.max(1,scene.duration-elapsed)
 for(const l of scene.layers){
  if(!l.visible||elapsed>=l.end)continue
  if(elapsed<l.start){delay=Math.min(delay,l.start-elapsed);continue}
  delay=Math.min(delay,l.end-elapsed)
  if(l.kind==='audio')continue
  if(l.keyframes?.length){const first=l.keyframes[0]!,last=l.keyframes[l.keyframes.length-1]!;if(elapsed<first.time)delay=Math.min(delay,first.time-elapsed);else if(elapsed<last.time)delay=Math.min(delay,16)}
  if(l.enter!=='none'&&l.enterMs>0&&elapsed<l.start+l.enterMs)delay=Math.min(delay,16)
  if(l.exit!=='none'&&l.exitMs>0){
   const exit=l.end-l.exitMs
   delay=Math.min(delay,elapsed>=exit?16:exit-elapsed)
  }
  if(l.kind==='particles')delay=Math.min(delay,33)
 }
 return Math.max(1,delay)
}
