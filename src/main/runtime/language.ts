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
export function loadCatalogs(root:string):Record<Language,LocaleCatalog>{
 return Object.fromEntries(languages.map(code=>{const path=join(root,'locales',code+'.json');if(statSync(path).size>1024*1024)throw Error('Locale too large');return [code,validateCatalog(JSON.parse(readFileSync(path,'utf8')),code)]})) as Record<Language,LocaleCatalog>
}
