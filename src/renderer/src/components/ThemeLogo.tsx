import type {ThemeId} from '../../../shared/themes'
import {themes} from '../../../shared/themes'
const card=new URL('../assets/pssa-card.png',import.meta.url).href
const vivi=new URL('../assets/vivi.png',import.meta.url).href
export function ThemeLogo({theme,className}:{theme:ThemeId;className:string}){
 return theme==='shiroe'?<span className={className}>{themes[theme].symbol}</span>:<span className={className+' image-logo'}><img src={theme==='vivionyx'?vivi:card} alt="" draggable={false}/></span>
}
