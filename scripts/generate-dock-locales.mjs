import {readFileSync,writeFileSync} from 'node:fs'
const codes=['pl','en','de']
const dictionaries=codes.map(code=>JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url),'utf8')).translations)
// Octal UTF-8 byte escapes keep MSVC source encoding independent of the build host.
const literal=value=>'"'+Array.from(Buffer.from(value,'utf8'),byte=>'\\'+byte.toString(8).padStart(3,'0')).join('')+'"'
const keys=Object.keys(dictionaries[0]).filter(k=>k.startsWith('dock.'))
let output='#pragma once\n#include <QString>\n#include <cstring>\nstatic QString pssaDockText(const QString &language,const char *key){\n'
for(const key of keys){const [pl,en,de]=dictionaries.map(d=>d[key]);if(!pl||!en||!de)throw Error('Missing dock key '+key);output+=' if(std::strcmp(key,"'+key+'")==0)return QString::fromUtf8(language=="en"?'+literal(en)+':language=="de"?'+literal(de)+':'+literal(pl)+');\n'}
output+=' return QString::fromUtf8(key);\n}\n'
if(!process.argv[2])throw Error('Missing output path')
writeFileSync(process.argv[2],output)
