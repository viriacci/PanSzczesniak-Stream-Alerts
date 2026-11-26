export const languages=['pl','en','de'] as const
export type Language=typeof languages[number]
export type LocaleCatalog={meta:{code:Language;language:string;author:string;version:string;schemaVersion:1};translations:Record<string,string>}
export const isLanguage=(v:unknown):v is Language=>typeof v==='string'&&(languages as readonly string[]).includes(v)
export function translate(catalog:LocaleCatalog|undefined,fallback:LocaleCatalog|undefined,key:string,values:Record<string,string|number>={}):string{
 const find=(c:LocaleCatalog|undefined)=>c&&Object.hasOwn(c.translations,key)?c.translations[key]:undefined
 return (find(catalog)??find(fallback)??key).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(match,name:string)=>Object.hasOwn(values,name)?String(values[name]):match)
}
export function validateCatalog(value:unknown,code:Language):LocaleCatalog{
 if(!value||typeof value!=='object')throw Error('Invalid locale')
 const c=value as LocaleCatalog
 if(!c.meta||c.meta.code!==code||c.meta.schemaVersion!==1||typeof c.meta.language!=='string'||typeof c.meta.author!=='string'||typeof c.meta.version!=='string'||!c.translations||typeof c.translations!=='object'||Array.isArray(c.translations))throw Error('Invalid locale metadata')
 for(const [key,text] of Object.entries(c.translations))if(!/^[a-zA-Z][a-zA-Z0-9_.-]{0,150}$/.test(key)||['__proto__','constructor','prototype'].includes(key)||typeof text!=='string'||!text.trim()||text.length>16000)throw Error('Invalid translation')
 return c
}

export const regions=['auto','pl-PL','en-US','en-GB','de-DE'] as const
export type Region=typeof regions[number]
export const isRegion=(value:unknown):value is Region=>typeof value==='string'&&(regions as readonly string[]).includes(value)
export function resolveRegion(language:Language,region:Region='auto'):Exclude<Region,'auto'>{return region==='auto'?({pl:'pl-PL',en:'en-US',de:'de-DE'} as const)[language]:region}
// Bounded formatter caches avoid repeated Intl construction for queue rows and heatmaps.
const numberFormats=new Map<string,Intl.NumberFormat>(),dateFormats=new Map<string,Intl.DateTimeFormat>()
function cached<T>(cache:Map<string,T>,key:string,create:()=>T):T{
 const existing=cache.get(key);if(existing!==undefined)return existing
 const value=create();if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(key,value);return value
}
export function regionalNumber(region:Exclude<Region,'auto'>,value:number|null,options:Intl.NumberFormatOptions={}):string{return value===null?'—':cached(numberFormats,region+JSON.stringify(options),()=>new Intl.NumberFormat(region,options)).format(value)}
export function regionalDate(region:Exclude<Region,'auto'>,value:number|string,options:Intl.DateTimeFormatOptions={}):string{const date=new Date(value);return Number.isFinite(date.getTime())?cached(dateFormats,region+JSON.stringify(options),()=>new Intl.DateTimeFormat(region,options)).format(date):'—'}
