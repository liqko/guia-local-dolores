import assert from 'node:assert/strict';
import {subscriberFixture} from './helpers/subscriber-fixture.mjs';
const cases=[];
const test=(name,fn)=>cases.push({name,fn});
async function account(f,verified=true){
  const out=await f.api({action:'crear',nombre:'Persona',mail:'persona@prueba.test',clave:'secreto1',ciudad_origen_id:'DOL'});assert.equal(out.success,true,JSON.stringify(out));
  assert.equal('clave' in out.suscriptor,false);
  const id=out.suscriptor.suscriptor_id;
  if(verified)f.seed('suscriptores',id,{...await f.db.get('suscriptores',id),email_verificado:true});
  const login=await f.api({action:'login',mail:'persona@prueba.test',clave:'secreto1'});
  return{id,login};
}
test('Registro, login sin escrituras y lista de comercios desde sesión',async f=>{
  const {id}=await account(f);f.seed('suscriptor_anunciante','REL',{suscriptor_id:id,anunciante_id:'ADV',activo:true,rol:'PROPIETARIO',permisos:'PROMOS'});f.seed('anunciantes','ADV',{nombre:'Comercio'});
  const before=f.stats.writes;const login=await f.api({action:'login',mail:'persona@prueba.test',clave:'secreto1'});assert.equal(login.success,true);assert.equal(f.stats.writes,before);
  const reads={...f.stats};const out=await f.api({action:'anunciantes_autorizados'},login.token,'GET');assert.equal(out.anunciantes[0].anunciante_nombre,'Comercio');assert.deepEqual(f.stats,reads);
});
test('Favoritos y sesión atraviesan todas las rutas sin perder el cuerpo',async f=>{
  const {id,login}=await account(f);const out=await f.api({action:'agregar_favorito',tipo:'CIUDAD',referencia_id:'DOL',suscriptor_id:'AJENO'},login.token);assert.equal(out.success,true,JSON.stringify(out));
  const rows=await f.api({action:'favoritos'},login.token,'GET');assert.equal(rows.favoritos.length,1);assert.equal(rows.favoritos[0].suscriptor_id,id);
  assert.equal((await f.api({action:'session'},login.token)).success,true);
  assert.equal((await f.api({action:'quitar_favorito',tipo:'CIUDAD',referencia_id:'DOL'},login.token)).success,true);
});
test('Ciudad y perfil ignoran suscriptor_id ajeno',async f=>{
  const {id,login}=await account(f);f.seed('suscriptores','AJENO',{nombre:'Original',ciudad_predeterminada_id:'CAS'});
  assert.equal((await f.api({action:'actualizar_ciudad',ciudad_id:'CAS',suscriptor_id:'AJENO'},login.token)).success,true);
  assert.equal((await f.db.get('suscriptores',id)).ciudad_predeterminada_id,'CAS');
  assert.equal((await f.api({action:'actualizar_perfil',nombre:'Nuevo',suscriptor_id:'AJENO'},login.token)).success,true);
  assert.equal((await f.db.get('suscriptores','AJENO')).nombre,'Original');
});
test('Confirmar correo actualiza cuenta y permite ingresar; código incorrecto no escribe',async f=>{
  const {id,login}=await account(f,false);assert.equal(login.requiere_verificacion,true);
  const before=f.stats.writes;const bad=await f.api({action:'confirmar_verificacion',mail:'persona@prueba.test',codigo:'000000'});assert.equal(bad.success,false);assert.equal(f.stats.writes,before);
  const ok=await f.api({action:'confirmar_verificacion',mail:'persona@prueba.test',codigo:'123456'});assert.equal(ok.success,true);
  assert.equal((await f.db.get('suscriptores',id)).email_verificado,true);
  assert.equal((await f.api({action:'login',mail:'persona@prueba.test',clave:'secreto1'})).success,true);
});
test('Restablecer clave guarda sólo la cuenta verificada por el puente',async f=>{
  const {id,login}=await account(f);const out=await f.api({action:'restablecer_clave',mail:'persona@prueba.test',codigo:'123456',clave_nueva:'secreto2'});assert.equal(out.success,true);
  assert.equal((await f.db.get('suscriptores',id)).clave,'secreto2');
  assert.equal((await f.api({action:'login',mail:'persona@prueba.test',clave:'secreto1'})).success,false);
  const before={...f.stats};assert.equal((await f.api({action:'session'},login.token)).success,false);assert.deepEqual(f.stats,before);
  assert.equal((await f.api({action:'login',mail:'persona@prueba.test',clave:'secreto2'})).success,true);
});
test('Solicitar códigos y fallos del puente no escriben Firestore',async f=>{
  await account(f);const before={...f.stats};
  for(const action of ['solicitar_verificacion','solicitar_recuperacion'])assert.equal((await f.api({action,mail:'persona@prueba.test'})).success,true);
  assert.deepEqual(f.stats,before);
  const original=globalThis.fetch;try{
    globalThis.fetch=async()=>new Response('no es JSON',{status:502});
    assert.equal((await f.api({action:'confirmar_verificacion',mail:'persona@prueba.test',codigo:'123456'})).success,false);
    assert.deepEqual(f.stats,before);
  }finally{globalThis.fetch=original}
});
test('Cambiar contraseña valida longitud y atraviesa las rutas',async f=>{
  const {login}=await account(f);const before=f.stats.writes;
  assert.equal((await f.api({action:'cambiar_clave',clave_actual:'secreto1',clave_nueva:'x'},login.token)).success,false);assert.equal(f.stats.writes,before);
  assert.equal((await f.api({action:'cambiar_clave',clave_actual:'secreto1',clave_nueva:'secreto2'},login.token)).success,true);
});
test('Eliminar cuenta exige clave, elimina sus datos y revoca sesión sin lecturas Firestore posteriores',async f=>{
  const {id,login}=await account(f);assert.equal((await f.api({action:'eliminar_cuenta',clave_actual:'mal'},login.token)).success,false);
  assert.ok(await f.db.get('suscriptores',id));
  assert.equal((await f.api({action:'eliminar_cuenta',clave_actual:'secreto1'},login.token)).success,true);
  assert.equal(await f.db.get('suscriptores',id),null);
  const before={...f.stats};assert.equal((await f.api({action:'agregar_favorito',tipo:'CIUDAD',referencia_id:'DOL'},login.token)).success,false);assert.deepEqual(f.stats,before);
});
let failures=0;
const original=globalThis.fetch;
try{for(const c of cases){const f=subscriberFixture();globalThis.fetch=f.mailFetch;try{await c.fn(f);console.log('OK:',c.name)}catch(e){failures++;console.error('FALLÓ:',c.name,e.message)}}}finally{globalThis.fetch=original}
assert.equal(failures,0,`${failures} circuitos fallaron`);
console.log(`SUSCRIPTORES V34 OK: ${cases.length} circuitos, correo simulado y datos aislados`);
