import {useLocale} from '../i18n'
import {localizeMessage} from '../../../shared/messages'
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
 const {t:tr,region}=useLocale()
 const [port,setPort]=useState(4455),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{if(obs?.port)setPort(obs.port)},[obs?.port])
 async function run(fn:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{const v=await fn();setMessage(success==='obs.refreshed'&&typeof v==='number'?tr(success,{count:v}):tr(success))}catch{setMessage(tr("obs.failed"))}finally{setBusy(false)}}
 const action=(cmd:ObsAction,success:string)=>void run(()=>window.pssa.obsAction(cmd),success)
 const agentAction=(cmd:AgentAction)=>void run(()=>window.pssa.agentAction(cmd),"agent.accepted")
 const connect=(e:FormEvent)=>{e.preventDefault();const secret=password;setPassword('');action({type:'connect',port,password:secret},"obs.connecting")}
 return <>
  <Panel title={tr("obs.title")} action={<Status tone={obs?.phase==='connected'?'ready':obs?.phase==='error'?'warning':'neutral'}>{tr("obs.phase."+(obs?.phase??"offline"))}</Status>}>
   <p>{tr("obs.detail")}</p><p>{localizeMessage(tr,obs?.detail??"")}</p>
   <form className="alert-form" onSubmit={connect}><label>{tr("obs.port")}<input type="number" min={1} max={65535} required value={port} onChange={e=>setPort(Number(e.target.value))}/></label><label>{tr("obs.password")}<input type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="alert-actions"><Button variant="primary" type="submit" disabled={busy}>{tr("obs.connect")}</Button><Button disabled={busy||!obs?.configured} onClick={()=>action({type:'disconnect'},"obs.disconnected")}>{tr("obs.disconnect")}</Button></div></form>
  </Panel>
  <details className="advanced-integrations"><summary>{tr("obs.advanced")}</summary>
  <Panel title={tr("obs.scenes")} detail={tr("obs.scenesDetail")}>
   <label className="alert-form">{tr("obs.scene")}<select className="queue-select" disabled={busy||obs?.phase!=='connected'||!obs.scenes.length} value={obs?.scene??''} onChange={e=>action({type:'scene',name:e.target.value},"obs.sceneChanged")}>{!obs?.scene&&<option value="">{tr("obs.noScene")}</option>}{obs?.scenes.map(name=><option key={name}>{name}</option>)}</select></label>
   <div className="alert-actions"><Button disabled={busy||obs?.phase!=='connected'} onClick={()=>action({type:'refresh'},'obs.refreshed')}>{tr("obs.refresh")}</Button></div>
  </Panel>
  <Panel title={tr("obs.telemetry")} action={<Status tone={obs?.metrics?'ready':'neutral'}>{obs?.metrics?tr("obs.metrics"):tr("analytics.noData")}</Status>}>
   <dl className="details"><dt>CPU</dt><dd>{obs?.metrics?.cpu==null?'—':obs.metrics.cpu.toLocaleString(region,{minimumFractionDigits:1,maximumFractionDigits:1})+'%'}</dd><dt>RAM</dt><dd>{obs?.metrics?.memory==null?'—':obs.metrics.memory.toLocaleString(region,{maximumFractionDigits:0})+' MB'}</dd><dt>FPS</dt><dd>{obs?.metrics?.fps==null?'—':obs.metrics.fps.toLocaleString(region,{minimumFractionDigits:1,maximumFractionDigits:1})}</dd><dt>{tr("obs.renderSkipped")}</dt><dd>{obs?.metrics?.renderSkipped??'—'}</dd><dt>{tr("obs.outputSkipped")}</dt><dd>{obs?.metrics?.outputSkipped??'—'}</dd><dt>{tr("obs.streaming")}</dt><dd>{obs?.metrics?(obs.metrics.streaming?tr("obs.activeStream"):tr("obs.inactiveStream")):'—'}</dd><dt>{tr("obs.recording")}</dt><dd>{obs?.metrics?(obs.metrics.recording?tr("obs.activeRecording"):tr("obs.inactiveRecording")):'—'}</dd></dl>
  </Panel>
  <Panel title="PSSA Agent" action={<Status tone={agent?.online?'ready':'neutral'}>{agent?.online?tr("agent.active"):tr("agent.inactive")}</Status>}>
   <p>{tr("agent.detail")}</p>
   <div className="alert-actions"><Button disabled={busy||agent?.online} onClick={()=>agentAction('enable')}>{tr("agent.enable")}</Button><Button disabled={busy} onClick={()=>agentAction(agent?.startup?'startup-off':'startup-on')}>{agent?.startup?tr("agent.startupOff"):tr("agent.startupOn")}</Button><Button disabled={busy||!agent?.online} onClick={()=>agentAction(agent?.autoLaunch?'auto-off':'auto-on')}>{agent?.autoLaunch?tr("agent.autoOff"):tr("agent.autoOn")}</Button></div>
   <label className="alert-form">{tr("agent.privateUrl")}<input readOnly value={agent?.online?agent.dockUrl:''} onFocus={e=>e.target.select()}/></label><p>{tr("agent.urlDetail")}</p><p>{localizeMessage(tr,agent?.detail??"")}</p>
  </Panel>
  </details>
  {message&&<p role="status">{message}</p>}
 </>
}
