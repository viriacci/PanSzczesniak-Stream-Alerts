import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
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
