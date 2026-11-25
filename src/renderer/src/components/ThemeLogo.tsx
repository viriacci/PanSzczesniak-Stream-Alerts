import type {ThemeId} from '../../../shared/themes'
const card=new URL('../assets/pssa-card.png',import.meta.url).href
const vivi=new URL('../assets/vivi.png',import.meta.url).href
const shiroe=new URL('../assets/shiroe.webp',import.meta.url).href
export function ThemeLogo({theme,className}:{theme:ThemeId;className:string}){
 return <span className={className+' image-logo'}><img src={theme==='vivionyx'?vivi:theme==='shiroe'?shiroe:card} alt="" draggable={false}/></span>
}
