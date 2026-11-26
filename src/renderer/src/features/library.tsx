import {useLocale} from '../i18n'
import {useEffect,useState} from 'react'
import type {LibraryState,Asset,LibraryAction,MediaKind,Profile} from '../../../shared/library'
import type {AlertState} from '../../../shared/alerts'
import type {LiveState} from '../../../shared/live'
import type {AlertVariant} from '../../../shared/variants'
import {Button,Panel,Empty,Status} from '../components/ui'
function useLibrary(){
 const {t:tr}=useLocale()
 const [state,setState]=useState<LibraryState>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function refresh(){setBusy(true);try{setState(await window.pssa.libraryState());setNotice('')}catch{setNotice(tr("library.readError"))}finally{setBusy(false)}}
 useEffect(()=>{void refresh()},[])
 async function run(task:()=>Promise<unknown>,message=tr("common.saved")){
  if(busy)return;setBusy(true);setNotice('')
  try{await task();setState(await window.pssa.libraryState());setNotice(message)}catch{setNotice(tr("library.actionError"))}finally{setBusy(false)}
 }
 const action=(x:LibraryAction,message?:string)=>run(()=>window.pssa.libraryAction(x),message)
 return {state,busy,notice,refresh,run,action}
}
function AssetEditor({asset,busy,save}:{asset:Asset;busy:boolean;save:(x:LibraryAction)=>void}){
 const {t:tr}=useLocale()
 const [name,setName]=useState(asset.name),[folder,setFolder]=useState(asset.folder),[tags,setTags]=useState(asset.tags.join(', '))
 return <form className="alert-form" onSubmit={e=>{e.preventDefault();save({type:'asset-edit',id:asset.id,name,folder,tags:tags.split(',').map(x=>x.trim()).filter(Boolean)})}}>
 <label>{tr("library.name")}<input value={name} required maxLength={200} onChange={e=>setName(e.target.value)}/></label>
 <label>{tr("library.logicalFolder")}<input value={folder} maxLength={120} onChange={e=>setFolder(e.target.value)} placeholder={tr("library.folderExample")}/></label>
 <label>{tr("library.tags")}<input value={tags} maxLength={500} onChange={e=>setTags(e.target.value)}/></label>
 <Button variant="primary" disabled={busy} type="submit">{tr("library.saveMetadata")}</Button></form>
}
export function LibraryPage({base,lowPower=false}:{base:string;lowPower?:boolean}){
 const {t:tr}=useLocale()
 const {state,busy,notice,refresh,run,action}=useLibrary()
 const [query,setQuery]=useState(''),[kind,setKind]=useState('all'),[folder,setFolder]=useState('all'),[missing,setMissing]=useState(false),[selected,setSelected]=useState(''),[limit,setLimit]=useState(48)
 const assets=state?.assets??[],folders=[...new Set(assets.map(a=>a.folder))].sort(),asset=assets.find(a=>a.id===selected)
 const shown=assets.filter(a=>(kind==='all'||a.kind===kind)&&(folder==='all'||a.folder===folder)&&(!missing||a.missing)&&[a.name,a.folder,...a.tags,a.id].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 return <>
 <Panel title={tr("library.title")} action={<Button disabled={busy} onClick={()=>void refresh()}>{tr("runtime.refresh")}</Button>}>
 {lowPower&&<p className="muted">{tr("library.streaming")}</p>}
 <div className="alert-actions">{(['image','audio','video'] as MediaKind[]).map(k=><Button key={k} disabled={busy} onClick={()=>void run(()=>window.pssa.chooseMedia(k),tr("library.refreshed"))}>+ {tr(k==="image"?"library.addImage":k==="audio"?"library.addAudio":"library.video")}</Button>)}</div>
 <div className="library-filters alert-form"><label>{tr("library.search")}<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(48)}} placeholder={tr("library.searchPlaceholder")}/></label><label>{tr("library.type")}<select value={kind} onChange={e=>{setKind(e.target.value);setLimit(48)}}><option value="all">{tr("library.all")}</option><option value="image">{tr("library.images")}</option><option value="audio">{tr("library.addAudio")}</option><option value="video">{tr("library.video")}</option></select></label><label>{tr("library.folder")}<select value={folder} onChange={e=>{setFolder(e.target.value);setLimit(48)}}><option value="all">{tr("library.all")}</option>{folders.map(x=><option key={x} value={x}>{x||tr("library.noFolder")}</option>)}</select></label><label className="alert-checkbox"><input type="checkbox" checked={missing} onChange={e=>setMissing(e.target.checked)}/> {tr("library.onlyMissing")}</label></div>
 <p className="muted">{tr("library.counts",{total:assets.length,missing:assets.filter(a=>a.missing).length,shown:shown.length})}</p>
 <div className="library-grid">{shown.slice(0,limit).map(a=><button key={a.id} className={'library-tile '+(selected===a.id?'selected':'')} onClick={()=>setSelected(a.id)}>
 <div className="library-thumb">{!a.missing&&a.kind==='image'&&base&&!lowPower?<img loading="lazy" decoding="async" src={base+'media/'+a.id} alt=""/>:<span>{a.missing?tr("library.missingBadge"):a.kind==='video'?'VIDEO':a.kind==='audio'?'AUDIO':'IMG'}</span>}</div>
 <strong title={a.name}>{a.name}</strong><small>{a.folder||tr("library.noFolder")} · {a.bytes===null?tr("library.missing"):(a.bytes/1024/1024).toFixed(2)+' MB'}</small><small>{tr("library.references",{count:a.references})} · {a.tags.join(', ')||tr("library.noTags")}</small></button>)}</div>
 {!shown.length&&<Empty title={tr("library.empty")}>{tr("library.emptyDetail")}</Empty>}{shown.length>limit&&<Button onClick={()=>setLimit(v=>v+48)}>{tr("library.more")}</Button>}
 </Panel>
 {asset&&<Panel title={tr("library.properties")} action={<Status tone={asset.missing?'warning':'ready'}>{asset.missing?tr("library.missing"):tr("library.available")}</Status>}><div className="alert-actions"><Button disabled={busy||asset.missing} onClick={()=>void action({type:'asset-reveal',id:asset.id},tr("library.revealed"))}>{tr("library.reveal")}</Button></div><AssetEditor key={asset.id+':'+asset.name+':'+asset.folder+':'+asset.tags.join(',')} asset={asset} busy={busy} save={x=>void action(x)}/>{base&&!asset.missing&&asset.kind==='video'&&<video controls preload="metadata" src={base+'media/'+asset.id} className="library-player"/>}{base&&!asset.missing&&asset.kind==='audio'&&<audio controls preload="none" src={base+'media/'+asset.id} className="library-player"/>}<p className="muted">{tr("library.retention")}</p></Panel>}
 {notice&&<p role="status">{notice}</p>}</>
}
function ProfileForm({profile,busy,save}:{profile?:Profile;busy:boolean;save:(name:string,category:string)=>void}){
 const {t:tr}=useLocale()
 const [name,setName]=useState(profile?.name??''),[category,setCategory]=useState(profile?.categoryId??'')
 return <form className="alert-form" onSubmit={e=>{e.preventDefault();save(name,category);if(!profile){setName('');setCategory('')}}}><label>{tr("profile.name")}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>{tr("profile.category")}<input pattern="[0-9]*" maxLength={30} value={category} onChange={e=>setCategory(e.target.value)}/></label><Button type="submit" disabled={busy||!name.trim()}>{profile?tr("profile.save"):tr("profile.copy")}</Button></form>
}
function VariantForm({variant,templates,keyName,busy,save}:{variant?:AlertVariant;templates:LibraryState['templates'];keyName:string;busy:boolean;save:(x:LibraryAction)=>void}){
 const {t:tr}=useLocale()
 const [name,setName]=useState(variant?.name??''),[templateId,setTemplate]=useState(variant?'':templates[0]?.id??''),[weight,setWeight]=useState(variant?.weight??1),[min,setMin]=useState(variant?.minCount??0),[max,setMax]=useState(variant?.maxCount?.toString()??''),[months,setMonths]=useState(variant?.minMonths??0),[category,setCategory]=useState(variant?.categoryId??'')
 return <form className="alert-form" onSubmit={e=>{e.preventDefault();save({type:'variant-save',key:keyName,id:variant?.id,name,templateId,weight,minCount:min,maxCount:max===''?null:Number(max),minMonths:months,categoryId:category})}}>
 <label>{tr("variant.name")}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>{tr("variant.scene")}<select value={templateId} onChange={e=>setTemplate(e.target.value)}>{variant?<option value="">{tr("variant.keep")}</option>:<option value="">{tr("variant.choose")}</option>}{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <div className="queue-fields"><label>{tr("variant.weight")}<input type="number" min={1} max={1000} required value={weight} onChange={e=>setWeight(Number(e.target.value))}/></label><label>{tr("variant.min")}<input type="number" min={0} max={1000000} required value={min} onChange={e=>setMin(Number(e.target.value))}/></label><label>{tr("variant.max")}<input type="number" min={min} max={1000000} value={max} onChange={e=>setMax(e.target.value)}/></label><label>{tr("variant.months")}<input type="number" min={0} max={1200} value={months} onChange={e=>setMonths(Number(e.target.value))}/></label></div>
 <label>{tr("variant.category")}<input pattern="[0-9]*" maxLength={30} value={category} onChange={e=>setCategory(e.target.value)}/></label>
 <Button type="submit" variant="primary" disabled={busy||!name.trim()||(!variant&&!templateId)}>{tr("variant.save")}</Button></form>
}
export function ProfilesPage({alerts,live}:{alerts?:AlertState;live?:LiveState}){
 const {t:tr}=useLocale()
 const {state,busy,notice,action,run,refresh}=useLibrary()
 const [key,setKey]=useState('raid'),[templateName,setTemplateName]=useState(''),[editing,setEditing]=useState(''),[variantId,setVariantId]=useState<string|null>(null)
 const [fresh,setFresh]=useState<AlertState>()
 const actual=fresh&&fresh.profileId===state?.activeProfile?fresh:alerts
 const rule=actual?.rules.find(r=>r.key===key),variants=rule?.variants??[],templates=state?.templates??[]
 const matched=live?.phase==='live'&&live.categoryId?state?.profiles.find(p=>p.categoryId===live.categoryId):undefined
 async function apply(x:LibraryAction){await run(async()=>{await window.pssa.libraryAction(x);setFresh(await window.pssa.alertState());setVariantId(null)})}
 useEffect(()=>{setFresh(undefined);setVariantId(null)},[alerts?.profileId])
 return <>
 <Panel title={tr("profile.title")} action={<Button disabled={busy} onClick={()=>void refresh()}>{tr("runtime.refresh")}</Button>}>
 {matched&&matched.id!==state?.activeProfile&&<div className="setting-row"><span>{tr("profile.currentCategory",{name:matched.name})}</span><Button disabled={busy} onClick={()=>void apply({type:'profile-activate',id:matched.id})}>{tr("profile.activate")}</Button></div>}
 {state?.profiles.map(p=><div key={p.id} className="library-profile"><div className="setting-row"><div><h3>{p.name}</h3>{p.categoryId&&<p>{tr("profile.categoryId",{id:p.categoryId})}</p>}</div><div className="alert-actions">{p.id===state.activeProfile?<Status tone="ready">{tr("runtime.active")}</Status>:<Button disabled={busy} onClick={()=>void apply({type:'profile-activate',id:p.id})}>{tr("profile.activate")}</Button>}<Button disabled={busy} onClick={()=>setEditing(editing===p.id?'':p.id)}>{tr("common.edit")}</Button>{p.id!=='default'&&p.id!==state.activeProfile&&<Button disabled={busy} onClick={()=>{if(window.confirm(tr("profile.delete",{name:p.name})))void apply({type:'profile-delete',id:p.id})}}>{tr("nav.remove")}</Button>}</div></div>{editing===p.id&&<ProfileForm key={p.id+':'+p.name+':'+p.categoryId} profile={p} busy={busy} save={(name,categoryId)=>void apply({type:'profile-edit',id:p.id,name,categoryId})}/>}</div>)}
 <ProfileForm busy={busy||!state} save={(name,categoryId)=>void apply({type:'profile-create',name,categoryId})}/></Panel>
 <Panel title={tr("template.title")}><label className="alert-form">{tr("template.target")}<select value={key} onChange={e=>{setKey(e.target.value);setVariantId(null)}}>{actual?.rules.map(r=><option key={r.key} value={r.key}>{r.title}</option>)}</select></label>
 <form className="alert-form" onSubmit={e=>{e.preventDefault();void apply({type:'template-create',key,name:templateName});setTemplateName('')}}><label>{tr("template.newName")}<input value={templateName} required maxLength={100} onChange={e=>setTemplateName(e.target.value)}/></label><Button type="submit" disabled={busy||!rule||!templateName.trim()}>{tr("template.save")}</Button></form>
 {templates.map(t=><div key={t.id} className="setting-row"><div><h3>{t.name}</h3><p>{tr("template.layers",{count:t.scene.layers.length,seconds:t.scene.duration/1000})}</p></div><div className="alert-actions"><Button disabled={busy||!rule} onClick={()=>{if(window.confirm(tr("template.replace")))void apply({type:'template-apply',id:t.id,key})}}>{tr("template.apply")}</Button><Button disabled={busy} onClick={()=>{if(window.confirm(tr("template.delete")))void apply({type:'template-delete',id:t.id})}}>{tr("nav.remove")}</Button></div></div>)}</Panel>
 <Panel title={tr("variant.title")} detail={tr("variant.detail")}>
 <p className="muted">{tr("variant.info")}</p>
 {variants.map(v=><div key={v.id} className="setting-row"><div><h3>{v.name}</h3><p>{tr("variant.summary",{weight:v.weight,min:v.minCount,max:v.maxCount??"∞",months:v.minMonths})}{v.categoryId?" · "+tr("variant.categoryShort",{id:v.categoryId}):""}</p></div><div className="alert-actions"><Button disabled={busy} onClick={()=>setVariantId(v.id)}>{tr("common.edit")}</Button><Button disabled={busy} onClick={()=>{if(window.confirm(tr("variant.delete")))void apply({type:'variant-delete',id:v.id,key})}}>{tr("nav.remove")}</Button></div></div>)}
 <Button disabled={busy||!rule||!templates.length||variants.length>=12} onClick={()=>setVariantId('new')}>{tr("variant.new")}</Button>
 {variantId!==null&&rule&&<VariantForm key={key+':'+variantId} keyName={key} templates={templates} variant={variants.find(v=>v.id===variantId)} busy={busy} save={x=>void apply(x)}/>}
 </Panel>{notice&&<p role="status">{notice}</p>}</>
}
