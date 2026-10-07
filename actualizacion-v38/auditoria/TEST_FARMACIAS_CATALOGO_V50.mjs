import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../../worker/WORKER_COMPLETO_V50.js',import.meta.url),'utf8');
const start=source.indexOf('var {farmaciasPanelDataV3} = (() => {');
const end=source.indexOf('\n})();',start)+7;
const farmaciasPanelDataV3=Function(source.slice(start,end)+';return farmaciasPanelDataV3;')();
const values=new Map([
 ['territorio:public:v1',{ciudades:[{ciudad_id:'D'},{ciudad_id:'N'}]}],
 ['catalogs:commerce:v1',{categorias:[{categoria_id:'CATF',titulo:'Farmacias'}]}],
 ['guide:city:v1:D',{anunciantes:[
  {id:'ADMIN',nombre:'ACP CONTENIDOS',sedes:[{sede_id:'ACP',ciudad_id:'D',estado:'ACTIVA'}]},
  {id:'F1',nombre:'Farmacia Uno',sedes:[{sede_id:'S1',ciudad_id:'D',estado:'ACTIVA',direccion:'Uno 10'},{sede_id:'OFF',ciudad_id:'D',estado:'INACTIVA'}]},
  {id:'F2',nombre:'Salud Dos',categoria_ids:['CATF'],sedes:[{sede_id:'S2',ciudad_id:'D',telefono:'123'}]},
  {id:'F3',nombre:'Botica Tres',categorias:['Farmacias'],sedes:[{sede_id:'S3',ciudad_id:'D'}]},
  {id:'OLD',nombre:'Botica histórica',sedes:[{sede_id:'LEG',ciudad_id:'D'}]},
  {id:'BAD',nombre:'Farmacia fuera de ciudad',sedes:[{sede_id:'OTHER',ciudad_id:'N'}]}
 ]}],
 ['guide:city:v1:N',{anunciantes:[{id:'FN',nombre:'Farmacia Necochea',sedes:[{sede_id:'SN',ciudad_id:'N'}]}]}]
]);
let reads=0;
const db={async get(c,id){reads++;assert.equal(c,'anunciantes_administracion');assert.equal(id,'ADMIN');return{funcionalidades:['FARMACIAS']}},async queryEqual(c,f,id,limit){reads++;assert.equal(limit,500);if(c==='farmacias_ciclos'){assert.equal(f,'anunciante_id');assert.equal(id,'ADMIN');return[{ciclo_id:'C',anunciante_id:'ADMIN',ciudad_id:'D'}]}assert.equal(c,'farmacias_ciclo_sedes');assert.equal(f,'ciclo_id');assert.equal(id,'C');return[{ciclo_id:'C',sede_id:'LEG'}]}};
const cache={async get(k){return structuredClone(values.get(k)||null)}};
const out=await farmaciasPanelDataV3({db,cache,advertiserId:'ADMIN',featureAllowed:a=>a.funcionalidades.includes('FARMACIAS'),allowedCityIds:['D']});
assert.equal(out.success,true);
assert.deepEqual(out.farmacias.map(x=>x.sede_id).sort(),['LEG','S1','S2','S3']);
assert.equal(out.farmacias.find(x=>x.sede_id==='S2').anunciante_id,'F2');
assert.equal(out.farmacias.find(x=>x.sede_id==='S2').nombre_ref,'Salud Dos');
assert.equal(out.farmacias.find(x=>x.sede_id==='S2').telefono,'123');
assert.equal(out.farmacias.some(x=>['ACP','OFF','OTHER','SN'].includes(x.sede_id)),false);
assert.deepEqual(out.ciudades,[{ciudad_id:'D'}]);
assert.equal(reads,3); // Admin y listas propias; catálogo de farmacias sólo KV.
values.delete('guide:city:v1:D');
const empty=await farmaciasPanelDataV3({db,cache,advertiserId:'ADMIN',featureAllowed:()=>true,allowedCityIds:['D']});
assert.deepEqual(empty.farmacias,[]); // No usar sede del administrador ni barrer Firestore.
const denied=await farmaciasPanelDataV3({db,cache,advertiserId:'ADMIN',featureAllowed:()=>false,allowedCityIds:['D']});
assert.equal(denied.success,false);
console.log('PASS V50: farmacias de otros propietarios por ciudad/nombre/categoría/participación; excluye ACP y sedes inactivas; catálogo sólo KV; sin fallback Firestore.');
