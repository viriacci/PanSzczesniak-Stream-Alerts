import {useLocale} from '../i18n'
import {localizeMessage} from '../../../shared/messages'
import {useCallback,useEffect,useRef,useState} from 'react'
import type {UpdateInfo} from '../../../shared/runtime'
import {Button} from '../components/ui'
import {Icon} from '../components/icons'
export function useUpdate(ready:boolean){
 const [info,setInfo]=useState<UpdateInfo>(),[remind,setRemind]=useState(false)
 useEffect(()=>{if(!ready)return;let active=true;const refresh=()=>{void window.pssa.updateInfo().then(v=>{if(active)setInfo(v)}).catch(()=>{});void window.pssa.updateDockReminder().then(v=>{if(active)setRemind(v)}).catch(()=>{})};refresh();const t=setInterval(refresh,15000);return()=>{active=false;clearInterval(t)}},[ready])
 const check=useCallback(async()=>{const v=await window.pssa.updateCheck();setInfo(v);return v},[])
 return {info,remind,check}
}
export function UpdatePopup({info,current,blocked,onClose}:{info:UpdateInfo;current:string;blocked:boolean;onClose:()=>void}){
 const {t:tr}=useLocale()
 const ref=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[launched,setLaunched]=useState(false),[alsoDock,setAlsoDock]=useState(true)
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>{if(d?.open)d.close()}},[])
 const download=async()=>{setBusy(true);setMessage(tr("update.downloading"));try{const result=await window.pssa.updateDownload(alsoDock,info.version,info.asset?.sha256??'');if(result==='launched'||result==='manual')setLaunched(true);setMessage(result==='manual'?tr("update.manual"):result==='cancelled'?tr("runtime.cancelled"):tr("update.launching"))}catch(e){setMessage(e instanceof Error?localizeMessage(tr,e.message.replace(/^Error invoking remote method '[^']+': Error: /,'')):tr("update.error"))}finally{setBusy(false)}}
 return <dialog ref={ref} className="rule-dialog update-dialog" aria-labelledby="update-title" onCancel={e=>{e.preventDefault();if(!busy)onClose()}}><header className="rule-dialog-header"><h2 id="update-title">{tr("update.title")}</h2><Button disabled={busy} onClick={onClose} aria-label={tr("common.close")}><Icon name="close"/></Button></header><div className="rule-dialog-body"><strong>{current} → {info.version}</strong><h3>{tr("update.whatsNew")}</h3><p className="update-notes">{info.notes||tr("update.notesFallback")}</p><label className="alert-checkbox"><input type="checkbox" checked={alsoDock} disabled={busy} onChange={e=>setAlsoDock(e.target.checked)}/> {tr("update.remindDock")}</label>{blocked&&<p>{tr("update.blocked")}</p>}{!info.asset&&<p>{tr("update.noInstaller")}</p>}{message&&<p role="status">{message}</p>}</div><footer className="rule-dialog-footer"><div className="alert-actions"><Button disabled={busy} onClick={onClose}>{tr("shell.remind")}</Button><Button disabled={busy} onClick={()=>void window.pssa.updateOpen().catch(()=>setMessage(tr("update.openError")))}>GitHub</Button><Button variant="primary" disabled={busy||launched||blocked||!info.asset} onClick={()=>void download()}>{launched?tr("update.ready"):busy?tr("update.progress"):tr("update.download")}</Button></div></footer></dialog>
}
