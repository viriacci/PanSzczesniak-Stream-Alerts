import {useRuntime,Onboarding} from './features/runtime'
import {useLive} from './features/live'
import {useObs} from './features/obs'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SystemStatus } from '../../shared/contracts'
import { bounds, defaultLayout, type LayoutPreferences, type PageId } from '../../shared/layout'
import { allPages, groups } from './navigation'
import { Button, ConfirmDialog, Panel, Status } from './components/ui'
import { Icon } from './components/icons'
import { ResizeHandle } from './components/ResizeHandle'
import { useAlerts } from './features/alerts'
import { PageContent } from './features/pages'

export function App() {
 const {runtime,saveRuntime}=useRuntime()
 const slow=runtime?.mode==='streaming'
 const alertState=useAlerts(slow)
 const live=useLive(slow)
 const {obs,agent}=useObs(slow)
 const twitch=alertState?.twitch
 const [status,setStatus]=useState<SystemStatus>()
 const [layout,setLayout]=useState<LayoutPreferences>(defaultLayout)
 const current=useRef<LayoutPreferences>(defaultLayout)
 const queue=useRef<Promise<unknown>>(Promise.resolve())
 const [ready,setReady]=useState(false)
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState<{text:string;error:boolean}|null>(null)
 const [confirm,setConfirm]=useState(false)
 const [query,setQuery]=useState('')
 const content=useRef<HTMLElement>(null)
 const [narrow,setNarrow]=useState(()=>window.innerWidth<1080)
 useEffect(()=>{
   let active=true
   Promise.all([window.pssa.getStatus(),window.pssa.getLayout()]).then(([s,l])=>{
     if(active){setStatus(s);current.current=l;setLayout(l);setReady(true)}
   }).catch(()=>{if(active)setNotice({text:'Nie udało się wczytać ustawień. Uruchom aplikację ponownie.',error:true})})
   const resize=()=>setNarrow(window.innerWidth<1080)
   window.addEventListener('resize',resize)
   return ()=>{active=false;window.removeEventListener('resize',resize)}
 },[])
 const patch=useCallback((update:Partial<LayoutPreferences>,save=true)=>{
   if(!ready)return
   const next={...current.current,...update}
   current.current=next;setLayout(next)
   if(save)queue.current=queue.current.catch(()=>{}).then(()=>window.pssa.setLayout(next)).catch(()=>{setNotice({text:'Nie udało się zapisać układu.',error:true})})
 },[ready])
 const navigate=useCallback((page:PageId)=>{patch({page});content.current?.scrollTo({top:0});content.current?.focus()},[patch])
 useEffect(()=>{
   const onKey=(event:KeyboardEvent)=>{
     if(!event.ctrlKey||event.altKey||event.shiftKey||event.metaKey||event.repeat||confirm)return
     if(event.target instanceof HTMLElement && (['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.isContentEditable))return
     if(event.key.toLowerCase()==='b'){event.preventDefault();patch({collapsed:!current.current.collapsed})}
     if(event.key.toLowerCase()==='i'){event.preventDefault();patch({inspectorOpen:!current.current.inspectorOpen})}
     if(event.key===','){event.preventDefault();navigate('settings')}
   }
   window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
 },[patch,navigate,confirm])
 useEffect(()=>{if(!notice||notice.error)return;const timer=window.setTimeout(()=>setNotice(null),3500);return()=>window.clearTimeout(timer)},[notice])
 async function toggleCompact(){
   if(!status||busy)return
   setBusy(true)
   try{const compact=await window.pssa.setCompact(!status.compact);setStatus(s=>s?{...s,compact}:s);setNotice({text:'Zapisano wygląd aplikacji.',error:false})}
   catch{setNotice({text:'Nie udało się zapisać ustawienia.',error:true})}
   finally{setBusy(false)}
 }
 const reset=()=>{patch({...defaultLayout,page:'settings'});setConfirm(false)}
 const item=allPages.find(p=>p.id===layout.page)??allPages[0]!
 const collapsed=layout.collapsed
 const inspector=layout.inspectorOpen&&!narrow
 const sidebarSize=collapsed?64:layout.sidebarWidth
 const styles={'--sidebar-width':sidebarSize+'px','--inspector-width':layout.inspectorWidth+'px'} as CSSProperties
 const filtered=groups.map(group=>({...group,items:group.items.filter(p=>p.label.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')))})).filter(g=>g.items.length)
 return <div className={`app ${status?.compact?'compact':''} ${slow?'streaming-mode':''}`} style={styles}>
  <header className="titlebar"><div className="title-brand"><span className="brand-symbol">P</span><span>PSSA <small>STREAM ALERTS</small></span></div><span className="title-version">{status?.version??'2.0-dev'}</span><span className="title-caption">BETA BUILD</span></header>
  <div className={`workspace ${inspector?'has-inspector':''}`}>
   <aside className={`sidebar ${collapsed?'collapsed':''}`} aria-label="Nawigacja główna">
    <div className="sidebar-top"><Button variant="ghost" title="Zwiń / rozwiń menu (Ctrl+B)" aria-label="Zwiń / rozwiń menu" aria-expanded={!collapsed} disabled={!ready} onClick={()=>patch({collapsed:!collapsed})}><Icon name="sidebar"/></Button>{!collapsed&&<label className="nav-search"><Icon name="search" size={15}/><input aria-label="Szukaj modułu" placeholder="Szukaj modułu" value={query} onChange={e=>setQuery(e.target.value)}/></label>}</div>
    <nav>{(collapsed?groups:filtered).map(g=><div className="nav-group" key={g.label}>{!collapsed&&<h2>{g.label}</h2>}{g.items.map(p=><button key={p.id} type="button" disabled={!ready} className={`nav-link ${p.id===item.id?'active':''}`} aria-current={p.id===item.id?'page':undefined} aria-label={p.label} title={collapsed?p.label:undefined} onClick={()=>navigate(p.id)}><Icon name={p.icon}/>{!collapsed&&<span>{p.label}</span>}</button>)}</div>)}{!collapsed&&filtered.length===0&&<p className="nav-empty">Brak wyników</p>}</nav>
    <div className="sidebar-bottom"><span className="account-avatar">P</span>{!collapsed&&<div><strong>{twitch?.login||'Profil lokalny'}</strong><small>{twitch?.phase==='connected'?'Twitch połączony':'Twitch niepołączony'}</small></div>}</div>
   </aside>
   {!collapsed&&<ResizeHandle label="Szerokość menu" value={layout.sidebarWidth} range={bounds.sidebar} onChange={n=>patch({sidebarWidth:n},false)} onCommit={n=>patch({sidebarWidth:n})}/>}
   <main className="content" tabIndex={-1} ref={content} id="main-content">
    <header className="page-header"><div><p className="eyebrow">PSSA / WORKSPACE</p><h1>{item.label}</h1><p>{item.description}</p></div><Button variant="ghost" aria-label="Pokaż / ukryj inspektor" title={narrow?'Inspektor dostępny w szerszym oknie':'Inspektor (Ctrl+I)'} aria-pressed={layout.inspectorOpen} disabled={!ready||narrow} onClick={()=>patch({inspectorOpen:!layout.inspectorOpen})}><Icon name="inspector"/></Button></header>
    <div className="page-body"><PageContent runtime={runtime} saveRuntime={saveRuntime} live={live} obs={obs} agent={agent} alertState={alertState} item={item} status={status} layout={layout} busy={busy||!ready} onCompact={toggleCompact} onReset={()=>setConfirm(true)} onIntegrations={()=>navigate('integrations')}/></div>
   </main>
   {inspector&&<><ResizeHandle label="Szerokość inspektora" value={layout.inspectorWidth} direction={-1} range={bounds.inspector} onChange={n=>patch({inspectorWidth:n},false)} onCommit={n=>patch({inspectorWidth:n})}/><aside className="inspector" aria-label="Inspektor"><header><h2>Inspektor</h2><Button variant="ghost" aria-label="Ukryj inspektor" disabled={!ready} onClick={()=>patch({inspectorOpen:false})}><Icon name="close" size={16}/></Button></header><Panel title="Połączenia"><div className="connection"><span>Twitch</span><Status tone={twitch?.phase==='connected'?'ready':'neutral'}>{twitch?.phase??'Offline'}</Status></div><div className="connection"><span>OBS Studio</span><Status tone={obs?.phase==='connected'?'ready':'neutral'}>{obs?.phase??'Offline'}</Status></div><div className="connection"><span>SQLite</span><Status tone={status?'ready':'warning'}>{status?'Gotowa':'Oczekiwanie'}</Status></div></Panel><Panel title="Kontekst modułu"><h3>{item.label}</h3><p>{item.description}</p><small className="muted">{item.stage>2?'Implementacja w etapie '+item.stage:'Interfejs lokalny'}</small></Panel></aside></>}
  </div>
  <footer className="statusbar"><Status tone={status?'ready':'warning'}>{status?'Baza lokalna gotowa':'Inicjalizacja'}</Status><span className="status-separator"/><Status tone={twitch?.phase==='connected'?'ready':'neutral'}>{twitch?.phase==='connected'?'Twitch połączony':'Twitch '+(twitch?.phase??'offline')}</Status><Status tone={obs?.phase==='connected'?'ready':'neutral'}>{obs?.phase==='connected'?'OBS połączony':'OBS '+(obs?.phase??'offline')}</Status><span className="footer-right">PSSA BETA · ETAP 10</span></footer>
  {notice&&<div className={`toast ${notice.error?'toast-error':''}`} role={notice.error?'alert':'status'}><span>{notice.text}</span><Button variant="ghost" aria-label="Zamknij powiadomienie" onClick={()=>setNotice(null)}><Icon name="close" size={16}/></Button></div>}
  {ready&&runtime&&!runtime.onboarded&&<Onboarding runtime={runtime} save={saveRuntime} onIntegrations={()=>navigate('integrations')}/>}
  {confirm&&<ConfirmDialog title="Przywrócić domyślny układ?" onClose={()=>setConfirm(false)} onConfirm={reset}>Zresetuje szerokość paneli i ich widoczność. Nie zmieni statystyk ani ustawień alertów.</ConfirmDialog>}
 </div>
}
