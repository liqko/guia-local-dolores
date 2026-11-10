import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {projectGuideLinks} from '../scripts/prepare-guide-links.mjs';

const city='DOL (BUE - ARG)';
const input={
 events:{success:true,ciudad_id:city,events:[{nombre_evento:'Fiesta',organizador:'Club',fecha_desde:'2026-11-30',fecha_hasta:'2026-12-01',sponsor2:'Asociación',descripcion:'Texto completo',imagen:'Imagen pesada'}]},
 promos:{success:true,ciudad_id:city,promos:[{promo_id:'P1',sede_id:'S1',hasta:'2026-11-30',aprobado:true,pausado:false,img:'Imagen'}]},
 activities:{success:true,ciudad_id:city,actividades:[{actividad_id:'A1',anunciante_id:'X1',descripcion:'Ficha completa'}]}
};

test('conserva fechas, vínculos y claves de los botones y descarta la ficha completa',()=>{
 const links=projectGuideLinks(city,input);
 assert.deepEqual(links.events,[{nombre_evento:'Fiesta',fecha_desde:'2026-11-30',fecha_hasta:'2026-12-01',organizador:'Club',sponsor2:'Asociación'}]);
 assert.deepEqual(links.promos,[{promo_id:'P1',sede_id:'S1',hasta:'2026-11-30',aprobado:true,pausado:false}]);
 assert.deepEqual(links.activities,[{actividad_id:'A1',anunciante_id:'X1'}]);
 assert.throws(()=>projectGuideLinks('OTRA',input),/inválido/);
});

test('la Guía lee el índice de su ciudad y vuelve a las rutas normales si el índice no corresponde',async()=>{
 const html=readFileSync(new URL('../plataforma/anunciantes.html',import.meta.url),'utf8');
 const script=html.slice(html.indexOf('    async function obtenerEnlacesGuia(){'),html.indexOf('    function obtenerBannersPromise(){'));
 const links=projectGuideLinks(city,input);
 let published=links;
 const calls=[];
 const run=runInNewContext(script+'\nobtenerEnlacesGuia;',{
  ciudadSeleccionada:city,TextEncoder,btoa,
  gldFetchJson:async url=>{calls.push(url);return {data:published};},
  obtenerEventosPromise:async requested=>{calls.push('events:'+requested);return input.events;},
  obtenerPromosPromise:async requested=>{calls.push('promos:'+requested);return input.promos;},
  obtenerActividadesPromise:async requested=>{calls.push('activities:'+requested);return input.activities;}
 });
 assert.equal(await run(),links);
 assert.deepEqual(calls,['/plataforma/guia-enlaces/'+Buffer.from(city).toString('base64url')+'.json']);
 published={...links,city:'OTRA'};
 const backup=await run();
 assert.equal(backup.events[0].nombre_evento,'Fiesta');
 assert.equal(backup.promos[0].promo_id,'P1');
 assert.equal(backup.activities[0].actividad_id,'A1');
 assert.deepEqual(calls.slice(-3),['events:'+city,'promos:'+city,'activities:'+city]);
});
