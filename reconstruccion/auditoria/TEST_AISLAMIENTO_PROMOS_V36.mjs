import assert from 'node:assert/strict';
import {panelFixture} from './helpers/panel-fixture.mjs';
const fields=['promo','img','desde','hasta','otros','instagram','facebook','youtube','tiktok','linkedin','x','direccion','maps','telefono','telefono1','telefono2','telefono3','telefono4','whatsapp','whatsapp2','whatsapp3'];
let cases=0;
async function setup(){
 const f=panelFixture(),log=[];
 f.seed('anunciantes_sedes','SED',{anunciante_id:'ADV',ciudad_id:'DOL'});
 const created=await f.action('/promos',{action:'createpromo',payload:{promo:'Oferta',categoria_id:'CAT',ciudad_id:'DOL',sede_id:'SED',img:'original'}});
 const promoId=created.promo.promo_id;
 for(const operation of ['get','queryEqual','patch','delete','listCollection']){
  const original=f.db[operation].bind(f.db);f.db[operation]=async(...args)=>{log.push({operation,args:structuredClone(args)});return original(...args)};
 }
 return{...f,log,promoId};
}
for(const field of fields){
 const f=await setup(),before=structuredClone(f.collection('promos').get(f.promoId));
 await f.action('/promos',{action:'updatepromo',payload:{promo_id:f.promoId,[field]:'Cambio.'}});
 assert.deepEqual(f.log.map(x=>x.operation),['get','patch'],field+': consulta ajena');
 assert.deepEqual(f.log[0].args,['promos',f.promoId]);
 assert.deepEqual(Object.keys(f.log[1].args[2]).sort(),[field,'actualizado'].sort(),field+': reescritura ajena');
 const saved=f.collection('promos').get(f.promoId);
 for(const [k,v]of Object.entries(before))if(k!==field&&k!=='actualizado')assert.deepEqual(saved[k],v);
 f.log.length=0;
 await f.action('/promos',{action:'updatepromo',payload:{promo_id:f.promoId,[field]:'Cambio.'}});
 assert.deepEqual(f.log.map(x=>x.operation),['get'],'Edición intacta escribió o consultó otros registros');
 cases+=2;
}
{
 const f=await setup();
 await f.action('/promos',{action:'updatepromo',payload:{promo_id:f.promoId,pausado:true}});
 assert.deepEqual(f.log.map(x=>x.operation),['get','patch']);cases++;
 f.log.length=0;
 await f.action('/promos',{action:'updatepromo',payload:{promo_id:f.promoId,pausado:false}});
 assert.equal(f.log.filter(x=>x.operation==='queryEqual').length,1);
 assert.ok(f.log.every(x=>['promos','anunciantes_administracion'].includes(x.args[0])));cases++;
 f.log.length=0;
 await assert.rejects(()=>f.action('/promos',{action:'updatepromo',payload:{promo_id:f.promoId,ciudad_id:'CAS'}}));
 assert.ok(f.log.every(x=>x.operation==='get'));cases++;
 f.log.length=0;
 await f.action('/promos',{action:'updatepromo',payload:{promo_id:f.promoId,ciudad_id:'CAS',sede_id:''}});
 assert.deepEqual(f.log.map(x=>x.operation),['get','patch']);
 assert.equal((await f.publicRows('/promos','DOL','promos')).length,0);
 assert.equal((await f.publicRows('/promos','CAS','promos')).length,1);cases++;
 f.log.length=0;
 await f.action('/promos',{action:'deletepromo',payload:{promo_id:f.promoId}});
 assert.deepEqual(f.log.map(x=>x.operation),['get','delete']);assert.equal((await f.publicRows('/promos','CAS','promos')).length,0);cases++;
}
console.log('AISLAMIENTO PROMOS V36 OK: '+cases+' casos, '+fields.length+' campos generales, no-op, pausa/cupo, ciudad/sede y baja con operaciones y campos exactos');

