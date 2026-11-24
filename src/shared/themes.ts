export const themeIds=['pssa','vivionyx','shiroe'] as const
export type ThemeId=typeof themeIds[number]
export const themes={
 pssa:{name:'Pan Szczesniak',symbol:'P',subtitle:'Black & Gold',colors:['#101012','#1b1b1e','#e3c048','#f2f2f2'],description:'Klasyczna czerń i złoto.'},
 vivionyx:{name:'ViviOnyx',symbol:'V',subtitle:'Onyx Atelier',colors:['#16121d','#252031','#d8a9eb','#f5edf8'],description:'Koncepcja: śliwkowy onyks, lawenda, zgaszona szałwia i subtelny motyw księżyca.'},
 shiroe:{name:'Shiroe',symbol:'S',subtitle:'Glacial Archive',colors:['#101820','#1a2631','#8ad4f5','#eff8ff'],description:'Koncepcja: grafit, lodowy błękit i geometryczne detale.'}
} satisfies Record<ThemeId,{name:string;symbol:string;subtitle:string;colors:string[];description:string}>
export function parseTheme(v:unknown):ThemeId{if(v===undefined)return 'pssa';if(typeof v==='string'&&themeIds.includes(v as ThemeId))return v as ThemeId;throw Error('Invalid theme')}
