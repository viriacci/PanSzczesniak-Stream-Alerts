import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {readLanguage,writeLanguage,loadCatalogs} from '../src/main/runtime/language.ts'
import {translate,validateCatalog} from '../src/shared/i18n.ts'
test('independent profile language preferences and old-profile Polish fallback',()=>{
 const a=mkdtempSync(join(tmpdir(),'pssa-lang-')),b=mkdtempSync(join(tmpdir(),'pssa-lang-'))
 try{assert.equal(readLanguage(a),'pl');writeLanguage(a,'de');writeLanguage(b,'en');assert.equal(readLanguage(a),'de');assert.equal(readLanguage(b),'en');writeFileSync(join(a,'language.json'),'{"language":"../../bad"}');assert.equal(readLanguage(a),'pl')}finally{rmSync(a,{recursive:true,force:true});rmSync(b,{recursive:true,force:true})}
})
test('all official catalogs match and support interpolation and fallback',()=>{
 const c=loadCatalogs(process.cwd());assert.deepEqual(Object.keys(c.en.translations),Object.keys(c.pl.translations));assert.deepEqual(Object.keys(c.de.translations),Object.keys(c.pl.translations));assert.equal(translate(c.de,c.pl,'setup.detected',{version:'2.1.0'}),'PSSA 2.1.0 erkannt • aktualisieren oder deinstallieren');assert.equal(translate(undefined,c.pl,'nav.queue'),'Kolejka');assert.throws(()=>validateCatalog({...c.en,meta:{...c.en.meta,code:'de'}},'en'))
})

import {resolveRegion,regionalDate,regionalNumber,isRegion} from '../src/shared/i18n.ts'
import {parseRuntime,defaults} from '../src/shared/runtime.ts'
test('regional format is independent of UI language and UTC analytics dates',()=>{
 assert.equal(resolveRegion('de','en-GB'),'en-GB')
 assert.equal(resolveRegion('pl'),'pl-PL')
 assert.equal(regionalNumber('en-US',1234.5),'1,234.5')
 assert.equal(regionalNumber('de-DE',1234.5),'1.234,5')
 assert.equal(regionalDate('en-GB',Date.UTC(2026,10,26),{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'UTC'}),'26/11/2026')
 assert.equal(parseRuntime({...defaults,region:'en-GB'}).region,'en-GB')
 assert.equal(parseRuntime({...defaults,region:'../../bad'}).region,undefined)
 assert.equal(isRegion('auto'),true)
})

test('corrupt external catalog cannot block UI and missing or invalid overrides fall back to shipped text',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pssa-locales-'))
 try{
  mkdirSync(join(dir,'locales'))
  const shipped=loadCatalogs(process.cwd())
  writeFileSync(join(dir,'locales','de.json'),'{broken')
  writeFileSync(join(dir,'locales','en.json'),JSON.stringify({...shipped.en,translations:{'nav.queue':'Custom queue','setup.detected':'Missing placeholder','unexpected.key':'unknown'}}))
  const loaded=loadCatalogs(dir,process.cwd())
  assert.equal(loaded.de.translations['nav.queue'],shipped.de.translations['nav.queue'])
  assert.equal(loaded.en.translations['nav.queue'],'Custom queue')
  assert.equal(loaded.en.translations['setup.detected'],shipped.en.translations['setup.detected'])
  assert.equal(loaded.en.translations['nav.alerts'],shipped.en.translations['nav.alerts'])
  assert.equal(Object.hasOwn(loaded.en.translations,'unexpected.key'),false)
  assert.deepEqual(loaded.pl,shipped.pl)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
