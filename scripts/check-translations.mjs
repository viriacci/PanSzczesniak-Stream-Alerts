import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const codes=['pl','en','de']
const catalogs=codes.map(code=>JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url),'utf8')))
const keys=Object.keys(catalogs[0].translations).sort()
const vars=s=>[...s.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>m[1]).sort()
for(const [i,c] of catalogs.entries()){
 assert.equal(c.meta.code,codes[i]);assert.equal(c.meta.schemaVersion,1)
 assert.deepEqual(Object.keys(c.translations).sort(),keys)
 for(const key of keys){assert.equal(typeof c.translations[key],'string');assert.ok(c.translations[key].trim());assert.deepEqual(vars(c.translations[key]),vars(catalogs[0].translations[key]),codes[i]+': '+key)}
}
console.log('Validated '+keys.length+' keys in '+codes.length+' languages.')
