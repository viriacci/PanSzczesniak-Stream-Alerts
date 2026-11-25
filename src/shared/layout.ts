export const pages = ['dashboard','activity','analytics','queue','alerts','rewards','studio','library','profiles','integrations','settings','diagnostics','documentation'] as const
export type PageId = typeof pages[number]
export const sidebarPages=pages.filter(p=>p!=='settings')
export type NavNode={kind:'page';id:PageId}|{kind:'group';id:string;name:string;collapsed:boolean;children:NavNode[]}
export interface Navigation {nodes:NavNode[];hidden:PageId[]}
const group=(id:string,name:string,ids:PageId[]):NavNode=>({kind:'group',id,name,collapsed:false,children:ids.map(id=>({kind:'page',id}))})
const previousNavigation:Navigation={nodes:[group('live','Centrum transmisji',['dashboard','activity','analytics']),group('alerts-group','Alerty',['queue','alerts','rewards','studio']),group('assets','Zasoby',['library','profiles']),group('system','System',['integrations','diagnostics','documentation'])],hidden:[]}
export const defaultNavigation:Navigation={nodes:[group('alerts-group','Główne',['queue','rewards','alerts','studio']),group('assets','Dodatkowe',['profiles','library','dashboard']),group('live','Analiza',['activity','analytics']),group('system','Ustawienia',['integrations','diagnostics','documentation'])],hidden:[]}
function migrateDefault(nav:Navigation):Navigation{
 const structure=(n:NavNode):unknown=>n.kind==='group'?{id:n.id,name:n.name,children:n.children.map(structure)}:{id:n.id}
 if(nav.hidden.length||JSON.stringify(nav.nodes.map(structure))!==JSON.stringify(previousNavigation.nodes.map(structure)))return nav
 return {...defaultNavigation,nodes:defaultNavigation.nodes.map(n=>{const old=nav.nodes.find(p=>p.id===n.id);return n.kind==='group'&&old?.kind==='group'?{...n,collapsed:old.collapsed}:n})}
}
export interface LayoutPreferences {page:PageId;sidebarWidth:number;collapsed:boolean;inspectorWidth:number;inspectorOpen:boolean;navigation:Navigation}
export const defaultLayout:LayoutPreferences={page:'queue',sidebarWidth:248,collapsed:false,inspectorWidth:300,inspectorOpen:false,navigation:defaultNavigation}
export const bounds={sidebar:[208,320],inspector:[240,420]} as const
export function clampWidth(value:number,range:readonly [number,number]):number{return Math.min(range[1],Math.max(range[0],Math.round(value)))}
export function parseNavigation(value:unknown):Navigation{
 if(!value||typeof value!=='object')throw Error('Invalid navigation')
 const v=value as Record<string,unknown>,ids=new Set<string>(),found=new Set<PageId>();let count=0
 function read(raw:unknown,depth:number):NavNode[]{
  if(!Array.isArray(raw)||raw.length>45)throw Error('Invalid navigation list')
  return raw.flatMap((item):NavNode[]=>{
   if(!item||typeof item!=='object'||++count>45)throw Error('Invalid navigation node')
   const n=item as Record<string,unknown>
   if(typeof n.id!=='string'||ids.has(n.id))throw Error('Duplicate navigation node')
   ids.add(n.id)
   if(n.kind==='page'&&n.id==='settings')return [] // migrate RC.7 menu; page itself remains accessible
   if(n.kind==='page'&&pages.includes(n.id as PageId)){found.add(n.id as PageId);return [{kind:'page',id:n.id as PageId}]}
   if(n.kind!=='group'||depth>=2||!/^[a-zA-Z0-9_-]{1,64}$/.test(n.id)||pages.includes(n.id as PageId)||typeof n.name!=='string'||!n.name.trim()||n.name.length>60||typeof n.collapsed!=='boolean')throw Error('Invalid category')
   return [{kind:'group',id:n.id,name:n.name.trim(),collapsed:n.collapsed,children:read(n.children,depth+1)}]
  })
 }
 const nodes=read(v.nodes,0)
 if(found.size!==sidebarPages.length||!Array.isArray(v.hidden)||v.hidden.length>pages.length||v.hidden.some(p=>!pages.includes(p as PageId))||new Set(v.hidden).size!==v.hidden.length)throw Error('Invalid page inventory')
 return {nodes,hidden:v.hidden.filter(p=>p!=='settings') as PageId[]}
}
export function parseLayout(value:unknown):LayoutPreferences{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid layout')
 const v=value as Record<string,unknown>
 const validWidth=(n:unknown,range:readonly [number,number]):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=range[0]&&n<=range[1]
 if(typeof v.page!=='string'||!pages.includes(v.page as PageId)||!validWidth(v.sidebarWidth,bounds.sidebar)||!validWidth(v.inspectorWidth,bounds.inspector)||typeof v.collapsed!=='boolean'||typeof v.inspectorOpen!=='boolean')throw new TypeError('Invalid layout')
 const old=v.navigation===undefined
 return {page:v.page as PageId,sidebarWidth:v.sidebarWidth,collapsed:v.collapsed,inspectorWidth:v.inspectorWidth,inspectorOpen:old?false:v.inspectorOpen,navigation:old?parseNavigation(defaultNavigation):migrateDefault(parseNavigation(v.navigation))}
}
export function findNode(nodes:NavNode[],id:string):NavNode|undefined{for(const n of nodes){if(n.id===id)return n;if(n.kind==='group'){const child=findNode(n.children,id);if(child)return child}}}
export function mapNodes(nodes:NavNode[],id:string,fn:(n:NavNode)=>NavNode):NavNode[]{return nodes.map(n=>n.id===id?fn(n):n.kind==='group'?{...n,children:mapNodes(n.children,id,fn)}:n)}
export function moveNode(nav:Navigation,source:string,target:string|null,position:'before'|'after'|'inside'):Navigation{
 const node=findNode(nav.nodes,source);if(!node||source===target||node.kind==='group'&&target&&findNode(node.children,target))return nav
 const remove=(nodes:NavNode[]):NavNode[]=>nodes.filter(n=>n.id!==source).map(n=>n.kind==='group'?{...n,children:remove(n.children)}:n)
 let inserted=false
 const insert=(nodes:NavNode[]):NavNode[]=>nodes.flatMap(n=>{
  if(n.id===target){if(position==='inside'){if(n.kind!=='group')return [n];inserted=true;return [{...n,collapsed:false,children:[...n.children,node]}]}inserted=true;return position==='before'?[node,n]:[n,node]}
  return [n.kind==='group'?{...n,children:insert(n.children)}:n]
 })
 let nodes=remove(nav.nodes)
 if(target===null){nodes=[...nodes,node];inserted=true}else nodes=insert(nodes)
 if(!inserted)return nav
 try{return parseNavigation({...nav,nodes})}catch{return nav}
}
export function deleteGroup(nav:Navigation,id:string):Navigation{
 const remove=(nodes:NavNode[]):NavNode[]=>nodes.flatMap(n=>n.kind==='group'?(n.id===id?n.children:[{...n,children:remove(n.children)}]):[n])
 return parseNavigation({...nav,nodes:remove(nav.nodes)})
}
