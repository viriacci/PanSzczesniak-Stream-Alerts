import {test} from 'node:test'
import assert from 'node:assert/strict'
import {obsVersion,dockLayout,parseCandidates} from '../src/main/obs/dock-detection.ts'
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
