import assert from 'node:assert/strict';
import {subscriberLoginV2} from '../worker/modules/suscriptor-login-v2.js';
import {observeDbV41,finishObservationV42,observationActionV43} from '../worker/core/db-observation-v41.js';
const env={SERVER_SECRET:'test-only',GLD_CACHE_KV:{async get(){return null;}}};
async function run(relations){
 const report={operations:{}};
 const raw={
  async queryEqual(collection,field,value,limit){
   if(collection==='suscriptores'){assert.equal(limit,5);return [{id:'S',mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true}];}
   assert.equal(collection,'suscriptor_anunciante');assert.equal(limit,100);return relations;
  },
  async get(collection,id){return collection==='anunciantes'?{id,nombre:'Nombre desde comercio'}:{id,funcionalidades:'PROMOS, EVENTOS'};},
  async patch(){throw Error('No debe escribir');},async delete(){throw Error('No debe eliminar');},async listCollection(){throw Error('No debe barrer');}
 };
 const out=await subscriberLoginV2({env,db:observeDbV41(raw,report),body:{mail:'persona@test.invalid',clave:'test-password'}});
 assert.equal(out.success,true);assert.ok(out.token);
 const totals=finishObservationV42({...report,method:'POST',path:'/suscriptores',action:'login',status:200}).totals;
 assert.equal(totals.write_calls,0);assert.equal(totals.delete_calls,0);
 return {out,totals};
}
let r=await run([]);assert.equal(r.totals.read_calls,2);assert.equal(r.totals.documents_returned,1);
console.log('Sin comercios: 2 consultas, 1 documento devuelto (no contador facturado).');
const complete=Array.from({length:8},(_,i)=>({anunciante_id:'A'+i,anunciante_nombre:'Nombre '+i,permisos:'PROMOS',rol:'ADMIN',activo:true}));
r=await run(complete);assert.equal(r.totals.read_calls,2);assert.equal(r.totals.documents_returned,9);assert.equal(r.out.anunciantes.length,8);
assert.equal(r.out.anunciantes[0].permisos,'PROMOS');assert.equal(r.out.anunciantes[0].anunciante_nombre,'Nombre 0');
console.log('8 relaciones completas: 2 consultas, 9 documentos; antes 18 consultas y 25 documentos.');
r=await run([{anunciante_id:'A',activo:true}]);assert.equal(r.totals.read_calls,4);assert.equal(r.totals.documents_returned,4);
assert.equal(r.out.anunciantes[0].anunciante_nombre,'Nombre desde comercio');assert.equal(r.out.anunciantes[0].permisos,'PROMOS, EVENTOS');
r=await run([{anunciante_id:'A',anunciante_nombre:'Nombre propio',activo:true}]);assert.equal(r.totals.read_calls,3);assert.equal(r.out.anunciantes[0].anunciante_nombre,'Nombre propio');
r=await run([{anunciante_id:'A',permisos:'PROMOS',activo:true}]);assert.equal(r.totals.read_calls,3);assert.equal(r.out.anunciantes[0].permisos,'PROMOS');
r=await run([{anunciante_id:'A',activo:false}]);assert.equal(r.totals.read_calls,2);assert.equal(r.out.anunciantes.length,0);
for(const action of ['login','session','favoritos','anunciantes_autorizados']){
 const request=new Request('https://test.invalid/suscriptores',{method:'POST',body:JSON.stringify({action,mail:'private',clave:'private'}),headers:{'Content-Type':'application/json'}});
 assert.equal(await observationActionV43(request,new URL(request.url)),action);
 assert.equal((await request.json()).clave,'private'); // La observación no consume el cuerpo original.
}
const request=new Request('https://test.invalid/suscriptores',{method:'POST',body:JSON.stringify({action:'private-secret'})});
assert.equal(await observationActionV43(request,new URL(request.url)),'');
console.log('V43: permisos/nombres conservados, relaciones inactivas excluidas, sin barridos/escrituras/eliminaciones; etiquetas seguras y cuerpo disponible para el router.');
