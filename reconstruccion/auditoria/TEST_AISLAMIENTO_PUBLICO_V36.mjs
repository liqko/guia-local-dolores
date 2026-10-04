import assert from 'node:assert/strict';
import worker from '../worker/app-main-v35.js';
import {routePublicV12} from '../worker/routes/public-v12.js';

// Cada lectura pública debe consultar sólo sus claves KV; ni DB, red externa ni escrituras.
const definitions=[
 ['/territory/public', ['territorio:public:v1']],
 ['/catalogs/public/guide', ['catalogs:commerce:v1']],
 ['/guide?ciudad_id=CITY', ['guide:city:v1:CITY']],
 ['/promos?ciudad_id=CITY', ['promos:city:v1:CITY']],
 ['/events-new?ciudad_id=CITY', ['events:city:v2:CITY']],
 ['/actividades?action=publicas&ciudad_id=CITY', ['activities:city:v2:CITY']],
 ['/publicidad?action=publicas&ciudad_id=CITY&modulo=GUIA', ['publicity:city:v2:CITY','catalogs:publicidad:v1']],
 ['/efemerides?action=efemerides&ciudad_id=CITY&fecha=2026-10-04', ['efemerides:city:v2:CITY']],
 ['/farmacias?action=turnos&ciudad_id=CITY&fecha=2026-10-04', ['farmacias:city:v2:CITY']]
];
const rows=new Map([
 ['territorio:public:v1',{ciudades:[{ciudad_id:'DOL'},{ciudad_id:'CAS'}]}],
 ['catalogs:commerce:v1',{segmentos:[{segmento_id:'SEG'}]}],
 ['catalogs:publicidad:v1',{ubicaciones:[{ubicacion_id:'UG',modulo:'GUIA'}]}]
]);
for(const city of ['DOL','CAS']){
 const marker='ONLY-'+city;
 rows.set('guide:city:v1:'+city,{ciudad_id:city,anunciantes:[{id:marker}]});
 rows.set('promos:city:v1:'+city,{ciudad_id:city,promos:[{promo_id:marker}]});
 rows.set('events:city:v2:'+city,{ciudad_id:city,events:[{evento_id:marker}]});
 rows.set('activities:city:v2:'+city,{ciudad_id:city,actividades:[{actividad_id:marker,activo:true,aprobado:true,estado:'ACTIVA'}]});
 rows.set('publicity:city:v2:'+city,{ciudad_id:city,publicidades:[{publicidad_id:marker,estado:'ACTIVA',aprobado:true,media:[{url:'imagen',tipo_media:'IMAGEN'}],segmentacion:[{ciudad_id:city,ubicacion_id:'UG'}]}]});
 rows.set('efemerides:city:v2:'+city,{ciudad_id:city,efemerides:[{efemeride_id:marker,tipo_fecha:'FIJA',mes:10,dia:4}]});
 rows.set('farmacias:city:v2:'+city,{ciudad_id:city,ciclos:[{ciclo_id:marker,activo:true,fecha_inicio:'2026-10-01',hora_inicio:'00:00',duracion_horas:24,participantes:[{sede_id:marker}],sedes:[{sede_id:marker,nombre_sede:marker}]}]});
}
const fail=()=>{throw new Error('Acceso ajeno a lectura KV pública')};
const db=new Proxy({}, {get:()=>fail});
const originalFetch=globalThis.fetch;globalThis.fetch=fail;
let checked=0;
try{
 for(const cold of [false,true])for(const city of ['DOL','CAS'])for(const [pattern,expected] of definitions){
  const url=new URL('https://prueba.local'+pattern.replaceAll('CITY',city));
  const allowed=expected.map(k=>k.replaceAll('CITY',city)),calls=[];
  const cache={get:async k=>{calls.push(k);assert.ok(allowed.includes(k),'Clave KV ajena: '+k);return cold?null:structuredClone(rows.get(k)||null)},put:fail};
  const request=new Request(url);
  const response=await routePublicV12({path:url.pathname,url,request,db,cache,env:{}});
  assert.ok(response,'Ruta pública sin respuesta');
  const body=await response.json();
  assert.equal(response.status,cold&&url.pathname==='/territory/public'?503:200,JSON.stringify(body));
  assert.equal(new Set(calls).size,calls.length,'Lectura KV repetida dentro de una consulta');
  if(!cold&&pattern.includes('CITY')){
   assert.ok(JSON.stringify(body).includes('ONLY-'+city),'No devolvió la ciudad solicitada');
   assert.ok(!JSON.stringify(body).includes('ONLY-'+(city==='DOL'?'CAS':'DOL')),'Mezcló otra ciudad');
  }
  // También atravesar el entrypoint real: un fallback Firestore intenta usar fetch y falla.
  const env={GLD_CACHE_KV:{get:async k=>{assert.ok(allowed.includes(k));return cold?null:JSON.stringify(rows.get(k)||null)},put:fail}};
  const throughWorker=await worker.fetch(new Request(url),env);
  assert.equal(throughWorker.status,response.status);
  assert.deepEqual(await throughWorker.json(),body);
  checked++;
 }
 for(const path of ['/guide','/promos','/events-new','/actividades?action=publicas','/publicidad?action=publicas','/efemerides?action=publicas','/farmacias?action=turnos']){
  const url=new URL('https://prueba.local'+path);
  const response=await routePublicV12({path:url.pathname,url,request:new Request(url),db,cache:{get:fail,put:fail},env:{}});
  assert.equal(response.status,400);checked++;
 }
 console.log('AISLAMIENTO PUBLICO V36 OK: '+checked+' casos; 9 consultas, 2 ciudades, KV poblado/vacío y parámetros faltantes; 0 Firestore, 0 escrituras y sin claves de otras ciudades');
}finally{globalThis.fetch=originalFetch}

