import {useEffect,useState,type FormEvent} from 'react'
import {defaultRule,type AlertRule,type AlertState} from '../../../shared/alerts'
import {Button,Panel,Status} from '../components/ui'
const labels:Record<string,string>={raid:'Raid',follow:'Follow',sub:'Subskrypcja',prime_sub:'Prime',resub:'Odnowienie',gift:'Gift sub',mass_gift:'Mass gift',bits:'Bits'}
export function useAlerts(){
 const [state,setState]=useState<AlertState>()
 useEffect(()=>{let active=true;let running=false
  const poll=async()=>{if(running)return;running=true;try{const v=await window.pssa.alertState();if(active)setState(v)}catch{}finally{running=false}}
  void poll();const t=window.setInterval(poll,1500);return()=>{active=false;window.clearInterval(t)}
 },[])
 return state
}
export function TwitchPage({state}:{state?:AlertState}){
 const [id,setId]=useState(''),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const t=state?.twitch
 async function run(action:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{await action();if(success)setMessage(success)}catch{setMessage('Operacja nie powiodła się. Sprawdź status i konfigurację.')}finally{setBusy(false)}}
 function login(e:FormEvent){e.preventDefault();const value=secret;setSecret('');void run(()=>window.pssa.twitchLogin(id.trim(),value),'Autoryzacja zakończona.')}
 return <>
  <Panel title="Twitch" action={<Status tone={t?.phase==='connected'?'ready':t?.phase==='error'?'warning':'neutral'}>{t?.phase??'Inicjalizacja'}</Status>}>
   <p>{t?.login?'Kanał: '+t.login:'Podłącz własną aplikację Twitch Developer Console.'}</p><p>{t?.detail}</p>
   <form className="alert-form" onSubmit={login}><label>Client ID<input required autoComplete="off" value={id} onChange={e=>setId(e.target.value)}/></label><label>Client Secret<input type="password" required autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}/></label><p className="muted">OAuth Redirect URL: http://localhost:3000. Tokeny i secret szyfrowane lokalnie.</p><div className="alert-actions"><Button type="submit" variant="primary" disabled={busy||t?.phase==='authorizing'}>Połącz z Twitch</Button><Button disabled={busy||!t?.login} onClick={()=>void run(()=>window.pssa.twitchConnect(),'Rozpoczęto ponowne połączenie.')}>Połącz ponownie</Button><Button disabled={!t?.login&&t?.phase!=='authorizing'} onClick={()=>void run(()=>window.pssa.twitchLogout(),'Wylogowano.')}>Wyloguj / anuluj</Button></div></form>
  </Panel>
  <Panel title="Nakładka OBS" detail="Źródło przeglądarkowe 1920 × 1080; bez połączenia z Twitch też działa."><label className="alert-form">Adres lokalny<input readOnly value={t?.overlayUrl??''} onFocus={e=>e.target.select()}/></label><p>Podłączone źródła: {t?.clients??0}. Tylko jedno źródło odtwarza dany alert. Nie udostępniaj adresu publicznie. Sterowanie OBS powstanie w etapie 5.</p></Panel>
  <Panel title="Migracja PSSA 1.x"><p>Importuj config.json ze starego programu. Przypisania o identycznych kluczach zostaną zastąpione; stara instalacja pozostanie nietknięta. Tokeny nie będą importowane.</p><Button disabled={busy} onClick={()=>void run(async()=>{const data=await window.pssa.importLegacy();setMessage(data?'Import: '+data.count+' reguł. '+data.warnings.join('; '):'Import anulowany.');return data},'')}>Importuj konfigurację</Button></Panel>
  {message&&<p role="status">{message}</p>}
 </>
}
function RuleEditor({initial,onClose}:{initial:AlertRule;onClose:()=>void}){
 const [rule,setRule]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const patch=(p:Partial<AlertRule>)=>setRule(v=>({...v,...p}))
 async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action()}catch{setMessage('Nie udało się wykonać operacji. Sprawdź pliki i ustawienia.')}finally{setBusy(false)}}
 return <Panel title={labels[rule.key]??rule.title} action={<Button onClick={onClose}>Zamknij</Button>}><form className="alert-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await window.pssa.saveAlert(rule);setMessage('Zapisano.')})}}>
  <label className="alert-checkbox"><input type="checkbox" checked={rule.enabled} onChange={e=>patch({enabled:e.target.checked})}/> Włącz alert</label>
  <label>Treść alertu<input maxLength={500} value={rule.template} onChange={e=>patch({template:e.target.value})}/></label><p className="muted">Zmienne: {'{user}, {reward}, {viewers}, {bits}, {months}, {count}'}</p>
  <label>Czas wyświetlania (s)<input type="number" min={1} max={120} step={0.5} value={rule.duration} onChange={e=>patch({duration:Number(e.target.value)})}/></label>
  <div className="queue-fields">{([{key:'priority',label:'Priorytet',max:10},{key:'cooldown',label:'Cooldown (s)',max:3600},{key:'volume',label:'Głośność (%)',max:100},{key:'minCount',label:'Minimalna liczba (Bits/widzowie/prezenty/miesiące)',max:1000000}] as const).map(field=><label key={field.key}>{field.label}<input type="number" min={0} max={field.max} step={1} value={rule[field.key]} onChange={e=>patch({[field.key]:Number(e.target.value)})}/></label>)}</div>
  {(['image','audio'] as const).map(kind=><div className="setting-row" key={kind}><div><h3>{kind==='image'?'Grafika / GIF':'Dźwięk'}</h3><p>{rule[kind]?'Plik przypisany':'Nie wybrano'}</p></div><div className="alert-actions"><Button disabled={busy} onClick={()=>void run(async()=>{const file=await window.pssa.chooseMedia(kind);if(file)patch({[kind]:file})})}>Wybierz</Button><Button disabled={busy||!rule[kind]} onClick={()=>patch({[kind]:''})}>Usuń</Button></div></div>)}
  <div className="alert-actions"><Button type="submit" variant="primary" disabled={busy}>Zapisz</Button><Button disabled={busy} onClick={()=>void run(async()=>{await window.pssa.saveAlert(rule);const n=await window.pssa.testAlert(rule.key);setMessage(n?'Test dodany do kolejki.':'Kolejka jest pełna.')})}>Zapisz i testuj</Button></div>
  {message&&<p role="status">{message}</p>}
 </form></Panel>
}
export function AlertsPage({state,rewards=false}:{state?:AlertState;rewards?:boolean}){
 const [selected,setSelected]=useState<AlertRule>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const rules=state?.rules??[]
 const list=rewards?[...rules.filter(r=>r.key.startsWith('reward:')),...(state?.rewards??[]).filter(x=>!rules.some(r=>r.key==='reward:'+x.id)).map(x=>defaultRule('reward:'+x.id,x.title))]:rules.filter(r=>!r.key.startsWith('reward:'))
 async function sync(){setBusy(true);try{await window.pssa.syncRewards();setMessage('Nagrody pobrane.')}catch{setMessage('Nie udało się pobrać nagród. Sprawdź autoryzację i dostęp do punktów kanału.')}finally{setBusy(false)}}
 return <>{rewards&&<Panel title="Nagrody kanału" action={<Button disabled={busy||!state?.twitch.login} onClick={()=>void sync()}>Synchronizuj</Button>}><p>{message||'Pobierz aktualne nagrody lub zaimportuj konfigurację PSSA 1.x.'}</p></Panel>}{selected&&<RuleEditor key={selected.key} initial={selected} onClose={()=>setSelected(undefined)}/>}<Panel title={rewards?'Przypisania nagród':'Typy alertów'}>{!list.length&&<p>Brak reguł do wyświetlenia.</p>}{list.map(rule=><div className="setting-row" key={rule.key}><div><h3>{labels[rule.key]??rule.title}</h3><Status tone={rule.enabled?'ready':'neutral'}>{rule.enabled?'Włączony':'Wyłączony'}</Status></div><Button onClick={()=>setSelected(rule)}>Edytuj</Button></div>)}</Panel></>
}
