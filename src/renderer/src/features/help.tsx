import {useEffect,useRef,useState} from 'react'
import type {PageId} from '../../../shared/layout'
import {allPages} from '../navigation'
import {Button} from '../components/ui'
import {isTourPage,topics,tours,type TourPage} from './help-content'

function useModal(onClose:()=>void){
 const ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{
  const dialog=ref.current, previous=document.activeElement
  if(dialog&&!dialog.open)dialog.showModal()
  return ()=>{if(dialog?.open)dialog.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus()}
 },[])
 return {ref,onCancel:(e:React.SyntheticEvent)=>{e.preventDefault();onClose()},onKeyDown:(e:React.KeyboardEvent)=>e.stopPropagation()}
}
export function HelpCenter({initial,onClose,onStart}:{initial:PageId;onClose:()=>void;onStart:(p:TourPage)=>void}){
 const [page,setPage]=useState<PageId>(initial==='activity'?'queue':initial)
 const [query,setQuery]=useState('')
 const [setting,setSetting]=useState(0)
 const modal=useModal(onClose)
 const entries=topics[page]??[]
 const match=query.trim().toLocaleLowerCase('pl')
 const pages=allPages.filter(p=>!match||[p.label,...(topics[p.id]??[]).flatMap(t=>[t.title,t.body])].some(t=>t.toLocaleLowerCase('pl').includes(match)))
 const shown=entries.filter(t=>!match||[t.title,t.body,allPages.find(p=>p.id===page)?.label??''].some(v=>v.toLocaleLowerCase('pl').includes(match)))
 return <dialog {...modal} className="pssa-help" aria-labelledby="help-title">
  <header className="help-header"><h2 id="help-title">Instrukcja PSSA</h2><Button onClick={onClose} aria-label="Zamknij instrukcję">×</Button></header>
  <div className="help-layout">
   <nav aria-label="Sekcje instrukcji"><input aria-label="Szukaj w instrukcji" placeholder="Szukaj w instrukcji" value={query} onChange={e=>{setQuery(e.target.value);setSetting(0)}}/>{pages.map(p=><Button key={p.id} data-help-page={p.id} aria-pressed={page===p.id} onClick={()=>{setPage(p.id);setSetting(0)}}>{p.label}</Button>)}{!pages.length&&<p>Brak wyników.</p>}</nav>
   <section className="help-body"><h3>{allPages.find(p=>p.id===page)?.label}</h3>
   {isTourPage(page)&&<Button variant="primary" data-help-start onClick={()=>onStart(page)}>Pokaż mi to</Button>}
   {page==='settings'&&<div className="help-settings" aria-label="Sekcje ustawień">{shown.map((t,i)=><Button key={t.title} data-help-setting aria-pressed={setting===i} onClick={()=>setSetting(i)}>{t.title}</Button>)}</div>}
   {(page==='settings'?shown.slice(Math.min(setting,Math.max(0,shown.length-1)),Math.min(setting,Math.max(0,shown.length-1))+1):shown).map(t=><details key={t.title} open={page==='settings'}><summary>{t.title}</summary><p>{t.body}</p></details>)}
   {!shown.length&&<p>Wybierz sekcję z wyników wyszukiwania.</p>}</section>
  </div>
 </dialog>
}
export function GuidedTour({page,onClose}:{page:TourPage;onClose:()=>void}){
 const [index,setIndex]=useState(0)
 const steps=tours[page],step=steps[index]!
 const modal=useModal(onClose)
 const hole=useRef<HTMLDivElement>(null), bubble=useRef<HTMLDivElement>(null)
 const missing=useRef<HTMLParagraphElement>(null)
 useEffect(()=>{
  let frame=0,previous:HTMLElement|null=null
  const update=()=>{
   const primary=document.querySelector<HTMLElement>('[data-tour="'+step.target+'"]')
   const fallback=step.fallback?document.querySelector<HTMLElement>('[data-tour="'+step.fallback+'"]'):null
   const visible=(el:HTMLElement|null)=>!!el&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0
   const target=(visible(primary)?primary:visible(fallback)?fallback:document.querySelector<HTMLElement>('[data-tour="page-header"]'))
   if(target&&target!==previous){target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});previous=target}
   const h=hole.current,b=bubble.current
   if(target&&h&&b){
    const r=target.getBoundingClientRect(),main=document.querySelector<HTMLElement>('#main-content')?.getBoundingClientRect()
    const left=Math.max(4,main?.left??0,r.left-5),top=Math.max(4,main?.top??0,r.top-5)
    const right=Math.min(innerWidth-4,main?.right??innerWidth,r.right+5),bottom=Math.min(innerHeight-4,main?.bottom??innerHeight,r.bottom+5)
    const width=Math.max(0,right-left),height=Math.max(0,bottom-top)
    Object.assign(h.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'})
    if(missing.current)missing.current.hidden=target===primary
    const bw=b.offsetWidth,bh=b.offsetHeight
    const y=bottom+12+bh<=innerHeight-8?bottom+12:top-bh-12>=8?top-bh-12:innerHeight-bh-8
    const x=Math.max(8,Math.min(innerWidth-bw-8,left+(width-bw)/2))
    Object.assign(b.style,{left:x+'px',top:Math.max(8,y)+'px'})
   }
   frame=requestAnimationFrame(update)
  }
  update()
  return ()=>cancelAnimationFrame(frame)
 },[step])
 return <dialog {...modal} className="pssa-tour" data-tour-page={page} aria-labelledby="tour-title">
  <div ref={hole} className="tour-hole" aria-hidden="true"/>
  <div ref={bubble} className="tour-bubble">
   <p className="tour-counter" data-tour-counter>{index+1} / {steps.length}</p>
   <h2 id="tour-title">{step.title}</h2><p>{step.body}</p>
   <p ref={missing} className="muted" hidden>Ten element jest teraz niedostępny. Pokazano najbliższy dostępny panel.</p>
   <div className="tour-actions"><Button data-tour-back disabled={index===0} onClick={()=>setIndex(i=>i-1)}>Wstecz</Button><Button data-tour-skip onClick={onClose}>Pomiń</Button><Button autoFocus variant="primary" data-tour-next onClick={()=>index===steps.length-1?onClose():setIndex(i=>i+1)}>{index===steps.length-1?'Zakończ':'Dalej'}</Button></div>
  </div>
 </dialog>
}
