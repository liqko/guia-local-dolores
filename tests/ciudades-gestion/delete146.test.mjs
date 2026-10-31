import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync('worker/modules/city-delete146.js','utf8');
async function run(role,linked){
 let deleted=0,puts=0,queries=0;
 const packet={version:1,paises:[{pais_id:'AR'}],provincias:[{provincia_id:'BA'}],ciudades:[{ciudad_id:'C-TEST',ciudad_visible:'Ciudad de prueba',activa:false}]};
 const context={
  authOr401:async()=>({rol:role}),
  json:(body,status=200)=>({status,...body}),
  text3:v=>String(v??'').trim(),packet:v=>v,
  ADMIN_KEY:'territorio:admin:v1',PUBLIC_KEY:'territorio:public:v1',
  GLD_ACTIONS138:{isInternal:()=>true},C:{ciudades:'ciudades'},
  remove:(rows,field,id)=>rows.filter(row=>row[field]!==id),Response:class{},
  Date,Promise
 };
 vm.createContext(context);vm.runInContext(code,context);
 const result=await context.deleteCity146({
  env:{},request:{},idFromPath:'C-TEST',
  db:{
   queryEqual:async()=>{queries++;return linked?[{id:'linked'}]:[]},
   delete:async()=>{deleted++;return true}
  },
  cache:{get:async()=>packet,put:async()=>{puts++}}
 });
 return {result,deleted,puts,queries};
}
let x=await run('SUPERADMIN_PRINCIPAL',false);
assert.equal(x.result.status,200);assert.equal(x.deleted,1);assert.equal(x.puts,10);
assert.equal(x.queries,19);
x=await run('SUPERADMIN_PRINCIPAL',true);
assert.equal(x.result.status,409);assert.equal(x.deleted,0);assert.equal(x.puts,0);
x=await run('SUPERADMIN',false);
assert.equal(x.result.status,403);assert.equal(x.deleted,0);assert.equal(x.queries,0);
console.log('PASS borrado sin vínculos; bloqueo con vínculos; permisos exclusivos; sin borrado parcial.');

const finalSedes=[
 {id:'SD-DOLORES',sede_id:'SD-DOLORES',anunciante_id:'ANU-1',ciudad_id:'C-TEST'},
 {id:'SD-BELGRANO',sede_id:'SD-BELGRANO',anunciante_id:'ANU-1',ciudad_id:'BELGRANO'},
 {id:'SD-OTRA',sede_id:'SD-OTRA',anunciante_id:'ANU-1',ciudad_id:'OTRA'}
];
const registrosBorrados=[];
const noBorrados=finalSedes.map(s=>s.id);
const context2={
 authOr401:async()=>({rol:'SUPERADMIN_PRINCIPAL'}),
 json:(body,status=200)=>({status,...body}),text3:v=>String(v??'').trim(),packet:v=>v,
 ADMIN_KEY:'territorio:admin:v1',PUBLIC_KEY:'territorio:public:v1',
 GLD_ACTIONS138:{isInternal:()=>true},C:{ciudades:'ciudades'},
 remove:(rows,field,id)=>rows.filter(row=>row[field]!==id),Response:class{},Date,Promise
};
vm.createContext(context2);vm.runInContext(code,context2);
const result2=await context2.deleteCity146({
 env:{},request:{},idFromPath:'C-TEST',
 db:{
  queryEqual:async(collection,field,value)=>collection==='anunciantes_sedes'?finalSedes.filter(s=>s.ciudad_id===value):[],
  delete:async(collection,id)=>{registrosBorrados.push(collection+'/'+id);const i=noBorrados.indexOf(id);if(i>=0)noBorrados.splice(i,1);}
 },
 cache:{get:async()=>({ciudades:[{ciudad_id:'C-TEST',activa:false}],paises:[],provincias:[]}),put:async()=>{}}
});
assert.equal(result2.status,200);
assert.deepEqual(registrosBorrados,['anunciantes_sedes/SD-DOLORES','ciudades/C-TEST']);
assert.deepEqual(noBorrados,['SD-BELGRANO','SD-OTRA']);
console.log('PASS multisedes: elimina solo la sede de la ciudad seleccionada y mantiene las otras dos.');

// Una ciudad activa no se puede borrar ni por una llamada directa al Worker.
const ctxActiva={
 authOr401:async()=>({rol:'SUPERADMIN_PRINCIPAL'}),
 json:(body,status=200)=>({status,...body}),text3:v=>String(v??'').trim(),packet:v=>v,
 ADMIN_KEY:'territorio:admin:v1',PUBLIC_KEY:'territorio:public:v1',
 GLD_ACTIONS138:{isInternal:()=>true},C:{ciudades:'ciudades'},
 remove:(rows,field,id)=>rows.filter(row=>row[field]!==id),Response:class{},Date,Promise
};
vm.createContext(ctxActiva);vm.runInContext(code,ctxActiva);
let accionesActivas=0;
const activa=await ctxActiva.deleteCity146({
 env:{},request:{},idFromPath:'C-TEST',
 db:{queryEqual:async()=>{accionesActivas++;return []},delete:async()=>{accionesActivas++;}},
 cache:{get:async()=>({ciudades:[{ciudad_id:'C-TEST',activa:true}],paises:[],provincias:[]}),put:async()=>{accionesActivas++;}}
});
assert.equal(activa.status,409);
assert.equal(activa.code,'CITY_MUST_BE_SUSPENDED');
assert.equal(accionesActivas,0);
console.log('PASS fase 1 obligatoria: una ciudad activa no puede borrarse.');


