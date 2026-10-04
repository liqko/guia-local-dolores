import assert from 'node:assert/strict';
import {panelFixture} from './helpers/panel-fixture.mjs';
import {syncGuideAdvertiserV2} from '../worker/core/guide-read-model-v2.js';
async function setup(){
 const f=panelFixture(),log=[];
 f.seed('anunciantes_sedes','SED',{sede_id:'SED',anunciante_id:'ADV',ciudad_id:'DOL',direccion:'Original',actividad_ids:['ACT'],accion_ids:[],nodo_ids:[]});
 await f.cache.put('catalogs:commerce:v1',{categorias:[{categoria_id:'CAT',nombre:'Comercio'}],actividades_clave:[{actividad_id:'ACT',nombre:'Original'},{actividad_id:'NEW',nombre:'Nueva'}]});
 await syncGuideAdvertiserV2({...f,advertiserId:'ADV'});
 for(const operation of ['get','queryEqual','patch','delete','listCollection']){
  const original=f.db[operation].bind(f.db);
  f.db[operation]=async(...args)=>{log.push({operation,args:structuredClone(args)});return original(...args)};
 }
 return{...f,log};
}
const tests=[];
const test=(name,fn)=>tests.push({name,fn});
const domainKeys=p=>Object.keys(p).filter(k=>k!=='actualizado_en').sort();
test('Descripción del anunciante: sólo el campo enviado, sin lecturas DB ni sedes',async f=>{
 await f.action('/commerce',{action:'set_datos',descripcion:'Nueva'});
 assert.equal(f.log.length,1);assert.equal(f.log[0].operation,'patch');
 assert.deepEqual(f.log[0].args.slice(0,2),['anunciantes','ADV']);assert.deepEqual(domainKeys(f.log[0].args[2]),['descripcion']);
 const card=(await f.publicRows('/guide','DOL','anunciantes'))[0];assert.equal(card.descripcion,'Nueva');assert.equal(card.sedes[0].direccion,'Original');
});
test('Imagen de sede: una lectura de pertenencia y un patch sin campos intactos',async f=>{
 await f.action('/commerce',{action:'set_sedes',sedes:[{sede_id:'SED',direccion:'Original',img1:'nueva'}]});
 assert.deepEqual(f.log.map(x=>x.operation),['get','patch']);
 assert.deepEqual(domainKeys(f.log[1].args[2]),['img1']);
 assert.equal((await f.publicRows('/guide','DOL','anunciantes'))[0].sedes[0].img1,'nueva');
});
test('Perfil administrativo: mismo aislamiento y publicación, sin reconstrucción global',async f=>{
 await f.action('/superadmin/advertisers/ADV/profile',{payload:{categoria_ids:['CAT'],eco:true}},f.admin);
 assert.equal(f.log.length,1);assert.equal(f.log[0].operation,'patch');assert.deepEqual(domainKeys(f.log[0].args[2]),['categoria_ids','eco']);
 const card=(await f.publicRows('/guide','DOL','anunciantes'))[0];assert.deepEqual(card.categorias,['Comercio']);assert.equal(card.eco,true);assert.equal(card.sedes[0].direccion,'Original');
});
test('Relaciones administrativas: sólo cambia una relación, una lectura de pertenencia',async f=>{
 await f.action('/superadmin/advertisers/ADV/sedes/relations',{sedes:[{sede_id:'SED',actividad_ids:['NEW'],accion_ids:[],nodo_ids:[]}]},f.admin);
 assert.deepEqual(f.log.map(x=>x.operation),['get','patch']);assert.deepEqual(domainKeys(f.log[1].args[2]),['actividad_ids']);
 assert.equal((await f.publicRows('/guide','DOL','anunciantes'))[0].sedes[0].actividades[0].nombre,'Nueva');
});
test('Relaciones intactas: ninguna escritura; un lote con sede ajena no guarda parcialmente',async f=>{
 const path='/superadmin/advertisers/ADV/sedes/relations';
 await f.action(path,{sedes:[{sede_id:'SED',actividad_ids:['ACT']}]},f.admin);
 assert.deepEqual(f.log.map(x=>x.operation),['get']);f.log.length=0;
 f.seed('anunciantes_sedes','OTHER',{anunciante_id:'OTRO',ciudad_id:'DOL'});
 await assert.rejects(()=>f.action(path,{sedes:[{sede_id:'SED',actividad_ids:['NEW']},{sede_id:'OTHER',actividad_ids:['NEW']}]},f.admin));
 assert.ok(f.log.every(x=>x.operation==='get'));assert.deepEqual(f.collection('anunciantes_sedes').get('SED').actividad_ids,['ACT']);
});
test('Borrar última sede: sólo lee y elimina esa sede; conserva el anunciante y tarjeta',async f=>{
 await f.action('/commerce',{action:'delete_sede',sede_id:'SED'});
 assert.deepEqual(f.log.map(x=>x.operation),['get','delete']);assert.ok(f.log.every(x=>x.args[0]==='anunciantes_sedes'));
 assert.ok(f.collection('anunciantes').get('ADV'));assert.equal((await f.publicRows('/guide','DOL','anunciantes'))[0].sedes.length,0);
});
for(const t of tests){await t.fn(await setup());console.log('OK:',t.name)}
console.log('AISLAMIENTO COMMERCE V36 OK: '+tests.length+' circuitos con operaciones y campos exactos, anunciante + administración + publicación');

