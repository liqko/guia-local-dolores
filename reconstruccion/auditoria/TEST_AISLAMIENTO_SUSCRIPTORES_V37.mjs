import assert from 'node:assert/strict';
import {subscriberFixture} from './helpers/subscriber-fixture.mjs';
let cases=0;
async function setup(verified=true){
 const f=subscriberFixture();
 const out=await f.api({action:'crear',nombre:'Persona',mail:'persona@prueba.test',clave:'secreto1',ciudad_origen_id:'DOL'});
 const id=out.suscriptor.suscriptor_id;
 if(verified)f.seed('suscriptores',id,{...f.collection('suscriptores').get(id),email_verificado:true});
 const login=await f.api({action:'login',mail:'persona@prueba.test',clave:'secreto1'});
 const log=[];
 for(const op of ['get','queryEqual','patch','delete','listCollection']){
  const original=f.db[op].bind(f.db);f.db[op]=async(...args)=>{log.push({op,args:structuredClone(args)});return original(...args)};
 }
 return{...f,id,token:login.token,log};
}
for(const field of ['nombre','whatsapp','tipo_usuario','ciudad_origen_id']){
 const f=await setup();await f.api({action:'actualizar_perfil',[field]:'Cambio',suscriptor_id:'AJENO'},f.token);
 assert.deepEqual(f.log.map(x=>x.op),['patch']);assert.deepEqual(f.log[0].args.slice(0,2),['suscriptores',f.id]);
 assert.deepEqual(Object.keys(f.log[0].args[2]).sort(),[field,'actualizado_en'].sort());cases++;
}
{
 const f=await setup();
 for(const [action,method]of [['session','POST'],['anunciantes_autorizados','GET']]){
  assert.equal((await f.api({action},f.token,method)).success,true);assert.equal(f.log.length,0);cases++;
 }
 await f.api({action:'actualizar_perfil',suscriptor_id:'AJENO'},f.token);assert.equal(f.log.length,0);cases++;
 await f.api({action:'actualizar_ciudad',ciudad_id:'CAS'},f.token);
 assert.deepEqual(f.log.map(x=>x.op),['patch']);assert.deepEqual(Object.keys(f.log[0].args[2]).sort(),['actualizado_en','ciudad_predeterminada_id']);cases++;
}
for(const tipo of ['ANUNCIANTE','EVENTO','PROMO','ACTIVIDAD','CIUDAD']){
 const f=await setup();
 await f.api({action:'agregar_favorito',tipo,referencia_id:'REF'},f.token);
 assert.deepEqual(f.log.map(x=>x.op),['patch']);assert.equal(f.log[0].args[0],'suscriptor_favoritos');cases++;
 f.log.length=0;await f.api({action:'quitar_favorito',tipo,referencia_id:'REF'},f.token);
 assert.deepEqual(f.log.map(x=>x.op),['get','delete']);assert.ok(f.log.every(x=>x.args[0]==='suscriptor_favoritos'));cases++;
}
{
 const f=await setup(),originalFetch=globalThis.fetch;globalThis.fetch=f.mailFetch;
 try{
  for(const action of ['solicitar_verificacion','solicitar_recuperacion']){
   assert.equal((await f.api({action,mail:'persona@prueba.test'})).success,true);assert.equal(f.log.length,0);cases++;
  }
  await f.api({action:'restablecer_clave',mail:'persona@prueba.test',codigo:'123456',clave_nueva:'secreto2'});
  assert.deepEqual(f.log.map(x=>x.op),['queryEqual','patch']);
  assert.deepEqual(Object.keys(f.log[1].args[2]).sort(),['actualizado_en','clave']);cases++;
 }finally{globalThis.fetch=originalFetch}
}
{
 const f=await setup(false),originalFetch=globalThis.fetch;globalThis.fetch=f.mailFetch;
 try{
  await f.api({action:'confirmar_verificacion',mail:'persona@prueba.test',codigo:'123456'});
  assert.deepEqual(f.log.map(x=>x.op),['queryEqual','patch']);
  assert.deepEqual(Object.keys(f.log[1].args[2]).sort(),['actualizado_en','email_verificado','email_verificado_fecha']);cases++;
 }finally{globalThis.fetch=originalFetch}
}
{
 const f=await setup();await f.api({action:'cambiar_clave',clave_actual:'secreto1',clave_nueva:'secreto2'},f.token);
 assert.deepEqual(f.log.map(x=>x.op),['get','patch']);assert.ok(f.log.every(x=>x.args[0]==='suscriptores'));
 assert.deepEqual(Object.keys(f.log[1].args[2]).sort(),['actualizado_en','clave']);cases++;
}
{
 const f=await setup();f.seed('suscriptores','OTRO',{clave:'intacta'});
 await f.api({action:'eliminar_cuenta',clave_actual:'secreto1',suscriptor_id:'OTRO'},f.token);
 assert.deepEqual(f.log.map(x=>x.op),['get','queryEqual','queryEqual','delete']);
 assert.deepEqual(f.log.filter(x=>x.op==='queryEqual').map(x=>x.args.slice(0,3)),[
 ['suscriptor_anunciante','suscriptor_id',f.id],['suscriptor_favoritos','suscriptor_id',f.id]]);
 assert.ok(f.collection('suscriptores').get('OTRO'));cases++;
}
console.log('AISLAMIENTO SUSCRIPTORES V37 OK:',cases,'casos; cuenta, sesión, 5 tipos de favoritos, códigos y correo simulado con operaciones/campos exactos');

