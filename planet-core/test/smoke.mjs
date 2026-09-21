import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const data=await mkdtemp(path.join(tmpdir(),'planet-test-'))
const port=18787
const child=spawn(process.execPath,['src/app.js'],{cwd:path.resolve('.'),env:{...process.env,PORT:String(port),PLANET_DATA_DIR:data},stdio:'pipe'})
const base='http://127.0.0.1:'+port
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function wait(){for(let i=0;i<40;i++){try{const r=await fetch(base+'/api/status');if(r.ok)return}catch{}await sleep(100)}throw new Error('Planet Core did not start')}
try{
  await wait()
  let r=await fetch(base+'/api/status'); let j=await r.json(); assert.equal(j.setup,false)
  r=await fetch(base+'/api/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Test Owner',password:'test-password-123'})}); assert.equal(r.status,201)
  r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'test-password-123'})}); assert.equal(r.status,200)
  const cookie=r.headers.get('set-cookie').split(';')[0]
  r=await fetch(base+'/api/modules',{headers:{cookie}}); j=await r.json(); assert.equal(j.length,27); assert.equal(j[0].slug,'homestead'); assert.equal(j[26].slug,'packs')
  r=await fetch(base+'/api/modules/animal-id/records',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({title:'Doe 1 weight',kind:'weight',body:'72 lb'})}); assert.equal(r.status,201)
  r=await fetch(base+'/api/modules/animal-id/records',{headers:{cookie}}); j=await r.json(); assert.equal(j.length,1)
  r=await fetch(base+'/api/sync/export',{headers:{cookie}}); j=await r.json(); assert.equal(j.format,'planet-sync-v1'); assert.equal(j.data.moduleRecords.length,1)
  r=await fetch(base+'/api/backup',{headers:{cookie}}); assert.equal(r.status,200)
  console.log('Planet Core smoke test passed: auth, 27 modules, records, sync, backup')
} finally {
  child.kill('SIGTERM'); await rm(data,{recursive:true,force:true})
}
