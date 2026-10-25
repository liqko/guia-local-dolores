import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,city,actorName} from './fixture.mjs';
const load=async source=>(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')));
const originalSource=readFileSync(new URL('../../worker/base-observado136.mjs',import.meta.url),'utf8');
const currentSource=readFileSync(new URL('../../worker/login-acciones138.mjs',import.meta.url),'utf8');
const original=await load(originalSource.replace('async function verifyAdmin(env, request2) {','async function verifyAdmin(env, request2) {globalThis.__authCount138++;'));
const current=await load(currentSource.replace('async function verifyAdminUncached138(env, request2) {','async function verifyAdminUncached138(env, request2) {globalThis.__authCount138++;')+'\nexport {rebuildTerritory,requestCache121,observeKv117,createCache};');
let active;const priorFetch=globalThis.fetch,priorLog=console.log;const evidence=[];
before(()=>{globalThis.fetch=(...args)=>{assert.ok(active,'No unscoped network');return active.network(...args);};console.log=()=>{};});
after(()=>{globalThis.fetch=priorFetch;console.log=priorLog;if(process.env.GLD_ACTION_REPORT)writeFileSync(process.env.GLD_ACTION_REPORT,JSON.stringify(evidence,null,2));});
function use(mod=current,opts){active=fixture(mod.GldPublicCache119,opts);return active;}
const save=(f,item,options={})=>f.call(current.default,'/superadmin/cities/create',{method:'POST',body:{item},...options});
test('ordinary public reads and missing-cache fallback retain status, content and operation counts',async()=>{
 for(const empty of [false,true]){
  const a=use(original,{cities:[city('A')],empty}),before=await a.call(original.default,'/territory/public',{auth:false});
  const b=use(current,{cities:[city('A')],empty}),after=await b.call(current.default,'/territory/public',{auth:false});
  assert.equal(after.status,before.status);assert.deepEqual(after.result,before.result);assert.equal(b.counts['kv.get'],1);assert.equal(b.counts['do.calls']||0,0);assert.equal(b.counts['firestore.GET']||0,0);
 }
});
test('administrative read verifies once, preserves three physical KV reads and local-city filtering',async()=>{
 for(const role of ['SUPERADMIN_PRINCIPAL','SUPERADMIN','ADMIN_LOCAL']){
  const a=use(original,{cities:[city('A'),city('B')]});globalThis.__authCount138=0;const before=await a.call(original.default,undefined,{role});const oldChecks=globalThis.__authCount138;
  const b=use(current,{cities:[city('A'),city('B')]});globalThis.__authCount138=0;const after=await b.call(current.default,undefined,{role});
  assert.deepEqual(after.result,before.result);assert.equal(b.counts['kv.get'],3);assert.equal(globalThis.__authCount138,1);assert.equal(after.consumption.cloudflare.action_store.calls,0);
  evidence.push({action:'read:'+role,beforeAuthChecks:oldChecks,afterAuthChecks:globalThis.__authCount138,counts:b.counts});
 }
});
test('unauthenticated and local administrators cannot mutate; no storage writes',async()=>{
 for(const options of [{auth:false},{role:'ADMIN_LOCAL'}]){
  const f=use(),r=await save(f,city('A'),options);assert.equal(r.status,options.auth===false?401:403);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['do.calls']||0,0);
 }
});
test('the incoming POST body is decoded once instead of three times',async()=>{
 const prior=Request.prototype.json;let reads=0;
 Request.prototype.json=async function(){if(new URL(this.url).hostname==='local.invalid')reads++;return prior.call(this);};
 try{
  const a=use(original);await a.call(original.default,'/superadmin/cities/create',{method:'POST',body:{item:city('A')}});assert.equal(reads,3);
  reads=0;const b=use();assert.equal((await save(b,city('A'))).status,200);assert.equal(reads,1);
 }finally{Request.prototype.json=prior;}
});
test('first save, identical PATCH and next real edit: counts include durable coordination',async()=>{
 const f=use();let r=await save(f,city('A'));assert.equal(r.status,200);assert.deepEqual(f.packet().ciudades.map(c=>c.ciudad_id),['A']);
 assert.equal(f.counts['firestore.PATCH'],1);assert.equal(f.counts['kv.get'],4);assert.equal(f.counts['kv.put'],2);assert.equal(f.counts['sql.write'],4);assert.equal(f.counts['alarm.set'],1);
 assert.equal(r.consumption.cloudflare.action_store.rows_written,6);assert.equal(f.counts['do-kv.put'],1);assert.equal(r.consumption.cloudflare.kv.get_calls,4);assert.equal(r.consumption.firestore.write_calls,1);
 evidence.push({action:'create-cold',counts:{...f.counts},consumption:r.consumption});
 f.reset();r=await f.call(current.default,'/superadmin/cities/A',{method:'PATCH',body:{item:city('A')}});
 assert.equal(r.status,200);assert.equal(r.result.updated,false);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['sql.write']||0,0);assert.equal(f.counts['alarm.set']||0,0);assert.equal(f.counts['kv.get'],2);
 evidence.push({action:'save-unchanged-hot',counts:{...f.counts},consumption:r.consumption});
 f.reset();r=await f.call(current.default,'/superadmin/cities/A',{method:'PATCH',body:{item:city('A','Changed')}});
 assert.equal(r.status,200);assert.equal(f.counts['firestore.PATCH'],1);assert.equal(f.counts['kv.get'],2);assert.equal(f.packet().ciudades[0].ciudad_visible,'Changed');
 evidence.push({action:'edit-hot',counts:{...f.counts},consumption:r.consumption});
});
test('parallel cities and parallel country/province changes retain every update',async()=>{
 const f=use();const responses=await Promise.all([save(f,city('A')),save(f,city('B'))]);assert.ok(responses.every(r=>r.status===200));assert.deepEqual(f.packet().ciudades.map(c=>c.ciudad_id),['A','B']);assert.equal(f.counts['firestore.PATCH'],2);
 const more=await Promise.all([
  f.call(current.default,'/superadmin/countries/AR',{method:'PATCH',body:{item:{pais_id:'AR',nombre:'Argentina editada',activo:true}}}),
  f.call(current.default,'/superadmin/provinces/P',{method:'PATCH',body:{item:{provincia_id:'P',pais_id:'AR',nombre:'Provincia editada',activo:true}}})
 ]);assert.ok(more.every(r=>r.status===200));assert.equal(f.packet('admin').paises[0].nombre,'Argentina editada');assert.equal(f.packet('admin').provincias[0].nombre,'Provincia editada');assert.equal(f.packet().ciudades.length,2);
});
test('explicit idempotency key survives restart, rejects changed payload and adds no repeat writes',async()=>{
 const f=use(),headers={'Idempotency-Key':'fixture-operation'};
 assert.equal((await save(f,city('A'),{headers})).status,200);f.evict();f.reset();
 const r=await save(f,city('A'),{headers});assert.equal(r.status,200);assert.equal(r.result.operation_replayed,true);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['sql.write']||0,0);
 assert.equal((await save(f,city('B'),{headers})).status,409);
});
test('failure after source save resumes only the missing public publication after restart',async()=>{
 const f=use();f.fail.publicPut=1;let r=await save(f,city('A'));assert.equal(r.status,503);assert.equal(r.result.operation_pending,true);assert.equal(f.snapshot().pending.phase,'publish');assert.equal(f.snapshot().pending.index,1);assert.equal(f.packet().ciudades.length,0);
 f.evict();f.reset();assert.equal(await f.alarm(),true);assert.deepEqual(f.packet().ciudades.map(c=>c.ciudad_id),['A']);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['firestore.GET']||0,0);assert.equal(f.counts['kv.put'],1);assert.equal(f.snapshot().pending,null);
 evidence.push({action:'recover-public-only-cold',counts:{...f.counts}});
});
test('lost Firestore acknowledgment and failed SQL checkpoint do not repeat the source write',async()=>{
 for(const failure of ['sourceAfterWrite','sqlAfterSource']){
  const f=use();f.fail[failure]=1;const r=await save(f,city('A'));assert.equal(r.status,503);assert.equal(f.counts['firestore.PATCH'],1);f.evict();f.reset();await f.alarm();assert.equal(f.counts['firestore.GET'],1);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.packet().ciudades[0].ciudad_id,'A');assert.equal(f.snapshot().pending,null);
 }
});
test('lost DO response is reported as incomplete, and retry is a no-op',async()=>{
 const f=use();f.fail.transportAfter=1;const r=await save(f,city('A'));assert.equal(r.status,500);assert.equal(r.consumption.firestore.write_calls,null);assert.equal(r.consumption.cloudflare.action_store.rows_written,null);assert.ok(r.consumption.coverage.missing.includes('action-store-unreported-internal-operations'));
 f.reset();assert.equal((await save(f,city('A'))).result.updated,false);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);
});
test('cancelled alarm failure cannot turn a completed save into an unsuccessful save',async()=>{
 const f=use();f.fail.cancelAlarm=1;const r=await save(f,city('A'));assert.equal(r.status,200);f.reset();await f.alarm();assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);
});
test('activation, deactivation and explicit rebuild preserve public/admin data contracts',async()=>{
 const f=use();assert.equal((await save(f,city('A'))).status,200);
 const paused=await f.call(current.default,'/superadmin/cities/A',{method:'PATCH',body:{item:{...city('A'),activa:false}}});assert.equal(paused.status,200);assert.equal(f.packet().ciudades.length,0);assert.equal(f.packet('admin').ciudades.length,1);
 assert.equal((await f.call(current.default,'/superadmin/cities/A',{method:'PATCH',body:{item:city('A')}})).status,200);
 f.reset();const rebuilt=await f.call(current.default,'/superadmin/territory/rebuild-cache',{method:'POST',body:{}});assert.equal(rebuilt.status,200);assert.equal(rebuilt.result.rebuilt,true);assert.equal(rebuilt.result.counts.ciudades,1);assert.equal(f.counts['firestore.GET'],3);assert.equal(f.counts['firestore.PATCH']||0,0);
});
test('absent binding fails closed and missing catalogs rebuild explicitly without public fallback reads',async()=>{
 const f=use();delete f.env.GLD_PUBLIC_CACHE;assert.equal((await save(f,city('A'))).status,503);assert.equal(f.counts['firestore.PATCH']||0,0);
 const g=use(current,{empty:true});assert.equal((await save(g,city('A'))).status,503);assert.equal(g.counts['firestore.PATCH']||0,0);const r=await g.call(current.default,'/superadmin/territory/rebuild-cache',{method:'POST',body:{}});assert.equal(r.status,200);assert.equal(g.packet().paises.length,1);
});
test('global-maintenance territorial rebuild uses the coordinator and primes the caller cache',async()=>{
 const f=use();const report={operations:{},request_id:'local-global-rebuild'};
 const env=current.requestCache121(current.observeKv117(f.env,report),report,false),cache=current.createCache(env);
 const {session}=await import('./fixture.mjs');
 const request=new Request('https://local.invalid/superadmin/rebuild-all-cache',{method:'POST',headers:{Authorization:'Bearer '+session(),'Content-Type':'application/json'},body:'{}'});
 const response=await current.rebuildTerritory({env,request,cache,db:{}});assert.equal(response.status,200);assert.equal(f.counts['do.calls'],1);
 const reads=f.counts['kv.get'];assert.equal((await cache.get('territorio:public:v1')).paises.length,1);assert.equal(f.counts['kv.get'],reads);
 assert.equal(report.action_store138.calls,1);
});
test('automatic recovery is bounded to six attempts and never rewrites the saved source',async()=>{
 const f=use();f.fail.publicPut=99;assert.equal((await save(f,city('A'))).status,503);f.reset();
 for(let i=0;i<6;i++)assert.equal(await f.alarm(),true);
 assert.equal(await f.alarm(),false);assert.equal(f.snapshot().pending.attempts,6);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put'],6);
});
test('completion checkpoint failure checks publication instead of duplicating acknowledged writes',async()=>{
 const f=use();f.fail.sqlComplete=1;assert.equal((await save(f,city('A'))).status,503);assert.equal(f.packet().ciudades.length,1);f.evict();f.reset();await f.alarm();assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.snapshot().pending,null);
});
test('recovery will not overwrite an externally changed source',async()=>{
 const f=use();f.fail.sqlAfterSource=1;assert.equal((await save(f,city('A'))).status,503);
 f.docs.get('ciudades/A').fields.ciudad_visible={stringValue:'External edit'};f.evict();f.reset();await f.alarm();
 assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.docs.get('ciudades/A').fields.ciudad_visible.stringValue,'External edit');assert.ok(f.snapshot().pending);assert.equal(await f.alarm(),false);
});
test('oversized recovery state is rejected before Firestore or publication writes',async()=>{
 const f=use();const r=await save(f,{...city('A'),large:'x'.repeat(1000000)});assert.equal(r.status,503);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['sql.write']||0,0);
});
test('ordinary city no-op remains a no-op after coordinator eviction',async()=>{
 const f=use();await save(f,city('A'));f.evict();f.reset();const r=await save(f,city('A'));assert.equal(r.status,200);assert.equal(r.result.updated,false);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['sql.write']||0,0);assert.equal(f.counts['kv.get'],2);assert.equal(f.counts['sql.read'],1);
});
test('existing Gran Hermano save handler and its reload keep working with both Worker versions',async()=>{
 const html=readFileSync(new URL('../../plataforma/granhermano.html',import.meta.url),'utf8');
 const extract=name=>{const start=html.search(new RegExp('(?:async )?function '+name+'\\(')),end=html.indexOf('\n}',start);assert.ok(start>=0&&end>start);return html.slice(start,end+2);};
 const {session}=await import('./fixture.mjs');
 for(const mod of [original,current]){
  const f=use(mod),requests=[],alerts=[],elements=new Map();
  const context=vm.createContext({TOKEN:session(),TERRITORY_API_ORIGIN:'https://local.invalid',CSS:{escape:String},esc:String,alert:x=>alerts.push(x),
   document:{querySelector:selector=>({value:selector.includes('nombre')?'Ciudad A':selector.includes('pais')?'AR':'P'}),getElementById:id=>id==='ciuSelect'?null:(elements.get(id)||elements.set(id,{innerHTML:''}).get(id))},
   async fetch(url,options={}){requests.push({path:new URL(url).pathname,method:options.method||'GET'});return mod.default.fetch(new Request(url,options),f.env);}
  });
  vm.runInContext('let GH_CITIES=[],GH_COUNTRIES=[],GH_PROVINCES=[];\n'+['ghCargarCiudades','ghRenderCiudades','ghGuardarTerritorio'].map(extract).join('\n'),context);
  await vm.runInContext("ghGuardarTerritorio('ciudad','A')",context);
  assert.deepEqual(alerts,[]);assert.deepEqual(requests.map(r=>r.method),['POST','GET']);assert.equal(f.packet().ciudades[0].ciudad_visible,'Ciudad A');assert.equal(f.counts['firestore.PATCH'],1);assert.equal(f.counts['kv.get'],7);assert.equal(f.counts['kv.put'],2);
  evidence.push({action:mod===current?'GH-save-and-reload138':'GH-save-and-reload136',requests:[...requests],counts:{...f.counts},scope:'Actual HTML handlers in a local VM and complete Worker; provider fixtures. Browser preflight/cache timing not simulated.'});
  if(mod===current){f.reset();await vm.runInContext("ghGuardarTerritorio('ciudad','A')",context);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['sql.write']||0,0);assert.equal(f.counts['kv.get'],5);evidence.push({action:'GH-save-unchanged-and-reload138',counts:{...f.counts}});}
 }
});
test('administrative recovery status is read-only, reports pending state, and survives nameless cold starts',async()=>{
 const f=use();let r=await f.call(current.default,'/superadmin/territory/action-status');assert.equal(r.status,200);assert.equal(r.result.safe_to_restore_previous_worker,true);assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['sql.write']||0,0);
 f.fail.publicPut=1;assert.equal((await save(f,city('A'))).status,503);f.evict();f.reset();
 r=await f.call(current.default,'/superadmin/territory/action-status');assert.equal(r.result.safe_to_restore_previous_worker,false);assert.equal(r.result.pending.phase,'publish');assert.equal(f.counts['kv.put']||0,0);assert.equal(f.counts['firestore.PATCH']||0,0);assert.equal(f.counts['sql.write']||0,0);
 await f.alarm();r=await f.call(current.default,'/superadmin/territory/action-status');assert.equal(r.result.pending,null);assert.equal(r.result.safe_to_restore_previous_worker,true);
});
