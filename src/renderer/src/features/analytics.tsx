import {useEffect,useState} from 'react'
import type {AnalyticsFilter,AnalyticsReport,PeriodStats} from '../../../shared/analytics'
import {DAY} from '../../../shared/analytics'
import {Button,Panel,Empty} from '../components/ui'
const date=(n:number)=>new Date(n).toISOString().slice(0,10)
const today=()=>Math.floor(Date.now()/DAY)*DAY
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('pl-PL',{maximumFractionDigits:1})
const hours=(n:number|null)=>n===null?'—':fmt(n/3600000)+' h'
function Trend({stats}:{stats:PeriodStats}){
 const points=stats.days,peak=Math.max(1,...points.map(p=>p.peak??0)),x=(i:number)=>35+i*600/Math.max(1,points.length-1),y=(v:number)=>156-v/peak*140
 const segments:{i:number;v:number}[][]=[]
 points.forEach((p,i)=>{if(p.average===null)return;const last=segments.at(-1);if(!last||last.at(-1)!.i!==i-1)segments.push([{i,v:p.average}]);else last.push({i,v:p.average})})
 return <svg viewBox="0 0 650 183" className="analytics-chart" role="img" aria-label="Średnia dzienna z lokalnych próbek widzów, luki oznaczają brak danych">
 {[0,.25,.5,.75,1].map(v=><g key={v}><line x1="35" x2="635" y1={y(peak*v)} y2={y(peak*v)} stroke="#303036"/><text x="28" y={y(peak*v)+3} textAnchor="end" fill="#999" fontSize="10">{Math.round(peak*v)}</text></g>)}
 {segments.map((s,i)=><g key={i}><polyline fill="none" stroke="#e3c048" strokeWidth="2" points={s.map(p=>x(p.i)+','+y(p.v)).join(' ')}/>{s.length===1&&<circle cx={x(s[0]!.i)} cy={y(s[0]!.v)} r="3" fill="#e3c048"/>}</g>)}
 {points.filter((_,i)=>i===0||i===points.length-1||i===Math.floor(points.length/2)).map(p=><text key={p.day} x={x(points.indexOf(p))} y="174" textAnchor={p===points[0]?'start':p===points.at(-1)?'end':'middle'} fill="#aaa" fontSize="11">{p.day.slice(5)}</text>)}</svg>
}
function Heatmap({stats}:{stats:PeriodStats}){
 const peak=Math.max(1,...stats.heatmap.map(x=>x.average))
 const cells=new Map(stats.heatmap.map(x=>[x.day+':'+x.hour,x]))
 return <div className="heat-scroll"><div className="heatmap"><span/>{Array.from({length:24},(_,h)=><span key={h}>{h%3===0?String(h).padStart(2,'0'):''}</span>)}{['Pon','Wt','Śr','Czw','Pt','Sob','Nd'].flatMap((d,i)=>[<span key={d}>{d}</span>,...Array.from({length:24},(_,h)=>{const p=cells.get(i+':'+h);return <span key={i+':'+h} className="heat-cell" style={{background:p?'rgba(227,192,72,'+(.12+.88*p.average/peak)+')':'#242428'}} title={d+' '+h+':00 UTC · '+(p?fmt(p.average)+' widzów / '+p.samples+' próbek':'Brak danych')}/>})])}</div></div>
}
export function AnalyticsPage(){
 const [channels,setChannels]=useState<string[]>([]),[channel,setChannel]=useState(''),[from,setFrom]=useState(date(today()-29*DAY)),[to,setTo]=useState(date(today())),[category,setCategory]=useState(''),[source,setSource]=useState<AnalyticsFilter['source']>('all'),[data,setData]=useState<AnalyticsReport>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function loadChannels(){const list=await window.pssa.analyticsChannels();setChannels(list);setChannel(c=>list.includes(c)?c:list[0]??'')}
 useEffect(()=>{void loadChannels().catch(()=>setNotice('Nie udało się odczytać kanałów.'))},[])
 const filter=():AnalyticsFilter=>({channel,from:Date.parse(from+'T00:00:00Z'),to:Date.parse(to+'T00:00:00Z')+DAY,category,source})
 async function run(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn()}catch{setNotice('Operacja nie powiodła się. Sprawdź zakres dat lub format pliku.')}finally{setBusy(false)}}
 function preset(n:number){setFrom(date(today()-(n-1)*DAY));setTo(date(today()))}
 const same=data&&JSON.stringify(data.filter)===JSON.stringify(filter()),s=same?data.current:undefined,p=same?data.previous:undefined
 const metric=(name:string,value:string,previous:string)=> <section className="metric" key={name}><header>{name}</header><strong>{value}</strong><small className="muted">Poprzednio: {previous}</small></section>
 return <>
 <Panel title="Analityka historyczna" detail="Zakresy kalendarzowe w UTC, koniec daty włącznie. Poprzedni okres ma identyczną długość.">
 <div className="alert-actions">{[7,14,30,180].map(n=><Button key={n} disabled={busy} onClick={()=>preset(n)}>{n} dni</Button>)}</div>
 <form className="alert-form" onSubmit={e=>{e.preventDefault();void run(async()=>setData(await window.pssa.analyticsReport(filter())))}}>
 <div className="queue-fields"><label>Kanał Twitch (ID)<select value={channel} onChange={e=>{setChannel(e.target.value);setCategory('')}}>{channels.map(c=><option key={c}>{c}</option>)}</select></label><label>Od<input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Do<input type="date" required value={to} onChange={e=>setTo(e.target.value)}/></label><label>Źródło<select value={source} onChange={e=>{setSource(e.target.value as AnalyticsFilter['source']);setCategory('')}}><option value="all">Wszystkie (bez duplikatów)</option><option value="local">PSSA / Twitch</option><option value="imported">Importowane</option></select></label><label>Kategoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Wszystkie</option>{data?.filter.channel===channel&&data.categories.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}</select></label></div>
 <div className="alert-actions"><Button type="submit" variant="primary" disabled={busy||!channel}>Oblicz raport</Button>{(['csv','json'] as const).map(format=><Button key={format} disabled={busy||!same} onClick={()=>void run(async()=>{if(await window.pssa.analyticsExport(filter(),format))setNotice('Zapisano plik '+format.toUpperCase()+'.')})}>Eksport {format.toUpperCase()}</Button>)}<Button disabled={busy} onClick={()=>void run(async()=>{const result=await window.pssa.analyticsImport();if(result){await loadChannels();setData(undefined);setNotice('Dodano '+result.added+' sesji, pominięto '+result.skipped+'.')}})}>Import CSV / JSON</Button></div></form>
 <p className="muted">Import tylko w formacie PSSA v1. Nie ma automatycznego pobierania SullyGnome. Możesz zaimportować własne, legalnie pozyskane podsumowania po konwersji do tego formatu.</p>
 {notice&&<p role="status">{notice}</p>}</Panel>
 {!s||!p?<Empty title="Wybierz zakres">Oblicz raport dla kanału. Brak kanału? Połącz Twitch albo zaimportuj historię.</Empty>:<>
 <Panel title="Porównanie okresów" detail={'Poprzedni: '+date(data!.filter.from-(data!.filter.to-data!.filter.from))+' – '+date(data!.filter.from-DAY)}>
 <div className="metric-grid">{metric('Transmisje',fmt(s.sessions),fmt(p.sessions))}{metric('Czas transmisji',hours(s.duration),hours(p.duration))}{metric('Śr. długość',hours(s.averageDuration),hours(p.averageDuration))}{metric('Śr. widzów (próbki)',fmt(s.average),fmt(p.average))}{metric('Szczyt (próbki)',fmt(s.peak),fmt(p.peak))}{metric('Liczba próbek',fmt(s.samples),fmt(p.samples))}</div><p className="muted">Sesje: {s.localSessions} lokalnych, {s.importedSessions} z importu. Czas lokalny to dolne oszacowanie końca; przy filtrze kategorii czas dotyczy całych pasujących sesji.</p></Panel>
 <Panel title="Podsumowania importowane"><div className="metric-grid">{metric('Średnia ważona czasem',fmt(s.importedAverage),fmt(p.importedAverage))}{metric('Szczyt z importu',fmt(s.importedPeak),fmt(p.importedPeak))}{metric('Sesje ze średnią',fmt(s.importedAverageSessions),fmt(p.importedAverageSessions))}</div><p className="muted">Tylko kompletne sesje w zakresie; import nie uzupełnia wykresów próbek ani zdarzeń Twitch.</p></Panel>
 <Panel title="Trend oglądalności" detail="Średnie dzienne z lokalnych próbek. Przerwy oznaczają brak danych."><Trend stats={s}/></Panel>
 <Panel title="Heatmapa oglądalności" detail="Dzień tygodnia × godzina UTC; intensywność = średnia z próbek."><Heatmap stats={s}/></Panel>
 <Panel title="Aktywność obserwowana" detail="Zdarzenia lokalne przypisane do sesji, nie oficjalna analityka Twitch.">
 {s.events?<div className="metric-grid">{([['follows','Follow'],['subs','Suby'],['prime','Prime'],['resubs','Resuby'],['gifts','Gift suby'],['bits','Bits'],['raids','Raids'],['raidViewers','Widzowie raidów'],['rewards','Nagrody'],['points','Punkty'],['messages','Wiadomości'],['chatters','Aktywni rozmówcy']] as const).map(([k,label])=>metric(label,fmt(s.events![k]),fmt(p.events?.[k]??null)))}</div>:<p>Brak porównywalnych danych o aktywności. Filtr kategorii nie przypisuje zdarzeń do gier.</p>}<p className="muted">Nieprzypisane zdarzenia: {s.unassigned}. Zera oznaczają brak odebranych zdarzeń, nie gwarancję kompletności.</p></Panel>
 <Panel title="Kategorie"><div className="analytics-table"><table><thead><tr><th>Kategoria</th><th>Próbki</th><th>Średnia</th><th>Szczyt</th></tr></thead><tbody>{s.categories.map(c=><tr key={c.key}><td>{c.name}</td><td>{c.samples}</td><td>{fmt(c.average)}</td><td>{fmt(c.peak)}</td></tr>)}</tbody></table></div></Panel>
 <Panel title="Najlepsze transmisje" detail="Ranking według średniej z lokalnych próbek w zakresie.">{s.best.map(x=><div className="setting-row" key={x.id}><div><h3>{x.title||x.category||x.externalId}</h3><p>{date(x.startedAt)} · {x.samples} próbek</p></div><strong>{fmt(x.average)}</strong></div>)}</Panel>
 <Panel title="Historia transmisji" detail={'Wyświetlono '+data!.sessions.length+' z '+data!.sessionCount+' sesji.'}><div className="analytics-table"><table><thead><tr><th>Data UTC</th><th>Tytuł</th><th>Kategoria</th><th>Czas</th><th>Średnia</th><th>Szczyt</th><th>Źródło</th></tr></thead><tbody>{data!.sessions.map(x=><tr key={x.id}><td>{date(x.startedAt)}</td><td>{x.title||'—'}</td><td>{x.category||'—'}</td><td>{hours(x.duration)}</td><td>{fmt(x.average)}</td><td>{fmt(x.peak)}</td><td>{x.provenance}</td></tr>)}</tbody></table></div></Panel></>}
 </>
}
