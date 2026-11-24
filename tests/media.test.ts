import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {copyMedia} from '../src/main/alerts/media.ts'
test('content-addressed media repairs corrupted copy and leaves no temporary file',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pssa-media-'))
 try{
  const src=join(root,'source.gif'),target=join(root,'media')
  await writeFile(src,'GIF89a')
  const name=await copyMedia(src,target,'image')
  await writeFile(join(target,name),'broken')
  assert.equal(await copyMedia(src,target,'image'),name)
  assert.equal(await readFile(join(target,name),'utf8'),'GIF89a')
  assert.deepEqual(await readdir(target),[name])
 }finally{await rm(root,{recursive:true,force:true})}
})
