import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'

const PORT = Number(process.env.PORT || 8787)
const DATA_DIR = process.env.PLANET_DATA_DIR || path.resolve('data')
const DATA_FILE = path.join(DATA_DIR, 'planet.json')
fs.mkdirSync(DATA_DIR, { recursive: true })

const emptyDb = () => ({
  version: 2, owner: null, identities: [], animals: [], inventory: [], notes: [], sensors: [], moduleRecords: [],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
})
let db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : emptyDb()
db.moduleRecords ||= []
db.version = Math.max(Number(db.version || 1), 2)
const sessions = new Map()

function save() {
  db.updatedAt = new Date().toISOString()
  const tmp = DATA_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, DATA_FILE)
}
function planetId(type='record') {
  const prefix = ({person:'PER',animal:'ANI',asset:'AST',device:'DEV',location:'LOC'})[type] || 'REC'
  return `PLN-${prefix}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`
}
function json(res, status, body, headers={}) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8', ...headers})
  res.end(JSON.stringify(body))
}
function text(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {'content-type':type}); res.end(body)
}
async function body(req) {
  let raw=''; for await (const c of req) { raw += c; if (raw.length > 1_000_000) throw new Error('Body too large') }
  return raw ? JSON.parse(raw) : {}
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v=>{const i=v.indexOf('=');return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1))]}))
}
function authed(req) {
  const token = cookies(req).planet_session
  const s = token && sessions.get(token)
  if (!s || s.expires < Date.now()) { if(token) sessions.delete(token); return false }
  return true
}
function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')) {
  return {salt, hash:crypto.scryptSync(password, salt, 64).toString('hex')}
}
function verifyPassword(password, saved) {
  const actual=crypto.scryptSync(password, saved.salt, 64)
  const expected=Buffer.from(saved.hash,'hex')
  return actual.length===expected.length && crypto.timingSafeEqual(actual,expected)
}
function cleanString(v, max=500) { return typeof v === 'string' ? v.trim().slice(0,max) : '' }
function addRecord(collection, input, allowed) {
  const now=new Date().toISOString()
  const rec={id:crypto.randomUUID(), createdAt:now, updatedAt:now}
  for(const key of allowed) if(input[key] !== undefined) rec[key]=typeof input[key]==='string'?cleanString(input[key],2000):input[key]
  db[collection].push(rec); save(); return rec
}
function updateRecord(collection,id,input,allowed) {
  const rec=db[collection].find(x=>x.id===id); if(!rec) return null
  for(const key of allowed) if(input[key] !== undefined) rec[key]=typeof input[key]==='string'?cleanString(input[key],2000):input[key]
  rec.updatedAt=new Date().toISOString(); save(); return rec
}
function removeRecord(collection,id) {
  const i=db[collection].findIndex(x=>x.id===id); if(i<0)return false
  db[collection].splice(i,1); save(); return true
}

const MODULES = [
  ['homestead','Homestead Management','Farm tasks, crops, equipment, maintenance, water, energy and supplies'],
  ['education','Education','Offline lessons, K-12 learning plans, progress and practical skills'],
  ['natural-health','Herbal Medicine & Wild Edibles','Reference notes for herbs, wild edibles and safety cautions'],
  ['memory','Memory & Knowledge','Capture household knowledge, procedures, decisions and lessons learned'],
  ['social','Social Knowledge Platform','Local posts, discussions, how-to sharing and community knowledge'],
  ['planet-id','Planet ID','Offline identity for people, animals, devices, tools and locations'],
  ['mapping','Offline Mapping','Locations, routes, property notes and map-linked records'],
  ['modes','Operational Modes','Home, travel, emergency, low-power and other operating profiles'],
  ['mesh','Offline Mesh','Peer nodes, store-and-forward messages and sync status'],
  ['portability','Portability & Sharing','Portable installs, transfer bundles, onboarding and device moves'],
  ['tools','Tools & Extensions','Local utilities, extension notes and integrations'],
  ['financials','Financials & Planning','Budgets, expenses, production costs, plans and projections'],
  ['species-id','Species Identification','Plant, animal and fungi observations with identification notes'],
  ['records','Record Keeping','General logs, journals, inspections and historical records'],
  ['diy','DIY Knowledge & Skills','Repair guides, fabrication, carpentry, welding and build procedures'],
  ['archive','Knowledge Archive','Offline wiki, manuals, references and archived knowledge'],
  ['learning','Learning Engine','Imported knowledge, study queues, skills and learning progress'],
  ['animal-id','Animal ID & Livestock Intelligence','Lineage, breeding, weights, health, feed and production records'],
  ['survival','Survival & Emergency','Emergency plans, first aid references, water and shelter procedures'],
  ['food','Food Production & Preservation','Garden, harvest, seed, canning, drying, smoking and storage records'],
  ['marketplace','Community Marketplace','Barter listings, equipment sharing, needs and offers'],
  ['automation','Sensors & Automation','Solar, battery, water, weather, soil and automation records'],
  ['media','Document & Media Vault','Documents, media catalog, source notes and offline library references'],
  ['ai','Local AI & Expert Systems','Local AI tasks, prompts, expert workflows and knowledge-source notes'],
  ['offline-internet','Decentralized Offline Internet','Local sites, peer services, messages, search and node directory'],
  ['legacy','Family Legacy','Family history, stories, skills, traditions and inheritance records'],
  ['packs','Offline App Store & Knowledge Packs','Installable/shareable module and knowledge-pack catalog']
].map((x,i)=>({number:i+1,slug:x[0],name:x[1],description:x[2]}))
const moduleBySlug = slug => MODULES.find(m=>m.slug===slug)

const allowed = {
  animals:['name','planetId','species','breed','sex','birthDate','tag','sireId','damId','health','feed','notes','status'],
  inventory:['name','category','quantity','unit','location','minimum','notes'],
  notes:['title','body','category'],
  sensors:['name','kind','location','unit','value','readingAt','notes'],
  identities:['name','planetId','type','notes']
}

async function api(req,res,url) {
  if (req.method==='GET' && url.pathname==='/api/status') return json(res,200,{setup:!!db.owner,version:db.version})
  if (req.method==='POST' && url.pathname==='/api/setup') {
    if(db.owner) return json(res,409,{error:'Owner already configured'})
    const b=await body(req), name=cleanString(b.name,100), password=String(b.password||'')
    if(!name || password.length<8) return json(res,400,{error:'Name and password of at least 8 characters required'})
    const pw=hashPassword(password), pid=planetId('person')
    db.owner={name,planetId:pid,password:pw,createdAt:new Date().toISOString()}
    db.identities.push({id:crypto.randomUUID(),name,planetId:pid,type:'person',notes:'Planet owner',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})
    save(); return json(res,201,{ok:true,planetId:pid})
  }
  if (req.method==='POST' && url.pathname==='/api/login') {
    if(!db.owner) return json(res,409,{error:'Setup required'})
    const b=await body(req)
    if(!verifyPassword(String(b.password||''),db.owner.password)) return json(res,401,{error:'Invalid password'})
    const token=crypto.randomBytes(32).toString('base64url')
    sessions.set(token,{expires:Date.now()+86400000})
    return json(res,200,{ok:true,name:db.owner.name,planetId:db.owner.planetId},{'set-cookie':`planet_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`})
  }
  if (req.method==='POST' && url.pathname==='/api/logout') {
    const t=cookies(req).planet_session; if(t)sessions.delete(t)
    return json(res,200,{ok:true},{'set-cookie':'planet_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})
  }
  if(!authed(req)) return json(res,401,{error:'Authentication required'})
  if(req.method==='GET' && url.pathname==='/api/dashboard') return json(res,200,{
    owner:{name:db.owner.name,planetId:db.owner.planetId},
    counts:{animals:db.animals.length,inventory:db.inventory.length,notes:db.notes.length,sensors:db.sensors.length,identities:db.identities.length},
    lowStock:db.inventory.filter(x=>Number(x.quantity)<=Number(x.minimum||0)),
    recentAnimals:db.animals.slice(-5).reverse()
  })
  if(req.method==='GET' && url.pathname==='/api/modules') return json(res,200,MODULES.map(m=>({...m,count:db.moduleRecords.filter(r=>r.module===m.slug).length})))
  if(req.method==='GET' && url.pathname==='/api/sync/export') {
    return json(res,200,{format:'planet-sync-v1',exportedAt:new Date().toISOString(),source:db.owner.planetId,data:{identities:db.identities,animals:db.animals,inventory:db.inventory,notes:db.notes,sensors:db.sensors,moduleRecords:db.moduleRecords}})
  }
  if(req.method==='POST' && url.pathname==='/api/sync/import') {
    const b=await body(req); if(b.format!=='planet-sync-v1'||!b.data) return json(res,400,{error:'Invalid Planet sync bundle'})
    for(const key of ['identities','animals','inventory','notes','sensors','moduleRecords']) {
      const incoming=Array.isArray(b.data[key])?b.data[key]:[]; const existing=new Map(db[key].map(x=>[x.id,x]))
      for(const rec of incoming){const old=existing.get(rec.id); if(!old||String(rec.updatedAt||'')>String(old.updatedAt||'')) existing.set(rec.id,rec)}
      db[key]=[...existing.values()]
    } save(); return json(res,200,{ok:true})
  }
  const mm=url.pathname.match(/^\/api\/modules\/([^/]+)\/records(?:\/([^/]+))?$/)
  if(mm){
    const mod=moduleBySlug(mm[1]); if(!mod)return json(res,404,{error:'Unknown module'})
    const id=mm[2]
    if(req.method==='GET'&&!id)return json(res,200,db.moduleRecords.filter(r=>r.module===mod.slug))
    if(req.method==='POST'&&!id){const b=await body(req),now=new Date().toISOString();const rec={id:crypto.randomUUID(),module:mod.slug,title:cleanString(b.title,200),kind:cleanString(b.kind,80),status:cleanString(b.status,80)||'active',tags:Array.isArray(b.tags)?b.tags.slice(0,30):[],body:cleanString(b.body,8000),data:b.data&&typeof b.data==='object'?b.data:{},createdAt:now,updatedAt:now};db.moduleRecords.push(rec);save();return json(res,201,rec)}
    const rec=db.moduleRecords.find(r=>r.id===id&&r.module===mod.slug);if(!rec)return json(res,404,{error:'Not found'})
    if(req.method==='PUT'){const b=await body(req);for(const k of ['title','kind','status','body'])if(b[k]!==undefined)rec[k]=cleanString(b[k],k==='body'?8000:200);if(Array.isArray(b.tags))rec.tags=b.tags.slice(0,30);if(b.data&&typeof b.data==='object')rec.data=b.data;rec.updatedAt=new Date().toISOString();save();return json(res,200,rec)}
    if(req.method==='DELETE'){db.moduleRecords=db.moduleRecords.filter(r=>r.id!==id);save();return json(res,200,{ok:true})}
  }
  if(req.method==='GET' && url.pathname==='/api/backup') {
    res.writeHead(200,{'content-type':'application/json','content-disposition':'attachment; filename="planet-backup.json"'}); return res.end(JSON.stringify(db,null,2))
  }
  const m=url.pathname.match(/^\/api\/(animals|inventory|notes|sensors|identities)(?:\/([^/]+))?$/)
  if(!m) return json(res,404,{error:'Not found'})
  const [,collection,id]=m
  if(req.method==='GET' && !id) return json(res,200,db[collection])
  if(req.method==='POST' && !id) {
    const b=await body(req)
    if(collection==='animals' && !b.planetId)b.planetId=planetId('animal')
    if(collection==='identities' && !b.planetId)b.planetId=planetId(b.type)
    return json(res,201,addRecord(collection,b,allowed[collection]))
  }
  if(req.method==='PUT' && id) {
    const rec=updateRecord(collection,id,await body(req),allowed[collection])
    return rec?json(res,200,rec):json(res,404,{error:'Not found'})
  }
  if(req.method==='DELETE' && id) return removeRecord(collection,id)?json(res,200,{ok:true}):json(res,404,{error:'Not found'})
  return json(res,405,{error:'Method not allowed'})
}

const page = String.raw`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apocalypse AI</title><style>
:root{font-family:system-ui,sans-serif;color:#eaf1e8;background:#101812}*{box-sizing:border-box}body{margin:0}.wrap{max-width:1100px;margin:auto;padding:18px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px}.brand{font-size:1.7rem;font-weight:800}.muted{color:#a8b5aa}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.card{background:#18231b;border:1px solid #344b39;border-radius:14px;padding:16px}.big{font-size:2rem;font-weight:800}
button{background:#7ca66f;color:#071008;border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer}input,select,textarea{width:100%;background:#0f1711;color:#fff;border:1px solid #46604b;border-radius:8px;padding:10px;margin:5px 0 10px}
nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}nav button{background:#243529;color:#eaf1e8}.hidden{display:none}.row{display:flex;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid #344b39;padding:10px 0}.danger{background:#a66f6f}.pill{font-size:.8rem;border:1px solid #52705a;border-radius:999px;padding:3px 7px}
</style></head><body><div class="wrap">
<header><div><div class="brand">🌎 Apocalypse AI</div><div class="muted">Offline-first local survival & homestead system</div></div><button id="logout" class="hidden">Log out</button></header>
<section id="setup" class="card hidden"><h2>First-run setup</h2><p>Create the local owner. Nothing is sent to the cloud.</p><input id="ownerName" placeholder="Owner name"><input id="ownerPass" type="password" placeholder="Password (8+ characters)"><button onclick="setup()">Create Planet</button><p id="setupMsg"></p></section>
<section id="login" class="card hidden"><h2>Unlock Planet</h2><input id="loginPass" type="password" placeholder="Password"><button onclick="login()">Unlock</button><p id="loginMsg"></p></section>
<main id="app" class="hidden"><nav><button onclick="show('modules')">All 27 Features</button><button onclick="show('dash')">Dashboard</button><button onclick="show('animals')">Animals</button><button onclick="show('inventory')">Inventory</button><button onclick="show('notes')">Notes</button><button onclick="show('sensors')">Sensors</button><button onclick="show('identities')">Planet IDs</button></nav>
<section id="dash"></section><section id="modules" class="hidden"><div class="card"><h2>Planet — 27 Feature Workspaces</h2><p class="muted">Every workspace stores structured offline records locally. Open one to add plans, references, events, procedures, listings, observations or other module data.</p><div id="moduleGrid" class="grid"></div></div><div id="moduleEditor"></div></section>
<section id="animals" class="hidden"><div class="card"><h2>Add animal</h2><div class="grid"><input id="aName" placeholder="Name"><input id="aSpecies" placeholder="Species (pig, goat, chicken...)"><input id="aBreed" placeholder="Breed"><select id="aSex"><option value="">Sex</option><option>female</option><option>male</option></select><input id="aTag" placeholder="Ear tag / RFID"><input id="aBirth" type="date"></div><textarea id="aNotes" placeholder="Health, breeding, feed or general notes"></textarea><button onclick="addAnimal()">Create animal + Planet ID</button></div><div id="animalList" class="card"></div></section>
<section id="inventory" class="hidden"><div class="card"><h2>Add inventory</h2><div class="grid"><input id="iName" placeholder="Item"><input id="iCat" placeholder="Category"><input id="iQty" type="number" step="any" placeholder="Quantity"><input id="iUnit" placeholder="Unit"><input id="iLoc" placeholder="Location"><input id="iMin" type="number" step="any" placeholder="Minimum stock"></div><button onclick="addInventory()">Add inventory</button></div><div id="inventoryList" class="card"></div></section>
<section id="notes" class="hidden"><div class="card"><h2>Journal / notes</h2><input id="nTitle" placeholder="Title"><input id="nCat" placeholder="Category"><textarea id="nBody" placeholder="Write a record..."></textarea><button onclick="addNote()">Save note</button></div><div id="noteList" class="card"></div></section>
<section id="sensors" class="hidden"><div class="card"><h2>Register sensor / reading</h2><div class="grid"><input id="sName" placeholder="Sensor name"><input id="sKind" placeholder="Kind (water, solar, soil...)"><input id="sLoc" placeholder="Location"><input id="sVal" placeholder="Latest value"><input id="sUnit" placeholder="Unit"></div><button onclick="addSensor()">Save sensor</button></div><div id="sensorList" class="card"></div></section>
<section id="identities" class="hidden"><div class="card"><h2>Create Planet ID</h2><div class="grid"><input id="pName" placeholder="Name"><select id="pType"><option>person</option><option>animal</option><option>asset</option><option>device</option><option>location</option></select></div><button onclick="addIdentity()">Create ID</button></div><div id="identityList" class="card"></div></section>
</main></div><script>
const q=id=>document.getElementById(id); const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
async function api(url,opt={}){const r=await fetch(url,{headers:{'content-type':'application/json'},...opt});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d}
async function boot(){const s=await api('/api/status');q(s.setup?'login':'setup').classList.remove('hidden')}
async function setup(){try{const d=await api('/api/setup',{method:'POST',body:JSON.stringify({name:q('ownerName').value,password:q('ownerPass').value})});q('setupMsg').textContent='Created '+d.planetId+'. Unlock with your password.';q('setup').classList.add('hidden');q('login').classList.remove('hidden')}catch(e){q('setupMsg').textContent=e.message}}
async function login(){try{await api('/api/login',{method:'POST',body:JSON.stringify({password:q('loginPass').value})});q('login').classList.add('hidden');q('app').classList.remove('hidden');q('logout').classList.remove('hidden');refresh()}catch(e){q('loginMsg').textContent=e.message}}
q('logout').onclick=async()=>{await api('/api/logout',{method:'POST'});location.reload()}
function show(id){for(const s of q('app').querySelectorAll(':scope>section'))s.classList.add('hidden');q(id).classList.remove('hidden');refresh()}
async function refresh(){try{const d=await api('/api/dashboard');q('dash').innerHTML='<div class="card"><h2>'+esc(d.owner.name)+'’s Planet</h2><span class="pill">'+esc(d.owner.planetId)+'</span><p><button onclick="show(\'modules\')">Open all 27 features</button> <button onclick="location.href=\'/api/backup\'">Backup</button></p></div><div class="grid" style="margin-top:12px">'+Object.entries(d.counts).map(([k,v])=>'<div class="card"><div class="big">'+v+'</div><div class="muted">'+esc(k)+'</div></div>').join('')+'</div>';const mods=await api('/api/modules');q('moduleGrid').innerHTML=mods.map(m=>'<div class="card"><span class="pill">#'+m.number+'</span><h3>'+esc(m.name)+'</h3><p class="muted">'+esc(m.description)+'</p><p>'+m.count+' records</p><button onclick="openModule(\''+m.slug+'\')">Open</button></div>').join('');for(const [c,id,fmt] of [['animals','animalList',x=>x.name+' — '+x.species+' / '+x.breed+' · '+x.planetId],['inventory','inventoryList',x=>x.name+' — '+x.quantity+' '+x.unit+' · '+x.location],['notes','noteList',x=>x.title+' — '+x.body],['sensors','sensorList',x=>x.name+' — '+x.value+' '+x.unit+' · '+x.location],['identities','identityList',x=>x.name+' — '+x.type+' · '+x.planetId]]){const rows=await api('/api/'+c);q(id).innerHTML='<h2>'+c[0].toUpperCase()+c.slice(1)+'</h2>'+rows.slice().reverse().map(x=>'<div class="row"><span>'+esc(fmt(x))+'</span><button class="danger" onclick="del(\''+c+'\',\''+x.id+'\')">Delete</button></div>').join('')}}catch(e){if(e.message.includes('Authentication'))location.reload()}}
async function post(c,b){await api('/api/'+c,{method:'POST',body:JSON.stringify(b)});refresh()}
async function del(c,id){if(confirm('Delete this record?')){await api('/api/'+c+'/'+id,{method:'DELETE'});refresh()}}
const addAnimal=()=>post('animals',{name:q('aName').value,species:q('aSpecies').value,breed:q('aBreed').value,sex:q('aSex').value,tag:q('aTag').value,birthDate:q('aBirth').value,notes:q('aNotes').value,status:'active'})
const addInventory=()=>post('inventory',{name:q('iName').value,category:q('iCat').value,quantity:Number(q('iQty').value||0),unit:q('iUnit').value,location:q('iLoc').value,minimum:Number(q('iMin').value||0)})
const addNote=()=>post('notes',{title:q('nTitle').value,category:q('nCat').value,body:q('nBody').value})
const addSensor=()=>post('sensors',{name:q('sName').value,kind:q('sKind').value,location:q('sLoc').value,value:q('sVal').value,unit:q('sUnit').value,readingAt:new Date().toISOString()})
const addIdentity=()=>post('identities',{name:q('pName').value,type:q('pType').value})
async function openModule(slug){const mods=await api('/api/modules'),m=mods.find(x=>x.slug===slug),rows=await api('/api/modules/'+slug+'/records');q('moduleEditor').innerHTML='<div class="card" style="margin-top:12px"><h2>#'+m.number+' '+esc(m.name)+'</h2><p>'+esc(m.description)+'</p><input id="mrTitle" placeholder="Title"><input id="mrKind" placeholder="Type / kind"><input id="mrTags" placeholder="Tags, comma separated"><textarea id="mrBody" placeholder="Details, procedure, observation, plan or reference"></textarea><button onclick="addModuleRecord(\''+slug+'\')">Save offline record</button><div id="mrRows">'+rows.slice().reverse().map(x=>'<div class="row"><span><b>'+esc(x.title||'Untitled')+'</b> · '+esc(x.kind)+'<br><span class="muted">'+esc(x.body)+'</span></span><button class="danger" onclick="deleteModuleRecord(\''+slug+'\',\''+x.id+'\')">Delete</button></div>').join('')+'</div>'}
async function addModuleRecord(slug){await api('/api/modules/'+slug+'/records',{method:'POST',body:JSON.stringify({title:q('mrTitle').value,kind:q('mrKind').value,tags:q('mrTags').value.split(',').map(x=>x.trim()).filter(Boolean),body:q('mrBody').value})});openModule(slug);refresh()}
async function deleteModuleRecord(slug,id){if(confirm('Delete this record?')){await api('/api/modules/'+slug+'/records/'+id,{method:'DELETE'});openModule(slug);refresh()}}
boot()
</script></body></html>`

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`)
    if(url.pathname.startsWith('/api/')) return await api(req,res,url)
    if(req.method==='GET' && (url.pathname==='/'||url.pathname==='/planet')) return text(res,200,page,'text/html; charset=utf-8')
    return text(res,404,'Not found')
  }catch(e){console.error(e);return json(res,500,{error:'Internal error'})}
})
server.listen(PORT,'0.0.0.0',()=>console.log(`Planet Core listening on http://0.0.0.0:${PORT}`))
