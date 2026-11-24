import { QueuePage } from './queue'
import { AlertsPage, TwitchPage } from './alerts'
import type { AlertState } from '../../../shared/alerts'
import type { SystemStatus } from '../../../shared/contracts'
import type { LayoutPreferences } from '../../../shared/layout'
import type { NavItem } from '../navigation'
import { Button, Empty, Panel, Status } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
type Props={alertState?:AlertState;item:NavItem;status?:SystemStatus;layout:LayoutPreferences;busy:boolean;onCompact:()=>void;onReset:()=>void;onIntegrations:()=>void}
const metrics:{label:string;icon:IconName;detail:string}[]=[
 {label:'Aktualni widzowie',icon:'users',detail:'Brak połączenia z Twitch'},
 {label:'Średnia widzów',icon:'chart',detail:'Brak zarejestrowanej sesji'},
 {label:'Czas transmisji',icon:'clock',detail:'Brak zarejestrowanej sesji'},
 {label:'Alerty w kolejce',icon:'bolt',detail:'Silnik w przygotowaniu'}
]
export function PageContent({alertState,item,status,layout,busy,onCompact,onReset,onIntegrations}:Props) {
 if(item.id==='dashboard')return <>
  <section className="hero"><div><span className="eyebrow">STREAM CONTROL / 04</span><h2>Twoje centrum transmisji.</h2><p>Alerty, statystyki i kontrola OBS w jednym miejscu.</p><Button variant="primary" onClick={onIntegrations}>Przejdź do integracji <Icon name="chevron" size={16}/></Button></div><div className="hero-emblem" aria-hidden="true"><span>P</span></div></section>
  <div className="metric-grid">{metrics.map(m=><section className="metric" key={m.label}><header><span>{m.label}</span><Icon name={m.icon}/></header><strong>{m.label==='Alerty w kolejce'?(alertState?.queue.pendingCount??'—'):'—'}</strong><small>{m.label==='Alerty w kolejce'?'Oczekujące alerty':m.detail}</small></section>)}</div>
  <Panel title="Oglądalność" detail="Bieżąca transmisja"><Empty title="Brak danych transmisji">Wykres pojawi się po uruchomieniu modułu Live Center w etapie 6.</Empty></Panel>
  <Panel title="Ostatnia aktywność" detail="Zdarzenia kanału">{alertState?.queue.history.length?alertState.queue.history.slice(0,4).map(x=><div className="setting-row" key={x.id}><span>{x.text}</span><small className="muted">{x.status}</small></div>):<Empty title="Brak zarejestrowanych zdarzeń">Ostatnie zakończone alerty pojawią się tutaj.</Empty>}</Panel>
 </>
 if(item.id==='settings')return <>
  <Panel title="Wygląd i układ" detail="Preferencje są zapisywane lokalnie w SQLite.">
   <div className="setting-row"><div><h3>Tryb kompaktowy</h3><p>Mniejsza ilość wolnej przestrzeni między elementami.</p></div><Button role="switch" aria-checked={status?.compact??false} disabled={!status||busy} onClick={onCompact}>{status?.compact?'Włączony':'Wyłączony'}</Button></div>
   <div className="setting-row"><div><h3>Rozmiar paneli</h3><p>Menu: {layout.sidebarWidth}px · Inspektor: {layout.inspectorWidth}px</p></div><Button disabled={busy} onClick={onReset}>Przywróć układ</Button></div>
  </Panel>
  <Panel title="Motyw"><div className="swatches">{['#101012','#1b1b1e','#e3c048','#f2f2f2'].map(c=><div key={c}><span style={{background:c}}/>{c.toUpperCase()}</div>)}</div><p className="muted">PSSA / Black & Gold</p></Panel>
 </>
 if(item.id==='diagnostics')return <Panel title="Stan systemu"><dl className="details"><dt>Wersja</dt><dd>{status?.version??'—'}</dd><dt>Baza danych</dt><dd><Status tone={status?'ready':'warning'}>{status?'SQLite · gotowa':'Niezweryfikowana'}</Status></dd><dt>Schemat</dt><dd>{status?.schemaVersion??'—'}</dd><dt>Środowisko</dt><dd>Electron / React / TypeScript</dd><dt>Integracje</dt><dd>Twitch: {alertState?.twitch.phase??'—'}</dd></dl></Panel>
 if(item.id==='documentation')return <><Panel title="Skróty klawiaturowe"><dl className="details"><dt>Ctrl + B</dt><dd>Zwiń / rozwiń menu</dd><dt>Ctrl + I</dt><dd>Inspektor</dd><dt>Ctrl + ,</dt><dd>Ustawienia</dd><dt>Strzałki / Home / End</dt><dd>Zmiana szerokości aktywnego separatora</dd><dt>Esc</dt><dd>Zamknij okno dialogowe</dd></dl></Panel><Panel title="Przewodnik po projekcie"><p>Dokumentacja techniczna i materiały do nauki znajdują się w katalogu docs repozytorium PSSA.</p></Panel></>
 if(item.id==='queue'||item.id==='activity')return <QueuePage state={alertState?.queue} historyOnly={item.id==='activity'}/>
 if(item.id==='integrations')return <TwitchPage state={alertState}/>
 if(item.id==='alerts'||item.id==='rewards')return <AlertsPage state={alertState} rewards={item.id==='rewards'}/>
 return <Panel title={item.label} action={<Status>Etap {item.stage}</Status>}><Empty title="Moduł w przygotowaniu">{item.description} Funkcjonalność nie jest jeszcze dostępna.</Empty></Panel>
}
