import {LocaleProvider,useLocale} from './i18n'
import {SidebarNav} from './features/navigation'
import type {Navigation} from '../../shared/layout'
import {themes} from '../../shared/themes'
import {ThemeLogo} from './components/ThemeLogo'
import {BRAND} from '../../shared/brand'
import {useUpdate,UpdatePopup} from './features/update'
import {useRuntime,Onboarding} from './features/runtime'
import {useLive} from './features/live'
import {useObs} from './features/obs'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SystemStatus } from '../../shared/contracts'
import { bounds, defaultLayout, type LayoutPreferences, type PageId } from '../../shared/layout'
import { allPages } from './navigation'
import { Button, ConfirmDialog, Panel, Status } from './components/ui'
import { Icon } from './components/icons'
import { ResizeHandle } from './components/ResizeHandle'
import { useAlerts } from './features/alerts'
import { PageContent } from './features/pages'
import { HelpCenter, GuidedTour } from './features/help'
import type { TourPage } from './features/help-content'

export function App(){const state=useRuntime();return <LocaleProvider language={state.runtime?.language??"pl"}><Workspace {...state}/></LocaleProvider>}
function Workspace({runtime,saveRuntime}:ReturnType<typeof useRuntime>) {
 const {t}=useLocale()
 const theme=themes[runtime?.theme??'pssa']
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
 const [helpOpen,setHelpOpen]=useState(false)
 const [tourPage,setTourPage]=useState<TourPage>()
 const {info:updateInfo,remind:dockReminder,check:checkUpdate}=useUpdate(ready)
 const [dismissedUpdate,setDismissedUpdate]=useState<{version:string;until:number}>()
 const [updateOpen,setUpdateOpen]=useState(false)
 const [busy,setBusy]=useState(false)
 const [dockStatus,setDockStatus]=useState<'missing'|'update'|'current'|'unavailable'>('missing')
 const [dockBusy,setDockBusy]=useState(false)
 const [notice,setNotice]=useState<{text:string;error:boolean}|null>(null)
 const [confirm,setConfirm]=useState(false)
 const [query,setQuery]=useState('')
 const [editing,setEditing]=useState(false)
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
 const navigate=useCallback((page:PageId)=>{patch({page});if(page!=='settings')setEditing(false);content.current?.scrollTo({top:0});content.current?.focus()},[patch])
 useEffect(()=>{
   const onKey=(event:KeyboardEvent)=>{
     if(!event.ctrlKey||event.altKey||event.shiftKey||event.metaKey||event.repeat||confirm||document.querySelector('dialog[open]'))return
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
 const navChange=useCallback((navigation:Navigation)=>patch({navigation}),[patch])
 const editMenu=()=>{setEditing(v=>!v);setQuery('');if(layout.collapsed)patch({collapsed:false})}
 useEffect(()=>{if(!ready||layout.page!=='settings')return;let active=true;void window.pssa.obsDockStatus().then(s=>{if(active)setDockStatus(s)}).catch(()=>{});return()=>{active=false}},[ready,layout.page])
 const installDock=async()=>{setDockBusy(true);try{if(await window.pssa.installObsDock()){setDockStatus(await window.pssa.obsDockStatus());setNotice({text:'Wtyczka OBS gotowa. Uruchom OBS ponownie.',error:false})}}catch(e){setNotice({text:e instanceof Error?e.message.replace(/^Error invoking remote method '[^']+': Error: /,''):'Nie udało się zainstalować wtyczki OBS.',error:true})}finally{setDockBusy(false)}}
 const reset=()=>{patch({...defaultLayout,page:'settings'});setConfirm(false)}
 const updateAvailable=updateInfo?.state==='available'&&(layout.page==='settings'||!(dismissedUpdate?.version===updateInfo.version&&dismissedUpdate.until>Date.now()))
 const updateBlocked=live?.phase==='live'||live?.phase==='unknown'||!!obs?.metrics?.streaming||!!obs?.metrics?.recording
 const originalItem=allPages.find(p=>p.id===(tourPage??layout.page))??allPages[0]!
 const item={...originalItem,label:t("nav."+originalItem.id),description:originalItem.description?t("nav.desc."+originalItem.id):""}
 const collapsed=layout.collapsed
 const inspector=layout.inspectorOpen&&!narrow
 const sidebarSize=collapsed?64:layout.sidebarWidth
 const styles={'--sidebar-width':sidebarSize+'px','--inspector-width':layout.inspectorWidth+'px'} as CSSProperties
 return <div className={`app ${status?.compact?'compact':''} ${slow?'streaming-mode':''}`} style={styles} data-theme={runtime?.theme??'pssa'}>
  <header className="titlebar"><div className="title-brand" title={BRAND+' / '+theme.name} aria-label={BRAND+' / '+theme.name}><ThemeLogo theme={runtime?.theme??'pssa'} className="brand-symbol"/><span>{runtime?.theme&&runtime.theme!=='pssa'?theme.name:'PSSA'} <small>STREAM ALERTS</small></span></div><span className="title-version">{status?.version??'2.0-dev'}</span></header>
  <div className={`workspace ${inspector?'has-inspector':''}`}>
   <aside className={`sidebar ${collapsed?'collapsed':''}`} aria-label={t("shell.nav")}>
    <div className="sidebar-top"><Button variant="ghost" title={t("shell.toggle")+" (Ctrl+B)"} aria-label={t("shell.toggle")} aria-expanded={!collapsed} disabled={!ready} onClick={()=>patch({collapsed:!collapsed})}><Icon name="sidebar"/></Button>{!collapsed&&<label className="nav-search"><Icon name="search" size={15}/><input aria-label={t("shell.search")} placeholder={t("shell.search")} value={query} onChange={e=>setQuery(e.target.value)}/></label>}</div>
    <SidebarNav navigation={layout.navigation} onChange={navChange} collapsed={collapsed} query={query} active={item.id} ready={ready} navigate={navigate} editing={editing}/>
    <div className="sidebar-bottom"><Button variant="ghost" aria-label={t("nav.settings")} aria-pressed={item.id==='settings'} title={t("nav.settings")} onClick={()=>navigate('settings')}><Icon name="settings"/></Button><ThemeLogo theme={runtime?.theme??'pssa'} className="account-avatar"/>{!collapsed&&<div><strong>{twitch?.login||t('shell.local')}</strong><small>{twitch?.phase==='connected'?t('shell.twitchOn'):t('shell.twitchOff')}</small></div>}</div>
   </aside>
   {!collapsed&&<ResizeHandle label={t("shell.menuWidth")} value={layout.sidebarWidth} range={bounds.sidebar} onChange={n=>patch({sidebarWidth:n},false)} onCommit={n=>patch({sidebarWidth:n})}/>}
   <main className={'content '+(item.id==='studio'?'content--studio':'')} tabIndex={-1} ref={content} id="main-content">
    <header className="page-header" data-tour="page-header"><div><p className="eyebrow">PSSA / WORKSPACE</p><h1>{item.label}</h1>{item.description&&<p>{item.description}</p>}</div>{item.id==='settings'&&<Button disabled={!ready||busy||dockBusy||dockStatus==='unavailable'} onClick={()=>void installDock()}>{dockBusy?'Instalowanie…':dockStatus==='update'?'Aktualizuj wtyczkę OBS':dockStatus==='current'?'Zainstaluj ponownie wtyczkę OBS':'Dodaj wtyczkę do OBS'}</Button>}</header>
    {updateAvailable&&<div className="update-banner" role="status"><Icon name="bolt"/><div><strong>Nowa wersja PSSA: {updateInfo?.version}</strong><small>Aktualizacja dostępna</small></div><Button variant="primary" onClick={()=>setUpdateOpen(true)}>Aktualizuj PSSA</Button><Button variant="ghost" aria-label="Przypomnij później" onClick={()=>setDismissedUpdate({version:updateInfo!.version,until:Date.now()+21600000})}><Icon name="close"/></Button></div>}
    {dockReminder&&dockStatus!=='current'&&<div className="update-banner"><Icon name="plug"/><div><strong>Zaktualizuj wtyczkę OBS</strong><small>Zamknij OBS i przejdź do ustawień.</small></div><Button onClick={()=>navigate('settings')}>Ustawienia</Button></div>}
    <div className="page-body"><PageContent update={updateInfo} checkUpdate={checkUpdate} openUpdate={()=>setUpdateOpen(true)} runtime={runtime} saveRuntime={saveRuntime} live={live} obs={obs} agent={agent} alertState={alertState} item={item} status={status} layout={layout} busy={busy||!ready} onCompact={toggleCompact} onReset={()=>setConfirm(true)} onLayout={patch} onNavigation={navChange} editingMenu={editing} onEditMenu={editMenu} onIntegrations={()=>navigate('integrations')}/></div>
   </main>
   {inspector&&<><ResizeHandle label="Szerokość inspektora" value={layout.inspectorWidth} direction={-1} range={bounds.inspector} onChange={n=>patch({inspectorWidth:n},false)} onCommit={n=>patch({inspectorWidth:n})}/><aside className="inspector" aria-label="Inspektor"><header><h2>Inspektor</h2><Button variant="ghost" aria-label="Ukryj inspektor" disabled={!ready} onClick={()=>patch({inspectorOpen:false})}><Icon name="close" size={16}/></Button></header><Panel title="Połączenia"><div className="connection"><span>Twitch</span><Status tone={twitch?.phase==='connected'?'ready':'neutral'}>{twitch?.phase??'Offline'}</Status></div><div className="connection"><span>OBS Studio</span><Status tone={obs?.phase==='connected'?'ready':'neutral'}>{obs?.phase??'Offline'}</Status></div><div className="connection"><span>SQLite</span><Status tone={status?'ready':'warning'}>{status?'Gotowa':'Oczekiwanie'}</Status></div></Panel><Panel title="Kontekst modułu"><h3>{item.label}</h3>{item.description&&<p>{item.description}</p>}<small className="muted">{item.stage>2?'Implementacja w etapie '+item.stage:'Interfejs lokalny'}</small></Panel></aside></>}
  </div>
  <footer className="statusbar"><Status tone={status?'ready':'warning'}>{status?t('shell.databaseReady'):t('shell.initializing')}</Status><span className="status-separator"/><Status tone={twitch?.phase==='connected'?'ready':'neutral'}>{twitch?.phase==='connected'?t('shell.twitchOn'):'Twitch '+(twitch?.phase??'offline')}</Status><Status tone={obs?.phase==='connected'?'ready':'neutral'}>{obs?.phase==='connected'?t('shell.obsOn'):'OBS '+(obs?.phase??'offline')}</Status><span className="footer-right">PSSA</span></footer>
  <button type="button" className="help-launch" data-help-launch aria-label={t("shell.help")} title={t("shell.help")} disabled={!ready||!!(runtime&&!runtime.onboarded)} onClick={()=>setHelpOpen(true)}>?</button>
  {helpOpen&&<HelpCenter initial={item.id} onClose={()=>setHelpOpen(false)} onStart={page=>{setHelpOpen(false);setTourPage(page);content.current?.scrollTo({top:0})}}/>}
  {tourPage&&<GuidedTour key={tourPage} page={tourPage} onClose={()=>{setTourPage(undefined);content.current?.scrollTo({top:0})}}/>}
  {updateOpen&&updateInfo?.state==='available'&&<UpdatePopup info={updateInfo} current={status?.version??''} blocked={updateBlocked} onClose={()=>{setUpdateOpen(false);setDismissedUpdate({version:updateInfo.version,until:Date.now()+21600000})}}/>}
  {notice&&<div className={`toast ${notice.error?'toast-error':''}`} role={notice.error?'alert':'status'}><span>{notice.text}</span><Button variant="ghost" aria-label="Zamknij powiadomienie" onClick={()=>setNotice(null)}><Icon name="close" size={16}/></Button></div>}
  {ready&&runtime&&!runtime.onboarded&&<Onboarding runtime={runtime} save={saveRuntime} onIntegrations={()=>{navigate('integrations');if(twitch?.publicLogin&&!twitch.login&&twitch.phase!=='authorizing')void window.pssa.twitchDeviceLogin().catch(()=>{})}}/>}
  {confirm&&<ConfirmDialog title="Przywrócić domyślny układ?" onClose={()=>setConfirm(false)} onConfirm={reset}>Zresetuje szerokość paneli, widoczność inspektora i układ menu. Nie zmieni statystyk ani ustawień alertów.</ConfirmDialog>}
 </div>
}
