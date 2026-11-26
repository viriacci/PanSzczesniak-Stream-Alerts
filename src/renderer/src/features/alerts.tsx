import {useLocale} from '../i18n'
import {assignRuleMedia,ruleMedia} from '../../../shared/scene-legacy'
import type {Asset} from '../../../shared/library'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import {defaultRule,alertVariableHints,type AlertRule,type AlertState} from '../../../shared/alerts'
import {Button,Panel,Status} from '../components/ui'
import {Icon,type IconName} from '../components/icons'
import type {Reward} from '../../../shared/alerts'
const standardTypes=new Set(["raid","follow","sub","prime_sub","resub","gift","mass_gift","bits"])
export function useAlerts(slow=false){
 const [state,setState]=useState<AlertState>()
 useEffect(()=>{let active=true;let running=false;let revision=-1
  const poll=async()=>{if(running||document.hidden)return;running=true;try{const v=await window.pssa.alertPoll(revision);if(active){revision=v.revision;if(v.state)setState(v.state)}}catch{revision=-1;if(active)setState(undefined)}finally{running=false}}
  void poll();const t=window.setInterval(poll,slow?5000:1500);return()=>{active=false;window.clearInterval(t)}
 },[slow])
 return state
}
export function TwitchPage({state}:{state?:AlertState}){
 const {t:tr}=useLocale()
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const t=state?.twitch
 async function run(action:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{await action();if(success)setMessage(success)}catch{setMessage(tr("twitch.error"))}finally{setBusy(false)}}
 return <>
  <Panel title="Twitch" action={<Status tone={t?.phase==='connected'?'ready':t?.phase==='error'?'warning':'neutral'}>{t?.phase??tr("shell.initializing")}</Status>}>
   <p>{t?.login?tr("twitch.channel",{name:t.login}):tr("twitch.signIn")}</p><p>{t?.detail}</p>
   <div className="alert-actions"><Button variant="primary" disabled={busy||!t?.publicLogin||t.phase==='authorizing'} onClick={()=>void run(()=>window.pssa.twitchDeviceLogin(),tr("twitch.authorized"))}>{tr("twitch.login")}</Button><Button disabled={busy||!t?.login} onClick={()=>void run(()=>window.pssa.twitchConnect(),tr("twitch.reconnecting"))}>{tr("twitch.reconnect")}</Button><Button disabled={!t?.login&&t?.phase!=='authorizing'} onClick={()=>void window.pssa.twitchLogout().catch(()=>setMessage(tr("twitch.cancelError")))}>{tr("twitch.logout")}</Button></div>
   {t?.deviceCode&&<p>{tr("twitch.code")} <strong>{t.deviceCode}</strong>. {tr("twitch.codeDetail")}</p>}
   {t&&!t.publicLogin&&<p className="muted">{tr("twitch.pending")}</p>}

  </Panel>
  <Panel title={tr("twitch.overlay")} detail={tr("twitch.overlayDetail")}><label className="alert-form">{tr("twitch.localUrl")}<input readOnly value={t?.overlayUrl??''} onFocus={e=>e.target.select()}/></label></Panel>
  {message&&<p role="status">{message}</p>}
 </>
}
export function AdvancedTwitchLogin({state}:{state?:AlertState}){
 const {t:tr}=useLocale()
 const [id,setId]=useState(''),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const t=state?.twitch
 function login(e:FormEvent){e.preventDefault();const value=secret;setSecret('');setBusy(true);setMessage('');void window.pssa.twitchLogin(id.trim(),value).then(()=>setMessage(tr("twitch.authorized"))).catch(()=>setMessage(tr("twitch.loginError"))).finally(()=>setBusy(false))}
 return <><p>{tr("twitch.customLogin")}</p><form className="alert-form" onSubmit={login}><label>Client ID<input required autoComplete="off" value={id} onChange={e=>setId(e.target.value)}/></label><label>Client Secret<input type="password" required autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}/></label><div className="alert-actions"><Button type="submit" variant="primary" disabled={busy||t?.phase==='authorizing'}>{tr("twitch.connect")}</Button></div></form><Button disabled={t?.phase!=='authorizing'} onClick={()=>void window.pssa.twitchLogout().catch(()=>setMessage(tr("twitch.cancelError")))}>{tr("twitch.cancelLogin")}</Button>{message&&<p role="status">{message}</p>}</>
}
export function MigrationPanel(){
 const {t:tr}=useLocale()
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 return <Panel title={tr("migration.title")}><p>{tr("migration.detail")}</p><Button disabled={busy} onClick={()=>{setBusy(true);void window.pssa.importLegacy().then(r=>setMessage(r?tr("migration.result",{count:r.count})+" "+r.warnings.join("; "):tr("runtime.cancelled"))).catch(()=>setMessage(tr("migration.error"))).finally(()=>setBusy(false))}}>{tr("migration.import")}</Button>{message&&<p role="status">{message}</p>}</Panel>
}
function RuleEditor({initial,onClose,profile}:{initial:AlertRule;onClose:()=>void;profile:string}){
 const {t:tr}=useLocale()
 const [rule,setRule]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [assets,setAssets]=useState<Asset[]>([]),[libraryError,setLibraryError]=useState(false)
 async function refreshAssets(){try{setAssets((await window.pssa.libraryState()).assets);setLibraryError(false)}catch{setLibraryError(true)}}
 useEffect(()=>{void refreshAssets()},[])
 const dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const d=dialog.current;const previous=document.activeElement;d?.showModal();return()=>{if(d?.open)d.close();if(previous instanceof HTMLElement)previous.focus()}},[])
 const patch=(p:Partial<AlertRule>)=>setRule(v=>({...v,...p}))
 async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action()}catch{setMessage(tr("alert.error"))}finally{setBusy(false)}}
 return <dialog ref={dialog} className="rule-dialog" aria-labelledby="rule-dialog-title" onCancel={e=>{e.preventDefault();if(!busy)onClose()}}><header className="rule-dialog-header"><h2 id="rule-dialog-title">{(standardTypes.has(rule.key)?tr("alert.type."+rule.key):rule.title)}</h2><Button disabled={busy} onClick={onClose} aria-label={tr("alert.closeEditor")}><Icon name="close"/></Button></header><form className="alert-form rule-dialog-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await window.pssa.saveAlert(rule,profile);setMessage(tr("common.saved"))})}}>
  <div className="rule-dialog-body"><label className="alert-checkbox"><input type="checkbox" checked={rule.enabled} onChange={e=>patch({enabled:e.target.checked})}/> {tr("alert.enable")}</label>
  <label>{tr("alert.text")}<input maxLength={500} value={rule.template} onChange={e=>patch({template:e.target.value})}/></label><p className="muted" data-variable-hints>{tr("alert.variables")} {alertVariableHints(rule.key).map(v=>'{'+v.key+'} ('+tr('alert.hint.'+(({user:rule.key==='raid'?'raidUser':rule.key==='follow'?'followUser':['sub','prime_sub','resub'].includes(rule.key)?'subUser':['gift','mass_gift','bits'].includes(rule.key)?'donor':rule.key.startsWith('reward:')?'rewardUser':'user'} as Record<string,string>)[v.key]??v.key))+')').join(', ')}</p>
  {rule.scene?<p className="muted">{tr("alert.sceneDetail")}</p>:<label>{tr("alert.duration")}<input type="number" min={1} max={120} step={0.5} value={rule.duration} onChange={e=>patch({duration:Number(e.target.value)})}/></label>}
  <div className="queue-fields">{([{key:'priority',label:"queue.priority",max:10},{key:'cooldown',label:"alert.cooldown",max:3600},{key:'volume',label:"alert.volume",max:100},{key:'minCount',label:"alert.minimum",max:1000000}] as const).map(field=><label key={field.key}>{tr(field.label)}<input type="number" min={0} max={field.max} step={1} value={rule[field.key]} onChange={e=>patch({[field.key]:Number(e.target.value)})}/></label>)}</div>
  {(['image','audio'] as const).map(kind=>{const id=ruleMedia(rule,kind),choices=assets.filter(a=>a.kind===kind&&!a.missing),blocked=!!rule.scene&&!rule.scene.layers.some(l=>l.kind===kind&&!l.locked)&&(rule.scene.layers.some(l=>l.kind===kind)||rule.scene.layers.length>=32);return <div className="alert-form" key={kind}><h3>{kind==='image'?tr("alert.image"):tr("alert.audio")}</h3><label>{tr(kind==="image"?"alert.libraryImage":"alert.libraryAudio")}<select aria-label={tr(kind==="image"?"alert.libraryImageAria":"alert.libraryAudioAria")} value={id} disabled={busy||blocked} onChange={e=>{try{setRule(assignRuleMedia(rule,kind,e.target.value))}catch{setMessage(tr("alert.layerError"))}}}><option value="">{tr("common.none")}</option>{id&&!choices.some(a=>a.id===id)&&<option value={id}>{assets.find(a=>a.id===id)?.name??tr("alert.currentFile")}</option>}{choices.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><div className="alert-actions"><Button disabled={busy||blocked} onClick={()=>void run(async()=>{const file=await window.pssa.chooseMedia(kind);if(file){setRule(assignRuleMedia(rule,kind,file));await refreshAssets()}})}>{tr("alert.chooseDisk")}</Button><Button disabled={busy||blocked||!id} onClick={()=>setRule(assignRuleMedia(rule,kind,''))}>{tr("nav.remove")}</Button></div>{blocked&&<p className="muted">{tr("alert.locked")}</p>}</div>})}
  <Button disabled={busy} onClick={()=>void refreshAssets()}>{tr("alert.refreshLibrary")}</Button>{libraryError&&<p role="status">{tr("alert.libraryError")}</p>}
  </div><footer className="rule-dialog-footer"><div className="alert-actions"><Button type="submit" variant="primary" disabled={busy}>{tr("common.save")}</Button><Button disabled={busy} onClick={()=>void run(async()=>{await window.pssa.saveAlert(rule,profile);const n=await window.pssa.testAlert(rule.key);setMessage(n?tr("alert.testQueued"):tr("alert.full"))})}>{tr("alert.saveTest")}</Button></div>
  {message&&<p role="status">{message}</p>}</footer>
 </form></dialog>
}
const tileIcons:Record<string,IconName>={raid:'users',follow:'bell',sub:'shield',prime_sub:'bolt',resub:'clock',gift:'gift',mass_gift:'layers',bits:'bolt'}
function RewardArt({reward,icon}:{reward?:Reward;icon:IconName}){
 const [failed,setFailed]=useState(false)
 useEffect(()=>setFailed(false),[reward?.image])
 return <span className="rule-tile-art" style={reward?.color?{backgroundColor:reward.color}:undefined}>{reward?.image&&!failed?<img src={reward.image} referrerPolicy="no-referrer" alt="" onError={()=>setFailed(true)} loading="lazy"/>:<Icon name={icon} size={30}/>}</span>
}
export function AlertsPage({state,rewards=false}:{state?:AlertState;rewards?:boolean}){
 const {t:tr,language}=useLocale()
 const [selected,setSelected]=useState<{rule:AlertRule;profile:string}>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const rules=state?.rules??[]
 const rewardMap=new Map((state?.rewards??[]).map(r=>['reward:'+r.id,r]))
 const list=rewards?[...rules.filter(r=>r.key.startsWith('reward:')),...(state?.rewards??[]).filter(x=>!rules.some(r=>r.key==='reward:'+x.id)).map(x=>defaultRule('reward:'+x.id,x.title))]:rules.filter(r=>!r.key.startsWith('reward:'))

 async function sync(){setBusy(true);try{await window.pssa.syncRewards();setMessage(tr("rewards.synced"))}catch{setMessage(tr("rewards.error"))}finally{setBusy(false)}}
 return <>{rewards&&<Panel tourId="rewards-sync" title={tr("rewards.title")} action={<Button disabled={busy||!state?.twitch.login} onClick={()=>void sync()}>{tr("rewards.sync")}</Button>}><p>{message||tr("rewards.detail")}</p></Panel>}<Panel tourId={rewards?'rewards-list':'alerts-list'} title={rewards?tr("rewards.assignments"):tr("alert.types")}>{!list.length&&<p>{tr("alert.noRules")}</p>}<div className="rule-grid" data-page={rewards?'rewards':'alerts'}>{list.map(rule=>{const reward=rewardMap.get(rule.key);return <button data-tour={rewards?'rewards-tile':'alerts-tile'} className="rule-tile" key={rule.key} type="button" onClick={()=>setSelected({rule,profile:state?.profileId??'default'})}><RewardArt reward={reward} icon={rewards?'gift':tileIcons[rule.key]??'bell'}/><strong>{reward?.title??(standardTypes.has(rule.key)?tr("alert.type."+rule.key):rule.title)}</strong>{reward&&<small>{tr("reward.points",{count:reward.cost.toLocaleString(language)})}</small>}<Status tone={rule.enabled?'ready':'neutral'}>{rule.enabled?tr("common.enabled"):tr("common.disabled")}</Status></button>})}</div></Panel>{selected&&<RuleEditor key={selected.rule.key} initial={selected.rule} profile={selected.profile} onClose={()=>setSelected(undefined)}/>}</>
}
