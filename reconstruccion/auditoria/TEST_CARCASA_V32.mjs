import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../worker/app-main-v35.js';

const html=fs.readFileSync('reconstruccion/plataforma/carcasa-territorio-v3.html','utf8');
const guideHtml=fs.readFileSync('reconstruccion/plataforma/anunciantes-publico-v4.html','utf8');
for(const [name,source] of [['carcasa',html],['anunciantes',guideHtml]]){
  for(const [i,m] of [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
    if(!/\bsrc=|application\/ld\+json/i.test(m[1]))new vm.Script(m[2],{filename:`${name}-script-${i}`});
  }
}
const packets=new Map([
  ['catalogs:commerce:v1',{segmentos:[{segmento_id:'S1',nombre:'Comercio'}]}]
]);
for(const city of ['DOL','CAS']){
  packets.set('guide:city:v1:'+city,{ciudad_id:city,anunciantes:[{id:'ADV-'+city,nombre:city}]});
  packets.set('promos:city:v1:'+city,{ciudad_id:city,promos:[{promo_id:'PRO-'+city}]});
  packets.set('events:city:v2:'+city,{ciudad_id:city,events:[{evento_id:'EV-'+city}]});
  packets.set('activities:city:v2:'+city,{ciudad_id:city,actividades:[{actividad_id:'ACT-'+city,activo:true,aprobado:true,estado:'ACTIVA'}]});
}
let writes=0,firestoreCalls=0,failNext=false;
const calls=[];
const env={GLD_CACHE_KV:{
  async get(key){return packets.has(key)?JSON.stringify(packets.get(key)):null},
  async put(){writes++;throw new Error('Una lectura pública intentó escribir KV')}
}};
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{firestoreCalls++;throw new Error('Lectura pública fuera de KV')};
const storage=new Map();
const context=vm.createContext({URL,AbortController,setTimeout,clearTimeout,console,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  fetch:async(url,options={})=>{
    calls.push(String(url));
    if(failNext){failNext=false;return new Response(JSON.stringify({success:false,message:'Temporal'}),{status:200})}
    return worker.fetch(new Request(url,options),env);
  }
});
function slice(start,end,source=html){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))}
vm.runInContext("let ciudadSeleccionada='DOL';"+
  slice('    const ANUNCIANTES_API','    const GLD_SUSCRIPTORES_API')+
  slice('    const EVENTS_WEBAPP_URL','    let gldLiberarCargaSecundaria'),context);
async function evaluate(code){return vm.runInContext(code,context)}
try{
  const guide=await evaluate("guiaPublicApi({action:'guia',ciudad_id:'DOL'})");
  assert.equal(guide.results[0].id,'ADV-DOL');
  assert.equal(new URL(calls.at(-1)).pathname,'/guide');
  assert.equal(new URL(calls.at(-1)).searchParams.has('action'),false);
  const catalog=await evaluate('gldFetchJson(GUIA_CATALOGOS_API)');
  assert.equal(catalog.data.segmentos[0].segmento_id,'S1');
  const results=await evaluate('Promise.all([obtenerPromosPromise(),obtenerPromosPromise(),obtenerEventosPromise(),obtenerActividadesPromise()])');
  assert.equal(results[0].promos[0].promo_id,'PRO-DOL');
  assert.equal(results[2].events[0].evento_id,'EV-DOL');
  assert.equal(results[3].actividades[0].actividad_id,'ACT-DOL');
  assert.equal(calls.filter(u=>new URL(u).pathname==='/promos').length,1);
  const other=await evaluate("ciudadSeleccionada='CAS';Promise.all([obtenerPromosPromise(),obtenerEventosPromise(),obtenerActividadesPromise()])");
  assert.equal(other[0].promos[0].promo_id,'PRO-CAS');
  assert.equal(other[1].events[0].evento_id,'EV-CAS');
  assert.equal(other[2].actividades[0].actividad_id,'ACT-CAS');
  const count=calls.length;
  await evaluate("ciudadSeleccionada='DOL';obtenerPromosPromise()");
  assert.equal(calls.length,count);
  failNext=true;
  await assert.rejects(()=>evaluate("obtenerPromosPromise('RETRY')"),/Temporal/);
  assert.equal(storage.has('gld_promos_modulo_cache_v2:RETRY'),false);
  await evaluate("obtenerPromosPromise('RETRY')");
  assert.equal(calls.filter(u=>new URL(u).searchParams.get('ciudad_id')==='RETRY').length,2);
  // Hidratación real: las relaciones ya preparadas en las sedes no se pierden.
  vm.runInContext("const normalizar=v=>String(v||'').toLowerCase();let relacionesSedesGlobales={};let metaPorIdGlobal={};let catalogosGlobales={actividades:[],acciones:[],nodos:[]};"+
    slice('        function limpiarCampos','        function relKey')+
    slice('        function relKey','          const acts=[], accs=[], nods=[]')+
    'return out;}',context);
  const hydrated=await evaluate("hidratarItem({id:'ADV',sedes:[{sede_id:'SED',actividades:[{actividad_id:'A',nombre:'Turismo'}],acciones:[{accion_id:'X'}],nodos:[{nodo_id:'N'}]}]})");
  assert.equal(hydrated.sedes[0].relaciones.actividades[0].nombre,'Turismo');
  assert.equal(hydrated.sedes[0].relaciones.acciones[0].accion_id,'X');
  assert.equal(hydrated.sedes[0].relaciones.nodos[0].nodo_id,'N');
  // El iframe de Guía ejecuta sus propias funciones contra el mismo Worker.
  storage.clear();
  const guideContext=vm.createContext({URL,AbortController,setTimeout,clearTimeout,console,
    localStorage:context.localStorage,fetch:context.fetch});
  vm.runInContext("let ciudadSeleccionada='DOL';"+
    slice('    const GLD_WORKER_ORIGIN','    const GLD_SUSCRIPTORES_API',guideHtml)+
    slice('    const EVENTS_WEBAPP_URL','    let gldLiberarCargaSecundaria',guideHtml),guideContext);
  const guideModules=await vm.runInContext('Promise.all([obtenerEventosPromise(),obtenerPromosPromise(),obtenerActividadesPromise()])',guideContext);
  assert.equal(guideModules[0].events[0].evento_id,'EV-DOL');
  assert.equal(guideModules[1].promos[0].promo_id,'PRO-DOL');
  assert.equal(guideModules[2].actividades[0].actividad_id,'ACT-DOL');
  assert.ok(calls.some(u=>new URL(u).pathname==='/events-new'&&new URL(u).searchParams.get('ciudad_id')==='DOL'));
  const guideOther=await vm.runInContext("ciudadSeleccionada='CAS';obtenerEventosPromise()",guideContext);
  assert.equal(guideOther.events[0].evento_id,'EV-CAS');
  vm.runInContext(slice('        function gldInsigniaActiva','        function relKey',guideHtml),guideContext);
  for(const value of [true,1,'x','true','sí'])assert.equal(vm.runInContext(`gldInsigniaActiva(${JSON.stringify(value)})`,guideContext),true);
  for(const value of [false,0,'false',''])assert.equal(vm.runInContext(`gldInsigniaActiva(${JSON.stringify(value)})`,guideContext),false);
  // El timeout real no cambia una carga ya finalizada a estado de error.
  let timeoutCallback;
  const timerContext=vm.createContext({setTimeout:fn=>{timeoutCallback=fn},
    miToken:1,tokenCarga:1,esperaReadyInterno:true,gldModuloCargando:false,
    document:{getElementById(){throw new Error('Timeout modificó una carga finalizada')}}});
  vm.runInContext(slice('    setTimeout(()=>{\n      if(miToken!==tokenCarga','    let destino=contextoUrl'),timerContext);
  timeoutCallback();
  for(const target of ['anunciantes-publico-v4.html','promos-public-v1.html','eventos-public-v1.html','actividades-public-v1.html']){
    assert.ok(html.includes(`url:'./${target}'`));
    assert.ok(fs.existsSync('reconstruccion/plataforma/'+target));
  }
  assert.equal(writes,0);
  assert.equal(firestoreCalls,0);
  console.log('TEST CARCASA V32 OK: Guía/iframe, catálogos, 3 módulos, 2 ciudades, deduplicación, reintento, relaciones, insignias y timeout; 0 Firestore/0 escrituras');
}finally{globalThis.fetch=originalFetch}
