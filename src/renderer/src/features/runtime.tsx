import {useLocale} from '../i18n'
import {languages,type Language} from '../../../shared/i18n'
import {MeasurementPanel,CrashPanel} from './measurement'
import {BRAND} from '../../../shared/brand'
import {useEffect,useState} from 'react'
import type {RuntimePreferences,Diagnostics,UpdateInfo,PerformanceMode} from '../../../shared/runtime'
import {Button,Panel,SettingsSection} from '../components/ui'
export function useRuntime(){
 const [runtime,setRuntime]=useState<RuntimePreferences>()
 useEffect(()=>{let active=true;window.pssa.runtimeState().then(v=>{if(active)setRuntime(v)}).catch(()=>{});return()=>{active=false}},[])
 async function saveRuntime(p:RuntimePreferences){const v=await window.pssa.runtimeSave(p);setRuntime(v);return v}
 return {runtime,saveRuntime}
}
type Props={runtime:RuntimePreferences;save:(p:RuntimePreferences)=>Promise<RuntimePreferences>}
export function Onboarding({runtime,save,onIntegrations}:Props&{onIntegrations:()=>void}){
 const {t}=useLocale()
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function finish(integrate=false){setBusy(true);try{await save({...runtime,onboarded:true});if(integrate)onIntegrations()}catch{setNotice(t('onboard.error'))}finally{setBusy(false)}}
 return <div className="runtime-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div className="runtime-welcome"><p className="eyebrow">{BRAND}</p><h2 id="welcome-title">{t("onboard.title")}</h2><p>{t("onboard.detail")}</p><div className="alert-actions"><Button disabled={busy} variant="primary" onClick={()=>void finish(true)}>{t("onboard.login")}</Button><Button disabled={busy} onClick={()=>void finish()}>{t("onboard.offline")}</Button></div>{notice&&<p role="status">{notice}</p>}</div></div>
}
const modes:Record<PerformanceMode,{name:string;detail:string}>={studio:{name:'Studio',detail:'runtime.mode.studio'},streaming:{name:'Streaming',detail:'runtime.mode.streaming'},background:{name:'Background',detail:'runtime.mode.background'}}
export function RuntimeSettings({runtime,save,update,checkUpdate,openUpdate}:Props&{update?:UpdateInfo;checkUpdate:()=>Promise<UpdateInfo>;openUpdate:()=>void}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function run(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn()}catch{setNotice(t("runtime.error"))}finally{setBusy(false)}}
 const {t,language}=useLocale()
 const patch=(v:Partial<RuntimePreferences>)=>void run(async()=>{await save({...runtime,...v});if(v.updates!==undefined||v.autoCheck===true)await checkUpdate();setNotice(t("runtime.saved"))})
 return <>
 <SettingsSection title={t("language.title")}><p>{t("language.detail")}</p><label className="alert-form">{t("language.app")}<select data-language-select value={language} disabled={busy} onChange={e=>{const language=e.target.value as Language;void run(async()=>{await save({...runtime,language});setNotice("")})}}>{languages.map(code=><option key={code} value={code}>{{pl:"Polski",en:"English",de:"Deutsch"}[code]}</option>)}</select></label></SettingsSection>
 <SettingsSection title={t("runtime.performance")}>{(Object.keys(modes) as PerformanceMode[]).map(mode=><div className="setting-row" key={mode}><div><h3>{modes[mode].name}</h3><p>{t(modes[mode].detail)}</p></div><Button disabled={busy||runtime.mode===mode} onClick={()=>{if(mode==='background'&&!window.confirm(t("runtime.backgroundConfirm")))return;patch({mode})}}>{runtime.mode===mode?t("runtime.active"):t("common.select")}</Button></div>)}</SettingsSection>
 <SettingsSection title={t("runtime.backup")}><p>{t("runtime.backupDetail")}</p><div className="alert-actions"><Button disabled={busy} onClick={()=>void run(async()=>{const r=await window.pssa.backupCreate();if(r)setNotice(t("runtime.backupSaved",{count:r.media}))})}>{t("runtime.createBackup")}</Button><Button disabled={busy} onClick={()=>void run(async()=>{if(await window.pssa.backupRestore())setNotice(t("runtime.restored"))})}>{t("runtime.restoreBackup")}</Button></div></SettingsSection>
 <SettingsSection title={t("runtime.updates")}><label className="alert-form">{t("runtime.channel")}<select disabled={busy} value={runtime.updates} onChange={e=>patch({updates:e.target.value as RuntimePreferences['updates']})}><option value="stable">Stable</option><option value="beta">Beta</option></select></label><label className="alert-checkbox"><input type="checkbox" checked={runtime.autoCheck} disabled={busy} onChange={e=>patch({autoCheck:e.target.checked})}/> {t("runtime.autoCheck")}</label><p>{update?.detail}{update?.version?' · '+update.version:''}</p><div className="alert-actions"><Button disabled={busy} onClick={()=>void run(async()=>{await checkUpdate()})}>{t("runtime.checkNow")}</Button>{update?.state==='available'&&<Button variant="primary" disabled={busy} onClick={openUpdate}>{t("shell.updateApp")}</Button>}<Button disabled={busy||update?.state!=='available'} onClick={()=>void run(()=>window.pssa.updateOpen())}>{t("runtime.github")}</Button></div></SettingsSection>
 {notice&&<p role="status">{notice}</p>}
 </>
}
export function DiagnosticsPage(){
 const {t}=useLocale()
 const [data,setData]=useState<Diagnostics>(),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 async function refresh(){setBusy(true);try{setData(await window.pssa.diagnostics())}catch{setNotice(t("runtime.diagnosticsError"))}finally{setBusy(false)}}
 useEffect(()=>{void refresh()},[])
 return <><Panel title={t("runtime.diagnostics")} action={<Button disabled={busy} onClick={()=>void refresh()}>{t("runtime.refresh")}</Button>}>{data&&<dl className="details">{Object.entries(data).map(([k,v])=><div className="diagnostic-pair" key={k}><dt>{t("diag."+k)}</dt><dd>{typeof v==='boolean'?(v?t("common.yes"):t("common.no")):String(v)||'—'}</dd></div>)}</dl>}<Button disabled={busy} onClick={()=>{setBusy(true);void window.pssa.diagnosticsExport().then(v=>setNotice(v?t("runtime.reportSaved"):t("runtime.cancelled"))).catch(()=>setNotice(t("runtime.reportError"))).finally(()=>setBusy(false))}}>{t("runtime.reportExport")}</Button>{notice&&<p role="status">{notice}</p>}</Panel><MeasurementPanel/><CrashPanel/></>
}
