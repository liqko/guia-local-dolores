const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('worker/worker206.txt','utf8');
const begin=source.indexOf('function withPanelCacheV48('),end=source.indexOf('\nreturn withPanelCacheV48;',begin);
assert(begin>0&&end>begin,'Debe probarse el código real del Worker');
const authorityStart=source.indexOf('const PUBLICATION_COLLECTIONS');
const authorityEnd=source.indexOf('function createDb(',authorityStart);
assert(authorityStart>0&&authorityEnd>authorityStart,'Debe probarse la autoridad administrativa real');
const wrapperSource=source.slice(authorityStart,authorityEnd)+'\n'+source.slice(begin,end);
const collections={
  suscriptores:['suscriptor_id'],
  anunciantes:['revision_adulto'],
  anunciantes_administracion:['anunciante_id'],
  anunciantes_sedes:['anunciante_id'],
  suscriptor_anunciante:['anunciante_id'],
  promos:['anunciante_id'],
  eventos:['anunciante_id'],
  actividades:['anunciante_id'],
  publicidades:['anunciante_id'],
  farmacias_ciclos:['anunciante_id'],
  publicidad_media:['anunciante_id'],
  publicidad_segmentacion:['anunciante_id'],
};
function setup(relations=[{rol:'PROPIETARIO',activo:true,anunciante_id:'A1'}]){
 const store=new Map(),docs=new Map(),call={get:0,put:0,del:0,lookup:0,dbget:0};
 const kv={async get(k){call.get++;return store.get(k)??null;},async put(k,v){call.put++;store.set(k,v);},async del(k){call.del++;store.delete(k);},async delete(k){return this.del(k)}};
 const rawDb={
  async get(c,id){call.dbget++;return docs.get(c+'/'+id)||null;},
  async patch(c,id,patch){if(patch?.simular_fallo)throw Error('Guardado fallido');const row={...(docs.get(c+'/'+id)||{}),...patch,id};docs.set(c+'/'+id,row);return row;},
  async delete(c,id){docs.delete(c+'/'+id);return true;},
  async commitPatches(entries){return entries.map(e=>{if(e.remove){docs.delete(e.collection+'/'+e.id);return null;}const row={...(docs.get(e.collection+'/'+e.id)||{}),...e.patch,id:e.id};docs.set(e.collection+'/'+e.id,row);return row;});},
  async queryEqual(){throw Error('No debe consultar una colección completa para detalle GH');},
  async subscriberRelations(sid){call.lookup++;return relations;},
 };
 const ctx={Map,Set,Date,JSON,Promise,String,Number,Array,Object,encodeURIComponent,structuredClone,
  text:v=>String(v??'').trim(),fields:collections,db:rawDb,console,crypto:require('node:crypto'),setTimeout,
  matchesField:()=>false,trackedQueryValue130:()=>false,queryKey:()=>'',advertiserKey:id=>'adv:'+id,docKey:id=>'doc:'+id,
  directoryState102:()=>'',createCache:()=>({get:async k=>{const v=store.get(k);return v?JSON.parse(v):null;},put:async(k,v)=>kv.put(k,JSON.stringify(v)),del:k=>kv.del(k)}),
  directoryDelta102:async()=>{},notify102:async()=>{},GUIDE_SOURCE132:new Set(),
  commerceMasterActor209:async()=>{},GLD_BUSINESS143:{quotaError:()=>false},
  ghAdminDetailInvalidate203:async(cache,id)=>cache.del('admin:advertiser:detail:v204:'+id),
  ghInvalidatedForRequest204:()=>new Set(),
  roleName159:v=>String(v||'').trim().toUpperCase(),truthy:v=>v===true||v===1||v==='true',
  httpError:(s)=>new Error(s),rejectedActivity:()=>false,
 };
 vm.createContext(ctx);
 vm.runInContext(wrapperSource+'\nthis.make=withPanelCacheV48;',ctx,{filename:'worker206-panel-cache.js'});
 const db=ctx.make(rawDb,{GLD_CACHE_KV:kv},{});
 const key=id=>'admin:advertiser:detail:v204:'+id;
 const seed=(id)=>store.set(key(id),JSON.stringify({version:204,detail:{success:true,id}}));
 return {db,docs,store,call,seed,key};
}
test('un cambio de contacto de propietario invalida su detalle GH una sola vez',async()=>{
 const h=setup();h.docs.set('suscriptores/S1',{id:'S1',nombre:'Viejo',mail:'a@a.test',whatsapp:'1'});
 h.seed('A1');
 await h.db.patch('suscriptores','S1',{nombre:'Nuevo'});
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A1')),false);
 assert.equal(h.call.lookup,1,'Se consultan relaciones sólo al guardar datos de contacto');
 assert.equal(h.call.del,1,'Sólo se borra la copia afectada');
});
test('cambio no visible del suscriptor NO agrega lecturas de relaciones',async()=>{
 const h=setup();h.docs.set('suscriptores/S1',{id:'S1',nombre:'Uno',mail:'a@a.test'});
 h.seed('A1');
 await h.db.patch('suscriptores','S1',{aceptacion_terminos:true});
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A1')),true);
 assert.equal(h.call.lookup,0);
});
test('no borra detalles ajenos ni detalles de relaciones que no sean propietario',async()=>{
 const h=setup([{rol:'COLABORADOR',activo:true,anunciante_id:'A1'},{rol:'PROPIETARIO',activo:false,anunciante_id:'A2'},{rol:'PROPIETARIO',activo:true,anunciante_id:'A3'}]);
 h.docs.set('suscriptores/S1',{id:'S1',nombre:'Anterior'});
 for(const id of ['A1','A2','A3','A4'])h.seed(id);
 await h.db.patch('suscriptores','S1',{nombre:'Actual'});
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A3')),false);
 for(const id of ['A1','A2','A4'])assert.equal(h.store.has(h.key(id)),true);
});
test('cambios de eventos y sedes invalidan exactamente al anunciante afectado',async()=>{
 for(const c of ['eventos','actividades','promos','publicidades','anunciantes_sedes']){
  const h=setup();h.seed('A1');h.seed('A2');
  h.docs.set(c+'/X',{id:'X',anunciante_id:'A1',estado:'PENDIENTE'});
  await h.db.patch(c,'X',{estado:'ACTIVO'});
  await h.db.flushLoginCache();
  assert.equal(h.store.has(h.key('A1')),false,c);
  assert.equal(h.store.has(h.key('A2')),true,c);
 }
});

test('cambio de anunciante de evento invalida origen y destino, no terceros',async()=>{
 const h=setup();for(const id of ['A1','A2','A3'])h.seed(id);
 h.docs.set('eventos/E',{id:'E',anunciante_id:'A1',estado:'PENDIENTE'});
 await h.db.patch('eventos','E',{anunciante_id:'A2'});
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A1')),false);
 assert.equal(h.store.has(h.key('A2')),false);
 assert.equal(h.store.has(h.key('A3')),true);
 assert.equal(h.call.del,2);
});
test('alta agrupada y eliminación de publicidad invalidan sólo tras guardar',async()=>{
 const h=setup();h.seed('A1');h.seed('A2');
 const entries=[{collection:'publicidades',id:'P',before:null,patch:{anunciante_id:'A1',estado:'ACTIVA'}}];
 await h.db.commitPatches(entries);
 assert.equal(h.store.has(h.key('A1')),true,'antes de confirmar el cierre del guardado');
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A1')),false);
 assert.equal(h.store.has(h.key('A2')),true);
 h.seed('A1');
 await h.db.delete('publicidades','P');
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A1')),false);
});
test('media y segmentación obtienen el anunciante desde la pieza, una vez por grupo',async()=>{
 const h=setup();h.seed('A1');h.seed('A2');
 h.docs.set('publicidades/P',{id:'P',anunciante_id:'A1'});
 h.docs.set('publicidad_media/M',{id:'M',publicidad_id:'P',url:'a'});
 h.docs.set('publicidad_segmentacion/G',{id:'G',publicidad_id:'P',ciudad_id:'C1'});
 await h.db.patch('publicidad_media','M',{url:'b'});
 await h.db.patch('publicidad_segmentacion','G',{ciudad_id:'C2'});
 const before=h.call.dbget;
 await h.db.flushLoginCache();
 assert.equal(h.call.dbget-before,1,'una consulta de titular por pieza, sólo al guardar');
 assert.equal(h.store.has(h.key('A1')),false);
 assert.equal(h.store.has(h.key('A2')),true);
 assert.equal(h.call.del,1,'un único borrado incluso con dos cambios');
});
test('eliminar una relación publicitaria usa publicidad_id anterior',async()=>{
 const h=setup();h.seed('A1');
 h.docs.set('publicidades/P',{id:'P',anunciante_id:'A1'});
 h.docs.set('publicidad_media/M',{id:'M',publicidad_id:'P',url:'imagen'});
 await h.db.delete('publicidad_media','M');
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A1')),false);
 assert.equal(h.call.del,1);
});
test('un guardado fallido no invalida copia del anunciante',async()=>{
 const h=setup();h.seed('A1');
 h.docs.set('eventos/E',{id:'E',anunciante_id:'A1'});
 await assert.rejects(h.db.patch('eventos','E',{simular_fallo:true}),/Guardado fallido/);
 await h.db.flushLoginCache();
 assert.equal(h.store.has(h.key('A1')),true);
 assert.equal(h.call.del,0);
});
test('todas las colecciones con incidencia declarada en detalle GH están cubiertas',async()=>{
 for(const c of ['anunciantes','anunciantes_administracion','anunciantes_sedes','suscriptor_anunciante','promos','eventos','actividades','publicidades','farmacias_ciclos','publicidad_media','publicidad_segmentacion']){
  const h=setup();h.seed('A1');h.seed('A2');
  const id=['anunciantes','anunciantes_administracion'].includes(c)?'A1':'X';
  const data={id,anunciante_id:'A1',estado:'PENDIENTE'};
  if(c.startsWith('publicidad_')){data.publicidad_id='P';h.docs.set('publicidades/P',{id:'P',anunciante_id:'A1'});}
  h.docs.set(c+'/'+id,data);
  await h.db.patch(c,id,{estado:'ACTIVA'});
  await h.db.flushLoginCache();
  assert.equal(h.store.has(h.key('A1')),false,'sin invalidación '+c);
  assert.equal(h.store.has(h.key('A2')),true,'se invalidó copia ajena '+c);
 }
});
