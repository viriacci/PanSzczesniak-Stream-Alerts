import {useEffect,useState} from 'react'
import type {LiveState,Category} from '../../../shared/live'
import type {ObsState} from '../../../shared/obs'
import {Button,Panel,Status,Empty} from '../components/ui'
export function useLive(){
 const [state,setState]=useState<LiveState>()
 useEffect(()=>{let active=true,busy=false;const poll=async()=>{if(busy)return;busy=true;try{const v=await window.pssa.liveState();if(active)setState(v)}catch{if(active)setState(undefined)}finally{busy=false}};void poll();const t=window.setInterval(poll,2000);return()=>{active=false;window.clearInterval(t)}},[])
 return state
}
function duration(ms:number){const s=Math.max(0,Math.floor(ms/1000));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':')}
function ViewerChart({state}:{state:LiveState}){
 const points=state.points
 if(!points.length)return <Empty title="Brak próbek oglądalności">Dane pojawią się po potwierdzeniu transmisji przez Twitch.</Empty>
 const width=640,height=175,left=42,right=12,top=10,bottom=25
 const min=points[0]!.at,max=Math.max(min+30000,points.at(-1)!.at),peak=Math.max(1,...points.map(p=>p.viewers))
 const x=(at:number)=>left+(at-min)/(max-min)*(width-left-right),y=(v:number)=>height-bottom-v/peak*(height-top-bottom)
 const segments:typeof points[]=[]
 for(const p of points){const segment=segments.at(-1);if(!segment||p.at-segment.at(-1)!.at>90000)segments.push([p]);else segment.push(p)}
 return <div className="live-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Wykres obserwowanej oglądalności; przerwy oznaczają brak próbek">
 {Array.from({length:5},(_,i)=>peak*i/4).map((v,i)=><g key={i}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="#303036"/><text x={left-8} y={y(v)+4} textAnchor="end" fill="#a2a1ab" fontSize="10">{Math.round(v)}</text></g>)}
 {segments.map((segment,i)=><g key={i}><polyline fill="none" stroke="#e3c048" strokeWidth="2" points={segment.map(p=>x(p.at)+','+y(p.viewers)).join(' ')}/>{segment.length===1&&<circle cx={x(segment[0]!.at)} cy={y(segment[0]!.viewers)} r="3" fill="#e3c048"/>}</g>)}
 <text x={left} y={height-5} fill="#a2a1ab" fontSize="11">{new Date(min).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</text><text x={width-right} y={height-5} textAnchor="end" fill="#a2a1ab" fontSize="11">{new Date(points.at(-1)!.at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</text>
 </svg><p className="muted">Średnia z rzeczywistych próbek (co około 30 s), nie oficjalna analityka Twitch. Widok ostatnich maks. 480 próbek. Luki nie są interpolowane.</p></div>
}
export function LiveCenter({state,obs,pending,onIntegrations}:{state?:LiveState;obs?:ObsState;pending:number|null;onIntegrations:()=>void}){
 const [title,setTitle]=useState(''),[category,setCategory]=useState<Category>({id:'',name:''}),[query,setQuery]=useState(''),[results,setResults]=useState<Category[]>([]),[editing,setEditing]=useState(false),[marker,setMarker]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{if(!editing){setTitle(state?.title??'');setCategory({id:state?.categoryId??'',name:state?.category??''})}},[state?.title,state?.categoryId,state?.category,editing])
 useEffect(()=>{setEditing(false);setResults([]);setQuery('');setMarker('')},[state?.channel])
 async function run(action:()=>Promise<unknown>,success:string){if(busy)return;setBusy(true);setNotice('');try{await action();setNotice(success)}catch{setNotice('Operacja nie powiodła się. Sprawdź uprawnienia i połączenie.')}finally{setBusy(false)}}
 const live=state?.phase==='live',m=obs?.metrics,c=state?.counts
 const tiles=[['Widzowie',state?.viewers??'—'],['Średnia z próbek',state?.average==null?'—':state.average.toFixed(1)],['Szczyt z próbek',state?.peak??'—'],['Czas transmisji',live&&state.startedAt!==null?duration(Date.now()-state.startedAt):'—'],['Alerty w kolejce',pending??'—'],['Bitrate OBS',state?.bitrate==null?'—':state.bitrate+' kb/s']]
 return <>
 <section className="hero"><div><span className="eyebrow">STREAM CONTROL / 06</span><h2>Live Center</h2><p>{state?.channel?state.channel+' · '+(state.title||'Brak tytułu'):'Podłącz Twitch, aby monitorować transmisję.'}</p><div className="alert-actions"><Button variant="primary" onClick={onIntegrations}>Integracje</Button><Button disabled={busy||!state?.channel} onClick={()=>void run(()=>window.pssa.liveAction({type:'refresh'}),'Odświeżono dane.')}>Odśwież dane</Button></div></div><Status tone={live?'ready':state?.phase==='unknown'?'warning':'neutral'}>{live?'LIVE':state?.phase==='offline'?'OFFLINE':state?.phase==='unknown'?'Brak aktualnych danych':'Niepołączony'}</Status></section>
 {state?.detail&&<p className="muted">{state.detail}</p>}
 <div className="metric-grid">{tiles.map(([label,value])=><section className="metric" key={label}><header>{label}</header><strong>{value}</strong></section>)}</div>
 <Panel title="Oglądalność" detail={state?.lastSampleAt?'Ostatni odczyt: '+new Date(state.lastSampleAt).toLocaleTimeString('pl-PL'):'Oczekiwanie na Twitch'}>{state?<ViewerChart state={state}/>:<Empty title="Brak danych">Połącz konto Twitch.</Empty>}</Panel>
 <Panel title="Aktywność sesji" detail="Zliczane lokalnie odebrane zdarzenia; nie jest to pełna historia Twitcha."><div className="metric-grid">{[['Follow',c?.follows],['Suby',c?.subs],['Prime',c?.prime],['Resuby',c?.resubs],['Gift suby',c?.gifts],['Bits',c?.bits],['Raids',c?.raids],['Widzowie z raidów',c?.raidViewers],['Nagrody',c?.rewards],['Punkty kanału',c?.points],['Wiadomości',c?.messages],['Aktywni rozmówcy',c?.chatters]].map(([label,value])=><section className="metric" key={label}><header>{label}</header><strong>{value??'—'}</strong></section>)}</div></Panel>
 <Panel title="OBS na żywo"><dl className="details"><dt>CPU</dt><dd>{m?.cpu==null?'—':m.cpu.toFixed(1)+'%'}</dd><dt>RAM</dt><dd>{m?.memory==null?'—':m.memory.toFixed(0)+' MB'}</dd><dt>FPS</dt><dd>{m?.fps==null?'—':m.fps.toFixed(1)}</dd><dt>Pominięte renderowanie</dt><dd>{m?.renderSkipped??'—'}</dd><dt>Pominięte wyjście</dt><dd>{m?.outputSkipped??'—'}</dd><dt>Scena</dt><dd>{obs?.scene||'—'}</dd></dl></Panel>
 <Panel title="Informacje o transmisji" action={<Status>{state?.canManage?'Edycja dostępna':'Wymaga uprawnienia'}</Status>}>
 <p className="muted">Do edycji i markerów wymagane jest ponowne zalogowanie z uprawnieniem channel:manage:broadcast.</p>
 <form className="alert-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await window.pssa.liveAction({type:'update',title,categoryId:category.id});setEditing(false)},'Zapisano informacje na Twitchu.')}}><label>Tytuł<input value={title} maxLength={140} required onChange={e=>{setEditing(true);setTitle(e.target.value)}} disabled={!state?.canManage||busy}/></label><label>Kategoria: {category.name||'Brak'}<input value={query} placeholder="Wyszukaj kategorię" onChange={e=>setQuery(e.target.value)} disabled={!state?.channel||busy}/></label><Button disabled={busy||!state?.channel||query.trim().length<2} onClick={()=>void run(async()=>{setResults(await window.pssa.liveAction({type:'search',query})??[])},'Wyszukiwanie zakończone.')}>Szukaj</Button>{results.map(v=><Button key={v.id} disabled={!state?.canManage||busy} onClick={()=>{setEditing(true);setCategory(v);setResults([])}}>{v.name}</Button>)}<Button variant="primary" type="submit" disabled={!state?.canManage||busy||!editing||!title.trim()}>Zapisz na Twitchu</Button></form>
 <div className="alert-form"><label>Marker transmisji<input value={marker} maxLength={140} onChange={e=>setMarker(e.target.value)} disabled={!live||!state?.canManage||busy}/></label><Button disabled={!live||!state?.canManage||busy} onClick={()=>void run(async()=>{await window.pssa.liveAction({type:'marker',description:marker});setMarker('')},'Utworzono marker.')}>Dodaj marker Twitch</Button></div>
 {notice&&<p role="status">{notice}</p>}</Panel>
 </>
}
