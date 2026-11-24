import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)
const files=tracked.map(path=>{const bytes=readFileSync(path);return {path,bytes:bytes.length,lines:bytes.toString('utf8').split('\n').length,sha256:createHash('sha256').update(bytes).digest('hex')}})
const lock=JSON.parse(readFileSync('package-lock.json','utf8')),pkg=JSON.parse(readFileSync('package.json','utf8'))
const packages=Object.entries(lock.packages).filter(([path])=>path).map(([path,p])=>({path,version:p.version,dev:p.dev===true,optional:p.optional===true,license:p.license??null,resolved:p.resolved??null,integrity:p.integrity??null,installScript:p.hasInstallScript===true}))
const errors=packages.filter(p=>!p.integrity||!p.resolved?.startsWith('https://registry.npmjs.org/'))
for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies}))if(lock.packages['node_modules/'+name]?.version!==version)throw Error('Direct dependency mismatch: '+name)
if(errors.length)throw Error('Unpinned dependency source or missing integrity: '+JSON.stringify(errors))
writeFileSync('audit-inventory.json',JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files,packages},null,2))
console.log(JSON.stringify({files:files.length,lines:files.reduce((n,f)=>n+f.lines,0),packages:packages.length,production:packages.filter(p=>!p.dev).length,installScripts:packages.filter(p=>p.installScript).map(p=>p.path)}))
