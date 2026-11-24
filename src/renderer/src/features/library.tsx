import {useEffect,useState} from 'react'
import type {LibraryState,Asset,LibraryAction,MediaKind,Profile} from '../../../shared/library'
import type {AlertState} from '../../../shared/alerts'
import type {LiveState} from '../../../shared/live'
import type {AlertVariant} from '../../../shared/variants'
import {Button,Panel,Empty,Status} from '../components/ui'
function useLibrary(){
 const [state,setState]=useState<LibraryState>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function refresh(){setBusy(true);try{setState(await window.pssa.libraryState());setNotice('')}catch{setNotice('Nie udało się odczytać biblioteki.')}finally{setBusy(false)}}
 useEffect(()=>{void refresh()},[])
 async function run(task:()=>Promise<unknown>,message='Zapisano.'){
  if(busy)return;setBusy(true);setNotice('')
  try{await task();setState(await window.pssa.libraryState());setNotice(message)}catch{setNotice('Operacja nie powiodła się. Sprawdź dane, limity i unikalność kategorii.')}finally{setBusy(false)}
 }
 const action=(x:LibraryAction,message?:string)=>run(()=>window.pssa.libraryAction(x),message)
 return {state,busy,notice,refresh,run,action}
}
function AssetEditor({asset,busy,save}:{asset:Asset;busy:boolean;save:(x:LibraryAction)=>void}){
 const [name,setName]=useState(asset.name),[folder,setFolder]=useState(asset.folder),[tags,setTags]=useState(asset.tags.join(', '))
 return <form className="alert-form" onSubmit={e=>{e.preventDefault();save({type:'asset-edit',id:asset.id,name,folder,tags:tags.split(',').map(x=>x.trim()).filter(Boolean)})}}>
 <label>Nazwa<input value={name} required maxLength={200} onChange={e=>setName(e.target.value)}/></label>
 <label>Folder logiczny<input value={folder} maxLength={120} onChange={e=>setFolder(e.target.value)} placeholder="np. Raid / Fantasy"/></label>
 <label>Tagi (maks. 12, rozdziel przecinkami)<input value={tags} maxLength={500} onChange={e=>setTags(e.target.value)}/></label>
 <Button variant="primary" disabled={busy} type="submit">Zapisz metadane</Button></form>
}
export function LibraryPage({base,lowPower=false}:{base:string;lowPower?:boolean}){
 const {state,busy,notice,refresh,run,action}=useLibrary()
 const [query,setQuery]=useState(''),[kind,setKind]=useState('all'),[folder,setFolder]=useState('all'),[missing,setMissing]=useState(false),[selected,setSelected]=useState(''),[limit,setLimit]=useState(48)
 const assets=state?.assets??[],folders=[...new Set(assets.map(a=>a.folder))].sort(),asset=assets.find(a=>a.id===selected)
 const shown=assets.filter(a=>(kind==='all'||a.kind===kind)&&(folder==='all'||a.folder===folder)&&(!missing||a.missing)&&[a.name,a.folder,...a.tags,a.id].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 return <>
 <Panel title="Biblioteka multimediów" action={<Button disabled={busy} onClick={()=>void refresh()}>Odśwież</Button>}>
 {lowPower&&<p className="muted">Tryb Streaming: miniatury wyłączone, aby nie dekodować wielu obrazów podczas transmisji.</p>}<p>Jeden zasób może być używany przez wiele scen i profili. Foldery i tagi nie zmieniają fizycznej ścieżki pliku.</p>
 <div className="alert-actions">{(['image','audio','video'] as MediaKind[]).map(k=><Button key={k} disabled={busy} onClick={()=>void run(()=>window.pssa.chooseMedia(k),'Biblioteka odświeżona.')}>+ {{image:'Grafika',audio:'Audio',video:'Wideo'}[k]}</Button>)}</div>
 <div className="library-filters alert-form"><label>Szukaj<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(48)}} placeholder="Nazwa, folder, tag..."/></label><label>Typ<select value={kind} onChange={e=>{setKind(e.target.value);setLimit(48)}}><option value="all">Wszystkie</option><option value="image">Grafiki</option><option value="audio">Audio</option><option value="video">Wideo</option></select></label><label>Folder<select value={folder} onChange={e=>{setFolder(e.target.value);setLimit(48)}}><option value="all">Wszystkie</option>{folders.map(x=><option key={x} value={x}>{x||'Bez folderu'}</option>)}</select></label><label className="alert-checkbox"><input type="checkbox" checked={missing} onChange={e=>setMissing(e.target.checked)}/> Tylko brakujące</label></div>
 <p className="muted">{assets.length} zasobów · {assets.filter(a=>a.missing).length} brakujących · {shown.length} pasujących</p>
 <div className="library-grid">{shown.slice(0,limit).map(a=><button key={a.id} className={'library-tile '+(selected===a.id?'selected':'')} onClick={()=>setSelected(a.id)}>
 <div className="library-thumb">{!a.missing&&a.kind==='image'&&base&&!lowPower?<img loading="lazy" decoding="async" src={base+'media/'+a.id} alt=""/>:<span>{a.missing?'BRAK':a.kind==='video'?'VIDEO':a.kind==='audio'?'AUDIO':'IMG'}</span>}</div>
 <strong title={a.name}>{a.name}</strong><small>{a.folder||'Bez folderu'} · {a.bytes===null?'Brak pliku':(a.bytes/1024/1024).toFixed(2)+' MB'}</small><small>{a.references} powiązań · {a.tags.join(', ')||'Bez tagów'}</small></button>)}</div>
 {!shown.length&&<Empty title="Brak zasobów">Dodaj plik lub zmień filtry.</Empty>}{shown.length>limit&&<Button onClick={()=>setLimit(v=>v+48)}>Pokaż kolejne</Button>}
 </Panel>
 {asset&&<Panel title="Właściwości zasobu" action={<Status tone={asset.missing?'warning':'ready'}>{asset.missing?'Brak pliku':'Dostępny'}</Status>}><AssetEditor key={asset.id+':'+asset.name+':'+asset.folder+':'+asset.tags.join(',')} asset={asset} busy={busy} save={x=>void action(x)}/>{base&&!asset.missing&&asset.kind==='video'&&<video controls preload="metadata" src={base+'media/'+asset.id} className="library-player"/>}{base&&!asset.missing&&asset.kind==='audio'&&<audio controls preload="none" src={base+'media/'+asset.id} className="library-player"/>}<p className="muted">Pliki nie są automatycznie kasowane. Brakujący plik przywróć przez ponowny import dokładnie tej samej zawartości i formatu.</p></Panel>}
 {notice&&<p role="status">{notice}</p>}</>
}
function ProfileForm({profile,busy,save}:{profile?:Profile;busy:boolean;save:(name:string,category:string)=>void}){
 const [name,setName]=useState(profile?.name??''),[category,setCategory]=useState(profile?.categoryId??'')
 return <form className="alert-form" onSubmit={e=>{e.preventDefault();save(name,category);if(!profile){setName('');setCategory('')}}}><label>Nazwa profilu<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>ID kategorii Twitch (opcjonalne)<input pattern="[0-9]*" maxLength={30} value={category} onChange={e=>setCategory(e.target.value)}/></label><Button type="submit" disabled={busy||!name.trim()}>{profile?'Zapisz profil':'Utwórz kopię aktywnego profilu'}</Button></form>
}
function VariantForm({variant,templates,keyName,busy,save}:{variant?:AlertVariant;templates:LibraryState['templates'];keyName:string;busy:boolean;save:(x:LibraryAction)=>void}){
 const [name,setName]=useState(variant?.name??''),[templateId,setTemplate]=useState(variant?'':templates[0]?.id??''),[weight,setWeight]=useState(variant?.weight??1),[min,setMin]=useState(variant?.minCount??0),[max,setMax]=useState(variant?.maxCount?.toString()??''),[months,setMonths]=useState(variant?.minMonths??0),[category,setCategory]=useState(variant?.categoryId??'')
 return <form className="alert-form" onSubmit={e=>{e.preventDefault();save({type:'variant-save',key:keyName,id:variant?.id,name,templateId,weight,minCount:min,maxCount:max===''?null:Number(max),minMonths:months,categoryId:category})}}>
 <label>Nazwa wariantu<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Scena z szablonu<select value={templateId} onChange={e=>setTemplate(e.target.value)}>{variant?<option value="">Zachowaj bieżącą scenę</option>:<option value="">Wybierz szablon</option>}{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <div className="queue-fields"><label>Waga<input type="number" min={1} max={1000} required value={weight} onChange={e=>setWeight(Number(e.target.value))}/></label><label>Minimum liczby<input type="number" min={0} max={1000000} required value={min} onChange={e=>setMin(Number(e.target.value))}/></label><label>Maksimum (opcjonalne)<input type="number" min={min} max={1000000} value={max} onChange={e=>setMax(e.target.value)}/></label><label>Minimum miesięcy<input type="number" min={0} max={1200} value={months} onChange={e=>setMonths(Number(e.target.value))}/></label></div>
 <label>ID kategorii (opcjonalne)<input pattern="[0-9]*" maxLength={30} value={category} onChange={e=>setCategory(e.target.value)}/></label>
 <Button type="submit" variant="primary" disabled={busy||!name.trim()||(!variant&&!templateId)}>Zapisz wariant</Button></form>
}
export function ProfilesPage({alerts,live}:{alerts?:AlertState;live?:LiveState}){
 const {state,busy,notice,action,run,refresh}=useLibrary()
 const [key,setKey]=useState('raid'),[templateName,setTemplateName]=useState(''),[editing,setEditing]=useState(''),[variantId,setVariantId]=useState<string|null>(null)
 const [fresh,setFresh]=useState<AlertState>()
 const actual=fresh&&fresh.profileId===state?.activeProfile?fresh:alerts
 const rule=actual?.rules.find(r=>r.key===key),variants=rule?.variants??[],templates=state?.templates??[]
 const matched=live?.phase==='live'&&live.categoryId?state?.profiles.find(p=>p.categoryId===live.categoryId):undefined
 async function apply(x:LibraryAction){await run(async()=>{await window.pssa.libraryAction(x);setFresh(await window.pssa.alertState());setVariantId(null)})}
 useEffect(()=>{setFresh(undefined);setVariantId(null)},[alerts?.profileId])
 return <>
 <Panel title="Profile alertów" action={<Button disabled={busy} onClick={()=>void refresh()}>Odśwież</Button>}><p>Profil zawiera reguły i sceny. Przełączenie zachowuje bieżące ustawienia; alerty już w kolejce zachowują swój snapshot. Profil dobierasz ręcznie.</p>
 {matched&&matched.id!==state?.activeProfile&&<div className="setting-row"><span>Profil dla bieżącej kategorii: {matched.name}</span><Button disabled={busy} onClick={()=>void apply({type:'profile-activate',id:matched.id})}>Aktywuj</Button></div>}
 {state?.profiles.map(p=><div key={p.id} className="library-profile"><div className="setting-row"><div><h3>{p.name}</h3><p>{p.categoryId?'Kategoria '+p.categoryId:'Bez przypisania'}</p></div><div className="alert-actions">{p.id===state.activeProfile?<Status tone="ready">Aktywny</Status>:<Button disabled={busy} onClick={()=>void apply({type:'profile-activate',id:p.id})}>Aktywuj</Button>}<Button disabled={busy} onClick={()=>setEditing(editing===p.id?'':p.id)}>Edytuj</Button>{p.id!=='default'&&p.id!==state.activeProfile&&<Button disabled={busy} onClick={()=>{if(window.confirm('Usunąć profil '+p.name+'? Pliki pozostaną w bibliotece.'))void apply({type:'profile-delete',id:p.id})}}>Usuń</Button>}</div></div>{editing===p.id&&<ProfileForm key={p.id+':'+p.name+':'+p.categoryId} profile={p} busy={busy} save={(name,categoryId)=>void apply({type:'profile-edit',id:p.id,name,categoryId})}/>}</div>)}
 <ProfileForm busy={busy||!state} save={(name,categoryId)=>void apply({type:'profile-create',name,categoryId})}/></Panel>
 <Panel title="Szablony scen"><label className="alert-form">Alert docelowy<select value={key} onChange={e=>{setKey(e.target.value);setVariantId(null)}}>{actual?.rules.map(r=><option key={r.key} value={r.key}>{r.title}</option>)}</select></label>
 <form className="alert-form" onSubmit={e=>{e.preventDefault();void apply({type:'template-create',key,name:templateName});setTemplateName('')}}><label>Nazwa nowego szablonu<input value={templateName} required maxLength={100} onChange={e=>setTemplateName(e.target.value)}/></label><Button type="submit" disabled={busy||!rule||!templateName.trim()}>Zapisz scenę alertu jako szablon</Button></form>
 {templates.map(t=><div key={t.id} className="setting-row"><div><h3>{t.name}</h3><p>{t.scene.layers.length} warstw · {t.scene.duration/1000} s</p></div><div className="alert-actions"><Button disabled={busy||!rule} onClick={()=>{if(window.confirm('Zastąpić zapisaną scenę alertu? Ustawienia silnika pozostaną.'))void apply({type:'template-apply',id:t.id,key})}}>Zastosuj</Button><Button disabled={busy} onClick={()=>{if(window.confirm('Usunąć szablon? Istniejące sceny nie zmienią się.'))void apply({type:'template-delete',id:t.id})}}>Usuń</Button></div></div>)}</Panel>
 <Panel title="Warianty i warunki" detail="Wagi względne, losowanie tylko wśród pasujących wariantów. Jeżeli żaden nie pasuje, odtwarzana jest scena bazowa.">
 <p className="muted">Liczba to widzowie raidu, Bits lub liczba giftów; miesiące dotyczą resubów. Pusta kategoria nie ogranicza wariantu. Wariant kopiuje scenę z szablonu.</p>
 {variants.map(v=><div key={v.id} className="setting-row"><div><h3>{v.name}</h3><p>Waga {v.weight} · liczba {v.minCount}–{v.maxCount??'∞'} · mies. ≥ {v.minMonths}{v.categoryId?' · kat. '+v.categoryId:''}</p></div><div className="alert-actions"><Button disabled={busy} onClick={()=>setVariantId(v.id)}>Edytuj</Button><Button disabled={busy} onClick={()=>{if(window.confirm('Usunąć wariant?'))void apply({type:'variant-delete',id:v.id,key})}}>Usuń</Button></div></div>)}
 <Button disabled={busy||!rule||!templates.length||variants.length>=12} onClick={()=>setVariantId('new')}>+ Nowy wariant</Button>
 {variantId!==null&&rule&&<VariantForm key={key+':'+variantId} keyName={key} templates={templates} variant={variants.find(v=>v.id===variantId)} busy={busy} save={x=>void apply(x)}/>}
 </Panel>{notice&&<p role="status">{notice}</p>}</>
}
