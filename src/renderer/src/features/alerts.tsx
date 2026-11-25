import {useEffect,useState,type FormEvent} from 'react'
import {defaultRule,type AlertRule,type AlertState} from '../../../shared/alerts'
import {Button,Panel,Status} from '../components/ui'
const labels:Record<string,string>={raid:'Raid',follow:'Follow',sub:'Subskrypcja',prime_sub:'Prime',resub:'Odnowienie',gift:'Gift sub',mass_gift:'Mass gift',bits:'Bits'}
export function useAlerts(slow=false){
 const [state,setState]=useState<AlertState>()
 useEffect(()=>{let active=true;let running=false;let revision=-1
  const poll=async()=>{if(running||document.hidden)return;running=true;try{const v=await window.pssa.alertPoll(revision);if(active){revision=v.revision;if(v.state)setState(v.state)}}catch{revision=-1;if(active)setState(undefined)}finally{running=false}}
  void poll();const t=window.setInterval(poll,slow?5000:1500);return()=>{active=false;window.clearInterval(t)}
 },[slow])
 return state
}
export function TwitchPage({state}:{state?:AlertState}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const t=state?.twitch
 async function run(action:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{await action();if(success)setMessage(success)}catch{setMessage('Operacja nie powiodła się. Sprawdź status i konfigurację.')}finally{setBusy(false)}}
 return <>
  <Panel title="Twitch" action={<Status tone={t?.phase==='connected'?'ready':t?.phase==='error'?'warning':'neutral'}>{t?.phase??'Inicjalizacja'}</Status>}>
   <p>{t?.login?'Kanał: '+t.login:'Zaloguj się na Twitch, aby odbierać zdarzenia i nagrody kanału.'}</p><p>{t?.detail}</p>
   <div className="alert-actions"><Button variant="primary" disabled={busy||!t?.publicLogin||t.phase==='authorizing'} onClick={()=>void run(()=>window.pssa.twitchDeviceLogin(),'Autoryzacja zakończona.')}>Zaloguj się przez Twitch</Button><Button disabled={busy||!t?.login} onClick={()=>void run(()=>window.pssa.twitchConnect(),'Rozpoczęto ponowne połączenie.')}>Połącz ponownie</Button><Button disabled={!t?.login&&t?.phase!=='authorizing'} onClick={()=>void window.pssa.twitchLogout().catch(()=>setMessage('Nie udało się anulować.'))}>Wyloguj / anuluj</Button></div>
   {t?.deviceCode&&<p>Kod autoryzacji: <strong>{t.deviceCode}</strong>. Zatwierdź go w przeglądarce.</p>}
   {t&&!t.publicLogin&&<p className="muted">Logowanie uproszczone oczekuje na rejestrację aplikacji PSSA. Logowanie własną aplikacją jest dostępne w ustawieniach.</p>}

  </Panel>
  <Panel title="Nakładka OBS" detail="Dodaj jako źródło przeglądarkowe 1920x1080"><label className="alert-form">Adres lokalny<input readOnly value={t?.overlayUrl??''} onFocus={e=>e.target.select()}/></label></Panel>
  {message&&<p role="status">{message}</p>}
 </>
}
export function AdvancedTwitchLogin({state}:{state?:AlertState}){
 const [id,setId]=useState(''),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const t=state?.twitch
 function login(e:FormEvent){e.preventDefault();const value=secret;setSecret('');setBusy(true);setMessage('');void window.pssa.twitchLogin(id.trim(),value).then(()=>setMessage('Autoryzacja zakończona.')).catch(()=>setMessage('Logowanie nie powiodło się.')).finally(()=>setBusy(false))}
 return <><p>Opcjonalne logowanie przy użyciu własnej aplikacji Twitch Developer Console.</p><form className="alert-form" onSubmit={login}><label>Client ID<input required autoComplete="off" value={id} onChange={e=>setId(e.target.value)}/></label><label>Client Secret<input type="password" required autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}/></label><p className="muted">OAuth Redirect URL: http://localhost:3000. Tokeny i secret szyfrowane lokalnie.</p><div className="alert-actions"><Button type="submit" variant="primary" disabled={busy||t?.phase==='authorizing'}>Połącz z Twitch</Button></div></form><Button disabled={t?.phase!=='authorizing'} onClick={()=>void window.pssa.twitchLogout().catch(()=>setMessage('Nie udało się anulować.'))}>Anuluj logowanie</Button>{message&&<p role="status">{message}</p>}</>
}
export function MigrationPanel(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 return <Panel title="Migracja PSSA 1.x"><p>Import konfiguracji starej wersji. Istniejące przypisania o tych samych kluczach zostaną zastąpione. Tokeny nie są importowane.</p><Button disabled={busy} onClick={()=>{setBusy(true);void window.pssa.importLegacy().then(r=>setMessage(r?'Import: '+r.count+' reguł. '+r.warnings.join('; '):'Anulowano.')).catch(()=>setMessage('Nie udało się zaimportować konfiguracji.')).finally(()=>setBusy(false))}}>Importuj konfigurację</Button>{message&&<p role="status">{message}</p>}</Panel>
}
function RuleEditor({initial,onClose,profile}:{initial:AlertRule;onClose:()=>void;profile:string}){
 const [rule,setRule]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const patch=(p:Partial<AlertRule>)=>setRule(v=>({...v,...p}))
 async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action()}catch{setMessage('Nie udało się wykonać operacji. Sprawdź pliki i ustawienia.')}finally{setBusy(false)}}
 return <Panel title={labels[rule.key]??rule.title} action={<Button onClick={onClose}>Zamknij</Button>}><form className="alert-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await window.pssa.saveAlert(rule,profile);setMessage('Zapisano.')})}}>
  <label className="alert-checkbox"><input type="checkbox" checked={rule.enabled} onChange={e=>patch({enabled:e.target.checked})}/> Włącz alert</label>
  <label>Treść alertu<input maxLength={500} value={rule.template} onChange={e=>patch({template:e.target.value})}/></label><p className="muted">Zmienne: {'{user}, {reward}, {viewers}, {bits}, {months}, {count}'}</p>
  {rule.scene?<p className="muted">Czas i multimedia tej sceny edytuj w Visual Studio.</p>:<label>Czas wyświetlania (s)<input type="number" min={1} max={120} step={0.5} value={rule.duration} onChange={e=>patch({duration:Number(e.target.value)})}/></label>}
  <div className="queue-fields">{([{key:'priority',label:'Priorytet',max:10},{key:'cooldown',label:'Cooldown (s)',max:3600},{key:'volume',label:'Głośność (%)',max:100},{key:'minCount',label:'Minimalna liczba (Bits/widzowie/prezenty/miesiące)',max:1000000}] as const).map(field=><label key={field.key}>{field.label}<input type="number" min={0} max={field.max} step={1} value={rule[field.key]} onChange={e=>patch({[field.key]:Number(e.target.value)})}/></label>)}</div>
  {!rule.scene&&(['image','audio'] as const).map(kind=><div className="setting-row" key={kind}><div><h3>{kind==='image'?'Grafika / GIF':'Dźwięk'}</h3><p>{rule[kind]?'Plik przypisany':'Nie wybrano'}</p></div><div className="alert-actions"><Button disabled={busy} onClick={()=>void run(async()=>{const file=await window.pssa.chooseMedia(kind);if(file)patch({[kind]:file})})}>Wybierz</Button><Button disabled={busy||!rule[kind]} onClick={()=>patch({[kind]:''})}>Usuń</Button></div></div>)}
  <div className="alert-actions"><Button type="submit" variant="primary" disabled={busy}>Zapisz</Button><Button disabled={busy} onClick={()=>void run(async()=>{await window.pssa.saveAlert(rule,profile);const n=await window.pssa.testAlert(rule.key);setMessage(n?'Test dodany do kolejki.':'Kolejka jest pełna.')})}>Zapisz i testuj</Button></div>
  {message&&<p role="status">{message}</p>}
 </form></Panel>
}
export function AlertsPage({state,rewards=false}:{state?:AlertState;rewards?:boolean}){
 const [selected,setSelected]=useState<AlertRule>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const rules=state?.rules??[]
 const list=rewards?[...rules.filter(r=>r.key.startsWith('reward:')),...(state?.rewards??[]).filter(x=>!rules.some(r=>r.key==='reward:'+x.id)).map(x=>defaultRule('reward:'+x.id,x.title))]:rules.filter(r=>!r.key.startsWith('reward:'))
 async function sync(){setBusy(true);try{await window.pssa.syncRewards();setMessage('Nagrody pobrane.')}catch{setMessage('Nie udało się pobrać nagród. Sprawdź autoryzację i dostęp do punktów kanału.')}finally{setBusy(false)}}
 return <>{rewards&&<Panel title="Nagrody kanału" action={<Button disabled={busy||!state?.twitch.login} onClick={()=>void sync()}>Synchronizuj</Button>}><p>{message||'Pobierz aktualne nagrody lub zaimportuj konfigurację PSSA 1.x.'}</p></Panel>}{selected&&<RuleEditor key={selected.key} initial={selected} profile={state?.profileId??'default'} onClose={()=>setSelected(undefined)}/>}<Panel title={rewards?'Przypisania nagród':'Typy alertów'}>{!list.length&&<p>Brak reguł do wyświetlenia.</p>}{list.map(rule=><div className="setting-row" key={rule.key}><div><h3>{labels[rule.key]??rule.title}</h3><Status tone={rule.enabled?'ready':'neutral'}>{rule.enabled?'Włączony':'Wyłączony'}</Status></div><Button onClick={()=>setSelected(rule)}>Edytuj</Button></div>)}</Panel></>
}
