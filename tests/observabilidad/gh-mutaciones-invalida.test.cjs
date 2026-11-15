const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('worker/worker206.txt','utf8');
const begin=source.indexOf('function withPanelCacheV48('),end=source.indexOf('\nreturn withPanelCacheV48;',begin);
assert(begin>0&&end>begin,'Debe probarse el código real del Worker');
const wrapperSource=source.slice(begin,end);
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
 const store=new Map(),docs=new Map(),call={get:0,put:0,del:0,lookup:0};
 const kv={async get(k){call.get++;return store.get(k)??null;},async put(k,v){call.put++;store.set(k,v);},async del(k){call.del++;store.delete(k);},async delete(k){return this.del(k)}};
 const rawDb={
  async get(c,id){return docs.get(c+'/'+id)||null;},
  async patch(c,id,patch){const row={...(docs.get(c+'/'+id)||{}),...patch,id};docs.set(c+'/'+id,row);return row;},
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
