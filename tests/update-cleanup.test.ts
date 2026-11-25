import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,mkdir,readdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {cleanUpdateFiles} from '../src/main/runtime/update-cleanup.ts'
test('cleanup removes only managed installer files, preserves unrelated data',async()=>{const root=await mkdtemp(join(tmpdir(),'pssa-clean-test-'));try{const a=await mkdtemp(join(root,'PSSA-update-')),b=await mkdtemp(join(root,'PSSA-update-'));await writeFile(join(a,'PSSA-Setup-2.0.0-rc.17-x64.exe'),'old');await writeFile(join(b,'PSSA-Setup-2.0.0-rc.18-x64.exe.part'),'partial');await writeFile(join(b,'keep.txt'),'keep');await mkdir(join(root,'unrelated'));assert.equal(await cleanUpdateFiles(root),2);assert.deepEqual(await readdir(b),['keep.txt']);assert.ok((await readdir(root)).includes('unrelated'))}finally{await rm(root,{recursive:true,force:true})}})
