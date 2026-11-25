export const themeIds=['pssa','vivionyx','shiroe'] as const
export type ThemeId=typeof themeIds[number]
export const themes={
 pssa:{name:'Pan Szczesniak',symbol:'P',subtitle:'Black & Gold',colors:['#101012','#1b1b1e','#e3c048','#f2f2f2'],description:'Klasyczna czerń i złoto.'},
 vivionyx:{name:'ViviOnyx',symbol:'V',subtitle:'Onyx Atelier',colors:['#141414','#843935','#ae9278'],description:'Grafit, ceglastoczerwony akcent główny i dyskretne beżowe detale.'},
 shiroe:{name:'Shiroe',symbol:'33',subtitle:'Literary Archive',colors:['#201913','#33271f','#dfc49c','#f6ead8'],description:'Espresso, sepia i pergamin; klasyczna czytelnia.'}
} satisfies Record<ThemeId,{name:string;symbol:string;subtitle:string;colors:string[];description:string}>
export function parseTheme(v:unknown):ThemeId{if(v===undefined)return 'pssa';if(typeof v==='string'&&themeIds.includes(v as ThemeId))return v as ThemeId;throw Error('Invalid theme')}
