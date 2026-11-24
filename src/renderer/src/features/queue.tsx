import {useState} from 'react'
import type {QueueCommand,QueueItem,QueueState} from '../../../shared/queue'
import {Button,Panel,Status,Empty} from '../components/ui'
const labels:Record<string,string>={pending:'Oczekuje',playing:'Odtwarzany',done:'Odtworzony',skipped:'Pominięty',failed:'Nieudany',suppressed:'Odfiltrowany'}
const reasons:Record<string,string>={disabled:'Wyłączony',minimum:'Poniżej progu',cooldown:'Cooldown',capacity:'Limit kolejki',manual:'Ręcznie',restart:'Restart',shutdown:'Zamknięcie aplikacji','overlay-disconnected':'Utrata nakładki','ack-timeout':'Brak potwierdzenia','restart-limit':'Limit prób'}
export function QueuePage({state,historyOnly=false}:{state?:QueueState;historyOnly?:boolean}){
 const [override,setOverride]=useState<QueueState>(),[busy,setBusy]=useState(false),[error,setError]=useState('')
 // Polling is authoritative; immediate result is used only during an outstanding command.
 const q=busy?(override??state):state
 async function run(command:QueueCommand){
  if(busy)return
  setBusy(true);setError('')
  try{setOverride(await window.pssa.queueCommand(command))}catch{setError('Nie udało się wykonać polecenia. Stan kolejki mógł się zmienić.')}finally{setBusy(false)}
 }
 if(!q)return <Panel title="Kolejka"><Empty title="Wczytywanie">Oczekiwanie na silnik alertów.</Empty></Panel>
 const update=(patch:Partial<QueueState['settings']>)=>void run({type:'settings',settings:{...q.settings,...patch}})
 const render=(item:QueueItem,pending=false)=><div className="queue-row" key={item.id}><div className="queue-info"><h3>{item.title} <span className="muted">#{item.id} · {item.source}</span></h3><p>{item.text}</p><small className="muted">{labels[item.status]} · {new Date(item.createdAt).toLocaleString('pl-PL')} {item.reason?' · '+(reasons[item.reason]??item.reason):''} · Próby: {item.attempts}</small></div><div className="alert-actions">{pending?<><label className="queue-priority">Priorytet <select aria-label={'Priorytet alertu '+item.id} value={item.priority} disabled={busy} onChange={e=>void run({type:'priority',id:item.id,priority:Number(e.target.value)})}>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i}</option>)}</select></label><Button disabled={busy} title="Wyżej w obrębie priorytetu" aria-label={'Przesuń w górę '+item.id} onClick={()=>void run({type:'move',id:item.id,direction:-1})}>↑</Button><Button disabled={busy} title="Niżej w obrębie priorytetu" aria-label={'Przesuń w dół '+item.id} onClick={()=>void run({type:'move',id:item.id,direction:1})}>↓</Button><Button disabled={busy} onClick={()=>void run({type:'skip',id:item.id})}>Pomiń</Button></>:item.status==='playing'?<Button disabled={busy} onClick={()=>void run({type:'skip',id:item.id})}>Pomiń</Button>:<Button disabled={busy} onClick={()=>void run({type:'replay',id:item.id})}>Odtwórz ponownie</Button>}</div></div>
 return <>
 {error&&<p role="alert">{error}</p>}
 {!historyOnly&&<><Panel title="Sterowanie silnikiem" action={<Status tone={q.online?'ready':'warning'}>{q.online?'Nakładka połączona':'Oczekiwanie na OBS'}</Status>}>
  <div className="alert-actions"><Button variant="primary" disabled={busy} onClick={()=>update({paused:!q.settings.paused})}>{q.settings.paused?'Wznów kolejkę':'Pauza po bieżącym'}</Button><Button disabled={busy} onClick={()=>update({muted:!q.settings.muted})}>{q.settings.muted?'Włącz dźwięk':'Wycisz natychmiast'}</Button></div>
  <div className="setting-row"><div><h3>Głośność globalna</h3><p>{q.settings.volume}% · wyciszenie działa również na odtwarzany alert.</p></div><select className="queue-select" aria-label="Głośność globalna" value={q.settings.volume} disabled={busy} onChange={e=>update({volume:Number(e.target.value)})}>{[...new Set([0,10,20,30,40,50,60,70,80,90,100,q.settings.volume])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}%</option>)}</select></div>
  <div className="setting-row"><div><h3>Przerwa między alertami</h3><p>Po zakończeniu lub pominięciu.</p></div><select className="queue-select" aria-label="Przerwa między alertami" value={q.settings.gapMs} disabled={busy} onChange={e=>update({gapMs:Number(e.target.value)})}>{[...new Set([0,250,500,1000,2000,3000,5000,10000,q.settings.gapMs])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n/1000} s</option>)}</select></div>
 </Panel><Panel title="Aktualnie odtwarzany">{q.current?render(q.current):<Empty title="Brak aktywnego alertu">{q.settings.paused?'Kolejka wstrzymana.':'Silnik oczekuje na zdarzenie lub nakładkę.'}</Empty>}</Panel>
 <Panel title={'Oczekujące · '+q.pendingCount} detail="Wyższy priorytet odtwarzany pierwszy. Strzałki zmieniają kolejność wewnątrz priorytetu.">{q.pending.length?q.pending.map(item=>render(item,true)):<Empty title="Kolejka pusta">Zdarzenia pojawią się tutaj.</Empty>}{q.pendingCount>q.pending.length&&<p>Wyświetlono pierwsze {q.pending.length} pozycji.</p>}</Panel></>}
 <Panel title="Historia alertów" detail="Ostatnie 100 zakończonych lub odfiltrowanych zdarzeń.">{q.history.length?q.history.map(item=>render(item)):<Empty title="Brak historii">Zakończone i odfiltrowane alerty zostaną tutaj zapisane.</Empty>}</Panel></>
}
