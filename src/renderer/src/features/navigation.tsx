import {useLocale} from '../i18n'
import {useRef,useState,type DragEvent} from 'react'
import {defaultNavigation,deleteGroup,mapNodes,moveNode,parseNavigation,type Navigation,type NavNode,type PageId} from '../../../shared/layout'
import {allPages} from '../navigation'
import {Button,SettingsSection} from '../components/ui'
import {Icon} from '../components/icons'
type Common={navigation:Navigation;onChange:(v:Navigation)=>void}
const label=(id:PageId)=>allPages.find(p=>p.id===id)!
type Position='before'|'after'|'inside'
export function SidebarNav({navigation,onChange,collapsed,query,active,ready,navigate,editing}:{collapsed:boolean;query:string;active:PageId;ready:boolean;navigate:(p:PageId)=>void;editing:boolean}&Common){
 const {language,t}=useLocale()
 const pageLabel=(id:PageId)=>t("nav."+id)
 const groupName=(n:Extract<NavNode,{kind:"group"}>)=>{const original=defaultNavigation.nodes.find(x=>x.id===n.id);const key=({"alerts-group":"main",assets:"extra",live:"analytics",system:"system"} as Record<string,string>)[n.id];return key&&original?.kind==="group"&&original.name===n.name?t("nav.group."+key):n.name}
 const source=useRef(''),[drag,setDrag]=useState(''),[hover,setHover]=useState('')
 const q=query.trim().toLocaleLowerCase(language),canDrag=ready&&!collapsed&&!q
 const shown=(n:NavNode):boolean=>n.kind==='page'?n.id!=='settings'&&(editing||!navigation.hidden.includes(n.id))&&(!q||pageLabel(n.id).toLocaleLowerCase(language).includes(q)):!q||n.children.some(shown)
 const begin=(e:DragEvent,id:string)=>{if(!canDrag){e.preventDefault();return}e.stopPropagation();source.current=id;e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';setDrag(id)}
 const stop=()=>{source.current='';setDrag('');setHover('')}
 const drop=(e:DragEvent,id:string|null,where:Position)=>{if(!source.current)return;e.preventDefault();e.stopPropagation();onChange(moveNode(navigation,source.current,id,where));stop()}
 const position=(e:DragEvent,isGroup:boolean):Position=>{const rect=e.currentTarget.getBoundingClientRect(),y=(e.clientY-rect.top)/Math.max(1,rect.height);return isGroup?(y<.25?'before':y>.75?'after':'inside'):y<.5?'before':'after'}
 const target=(id:string,isGroup:boolean)=>({onDragOver:(e:DragEvent)=>{if(!source.current)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';const next=id+':'+position(e,isGroup);setHover(v=>v===next?v:next)},onDrop:(e:DragEvent)=>drop(e,id,position(e,isGroup))})
 const highlight=(id:string)=>hover.startsWith(id+':')?' nav-target-'+hover.slice(id.length+1):''
 function render(n:NavNode,depth:number){
  if(!shown(n))return null
  if(n.kind==='page'){const p=label(n.id);return <div key={n.id}><button data-nav-id={n.id} draggable={canDrag} onDragStart={e=>begin(e,n.id)} onDragEnd={stop} {...target(n.id,false)} type="button" disabled={!ready} className={'nav-link '+(p.id===active?'active ':'')+(navigation.hidden.includes(n.id)?'nav-hidden':'')+highlight(n.id)} aria-current={p.id===active?'page':undefined} title={pageLabel(p.id)} onClick={()=>navigate(p.id)}><Icon name={p.icon}/>{!collapsed&&<><span>{pageLabel(p.id)}</span><span className="nav-grip" aria-hidden="true">⠿</span></>}</button></div>}
  const open=editing||!!q||!n.collapsed
  return <div className={'nav-group '+(depth?'nav-subgroup':'')} key={n.id}>{!collapsed&&<button data-nav-id={n.id} className={'nav-category'+highlight(n.id)} draggable={canDrag} onDragStart={e=>begin(e,n.id)} onDragEnd={stop} {...target(n.id,true)} aria-expanded={open} onClick={()=>onChange({...navigation,nodes:mapNodes(navigation.nodes,n.id,x=>x.kind==='group'?{...x,collapsed:!x.collapsed}:x)})}><span>{groupName(n)}</span><span className="nav-grip" aria-hidden="true">⠿</span><span className={open?'nav-arrow open':'nav-arrow'}><Icon name="chevron" size={12}/></span></button>}{(open||collapsed)&&<div className={depth?'nav-nested':''}>{n.children.map(x=>render(x,depth+1))}</div>}</div>
 }
 return <nav className={drag?'nav-dragging':''}>{navigation.nodes.map(n=>render(n,0))}{drag&&<div className="nav-root-drop" onDragOver={e=>{if(source.current){e.preventDefault();setHover('root')}}} onDrop={e=>drop(e,null,'after')}>Upuść na głównym poziomie</div>}{!navigation.nodes.some(shown)&&<p className="nav-empty">Brak zakładek</p>}</nav>
}
export function NavigationSettings({navigation,onChange,editing,onEdit}:Common&{editing:boolean;onEdit:()=>void}){
 const {t}=useLocale()
 const [notice,setNotice]=useState('')
 const save=(nodes:NavNode[])=>{try{onChange(parseNavigation({...navigation,nodes}));setNotice('')}catch{setNotice('Nie można zapisać układu (maks. dwa poziomy kategorii i 45 elementów).')}}
 const add=(parent?:string)=>{const n:NavNode={kind:'group',id:'g-'+crypto.randomUUID(),name:parent?'Nowa podkategoria':'Nowa kategoria',collapsed:false,children:[]};save(parent?mapNodes(navigation.nodes,parent,x=>x.kind==='group'?{...x,children:[...x.children,n]}:x):[...navigation.nodes,n])}
 const categories=(nodes:NavNode[],depth=0)=>nodes.map(n=>n.kind==='group'?<div key={n.id} className="nav-manager-group"><div className="nav-manager-row"><input aria-label={'Nazwa kategorii '+n.name} key={n.id+n.name} defaultValue={n.name} maxLength={60} onBlur={e=>{const name=e.target.value.trim();if(name&&name!==n.name)save(mapNodes(navigation.nodes,n.id,x=>x.kind==='group'?{...x,name}:x));else if(!name)e.target.value=n.name}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>{depth===0&&<Button onClick={()=>add(n.id)}>+ Podkategoria</Button>}<Button onClick={()=>onChange(deleteGroup(navigation,n.id))} title="Usuń kategorię; zakładki pozostaną">Usuń</Button></div>{categories(n.children,depth+1)}</div>:null)
 return <><SettingsSection title="Ukryj zakładki"><div className="nav-visibility">{allPages.filter(p=>p.id!=='settings').map(p=><label key={p.id} className="alert-checkbox"><input type="checkbox" checked={navigation.hidden.includes(p.id)} onChange={e=>onChange({...navigation,hidden:e.target.checked?[...navigation.hidden,p.id]:navigation.hidden.filter(id=>id!==p.id)})}/>{t("nav."+p.id)}</label>)}</div></SettingsSection><SettingsSection title="Kategorie i podkategorie"><div className="alert-actions"><Button onClick={onEdit}>{editing?'Zakończ podgląd':'Pokaż również ukryte zakładki'}</Button><Button onClick={()=>add()}>+ Kategoria</Button><Button onClick={()=>{if(window.confirm('Przywrócić tymczasowy domyślny układ menu?'))onChange(parseNavigation(defaultNavigation))}}>Reset menu</Button></div>{categories(navigation.nodes)}{notice&&<p role="status">{notice}</p>}</SettingsSection></>
}
