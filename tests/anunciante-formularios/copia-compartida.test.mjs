import {test} from 'node:test';
import assert from 'node:assert/strict';
import {source} from '../observabilidad/worker-source.mjs';
const w=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {commerceMaster205,withPanelCacheV48,createCache};').toString('base64'));
function fixture(){
 const values=new Map(),sourceRows=new Map(),ops=[],sourceOps=[];
 const masters=new Map(),actors=new Map();let failWrite=false;
 const masterKey=aid=>'test:master:'+aid;
 const env={GLD_CACHE_KV:{
  async get(key){ops.push(['get',key]);return values.get(key)??null;},
  async put(key,value,options){ops.push(['put',key,options]);assert.equal(options?.expirationTtl,undefined);values.set(key,value);},
  async delete(key){ops.push(['delete',key]);values.delete(key);},
  async list({prefix}){ops.push(['list',prefix]);return{keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),list_complete:true};}
 }};
 const cache=w.createCache(env),seed=(key,value)=>values.set(key,JSON.stringify(value));
 seed('catalogs:commerce:v1',{niveles_anunciante:[{nivel_id:'CONFIG_GENERAL_ANUNCIANTES'}],categorias:[{categoria_id:'C',nombre:'Actual'}]});
 seed('admin:functional-settings:v1',{revision:9,reglas:{ACTIVIDADES:{activo:true,niveles_habilitados:[4,6],nombre:'Actividades'}}});
 function add(aid,nivel){
  const datos={id:aid,anunciante_id:aid,nombre:aid,extension_futura:{conservar:true}};
  const administracion={id:aid,nivel,funcionalidades:'ACTIVIDADES'};
  const sedes=[{id:'S-'+aid,sede_id:'S-'+aid,anunciante_id:aid,nombre_sede:'Original'}];
  sourceRows.set('anunciantes/'+aid,datos);sourceRows.set('anunciantes_administracion/'+aid,administracion);
  for(const row of sedes)sourceRows.set('anunciantes_sedes/'+row.id,row);
  masters.set(aid,{success:true,advertiser:{id:aid,datos,administracion,sedes}});
  seed('panel:query:v48:anunciantes_sedes:'+aid,{version:48,data:sedes,revision:''});
 }
 const db={
  async get(c,id){sourceOps.push(['get',c,id]);return structuredClone(sourceRows.get(c+'/'+id)||null);},
  async queryEqual(c,field,value){sourceOps.push(['query',c,field,value]);return [...sourceRows].filter(([key,row])=>key.startsWith(c+'/')&&row[field]===value).map(([,row])=>structuredClone(row));},
  async patch(c,id,patch){sourceOps.push(['patch',c,id]);const row={...sourceRows.get(c+'/'+id),...patch,id};sourceRows.set(c+'/'+id,row);return structuredClone(row);},
  async delete(c,id){sourceOps.push(['delete',c,id]);sourceRows.delete(c+'/'+id);},
  async commitPatches(entries){return Promise.all(entries.map(e=>e.remove?this.delete(e.collection,e.id).then(()=>null):this.patch(e.collection,e.id,e.patch)));},
  async panelAdministration(id){return structuredClone(sourceRows.get('anunciantes_administracion/'+id)||{});}
 };
 env.GLD_PUBLIC_CACHE={idFromName:x=>x,get(name){const aid=name.split(':').at(-1);if(!actors.has(aid))actors.set(aid,{
  metrics:{rows_read:0,rows_written:0},guideJob132:async()=>null,repairGuide132:async()=>{},
  query(sql,value){if(sql.startsWith('SELECT')){this.metrics.rows_read++;ops.push(['master-get',aid]);return masters.has(aid)?[{value:JSON.stringify(masters.get(aid))}]:[];}if(sql.startsWith('INSERT')){if(failWrite)throw Error('Escritura interrumpida');this.metrics.rows_written++;masters.set(aid,JSON.parse(value));ops.push(['master-put',aid]);}return [];},
  commerceMaster209:w.GldPublicCache119.prototype.commerceMaster209,
  commerceRequest209:w.GldPublicCache119.prototype.commerceRequest209
 });return{async fetch(request){const actor=actors.get(aid);actor.metrics={rows_read:0,rows_written:0};return actor.commerceRequest209(await request.json());}};}};
 const panel=w.withPanelCacheV48(db,env,{operations:{}});
 return{env,cache,seed,add,sourceRows,ops,sourceOps,panel,db:panel,master:aid=>masters.get(aid),set failWrite(value){failWrite=value;}};
}
test('una cuenta puede consultar copias independientes de niveles 3, 4 y 6 sin tocar Firestore',async()=>{
 const h=fixture();for(const [id,level]of [['A',3],['B',4],['C',6]])h.add(id,level);
 h.db.get=h.db.queryEqual=async()=>{throw Error('Consulta a la fuente durante una apertura preparada');};
 for(const id of ['A','B','C','A','C','B']){
  const start=h.ops.length,response=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:id});
  assert.equal(response.advertiser.id,id);assert.equal(response.advertiser.datos.nombre,id);
  assert.equal(response.advertiser.sedes[0].anunciante_id,id);
  assert.equal(response.advertiser.configuracion_funcionalidades.ACTIVIDADES.activo,id!=='A');
  assert.deepEqual(h.ops.slice(start).map(op=>op[0]),['master-get','get','get']);
  assert.equal(h.ops[start][1],id);
 }
 assert.equal(h.sourceOps.length,0);
});
test('reglas y catálogos nuevos se reflejan sin reconstruir ni reescribir la ficha',async()=>{
 const h=fixture();h.add('B',4);
 await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'B'});
 h.seed('admin:functional-settings:v1',{revision:10,reglas:{ACTIVIDADES:{activo:false}}});
 h.seed('catalogs:commerce:v1',{niveles_anunciante:[{nivel_id:'CONFIG_GENERAL_ANUNCIANTES'}],categorias:[{categoria_id:'C',nombre:'Modificada'}]});
 h.ops.length=0;
 const response=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'B'});
 assert.equal(response.advertiser.configuracion_revision,10);
 assert.equal(response.advertiser.configuracion_funcionalidades.ACTIVIDADES.activo,false);
 assert.equal(response.advertiser.categorias[0].nombre,'Modificada');
 assert.equal(h.sourceOps.length,0);assert(h.ops.every(op=>['get','master-get'].includes(op[0])));
});
test('guardar datos prepara la copia antes de la siguiente apertura y conserva campos no modificados',async()=>{
 const h=fixture();h.add('A',3);
 await h.panel.patch('anunciantes','A',{descripcion:'Guardada'});
 await h.panel.flushLoginCache();
 const puts=h.ops.filter(([op,key])=>op==='master-put'&&key==='A');
 assert.equal(puts.length,1);assert.equal(puts[0][2],undefined);
 h.sourceOps.length=0;h.ops.length=0;
 const response=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'A'});
 assert.equal(response.advertiser.datos.descripcion,'Guardada');
 assert.deepEqual(response.advertiser.datos.extension_futura,{conservar:true});
 assert.equal(h.sourceOps.length,0);assert(h.ops.every(([op])=>['get','master-get'].includes(op)));
});
test('alta, edición y baja de sedes mantienen la copia con los deltas confirmados',async()=>{
 const h=fixture();h.add('A',3);
 await h.panel.patch('anunciantes_sedes','NUEVA',{anunciante_id:'A',sede_id:'NUEVA',nombre_sede:'Nueva'},{newDocument:true});
 await h.panel.flushLoginCache();
 let response=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'A'});
 assert.equal(response.advertiser.sedes.length,2);
 await h.panel.patch('anunciantes_sedes','NUEVA',{nombre_sede:'Modificada'});
 await h.panel.delete('anunciantes_sedes','S-A');
 await h.panel.flushLoginCache();
 response=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'A'});
 assert.equal(response.advertiser.sedes.length,1);assert.equal(response.advertiser.sedes[0].nombre_sede,'Modificada');
});
test('un cambio comercial actualiza su anunciante sin modificar las copias de otros',async()=>{
 const h=fixture();h.add('A',3);h.add('B',6);
 await h.panel.patch('anunciantes_administracion','A',{nivel:4});await h.panel.flushLoginCache();
 const a=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'A'});
 const b=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'B'});
 assert.equal(a.advertiser.administracion.nivel,4);assert.equal(b.advertiser.administracion.nivel,6);
 assert(a.advertiser.configuracion_funcionalidades.ACTIVIDADES.activo);
 assert.equal(h.ops.filter(([op,key])=>op==='master-put'&&key==='B').length,0);
});
test('fallo al escribir la copia impide confirmar el guardado y permite recuperar la proyección',async()=>{
 const h=fixture();h.add('A',3);
 h.failWrite=true;
 await h.panel.patch('anunciantes','A',{descripcion:'Cambio confirmado en fuente'});
 await assert.rejects(h.panel.flushLoginCache(),/Escritura interrumpida/);
 assert.notEqual(h.master('A').advertiser.datos.descripcion,'Cambio confirmado en fuente');
 h.failWrite=false;await h.panel.flushLoginCache();
 assert.equal(h.master('A').advertiser.datos.descripcion,'Cambio confirmado en fuente');
});
test('la copia preparada sigue válida después de dos minutos y de un día, sin escrituras al consultar',async t=>{
 const h=fixture();h.add('A',3);
 assert.equal(h.master('A').advertiser.id,'A');
 const now=Date.now();let elapsed=0;t.mock.method(Date,'now',()=>now+elapsed);
 for(elapsed of [121000,86400001]){
  h.ops.length=0;h.sourceOps.length=0;
  const response=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'A'});
  assert.equal(response.advertiser.id,'A');assert.equal(h.sourceOps.length,0);
  assert(h.ops.every(([op])=>['get','master-get'].includes(op)));
 }
});
test('un guardado conjunto prepara una sola copia por anunciante',async()=>{
 const h=fixture();h.add('A',3);
 await h.panel.commitPatches([
  {collection:'anunciantes',id:'A',before:h.sourceRows.get('anunciantes/A'),patch:{descripcion:'Conjunta'}},
  {collection:'anunciantes_sedes',id:'S-A',before:h.sourceRows.get('anunciantes_sedes/S-A'),patch:{nombre_sede:'Conjunta'}}
 ]);
 await h.panel.flushLoginCache();
 assert.equal(h.ops.filter(([op,key])=>op==='master-put'&&key==='A').length,1);
 const response=await w.commerceMaster205({db:h.db,cache:h.cache,advertiserId:'A'});
 assert.equal(response.advertiser.datos.descripcion,'Conjunta');assert.equal(response.advertiser.sedes[0].nombre_sede,'Conjunta');
});
