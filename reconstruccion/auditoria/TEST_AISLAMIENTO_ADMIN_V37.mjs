import assert from 'node:assert/strict';
import {panelFixture} from './helpers/panel-fixture.mjs';
import {routeAdminV11} from '../worker/routes/admin-v11.js';
const defs=[
 ['segmentos','segmentos','segmento_id'],['niveles_anunciante','niveles_anunciante','nivel_id'],['funcionalidades','funcionalidades','funcionalidad_id'],
 ['categorias','categorias','categoria_id'],['actividades_clave','actividades_clave','actividad_id'],['acciones','acciones','accion_id'],['nodos','nodos','nodo_id'],
 ['eventos_categorias','eventos_categorias','categoria_id'],['actividades_categorias','actividades_categorias','categoria_id'],['moderacion_18','eventos_moderacion_palabras','regla_id']
];
let cases=0;
for(const [type,collection,idKey]of defs){
 const f=panelFixture(),row={[idKey]:'ITEM',nombre:'Original',activo:true,orden:1,ciudad_id:'DOL'};
 f.seed(collection,'ITEM',row);await f.cache.put('admin:catalogs:v2',{[type]:[row]});
 const log=[];for(const op of ['get','queryEqual','patch','delete','listCollection']){
  const original=f.db[op].bind(f.db);f.db[op]=async(...args)=>{log.push({op,args:structuredClone(args)});return original(...args)};
 }
 await f.action('/superadmin/catalogs/'+type,{item:{...row,nombre:'Nuevo'}},f.admin);
 assert.deepEqual(log.map(x=>x.op),['patch']);assert.equal(log[0].args[0],collection);
 assert.deepEqual(Object.keys(log[0].args[2]).sort(),['actualizado_en','nombre']);
 log.length=0;await f.action('/superadmin/catalogs/'+type,{item:{...row,nombre:'Nuevo'}},f.admin);
 assert.equal(log.length,0);cases+=2;
}
for(const path of ['/superadmin/dashboard','/superadmin/advertisers/search?q=uno','/superadmin/subscribers/search?q=uno','/superadmin/catalogs/categorias']){
 const f=panelFixture(),url=new URL('https://prueba.local'+path);
 const response=await routeAdminV11({...f,path:url.pathname,url,request:new Request(url,{headers:{Authorization:'Bearer '+f.admin}})});
 assert.equal(response.status,200);assert.equal((await response.json()).success,true);
 assert.deepEqual(f.stats,{reads:0,writes:0,queries:0,scans:0});cases++;
}
console.log('AISLAMIENTO ADMIN V37 OK:',cases,'casos; 10 catálogos, no-op, búsqueda y dashboard KV sin DB');

