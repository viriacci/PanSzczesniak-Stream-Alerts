import {useLocale} from '../i18n'
import {regionalNumber,regionalDate} from '../../../shared/i18n'
import {useEffect,useState} from 'react'
import type {AnalyticsFilter,AnalyticsReport,PeriodStats} from '../../../shared/analytics'
import {DAY} from '../../../shared/analytics'
import {Button,Panel,Empty} from '../components/ui'
const date=(n:number)=>new Date(n).toISOString().slice(0,10)
const today=()=>Math.floor(Date.now()/DAY)*DAY
function Trend({stats}:{stats:PeriodStats}){
 const {t:tr,region}=useLocale()
 const points=stats.days,peak=Math.max(1,...points.map(p=>p.peak??0)),x=(i:number)=>35+i*600/Math.max(1,points.length-1),y=(v:number)=>156-v/peak*140
 const segments:{i:number;v:number}[][]=[]
 points.forEach((p,i)=>{if(p.average===null)return;const last=segments.at(-1);if(!last||last.at(-1)!.i!==i-1)segments.push([{i,v:p.average}]);else last.push({i,v:p.average})})
 return <svg viewBox="0 0 650 183" className="analytics-chart" role="img" aria-label={tr("analytics.chartLabel")}>
 {[0,.25,.5,.75,1].map(v=><g key={v}><line x1="35" x2="635" y1={y(peak*v)} y2={y(peak*v)} stroke="var(--line)"/><text x="28" y={y(peak*v)+3} textAnchor="end" fill="#999" fontSize="10">{regionalNumber(region,Math.round(peak*v))}</text></g>)}
 {segments.map((s,i)=><g key={i}><polyline fill="none" stroke="var(--gold)" strokeWidth="2" points={s.map(p=>x(p.i)+','+y(p.v)).join(' ')}/>{s.length===1&&<circle cx={x(s[0]!.i)} cy={y(s[0]!.v)} r="3" fill="var(--gold)"/>}</g>)}
 {points.filter((_,i)=>i===0||i===points.length-1||i===Math.floor(points.length/2)).map(p=><text key={p.day} x={x(points.indexOf(p))} y="174" textAnchor={p===points[0]?'start':p===points.at(-1)?'end':'middle'} fill="#aaa" fontSize="11">{regionalDate(region,p.day,{month:"2-digit",day:"2-digit",timeZone:"UTC"})}</text>)}</svg>
}
function Heatmap({stats}:{stats:PeriodStats}){
 const {t:tr,region}=useLocale()
 const fmt=(n:number)=>regionalNumber(region,n,{maximumFractionDigits:1})
 const peak=Math.max(1,...stats.heatmap.map(x=>x.average))
 const cells=new Map(stats.heatmap.map(x=>[x.day+':'+x.hour,x]))
 return <div className="heat-scroll"><div className="heatmap"><span/>{Array.from({length:24},(_,h)=><span key={h}>{h%3===0?String(h).padStart(2,'0'):''}</span>)}{Array.from({length:7},(_,i)=>regionalDate(region,Date.UTC(2024,0,1+i),{weekday:'short',timeZone:'UTC'})).flatMap((d,i)=>[<span key={d}>{d}</span>,...Array.from({length:24},(_,h)=>{const p=cells.get(i+':'+h);return <span key={i+':'+h} className="heat-cell" style={{background:p?'color-mix(in srgb, var(--brand-fill, var(--gold)) '+Math.round((.12+.88*p.average/peak)*100)+'%, var(--bg))':'var(--raised)'}} title={p?tr("analytics.heatCell",{day:d,hour:h,average:fmt(p.average),count:p.samples}):d+" "+h+":00 UTC · "+tr("analytics.noData")}/>})])}</div></div>
}
export function AnalyticsPage(){
 const {t:tr,region}=useLocale()
 const fmt=(n:number|null)=>regionalNumber(region,n,{maximumFractionDigits:1})
 const hours=(n:number|null)=>n===null?"—":fmt(n/3600000)+" h"
 const displayDate=(n:number|string)=>regionalDate(region,n,{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"UTC"})
 const [channels,setChannels]=useState<string[]>([]),[channel,setChannel]=useState(''),[from,setFrom]=useState(date(today()-29*DAY)),[to,setTo]=useState(date(today())),[category,setCategory]=useState(''),[source,setSource]=useState<AnalyticsFilter['source']>('all'),[data,setData]=useState<AnalyticsReport>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function loadChannels(){const list=await window.pssa.analyticsChannels();setChannels(list);setChannel(c=>list.includes(c)?c:list[0]??'')}
 useEffect(()=>{void loadChannels().catch(()=>setNotice(tr("analytics.channelsError")))},[])
 const filter=():AnalyticsFilter=>({channel,from:Date.parse(from+'T00:00:00Z'),to:Date.parse(to+'T00:00:00Z')+DAY,category,source})
 async function run(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn()}catch{setNotice(tr("analytics.error"))}finally{setBusy(false)}}
 function preset(n:number){setFrom(date(today()-(n-1)*DAY));setTo(date(today()))}
 const same=data&&JSON.stringify(data.filter)===JSON.stringify(filter()),s=same?data.current:undefined,p=same?data.previous:undefined
 const metric=(name:string,value:string,previous:string)=> <section className="metric" key={name}><header>{name}</header><strong>{value}</strong><small className="muted">{tr("analytics.previous",{value:previous})}</small></section>
 return <>
 <Panel tourId="analytics-filter" title={tr("analytics.historyTitle")}>
 <div className="alert-actions">{[7,14,30,180].map(n=><Button key={n} disabled={busy} onClick={()=>preset(n)}>{tr("analytics.days",{count:n})}</Button>)}</div>
 <form className="alert-form" onSubmit={e=>{e.preventDefault();void run(async()=>setData(await window.pssa.analyticsReport(filter())))}}>
 <div className="queue-fields" data-tour="analytics-inputs"><label>{tr("analytics.channel")}<select value={channel} onChange={e=>{setChannel(e.target.value);setCategory('')}}>{channels.map(c=><option key={c}>{c}</option>)}</select></label><label>{tr("analytics.from")}<input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label>{tr("analytics.to")}<input type="date" required value={to} onChange={e=>setTo(e.target.value)}/></label><label>{tr("analytics.source")}<select value={source} onChange={e=>{setSource(e.target.value as AnalyticsFilter['source']);setCategory('')}}><option value="all">{tr("analytics.allSources")}</option><option value="local">PSSA / Twitch</option><option value="imported">{tr("analytics.imported")}</option></select></label><label>{tr("analytics.category")}<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{tr("library.all")}</option>{data?.filter.channel===channel&&data.categories.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}</select></label></div>
 <div className="alert-actions" data-tour="analytics-report"><Button type="submit" variant="primary" disabled={busy||!channel}>{tr("analytics.report")}</Button>{(['csv','json'] as const).map(format=><Button key={format} disabled={busy||!same} onClick={()=>void run(async()=>{if(await window.pssa.analyticsExport(filter(),format))setNotice(tr("analytics.exported",{format:format.toUpperCase()}))})}>{tr("analytics.export",{format:format.toUpperCase()})}</Button>)}</div></form>
 {notice&&<p role="status">{notice}</p>}</Panel>
 {!s||!p?<Empty title={tr("analytics.selectRange")}>{tr("analytics.selectDetail")}</Empty>:<>
 <Panel tourId="analytics-results" title={tr("analytics.compare")} detail={tr("analytics.previousRange",{from:displayDate(data!.filter.from-(data!.filter.to-data!.filter.from)),to:displayDate(data!.filter.from-DAY)})}>
 <div className="metric-grid">{metric(tr("analytics.sessions"),fmt(s.sessions),fmt(p.sessions))}{metric(tr("analytics.duration"),hours(s.duration),hours(p.duration))}{metric(tr("analytics.avgDuration"),hours(s.averageDuration),hours(p.averageDuration))}{metric(tr("analytics.avgViewers"),fmt(s.average),fmt(p.average))}{metric(tr("analytics.peakSamples"),fmt(s.peak),fmt(p.peak))}{metric(tr("analytics.sampleCount"),fmt(s.samples),fmt(p.samples))}</div><p className="muted">{tr("analytics.sessionDetail",{local:s.localSessions,imported:s.importedSessions})}</p></Panel>
 <Panel title={tr("analytics.importSummary")}><div className="metric-grid">{metric(tr("analytics.weighted"),fmt(s.importedAverage),fmt(p.importedAverage))}{metric(tr("analytics.importPeak"),fmt(s.importedPeak),fmt(p.importedPeak))}{metric(tr("analytics.avgSessions"),fmt(s.importedAverageSessions),fmt(p.importedAverageSessions))}</div><p className="muted">{tr("analytics.importDetail")}</p></Panel>
 <Panel title={tr("analytics.trend")} detail={tr("analytics.trendDetail")}><Trend stats={s}/></Panel>
 <Panel title={tr("analytics.heatmap")} detail={tr("analytics.heatmapDetail")}><Heatmap stats={s}/></Panel>
 <Panel title={tr("analytics.activity")} detail={tr("analytics.activityDetail")}>
 {s.events?<div className="metric-grid">{([['follows','analytics.event.follows'],['subs','analytics.event.subs'],['prime','analytics.event.prime'],['resubs','analytics.event.resubs'],['gifts','analytics.event.gifts'],['bits','analytics.event.bits'],['raids','analytics.event.raids'],['raidViewers','analytics.event.raidViewers'],['rewards','analytics.event.rewards'],['points','analytics.event.points'],['messages','analytics.event.messages'],['chatters','analytics.event.chatters']] as const).map(([k,label])=>metric(tr(label),fmt(s.events![k]),fmt(p.events?.[k]??null)))}</div>:<p>{tr("analytics.activityEmpty")}</p>}<p className="muted">{tr("analytics.unassigned",{count:s.unassigned})}</p></Panel>
 <Panel title={tr("analytics.categories")}><div className="analytics-table"><table><thead><tr><th>{tr("analytics.category")}</th><th>{tr("analytics.samples")}</th><th>{tr("analytics.average")}</th><th>{tr("analytics.peak")}</th></tr></thead><tbody>{s.categories.map(c=><tr key={c.key}><td>{c.name}</td><td>{fmt(c.samples)}</td><td>{fmt(c.average)}</td><td>{fmt(c.peak)}</td></tr>)}</tbody></table></div></Panel>
 <Panel title={tr("analytics.best")} detail={tr("analytics.bestDetail")}>{s.best.map(x=><div className="setting-row" key={x.id}><div><h3>{x.title||x.category||x.externalId}</h3><p>{displayDate(x.startedAt)} · {tr("analytics.sampleDetail",{count:x.samples})}</p></div><strong>{fmt(x.average)}</strong></div>)}</Panel>
 <Panel tourId="analytics-history" title={tr("analytics.streamHistory")} detail={tr("analytics.historyDetail",{shown:data!.sessions.length,total:data!.sessionCount})}><div className="analytics-table"><table><thead><tr><th>{tr("analytics.utcDate")}</th><th>{tr("analytics.title")}</th><th>{tr("analytics.category")}</th><th>{tr("analytics.time")}</th><th>{tr("analytics.average")}</th><th>{tr("analytics.peak")}</th><th>{tr("analytics.source")}</th></tr></thead><tbody>{data!.sessions.map(x=><tr key={x.id}><td>{displayDate(x.startedAt)}</td><td>{x.title||'—'}</td><td>{x.category||'—'}</td><td>{hours(x.duration)}</td><td>{fmt(x.average)}</td><td>{fmt(x.peak)}</td><td>{x.provenance}</td></tr>)}</tbody></table></div></Panel></>}
 </>
}
