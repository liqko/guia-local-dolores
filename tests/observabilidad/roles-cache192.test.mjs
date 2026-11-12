import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
const source=await readFile(new URL('../../worker/worker190_roles_multiples_sobre_189.txt',import.meta.url),'utf8');
const worker=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {rolesInternosRoute188,issue2};').toString('base64'));
function setup(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 const state={storage:{sql:{exec(statement,...args){const p=sql.prepare(statement);if(p.columns().length){const rows=p.all(...args);return Object.assign(rows,{rowsRead:rows.length,rowsWritten:0});}const result=p.run(...args);return Object.assign([],{rowsRead:0,rowsWritten:result.changes});}},transactionSync(fn){sql.exec('BEGIN');try{const value=fn();sql.exec('COMMIT');return value;}catch(e){sql.exec('ROLLBACK');throw e;}}}};
 const rows={superadmins:new Map([['P',{id:'P',suscriptor_id:'P',rol:'SUPERADMIN_PRINCIPAL',activo:true}],['A',{id:'A',suscriptor_id:'A',rol:'ADMIN_LOCAL',activo:true}]]),personal_comercial:new Map(),suscriptores:new Map([['A',{id:'A',suscriptor_id:'A',nombre:'Persona A',mail:'a@example.invalid',activo:true,clave:'NO_PERSISTIR'}]])};
 const calls=[],writes=[];let failAfterCommit=false;let pause;
 const db={
  async get(c,id){calls.push(['get',c,id]);return structuredClone(rows[c]?.get(id)||null);},
  async listCollection(c){calls.push(['list',c]);if(pause){const pending=pause;pause=null;await pending;}return [...rows[c].values()].map(x=>structuredClone(x));},
  async patch(c,id,patch){writes.push(['patch',c,id]);const row={...rows[c].get(id),...patch,id};rows[c].set(id,row);if(failAfterCommit){failAfterCommit=false;throw Error('Respuesta perdida después del commit');}return structuredClone(row);},
  async delete(c,id){writes.push(['delete',c,id]);rows[c].delete(id);return true;},
  async commitPatches(entries){const saved=[];for(const e of entries){if(e.remove){rows[e.collection].delete(e.id);saved.push(null);}else{const row={...rows[e.collection].get(e.id),...e.patch,id:e.id};rows[e.collection].set(e.id,row);saved.push(structuredClone(row));}}writes.push(['commit']);return saved;}
 };
 const kv=new Map();const env={SERVER_SECRET:'ensayo-aislado192',GLD_CACHE_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k)}};
 let actor=new worker.PrivateRoles192(state,env,()=>db);
 env.GLD_PUBLIC_CACHE={idFromName:name=>name,get(name){assert.equal(name,'internal-role-directory-v192');return {fetch:async req=>actor.fetch(await req.json())};}};
 const sourceDb=worker.roleSourceDb192(db,env);
 const call=async(path,params={},auth=true,body=null)=>{
  const token=await worker.issue2(env,{sid:'P',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:0});
  const url=new URL('https://ensayo.invalid/superadmin/'+path);for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);
  const request=new Request(url,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const report={operations:{}};env.__gldRequestReport119=report;
  const response=await worker.rolesInternosRoute188({path:url.pathname,request,url,env,db:sourceDb,cache:{get:async()=>null}});
  return {status:response.status,body:await response.json(),report};
 };
 return {sql,env,db,sourceDb,rows,calls,writes,call,restart(){actor=new worker.PrivateRoles192(state,env,()=>db);},failCommit(){failAfterCommit=true;},pauseReads(p){pause=p;}};
}
test('listado, persona, supervisor y ausencias comparten una copia durable; reapertura cero lecturas fuente',async t=>{
 const h=setup(t);
 let r=await h.call('internal-roles/list');assert.equal(r.status,200);assert.equal(h.calls.length,3);
 assert.equal(r.report.operations['listCollection:superadmins'].calls,1);
 assert.equal(r.report.operations['listCollection:personal_comercial'].calls,1);
 const before=h.calls.length;
 for(let i=0;i<2;i++){
  r=await h.call('internal-roles/person',{suscriptor_id:'A'});assert.deepEqual(r.body.roles,[{rol:'MODERADOR',activo:true}]);
  r=await h.call('commercial/personnel',{suscriptor_id:'A',rol:'SUPERVISOR'});assert.equal(r.body.personal,null);assert.deepEqual(r.body.team,[]);
 }
 assert.equal(h.calls.length,before);h.restart();await h.call('internal-roles/list');assert.equal(h.calls.length,before);
 assert(!h.calls.some(x=>x[0]==='get'&&x[1]==='personal_comercial'));
 assert(!JSON.stringify(h.sql.prepare('SELECT * FROM gh_roles192_rows').all()).includes('NO_PERSISTIR'));
});
test('persona sin roles ni suscripción: ausencia recordada, sin consultar cada asignación posible',async t=>{
 const h=setup(t);await h.call('internal-roles/person',{suscriptor_id:'NO_EXISTE'});assert.equal(h.calls.length,3);
 await h.call('internal-roles/person',{suscriptor_id:'NO_EXISTE'});assert.equal(h.calls.length,3);
 assert.deepEqual(h.calls,[['list','superadmins'],['list','personal_comercial'],['get','suscriptores','NO_EXISTE']]);
 await h.sourceDb.patch('suscriptores','NO_EXISTE',{suscriptor_id:'NO_EXISTE',nombre:'Alta',activo:true});
 const r=await h.call('internal-roles/person',{suscriptor_id:'NO_EXISTE'});assert.equal(r.body.suscriptor_activo,true);assert.equal(h.calls.length,3);
});
test('altas, cambios, bajas y asignación de equipo actualizan la misma copia sin reconstruir ni perder otro rol',async t=>{
 const h=setup(t);await h.call('internal-roles/list');const n=h.calls.length;
 await h.sourceDb.patch('personal_comercial','A__VENDEDOR',{suscriptor_id:'A',rol:'VENDEDOR',activo:true,supervisor_id:'B'});
 await h.sourceDb.patch('personal_comercial','A__SUPERVISOR',{suscriptor_id:'A',rol:'SUPERVISOR',activo:true});
 let r=await h.call('internal-roles/person',{suscriptor_id:'A'});assert.equal(r.body.roles.length,3);
 await h.sourceDb.delete('personal_comercial','A__VENDEDOR');
 r=await h.call('internal-roles/person',{suscriptor_id:'A'});assert.deepEqual(r.body.roles.map(x=>x.rol),['MODERADOR','SUPERVISOR']);
 await h.sourceDb.patch('suscriptores','A',{activo:false,nombre:'Cambio'});
 r=await h.call('internal-roles/list');assert(r.body.results.every(x=>x.activo===false&&x.nombre==='Cambio'));
 await h.sourceDb.patch('personal_comercial','C__VENDEDOR',{suscriptor_id:'C',rol:'VENDEDOR',activo:true,supervisor_id:'A'});
 r=await h.call('commercial/personnel',{suscriptor_id:'A',rol:'SUPERVISOR'});assert.equal(r.body.team[0].suscriptor_id,'C');
 await h.sourceDb.commitPatches([{collection:'personal_comercial',id:'C__VENDEDOR',patch:{supervisor_id:'B'}},{collection:'superadmins',id:'A',remove:true}]);
 r=await h.call('commercial/personnel',{suscriptor_id:'A',rol:'SUPERVISOR'});assert.deepEqual(r.body.team,[]);
 r=await h.call('internal-roles/person',{suscriptor_id:'A'});assert.deepEqual(r.body.roles.map(x=>x.rol),['SUPERVISOR']);
 assert.equal(h.calls.length,n);
});
test('respuesta de escritura perdida: reconciliar registro afectado sin repetir la escritura',async t=>{
 const h=setup(t);await h.call('internal-roles/list');const n=h.calls.length;
 h.failCommit();await assert.rejects(h.sourceDb.patch('personal_comercial','A__VENDEDOR',{suscriptor_id:'A',rol:'VENDEDOR',activo:true}));
 h.restart();let r=await h.call('internal-roles/person',{suscriptor_id:'A'});
 assert(r.body.roles.some(x=>x.rol==='VENDEDOR'));assert.equal(h.calls.length,n+1);assert.equal(h.writes.length,1);
 await h.call('internal-roles/person',{suscriptor_id:'A'});assert.equal(h.calls.length,n+1);
 assert.equal(h.sql.prepare("SELECT * FROM gh_roles192_meta WHERE key='pending'").all().length,0);
});
test('solicitudes concurrentes inicializan una vez; escritura y lectura no se intercalan en la copia',async t=>{
 const h=setup(t);let release;const paused=new Promise(resolve=>{release=resolve;});h.pauseReads(paused);
 const a=h.call('internal-roles/person',{suscriptor_id:'A'}),b=h.call('internal-roles/person',{suscriptor_id:'A'});
 await new Promise(resolve=>setImmediate(resolve));release();await Promise.all([a,b]);assert.equal(h.calls.length,3);
 await Promise.all([h.sourceDb.patch('personal_comercial','A__VENDEDOR',{suscriptor_id:'A',rol:'VENDEDOR',activo:true}),h.call('internal-roles/person',{suscriptor_id:'A'})]);
 const r=await h.call('internal-roles/person',{suscriptor_id:'A'});assert(r.body.roles.some(x=>x.rol==='VENDEDOR'));assert.equal(h.calls.length,3);
});
test('autorización se comprueba antes de acceder a la copia; sesión revocada no recibe datos',async t=>{
 const h=setup(t);let r=await h.call('internal-roles/list',{},false);assert.equal(r.status,401);assert.equal(h.calls.length,0);
 // Revocación de la cuenta principal: la copia no sustituye el estado de sesión.
 h.env.GLD_CACHE_KV.get=async key=>key==='subscriber:session-state:v1:P'?JSON.stringify({deleted:true,version:1}):null;
 r=await h.call('internal-roles/list');assert.equal(r.status,401);assert.equal(h.calls.length,0);
 const token=await worker.issue2(h.env,{sid:'P',rol:'SUPERADMIN',persistent:true,sv:0});
 const url=new URL('https://ensayo.invalid/superadmin/internal-roles/list');
 const response=await worker.rolesInternosRoute188({path:url.pathname,url,request:new Request(url,{headers:{Authorization:'Bearer '+token}}),env:h.env,db:h.sourceDb,cache:{get:async()=>null}});
 assert([401,403].includes(response.status));assert.equal(h.calls.length,0);
});

test('guardar desde la ruta real actualiza copia y revoca sesiones sin leer ausencias en Firestore',async t=>{
 const h=setup(t);await h.call('internal-roles/list');const n=h.calls.length;
 const saved=await h.call('commercial/personnel',{},true,{suscriptor_id:'A',rol:'VENDEDOR',activo:true,comision_porcentaje:5,comision_supervision_porcentaje:0,supervisor_id:'',ciudades:[]});
 assert.equal(saved.status,200);assert.equal(h.writes.length,1);
 const state=JSON.parse(await h.env.GLD_CACHE_KV.get('subscriber:session-state:v1:A'));assert.equal(state.version,1);
 const result=await h.call('internal-roles/person',{suscriptor_id:'A'});assert(result.body.roles.some(x=>x.rol==='VENDEDOR'));assert.equal(h.calls.length,n);
});
test('commit parcial no borra campos de una proyección conocida y la baja de suscriptor se refleja',async t=>{
 const h=setup(t);await h.call('internal-roles/list');const n=h.calls.length;
 const old=h.db.commitPatches;h.db.commitPatches=async entries=>{await old(entries);return entries.map(e=>({...e.patch,id:e.id}));};
 await h.sourceDb.commitPatches([{collection:'suscriptores',id:'A',patch:{activo:false}}]);
 const r=await h.call('internal-roles/list');assert(r.body.results.every(x=>x.nombre==='Persona A'&&x.activo===false));
 await h.sourceDb.delete('suscriptores','A');const gone=await h.call('internal-roles/person',{suscriptor_id:'A'});assert.equal(gone.body.suscriptor_activo,false);assert.equal(h.calls.length,n);
});
