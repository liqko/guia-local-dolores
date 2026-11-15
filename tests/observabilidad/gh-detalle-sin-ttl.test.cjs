const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('worker/worker206.txt','utf8');
const start=source.indexOf('function ghAdminDetailKey203(id)');
const end=source.indexOf('async function adminSubscriberDetailV2',start);
assert(start>=0&&end>start,'Se deben probar funciones reales del único Worker');
function setup(){
 const storage=new Map(),calls={get:0,put:0,del:0,build:0};
 const cache={
 async get(k){calls.get++;return storage.get(k)||null;},
 async put(k,v,opts){calls.put++;assert.equal(opts,undefined,'No escribir expiración temporal');storage.set(k,v);},
 async del(k){calls.del++;storage.delete(k);}
 };
 const ctx={encodeURIComponent,Date,advertiserDetailV2:async({advertiserId})=>{calls.build++;return {success:true,id:advertiserId,revision:calls.build}}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(start,end),ctx);
 return {cache,calls,ctx};
}
test('el detalle sigue disponible después de 121 segundos y 24 horas sin reconstrucción',async()=>{
 const {cache,calls,ctx}=setup();
 const date=Date.now;
 try{
   const original=await ctx.adminAdvertiserDetailV2({db:{},id:'ABC',cache});
   Date.now=()=>date()+24*3600*1000;
   const next=await ctx.adminAdvertiserDetailV2({db:{},id:'ABC',cache});
   assert.equal(next.id,original.id);
   assert.equal(next.revision,original.revision);
   assert.equal(calls.build,1);
   assert.equal(calls.put,1);
   assert.equal(calls.get,2);
 }finally{Date.now=date;}
});
test('cambio confirmado invalida copia y nueva lectura reconstruye una sola vez',async()=>{
 const {cache,calls,ctx}=setup();
 await ctx.adminAdvertiserDetailV2({db:{},id:'ABC',cache});
 await ctx.ghAdminDetailInvalidate203(cache,'ABC');
 const second=await ctx.adminAdvertiserDetailV2({db:{},id:'ABC',cache});
 assert.equal(second.revision,2);
 assert.equal(calls.build,2);
 assert.equal(calls.put,2);
 assert.equal(calls.del,1);
});
test('elimina caducidad antigua y no utiliza versión 203 previa',()=>{
 assert(!source.includes('GH_ADMIN_DETAIL_TTL203'),'El TTL120 debe desaparecer del código completo');
 assert(source.includes("admin:advertiser:detail:v204:"),'La nueva clave evita reutilizar copias antiguas');
 assert(source.includes('if(result.updated)await ghAdminDetailInvalidate203(cache,aid)'),'Los guardados deben invalidar el detalle');
 assert(source.includes('for(const aid of detailChanged204)await ghAdminDetailInvalidate203(directoryCache102,aid)'),'Los cambios de cualquier panel deben invalidar la copia centralmente');
 for(const name of ['anunciantes_sedes','suscriptor_anunciante','promos','eventos','actividades','publicidades'])assert(source.includes(name),'Falta dependencia '+name);
});
