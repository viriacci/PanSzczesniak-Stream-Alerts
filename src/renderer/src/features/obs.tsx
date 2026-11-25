import {useEffect,useState,type FormEvent} from 'react'
import type {ObsState,AgentState,ObsAction,AgentAction} from '../../../shared/obs'
import {Button,Panel,Status} from '../components/ui'
export function useObs(slow=false){
 const [obs,setObs]=useState<ObsState>(),[agent,setAgent]=useState<AgentState>()
 useEffect(()=>{let active=true,busy=false
  const poll=async()=>{if(busy||document.hidden)return;busy=true;try{const [o,a]=await Promise.all([window.pssa.obsState(),window.pssa.agentState()]);if(active){setObs(o);setAgent(a)}}catch{if(active){setObs(undefined);setAgent(undefined)}}finally{busy=false}}
  void poll();const t=window.setInterval(poll,slow?5000:2000);return()=>{active=false;window.clearInterval(t)}
 },[slow])
 return {obs,agent}
}
export function ObsPage({obs,agent}:{obs?:ObsState;agent?:AgentState}){
 const [port,setPort]=useState(4455),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{if(obs?.port)setPort(obs.port)},[obs?.port])
 async function run(fn:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{const v=await fn();setMessage(success+(typeof v==='number'&&success.startsWith('Odświeżono')?' '+v+' źródeł.':''))}catch{setMessage('Operacja nie powiodła się. Sprawdź połączenie i ustawienia.')}finally{setBusy(false)}}
 const action=(cmd:ObsAction,success:string)=>void run(()=>window.pssa.obsAction(cmd),success)
 const agentAction=(cmd:AgentAction)=>void run(()=>window.pssa.agentAction(cmd),'Polecenie przyjęte. Stan zostanie odświeżony.')
 const connect=(e:FormEvent)=>{e.preventDefault();const secret=password;setPassword('');action({type:'connect',port,password:secret},'Rozpoczęto połączenie.')}
 return <>
  <Panel title="Połączenie z OBS Studio (opcjonalne)" action={<Status tone={obs?.phase==='connected'?'ready':obs?.phase==='error'?'warning':'neutral'}>{obs?.phase??'offline'}</Status>}>
   <p>Potrzebne tylko do statystyk OBS i sterowania programem. Alerty działają bez tego połączenia. W OBS włącz Narzędzia → Ustawienia serwera WebSocket i skopiuj port oraz hasło.</p><p>{obs?.detail}</p>
   <form className="alert-form" onSubmit={connect}><label>Port (127.0.0.1)<input type="number" min={1} max={65535} required value={port} onChange={e=>setPort(Number(e.target.value))}/></label><label>Hasło WebSocket<input type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="alert-actions"><Button variant="primary" type="submit" disabled={busy}>Połącz</Button><Button disabled={busy||!obs?.configured} onClick={()=>action({type:'disconnect'},'Rozłączono i usunięto zapisane hasło.')}>Rozłącz</Button></div></form>
  </Panel>
  <details className="advanced-integrations"><summary>Zaawansowane sterowanie OBS i PSSA</summary>
  <Panel title="Sceny i źródła" detail="Zmień aktywną scenę OBS lub przeładuj wyłącznie nakładki PSSA.">
   <label className="alert-form">Scena programu<select className="queue-select" disabled={busy||obs?.phase!=='connected'||!obs.scenes.length} value={obs?.scene??''} onChange={e=>action({type:'scene',name:e.target.value},'Zmieniono scenę programu.')}>{!obs?.scene&&<option value="">Brak sceny</option>}{obs?.scenes.map(name=><option key={name}>{name}</option>)}</select></label>
   <div className="alert-actions"><Button disabled={busy||obs?.phase!=='connected'} onClick={()=>action({type:'refresh'},'Odświeżono')}>Odśwież nakładki PSSA</Button></div>
  </Panel>
  <Panel title="Telemetria OBS" action={<Status tone={obs?.metrics?'ready':'neutral'}>{obs?.metrics?'Dane z OBS':'Brak danych'}</Status>}>
   <dl className="details"><dt>CPU</dt><dd>{obs?.metrics?.cpu==null?'—':obs.metrics.cpu.toFixed(1)+'%'}</dd><dt>RAM</dt><dd>{obs?.metrics?.memory==null?'—':obs.metrics.memory.toFixed(0)+' MB'}</dd><dt>FPS</dt><dd>{obs?.metrics?.fps==null?'—':obs.metrics.fps.toFixed(1)}</dd><dt>Pominięte renderowanie</dt><dd>{obs?.metrics?.renderSkipped??'—'}</dd><dt>Pominięte wyjście</dt><dd>{obs?.metrics?.outputSkipped??'—'}</dd><dt>Transmisja</dt><dd>{obs?.metrics?(obs.metrics.streaming?'Aktywna':'Nieaktywna'):'—'}</dd><dt>Nagrywanie</dt><dd>{obs?.metrics?(obs.metrics.recording?'Aktywne':'Nieaktywne'):'—'}</dd></dl>
  </Panel>
  <Panel title="PSSA Agent" action={<Status tone={agent?.online?'ready':'neutral'}>{agent?.online?'Aktywny':'Nieaktywny'}</Status>}>
   <p>Opcjonalny pomocnik działający w tle. Pozwala uruchamiać, zamykać i restartować PSSA z panelu OBS. Nie jest wymagany do alertów.</p>
   <div className="alert-actions"><Button disabled={busy||agent?.online} onClick={()=>agentAction('enable')}>Uruchom Agent</Button><Button disabled={busy} onClick={()=>agentAction(agent?.startup?'startup-off':'startup-on')}>{agent?.startup?'Wyłącz autostart Windows':'Włącz autostart Windows'}</Button><Button disabled={busy||!agent?.online} onClick={()=>agentAction(agent?.autoLaunch?'auto-off':'auto-on')}>{agent?.autoLaunch?'Wyłącz start z OBS':'Włącz start z OBS'}</Button></div>
   <label className="alert-form">Adres panelu OBS (prywatny)<input readOnly value={agent?.online?agent.dockUrl:''} onFocus={e=>e.target.select()}/></label><p>OBS → Panele → Własne panele przeglądarkowe. Dodaj nazwę PSSA Control i wklej pełny adres. Nie udostępniaj adresu ani klucza.</p><p>{agent?.detail}</p>
  </Panel>
  </details>
  {message&&<p role="status">{message}</p>}
 </>
}
