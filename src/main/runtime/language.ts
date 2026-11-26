import {readFileSync,writeFileSync,renameSync,rmSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {isLanguage,validateCatalog,languages,type Language,type LocaleCatalog} from '../../shared/i18n.ts'
export function readLanguage(directory:string):Language{
 try{const path=join(directory,'language.json');if(statSync(path).size>1024)return 'pl';const value=JSON.parse(readFileSync(path,'utf8')).language;return isLanguage(value)?value:'pl'}catch{return 'pl'}
}
export function writeLanguage(directory:string,language:Language){
 if(!isLanguage(language))throw Error('Invalid language')
 const path=join(directory,'language.json'),temp=path+'.'+randomUUID()+'.tmp'
 try{writeFileSync(temp,JSON.stringify({language})+'\n',{flag:'wx',mode:0o600});renameSync(temp,path)}finally{rmSync(temp,{force:true})}
}
function readCatalog(root:string,code:Language):LocaleCatalog{
 const path=join(root,'locales',code+'.json')
 if(statSync(path).size>1024*1024)throw Error('Locale too large')
 return validateCatalog(JSON.parse(readFileSync(path,'utf8')),code)
}
const placeholders=(s:string)=>[...s.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>m[1]).sort().join(',')
export function loadCatalogs(root:string,fallbackRoot=root):Record<Language,LocaleCatalog>{
 return Object.fromEntries(languages.map(code=>{
  const fallback=readCatalog(fallbackRoot,code)
  if(root===fallbackRoot)return [code,fallback]
  try{
   const external=readCatalog(root,code)
   const translations={...fallback.translations}
   for(const [key,value] of Object.entries(external.translations)){
    if(Object.hasOwn(translations,key)&&placeholders(value)===placeholders(translations[key]!))translations[key]=value
   }
   return [code,{...fallback,translations}]
  }catch{return [code,fallback]}
 })) as Record<Language,LocaleCatalog>
}
