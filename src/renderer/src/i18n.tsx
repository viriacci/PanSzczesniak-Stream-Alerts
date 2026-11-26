import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react'
import {translate,type Language,type LocaleCatalog} from '../../shared/i18n'
type Catalogs=Record<Language,LocaleCatalog>
type Context={language:Language;t:(key:string,values?:Record<string,string|number>)=>string}
const LocaleContext=createContext<Context>({language:'pl',t:key=>key})
export function LocaleProvider({language,children}:{language:Language;children:ReactNode}){
 const [catalogs,setCatalogs]=useState<Catalogs>(),[failed,setFailed]=useState(false)
 useEffect(()=>{let active=true;void window.pssa.localeCatalogs().then(c=>{if(active)setCatalogs(c)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[])
 useEffect(()=>{document.documentElement.lang=language},[language])
 const value=useMemo(()=>({language,t:(key:string,values?:Record<string,string|number>)=>translate(catalogs?.[language],catalogs?.pl,key,values)}),[language,catalogs])
 return <LocaleContext.Provider value={value}>{catalogs?children:failed?<p role="alert">PSSA: locales/pl.json, en.json, de.json unavailable. Reinstall PSSA / Zainstaluj PSSA ponownie / PSSA erneut installieren.</p>:<p>PSSA…</p>}</LocaleContext.Provider>
}
export const useLocale=()=>useContext(LocaleContext)
