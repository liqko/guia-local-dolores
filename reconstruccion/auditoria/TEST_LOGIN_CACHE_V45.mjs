import assert from 'node:assert/strict';
import {subscriberLoginV2} from '../worker/modules/suscriptor-login-v2.js';
import {withLoginCacheV45} from '../worker/core/login-cache-v45.js';
import {observeDbV41,finishObservationV42} from '../worker/core/db-observation-v41.js';
const values=new Map();
const env={SERVER_SECRET:'test-only',GLD_CACHE_KV:{
 async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)}
}};
let account={id:'S',mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true};
let relations=Array.from({length:8},(_,i)=>({id:'R'+i,suscriptor_id:'S',anunciante_id:'A'+i,anunciante_nombre:'Comercio '+i,rol:'ADMIN',activo:true}));
const records=new Map(relations.map((r,i)=>['anunciantes_administracion/A'+i,{id:'A'+i,funcionalidades:'PROMOS, EVENTOS'}]));
const raw={
 async queryEqual(c,f,v){if(c==='suscriptores')return account?[{...account}]:[];assert.equal(c,'suscriptor_anunciante');return relations.filter(r=>r[f]===v).map(r=>({...r}))},
 async get(c,id){return c==='suscriptor_anunciante'?relations.find(r=>r.id===id)||null:records.get(c+'/'+id)||null},
 async patch(c,id,p){if(c==='suscriptor_anunciante'){let r=relations.find(r=>r.id===id);if(!r){r={id};relations.push(r)}Object.assign(r,p);return {...r}}const r={...records.get(c+'/'+id),id,...p};records.set(c+'/'+id,r);return r},
 async delete(c,id){if(c==='suscriptores')account=null;else if(c==='suscriptor_anunciante')relations=relations.filter(r=>r.id!==id);else records.delete(c+'/'+id)},
 async listCollection(){throw Error('No se permiten barridos')}
};
function request(){const report={operations:{}};const db=withLoginCacheV45(observeDbV41(raw,report),env);return {db,totals:()=>finishObservationV42(report).totals}}
async function login(clave='test-password'){const req=request();const out=await subscriberLoginV2({env,db:req.db,body:{mail:'persona@test.invalid',clave}});await req.db.flushLoginCache();return {out,...req.totals()}}
let cold=await login();assert.equal(cold.out.success,true);assert.equal(cold.read_calls,10);assert.equal(cold.documents_returned,17);
let warm=await login();assert.equal(warm.read_calls,1);assert.equal(warm.documents_returned,1);assert.deepEqual(warm.out.anunciantes,cold.out.anunciantes);assert.equal(warm.write_calls,0);assert.equal(warm.delete_calls,0);
let bad=await login('incorrecta');assert.equal(bad.out.success,false);assert.equal(bad.read_calls,1);
account.clave='nueva';bad=await login();assert.equal(bad.out.success,false);account.clave='test-password';
let req=request();await req.db.patch('anunciantes_administracion','A3',{funcionalidades:'ACTIVIDADES'});await req.db.flushLoginCache();warm=await login();assert.equal(warm.documents_returned,2);assert.equal(warm.out.anunciantes[3].permisos,'ACTIVIDADES');
req=request();await req.db.patch('suscriptor_anunciante','R0',{activo:false});await req.db.flushLoginCache();assert.equal(req.totals().documents_returned,1);warm=await login();assert.equal(warm.out.anunciantes.length,7);assert.equal(warm.documents_returned,9);
req=request();await req.db.queryEqual('suscriptor_anunciante','suscriptor_id','S');await req.db.delete('suscriptor_anunciante','R1');await req.db.flushLoginCache();warm=await login();assert.equal(warm.out.anunciantes.length,6);
// Una carga antigua que termina luego de la mutación no repuebla la revisión nueva.
const previous=[...values.entries()].find(([k])=>k.startsWith('login:relations:v45:S:')&&!k.endsWith(':revision'));
req=request();await req.db.patch('suscriptor_anunciante','R2',{activo:false});await req.db.flushLoginCache();if(previous)values.set(...previous);warm=await login();assert.equal(warm.out.anunciantes.length,5);
// Caducidad: recargar solamente la lista; los complementos siguen en caché.
for(const [k,v] of values)if(k.startsWith('login:relations:v45:S:')&&!k.endsWith(':revision')){const p=JSON.parse(v);p.expires_at=0;values.set(k,JSON.stringify(p))}
warm=await login();assert.equal(warm.documents_returned,8);assert.equal(warm.read_calls,2);
req=request();await req.db.get('anunciantes_administracion','A3');assert.equal(req.totals().documents_returned,1); // el panel conserva su lectura fresca
req=request();await req.db.delete('suscriptores','S');await req.db.flushLoginCache();bad=await login();assert.equal(bad.out.success,false);
assert.ok(![...values.values()].join('').includes('test-password'));
console.log('V45: frío 10 consultas/17 documentos; caliente 1/1. Contraseña, permisos, baja, caducidad, carreras y lecturas del panel comprobadas; sin contraseñas en KV.');
