import {test} from 'node:test';
import assert from 'node:assert/strict';
import {source} from './worker-source.mjs';
import {accessBinding201} from './access-fixture201.mjs';
const w=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {accessRecord201,subscriberSessionState,revokeSubscriberSessions,verifyAdminUncached138,verifySubscriberSessionRaw143,withAuthCacheV58,superadminLoginV2,issue2,issueSession,verifyAdminPanel155,routeDiagnosticsV87,changeSubscriberPasswordV2};\n//# sourceURL=worker-access-test.js').toString('base64'));
function setup(t){
 const raw=new Map(),gets=[],report={operations:{},kv:{get_calls:0,put_calls:0,delete_calls:0,list_calls:0,failures:0}};
 const env={SERVER_SECRET:'local-only-access-test',__gldRequestReport119:report,GLD_CACHE_KV:{get:async key=>{gets.push(key);return raw.get(key)||null;},put:async(key,v)=>raw.set(key,v),delete:async key=>raw.delete(key)}};
 env.GLD_PUBLIC_CACHE=accessBinding201(w,env,{get(){throw Error('Unexpected actor');}},t);
 const seed=(key,value)=>raw.set(key,JSON.stringify(value));
 const access=(sid,command)=>w.accessRecord201(env,sid,command);
 const token=(sid='P',rol='SUPERADMIN_PRINCIPAL',extra={})=>w.issue2(env,{sid,rol,persistent:true,sv:0,...extra});
 const request=token=>new Request('https://fixture.invalid/superadmin/dashboard',{headers:{Authorization:'Bearer '+token}});
 return {env,raw,gets,report,seed,access,token,request};
}
test('importe único de las tres claves antiguas; lectura única SQL después de reiniciar',async t=>{
 const h=setup(t);h.seed('subscriber:session-state:v1:P',{version:7,deleted:false});h.seed('admin:access:v72:P',{activo:true,revision:'r7'});h.seed('auth:admin:v100:P',{version:58,data:{id:'P',rol:'SUPERADMIN_PRINCIPAL',activo:true,access_revision:'r7'}});
 const first=await h.access('P');assert.equal(first.state.version,7);assert.equal(first.policy.revision,'r7');assert.equal(first.admin.rol,'SUPERADMIN_PRINCIPAL');assert.equal(h.gets.length,3);
 h.env.GLD_PUBLIC_CACHE.restart();h.report.auth_store201=null;
 assert.deepEqual(await h.access('P'),first);assert.equal(h.gets.length,3);assert.deepEqual(h.report.auth_store201,{calls:1,rows_read:1,rows_written:0,failures:0});
});
for(const rol of ['SUPERADMIN_PRINCIPAL','SUPERADMIN','ADMIN_LOCAL'])test('sesión '+rol+': una lectura, sin excepción por identidad; revocación inmediata',async t=>{
 const h=setup(t),token=await h.token('P',rol);assert.equal((await w.verifyAdminUncached138(h.env,h.request(token))).ok,true);
 const reads=h.gets.length;h.report.auth_store201=null;assert.equal((await w.verifyAdminUncached138(h.env,h.request(token))).ok,true);assert.equal(h.gets.length,reads);assert.equal(h.report.auth_store201.rows_read,1);
 await w.revokeSubscriberSessions(h.env,'P');assert.equal((await w.verifyAdminUncached138(h.env,h.request(token))).ok,false);
});
test('firma falsa se rechaza sin leer el registro de acceso',async t=>{
 const h=setup(t),token=await h.token();const invalid=token.split('.')[0]+'.firma-invalida';assert.equal((await w.verifyAdminUncached138(h.env,h.request(invalid))).ok,false);assert.equal(h.gets.length,0);assert.equal(h.report.auth_store201,undefined);
});
test('permisos revocados, revisados y cuenta borrada se conservan al reiniciar',async t=>{
 const h=setup(t),old=await h.token();await h.access('P',{action:'policy',policy:{activo:false,revision:'r1'}});assert.equal((await w.verifyAdminUncached138(h.env,h.request(old))).ok,false);
 await h.access('P',{action:'policy',policy:{activo:true,revision:'r1'}});assert.equal((await w.verifyAdminUncached138(h.env,h.request(old))).ok,false);
 const fresh=await h.token('P','SUPERADMIN_PRINCIPAL',{access_revision:'r1'});assert.equal((await w.verifyAdminUncached138(h.env,h.request(fresh))).ok,true);
 await w.revokeSubscriberSessions(h.env,'P',{deleted:true});h.env.GLD_PUBLIC_CACHE.restart();assert.equal((await w.verifyAdminUncached138(h.env,h.request(fresh))).ok,false);assert.equal((await w.subscriberSessionState(h.env,'P')).deleted,true);
});
test('50 revocaciones simultáneas no pierden cambios ni restauran permisos',async t=>{
 const h=setup(t);await h.access('P');
 await Promise.all([...Array.from({length:50},()=>w.revokeSubscriberSessions(h.env,'P')),h.access('P',{action:'policy',policy:{activo:false,revision:'final'}})]);
 const value=await h.access('P');assert.equal(value.state.version,50);assert.deepEqual(value.policy,{activo:false,revision:'final'});
});
test('respuesta antigua de la fuente no restaura un permiso cambiado durante el ingreso',async t=>{
 const h=setup(t),initial=await h.access('P');await h.access('P',{action:'policy',policy:{activo:false,revision:'nueva'}});
 const late=await h.access('P',{action:'admin',generation:initial.generation,admin:{id:'P',activo:true,rol:'SUPERADMIN_PRINCIPAL'}});assert.equal(late.admin,null);assert.equal(late.policy.activo,false);
});
test('confirmación atrasada de permisos no reactiva una revisión anterior',async t=>{
 const h=setup(t);await h.access('P',{action:'policy',policy:{activo:false,revision:'A'}});await h.access('P',{action:'policy',policy:{activo:false,revision:'B'}});await h.access('P',{action:'policy',policy:{activo:true,revision:'B'}});
 await assert.rejects(h.access('P',{action:'policy',policy:{activo:true,revision:'A'}}));const value=await h.access('P');assert.equal(value.policy.activo,false);assert.equal(value.policy.revision,'B');assert.equal(value.admin,null);
});
test('importación inválida y caída de KV no crean un acceso permisivo; reintento recupera',async t=>{
 const h=setup(t);h.raw.set('admin:access:v72:P','{');await assert.rejects(h.access('P'));h.seed('admin:access:v72:P',{activo:false,revision:'x'});assert.equal((await h.access('P')).policy.activo,false);
 const get=h.env.GLD_CACHE_KV.get;h.env.GLD_CACHE_KV.get=async()=>{throw Error('fixture down');};await assert.rejects(h.access('X'));h.env.GLD_CACHE_KV.get=get;assert.equal((await h.access('X')).state.version,0);
});
test('fuente de identidad distinta no se incorpora, y ausencia de rol se recuerda sin repetir Firestore',async t=>{
 const h=setup(t);let calls=0;const db=w.withAuthCacheV58({get:async()=>{calls++;return null;},queryEqual:async()=>{calls++;return[];}},h.env);
 assert.equal(await db.loginAdmin('P'),null);assert.equal(await db.loginAdmin('P'),null);assert.equal(calls,2);
 const current=await h.access('P');await assert.rejects(h.access('P',{action:'admin',generation:current.generation,admin:{id:'OTHER',rol:'SUPERADMIN_PRINCIPAL'}}));assert.equal((await h.access('P')).admin,null);
});
test('login repetido conserva contraseña y permisos; cambio de clave actualiza el verificador y revoca sesiones',async t=>{
 const h=setup(t);let subscriber={id:'P',suscriptor_id:'P',mail:'p@example.invalid',clave:'original123',activo:true};let admin={id:'P',suscriptor_id:'P',rol:'SUPERADMIN_PRINCIPAL',activo:true};let calls=0;
 const sourceDb={queryEqual:async(c)=>{calls++;return c==='suscriptores'?[subscriber]:[admin];},get:async(c)=>{calls++;return c==='suscriptores'?subscriber:admin;},patch:async(c,id,patch)=>{subscriber={...subscriber,...patch};return subscriber;}};
 const db=w.withAuthCacheV58(sourceDb,h.env),body={mail:subscriber.mail,clave:subscriber.clave};let logged=await w.superadminLoginV2({env:h.env,db,body});assert(logged.success);const n=calls;assert((await w.superadminLoginV2({env:h.env,db,body})).success);assert.equal(calls,n);
 assert.equal((await w.superadminLoginV2({env:h.env,db,body:{...body,clave:'incorrecta'}})).success,false);
 await w.changeSubscriberPasswordV2({env:h.env,db,request:h.request(await w.issueSession(h.env,{sid:'P',sv:0,auth:[]})),body:{clave_actual:'original123',clave_nueva:'nueva123456'}});
 assert.equal((await w.verifyAdminUncached138(h.env,h.request(logged.token))).ok,false);assert.equal((await w.superadminLoginV2({env:h.env,db,body})).success,false);
 logged=await w.superadminLoginV2({env:h.env,db,body:{...body,clave:'nueva123456'}});assert(logged.success);assert.equal((await w.verifyAdminUncached138(h.env,h.request(logged.token))).ok,true);
});
test('mismo estado de revocación para Usuario y acceso delegado de Anunciante',async t=>{
 const h=setup(t),token=await w.issueSession(h.env,{sid:'P',sv:0,auth:[]});assert.equal((await w.verifySubscriberSessionRaw143(h.env,h.request(token))).ok,true);
 const delegated={sid:'P',aid:'A',exp:Date.now()+60000,admin_role:'SUPERADMIN_PRINCIPAL',sv:0};const req=new Request('https://fixture.invalid/commerce?anunciante_id=A');assert.equal((await w.verifyAdminPanel155(h.env,req,delegated)).ok,true);
 await w.revokeSubscriberSessions(h.env,'P');assert.equal((await w.verifySubscriberSessionRaw143(h.env,h.request(token))).ok,false);assert.equal((await w.verifyAdminPanel155(h.env,req,delegated)).ok,false);
});
test('caída del almacén unificado no permite acceso por el mecanismo antiguo',async t=>{
 const h=setup(t),token=await h.token();h.env.GLD_PUBLIC_CACHE.get=()=>({fetch:async()=>Response.json({error:'down'},{status:503})});await assert.rejects(w.verifyAdminUncached138(h.env,h.request(token)));assert.equal(h.gets.length,0);assert.equal(h.report.auth_store201.failures,1);
});
