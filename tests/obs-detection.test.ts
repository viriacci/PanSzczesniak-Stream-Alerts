import {test} from 'node:test'
import assert from 'node:assert/strict'
import {obsVersion,dockLayout,parseCandidates,compareDockHashes} from '../src/main/obs/dock-detection.ts'
test('OBS version discovery ignores zero metadata and parses real version fields',()=>{
 assert.deepEqual(obsVersion(['0','0.0.0.0','32.2.2.0']),{major:32,label:'32.2.2'})
 assert.deepEqual(obsVersion(['','33.0.0-rc1']),{major:33,label:'33.0.0'})
 assert.deepEqual(obsVersion(['OBS Studio 31.1.1']),{major:31,label:'31.1.1'})
 assert.deepEqual(obsVersion(['32, 2, 0, 0']),{major:32,label:'32.2.0'})
 assert.equal(obsVersion(['0','unknown','']),null)
 assert.equal(dockLayout(31),'legacy');assert.equal(dockLayout(32),'legacy');assert.equal(dockLayout(33),'modern')
 assert.throws(()=>dockLayout(30),/30/);assert.throws(()=>dockLayout(34),/34/)
})
test('OBS candidates are deduplicated and invalid executable names rejected',()=>{
 const path='D:\\Steam\\steamapps\\common\\OBS Studio\\bin\\64bit\\obs64.exe'
 const c={path,source:'Steam',versions:['32.2.2'],portable:false}
 assert.deepEqual(parseCandidates([c,{...c,path:path.toUpperCase()},{...c,path:'C:\\setup.exe'},null]),[c])
})

test('installed dock status uses bundled DLL hash, detects old or duplicate versions',()=>{
 assert.equal(compareDockHashes('new',[]),'missing');assert.equal(compareDockHashes('new',['old']),'update');assert.equal(compareDockHashes('new',['new']),'current');assert.equal(compareDockHashes('new',['new','old']),'update');assert.equal(compareDockHashes(null,[]),'unavailable')
})

import {dockReplacementCommands} from '../src/main/obs/dock-detection.ts'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,readFileSync,rmSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
test('Windows plugin updater replaces existing file with verified bytes and removes obsolete copy',{skip:process.platform!=='win32'},()=>{
 const dir=mkdtempSync(join(tmpdir(),'pssa-dll-test-')),dll=join(dir,'new.dll'),target=join(dir,'installed.dll'),old=join(dir,'legacy.dll')
 const quote=(v:string)=>"'"+v.replaceAll("'","''")+"'"
 try{
  writeFileSync(dll,'new verified bytes');writeFileSync(target,'old version');writeFileSync(old,'obsolete path')
  const script=["$ErrorActionPreference='Stop'","$dll="+quote(dll),"$target="+quote(target),"$old="+quote(old),...dockReplacementCommands,'exit 0'].join('\r\n')
  const run=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000,windowsHide:true})
  assert.equal(run.status,0,run.stderr);assert.equal(readFileSync(target,'utf8'),'new verified bytes');assert.deepEqual(readdirSync(dir).sort(),['installed.dll','new.dll'])
 }finally{rmSync(dir,{recursive:true,force:true})}
})
