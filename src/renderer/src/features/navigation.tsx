import {useState,type DragEvent} from 'react'
import {defaultNavigation,deleteGroup,findNode,mapNodes,moveNode,parseNavigation,type Navigation,type NavNode,type PageId} from '../../../shared/layout'
import {allPages} from '../navigation'
import {Button,Panel} from '../components/ui'
import {Icon} from '../components/icons'
type Common={navigation:Navigation;onChange:(v:Navigation)=>void}
const label=(id:PageId)=>allPages.find(p=>p.id===id)!
export function SidebarNav({navigation,onChange,collapsed,query,active,ready,navigate,editing}:{collapsed:boolean;query:string;active:PageId;ready:boolean;navigate:(p:PageId)=>void;editing:boolean}&Common){
 const [drag,setDrag]=useState(''),[hover,setHover]=useState('')
 const q=query.trim().toLocaleLowerCase('pl')
 const shown=(n:NavNode):boolean=>n.kind==='page'?(editing||!navigation.hidden.includes(n.id))&&(!q||label(n.id).label.toLocaleLowerCase('pl').includes(q)):editing||n.children.some(shown)
 const begin=(e:DragEvent,id:string)=>{e.stopPropagation();e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';setDrag(id)}
 const stop=()=>{setDrag('');setHover('')}
 const drop=(e:DragEvent,id:string|null,where:'before'|'after'|'inside')=>{e.preventDefault();e.stopPropagation();if(drag)onChange(moveNode(navigation,drag,id,where));stop()}
 const target=(id:string|null,where:'before'|'after'|'inside')=>({onDragOver:(e:DragEvent)=>{if(!drag)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setHover((id??'root')+where)},onDrop:(e:DragEvent)=>drop(e,id,where)})
 const line=(id:string|null,where:'before'|'after')=>editing&&<div className={'nav-drop '+(hover===(id??'root')+where?'over':'')} {...target(id,where)}/>
 function render(n:NavNode,depth:number){
  if(!shown(n))return null
  if(n.kind==='page'){const p=label(n.id);return <div key={n.id}>{line(n.id,'before')}<button draggable={editing} onDragStart={e=>begin(e,n.id)} onDragEnd={stop} type="button" disabled={!ready} className={'nav-link '+(p.id===active?'active ':'')+(navigation.hidden.includes(n.id)?'nav-hidden':'')} aria-current={p.id===active?'page':undefined} title={p.label} onClick={()=>navigate(p.id)}><Icon name={p.icon}/>{!collapsed&&<span>{p.label}</span>}</button>{line(n.id,'after')}</div>}
  const open=editing||!!q||!n.collapsed
  return <div className={'nav-group '+(depth?'nav-subgroup':'')} key={n.id}>{line(n.id,'before')}{!collapsed&&<button className={'nav-category '+(hover===n.id+'inside'?'over':'')} draggable={editing} onDragStart={e=>begin(e,n.id)} onDragEnd={stop} {...(editing?target(n.id,'inside'):{})} aria-expanded={open} onClick={()=>onChange({...navigation,nodes:mapNodes(navigation.nodes,n.id,x=>x.kind==='group'?{...x,collapsed:!x.collapsed}:x)})}><span>{n.name}</span><span className={open?'nav-arrow open':'nav-arrow'}><Icon name="chevron" size={12}/></span></button>}{(open||collapsed)&&<div className={depth?'nav-nested':''}>{n.children.map(x=>render(x,depth+1))}</div>}{line(n.id,'after')}</div>
 }
 return <nav>{navigation.nodes.map(n=>render(n,0))}{line(null,'after')}{editing&&<div className="nav-root-drop" {...target(null,'inside')}>Upuść na głównym poziomie</div>}{!navigation.nodes.some(shown)&&<p className="nav-empty">Brak zakładek</p>}</nav>
}
export function NavigationSettings({navigation,onChange,editing,onEdit}:Common&{editing:boolean;onEdit:()=>void}){
 const [notice,setNotice]=useState('')
 const save=(nodes:NavNode[])=>{try{onChange(parseNavigation({...navigation,nodes}));setNotice('')}catch{setNotice('Nie można zapisać układu (maks. dwa poziomy kategorii i 45 elementów).')}}
 const add=(parent?:string)=>{const n:NavNode={kind:'group',id:'g-'+crypto.randomUUID(),name:parent?'Nowa podkategoria':'Nowa kategoria',collapsed:false,children:[]};save(parent?mapNodes(navigation.nodes,parent,x=>x.kind==='group'?{...x,children:[...x.children,n]}:x):[...navigation.nodes,n])}
 const categories=(nodes:NavNode[],depth=0)=>nodes.map(n=>n.kind==='group'?<div key={n.id} className="nav-manager-group"><div className="nav-manager-row"><input aria-label={'Nazwa kategorii '+n.name} key={n.id+n.name} defaultValue={n.name} maxLength={60} onBlur={e=>{const name=e.target.value.trim();if(name&&name!==n.name)save(mapNodes(navigation.nodes,n.id,x=>x.kind==='group'?{...x,name}:x));else if(!name)e.target.value=n.name}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>{depth===0&&<Button onClick={()=>add(n.id)}>+ Podkategoria</Button>}<Button onClick={()=>onChange(deleteGroup(navigation,n.id))} title="Usuń kategorię; zakładki pozostaną">Usuń</Button></div>{categories(n.children,depth+1)}</div>:null)
 return <><Panel title="Ukryj zakładki"><div className="nav-visibility">{allPages.map(p=><label key={p.id} className="alert-checkbox"><input type="checkbox" checked={navigation.hidden.includes(p.id)} onChange={e=>onChange({...navigation,hidden:e.target.checked?[...navigation.hidden,p.id]:navigation.hidden.filter(id=>id!==p.id)})}/>{p.label}</label>)}</div><small className="muted">Ukrycie nie usuwa danych ani nie wyłącza funkcji. Ustawienia są zawsze dostępne przez koło zębate.</small></Panel><Panel title="Kategorie i podkategorie" action={<Button variant={editing?'primary':'secondary'} onClick={onEdit}>{editing?'Zakończ edycję':'Edytuj menu'}</Button>}><p>W trybie edycji przeciągaj zakładki lub kategorie w lewym menu. Upuść na nagłówku, aby przenieść do kategorii, albo na linii między elementami, aby zmienić kolejność. Nazwy zmienisz poniżej.</p><div className="alert-actions"><Button onClick={()=>add()}>+ Kategoria</Button><Button onClick={()=>{if(window.confirm('Przywrócić tymczasowy domyślny układ menu?'))onChange(parseNavigation(defaultNavigation))}}>Reset menu</Button></div>{categories(navigation.nodes)}{notice&&<p role="status">{notice}</p>}</Panel></>
}
