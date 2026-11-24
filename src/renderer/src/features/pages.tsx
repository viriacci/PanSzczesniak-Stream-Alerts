import {RuntimeSettings,DiagnosticsPage} from './runtime'
import type {RuntimePreferences} from '../../../shared/runtime'
import {AnalyticsPage} from './analytics'
import {LibraryPage,ProfilesPage} from './library'
import {StudioPage} from './studio'
import {LiveCenter} from './live'
import type {LiveState} from '../../../shared/live'
import {ObsPage} from './obs'
import type {ObsState,AgentState} from '../../../shared/obs'
import { QueuePage } from './queue'
import { AlertsPage, TwitchPage } from './alerts'
import type { AlertState } from '../../../shared/alerts'
import type { SystemStatus } from '../../../shared/contracts'
import type { LayoutPreferences } from '../../../shared/layout'
import type { NavItem } from '../navigation'
import { Button, Empty, Panel, Status } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
type Props={runtime?:RuntimePreferences;saveRuntime:(p:RuntimePreferences)=>Promise<RuntimePreferences>;live?:LiveState;obs?:ObsState;agent?:AgentState;alertState?:AlertState;item:NavItem;status?:SystemStatus;layout:LayoutPreferences;busy:boolean;onCompact:()=>void;onReset:()=>void;onIntegrations:()=>void}
export function PageContent({runtime,saveRuntime,live,obs,agent,alertState,item,status,layout,busy,onCompact,onReset,onIntegrations}:Props) {
 if(item.id==='dashboard')return <><LiveCenter state={live} obs={obs} pending={alertState?.queue.pendingCount??null} onIntegrations={onIntegrations}/><Panel title="Ostatnia aktywność">{alertState?.queue.history.length?alertState.queue.history.slice(0,4).map(x=><div className="setting-row" key={x.id}><span>{x.text}</span><small className="muted">{x.status}</small></div>):<Empty title="Brak zarejestrowanych zdarzeń">Ostatnie zakończone alerty pojawią się tutaj.</Empty>}</Panel></>
 if(item.id==='analytics')return <AnalyticsPage/>
 if(item.id==='library')return <LibraryPage base={alertState?.twitch.overlayUrl??''}/>
 if(item.id==='profiles')return <ProfilesPage alerts={alertState} live={live}/>
 if(item.id==='studio')return <StudioPage state={alertState}/>
 if(item.id==='settings')return <>
  <Panel title="Wygląd i układ" detail="Preferencje są zapisywane lokalnie w SQLite.">
   <div className="setting-row"><div><h3>Tryb kompaktowy</h3><p>Mniejsza ilość wolnej przestrzeni między elementami.</p></div><Button role="switch" aria-checked={status?.compact??false} disabled={!status||busy} onClick={onCompact}>{status?.compact?'Włączony':'Wyłączony'}</Button></div>
   <div className="setting-row"><div><h3>Rozmiar paneli</h3><p>Menu: {layout.sidebarWidth}px · Inspektor: {layout.inspectorWidth}px</p></div><Button disabled={busy} onClick={onReset}>Przywróć układ</Button></div>
  </Panel>
  {runtime&&<RuntimeSettings runtime={runtime} save={saveRuntime}/>}
  <Panel title="Motyw"><div className="swatches">{['#101012','#1b1b1e','#e3c048','#f2f2f2'].map(c=><div key={c}><span style={{background:c}}/>{c.toUpperCase()}</div>)}</div><p className="muted">PSSA / Black & Gold</p></Panel>
 </>
 if(item.id==='diagnostics')return <DiagnosticsPage/>
 if(item.id==='documentation')return <><Panel title="Skróty klawiaturowe"><dl className="details"><dt>Ctrl + B</dt><dd>Zwiń / rozwiń menu</dd><dt>Ctrl + I</dt><dd>Inspektor</dd><dt>Ctrl + ,</dt><dd>Ustawienia</dd><dt>Strzałki / Home / End</dt><dd>Zmiana szerokości aktywnego separatora</dd><dt>Esc</dt><dd>Zamknij okno dialogowe</dd></dl></Panel><Panel title="Przewodnik po projekcie"><p>Dokumentacja techniczna i materiały do nauki znajdują się w katalogu docs repozytorium PSSA.</p></Panel></>
 if(item.id==='queue'||item.id==='activity')return <QueuePage state={alertState?.queue} historyOnly={item.id==='activity'}/>
 if(item.id==='integrations')return <><TwitchPage state={alertState}/><ObsPage obs={obs} agent={agent}/></>
 if(item.id==='alerts'||item.id==='rewards')return <AlertsPage key={alertState?.profileId??'default'} state={alertState} rewards={item.id==='rewards'}/>
 return <Panel title={item.label} action={<Status>Etap {item.stage}</Status>}><Empty title="Moduł w przygotowaniu">{item.description} Funkcjonalność nie jest jeszcze dostępna.</Empty></Panel>
}
