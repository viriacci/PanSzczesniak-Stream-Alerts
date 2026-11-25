import {parseNavigation,moveNode,findNode,deleteGroup} from '../src/shared/layout.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultLayout, bounds, clampWidth, parseLayout } from '../src/shared/layout.ts'
import { openDatabase } from '../src/main/database/index.ts'
import { getLayout, setLayout } from '../src/main/database/layout.ts'
import { sanitizeWindowState, readWindowState, writeWindowState } from '../src/main/window-state.ts'

test('layout validation restricts pages, widths and boolean flags',()=>{
 assert.deepEqual(parseLayout(defaultLayout),defaultLayout)
 for(const bad of [null,[],{}, {...defaultLayout,page:'unknown'}, {...defaultLayout,sidebarWidth:999}, {...defaultLayout,inspectorWidth:NaN}, {...defaultLayout,collapsed:'true'}]) assert.throws(()=>parseLayout(bad))
 assert.equal(clampWidth(999,bounds.sidebar),320)
 assert.equal(clampWidth(100,bounds.inspector),240)
})
test('layout is saved and corrupt records safely default',()=>{
 const db=openDatabase(':memory:')
 try {
  assert.deepEqual(getLayout(db),defaultLayout)
  const next={...defaultLayout,page:'analytics' as const,collapsed:true,sidebarWidth:300}
  assert.deepEqual(setLayout(db,next),next)
  assert.deepEqual(getLayout(db),next)
  assert.throws(()=>setLayout(db,{...next,page:'bad'}))
  assert.deepEqual(getLayout(db),next)
  db.exec("UPDATE settings SET value='invalid' WHERE key='layout.v1'")
  assert.deepEqual(getLayout(db),defaultLayout)
 } finally {db.close()}
})
test('window state rejects disconnected displays and invalid sizes',()=>{
 const displays=[{x:0,y:0,width:1920,height:1080}]
 const state={bounds:{x:80,y:100,width:1100,height:750},maximized:true}
 assert.deepEqual(sanitizeWindowState(state,displays),state)
 assert.equal(sanitizeWindowState({...state,bounds:{...state.bounds,x:4000}},displays).maximized,false)
 assert.equal(sanitizeWindowState({...state,bounds:{...state.bounds,width:1}},displays).bounds.width,1180)
 const db=openDatabase(':memory:')
 try {writeWindowState(db,state);assert.deepEqual(readWindowState(db,displays),state)} finally {db.close()}
})

test('old layout hides inspector; navigation supports nested moving and preserves all pages',()=>{
 const {navigation,...old}=defaultLayout
 assert.equal(parseLayout({...old,inspectorOpen:true}).inspectorOpen,false)
 const group={kind:'group' as const,id:'custom',name:'Custom',collapsed:false,children:[]}
 const nav=parseNavigation({...navigation,nodes:[...navigation.nodes,group]})
 const moved=moveNode(nav,'studio','custom','inside')
 assert.equal(findNode(moved.nodes,'custom')?.kind,'group')
 assert.deepEqual((findNode(moved.nodes,'custom') as any).children,[{kind:'page',id:'studio'}])
 const nested=moveNode(moved,'custom','assets','inside')
 assert.deepEqual(moveNode(nested,'assets','custom','inside'),nested)
 assert.equal(findNode(deleteGroup(nested,'custom').nodes,'studio')?.kind,'page')
 assert.throws(()=>parseNavigation({...navigation,nodes:[]}))
 assert.throws(()=>parseNavigation({...navigation,hidden:['studio','studio']}))
})

test('RC.7 menu migrates settings out without changing custom layout',()=>{
 const n=parseNavigation({...defaultLayout.navigation,nodes:[...defaultLayout.navigation.nodes,{kind:'page',id:'settings'}],hidden:['settings','studio']})
 assert.equal(findNode(n.nodes,'settings'),undefined);assert.deepEqual(n.hidden,['studio'])
 assert.equal(parseLayout({...defaultLayout,page:'settings',navigation:n}).page,'settings')
 const moved=moveNode(n,'analytics','alerts','after')
 const group=findNode(moved.nodes,'alerts-group')
 assert.ok(group?.kind==='group');assert.equal(group.children[3]?.id,'analytics')
 assert.equal(moveNode(moved,'analytics',null,'after').nodes.at(-1)?.id,'analytics')
})

test('RC.8 defaults migrate while preserving custom layout and collapse state',()=>{
 const g=(id:string,name:string,ids:string[],collapsed=false)=>({kind:'group',id,name,collapsed,children:ids.map(id=>({kind:'page',id}))})
 const old={nodes:[g('live','Centrum transmisji',['dashboard','activity','analytics'],true),g('alerts-group','Alerty',['queue','alerts','rewards','studio']),g('assets','Zasoby',['library','profiles']),g('system','System',['integrations','diagnostics','documentation'])],hidden:[]}
 const next=parseLayout({...defaultLayout,navigation:old,sidebarWidth:300,page:'dashboard'})
 assert.deepEqual(next.navigation.nodes.map(n=>n.id),['alerts-group','assets','live','system'])
 assert.equal((findNode(next.navigation.nodes,'live') as any).collapsed,true);assert.equal(next.sidebarWidth,300);assert.equal(next.page,'dashboard')
 const custom={...old,hidden:['studio']};assert.deepEqual(parseLayout({...defaultLayout,navigation:custom}).navigation,custom)
 assert.equal(defaultLayout.page,'queue');assert.equal((defaultLayout.navigation.nodes[0] as any).children[1].id,'rewards')
})
