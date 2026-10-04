import assert from 'node:assert/strict';
import {panelFixture} from './helpers/panel-fixture.mjs';
import {syncGuideAdvertiserV2} from '../worker/core/guide-read-model-v2.js';
const cases=[];const test=(name,fn)=>cases.push({name,fn});
async function guideSeed(f){
 f.seed('anunciantes_sedes','SED',{sede_id:'SED',anunciante_id:'ADV',ciudad_id:'DOL',direccion:'Original',actividad_ids:['ACT']});
 await f.cache.put('catalogs:commerce:v1',{actividades_clave:[{actividad_id:'ACT',nombre:'Servicio'}]});
 await syncGuideAdvertiserV2({...f,advertiserId:'ADV'});
}
test('Modificar datos e imágenes: una escritura puntual y publicación sin Firestore',async f=>{
 await guideSeed(f);const before={...f.stats};
 await f.action('/commerce',{action:'set_datos',descripcion:'Actualizada',img1:'https://prueba.test/uno.jpg'});
 assert.equal(f.stats.writes-before.writes,1);assert.equal(f.stats.reads,before.reads);assert.equal(f.stats.queries,before.queries);
 const card=(await f.publicRows('/guide','DOL','anunciantes'))[0];assert.equal(card.img1,'https://prueba.test/uno.jpg');assert.equal(card.sedes[0].actividades[0].nombre,'Servicio');
 await f.action('/commerce',{action:'set_datos',img1:''});assert.equal((await f.publicRows('/guide','DOL','anunciantes'))[0].img1,'');
});
test('Sedes: mover, eliminar la última y agregar nuevamente conserva datos del comercio',async f=>{
 await guideSeed(f);await f.action('/commerce',{action:'set_sedes',sedes:[{sede_id:'SED',ciudad_id:'CAS',img1:'https://prueba.test/sede.jpg'}]});
 assert.equal((await f.publicRows('/guide','DOL','anunciantes')).length,0);
 assert.equal((await f.publicRows('/guide','CAS','anunciantes'))[0].sedes[0].img1,'https://prueba.test/sede.jpg');
 await f.action('/commerce',{action:'delete_sede',sede_id:'SED'});assert.equal((await f.publicRows('/guide','CAS','anunciantes'))[0].sedes.length,0);
 assert.ok(await f.db.get('anunciantes','ADV'));
 await syncGuideAdvertiserV2({...f,advertiserId:'ADV'});
 assert.equal((await f.publicRows('/guide','CAS','anunciantes'))[0].sedes.length,0);
 await f.action('/commerce',{action:'set_datos',descripcion:'Sin sedes pero actualizada'});
 const added=await f.action('/commerce',{action:'set_sedes',sedes:[{ciudad_id:'DOL',direccion:'Nueva'}]});
 const card=(await f.publicRows('/guide','DOL','anunciantes'))[0];assert.equal(card.descripcion,'Sin sedes pero actualizada');assert.equal(card.sedes[0].sede_id,added.sedes[0].sede_id);
 const before=f.stats.writes;await f.action('/commerce',{action:'set_sedes',sedes:[{sede_id:added.sedes[0].sede_id,direccion:'Nueva'}]});assert.equal(f.stats.writes,before);
});
test('Sedes: una ciudad inválida o sede ajena rechaza todo el lote antes de escribir',async f=>{
 await guideSeed(f);f.seed('anunciantes_sedes','AJENA',{anunciante_id:'OTRO',ciudad_id:'CAS'});
 for(const second of [{sede_id:'AJENA',direccion:'Intento'},{ciudad_id:'NO-EXISTE'}]){
  const before=f.stats.writes;await assert.rejects(()=>f.action('/commerce',{action:'set_sedes',sedes:[{sede_id:'SED',direccion:'Cambio'},second]}));assert.equal(f.stats.writes,before);
 }
 assert.equal((await f.db.get('anunciantes_sedes','SED')).direccion,'Original');
});
test('Eventos: programación en dos ciudades, edición de imágenes sin recrear instancias, pausa y baja',async f=>{
 const payload={...f.event,img1:'https://prueba.test/evento.jpg',programacion:[...f.event.programacion,{fecha:'2026-10-12',ciudad_id:'CAS',lugar_texto:'Club',direccion:'Centro'}]};
 const e=await f.action('/events-new',{action:'createvipevent',payload});const id=e.evento_id;
 await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id,decision:'APROBAR'},f.admin);
 for(const [city,date]of [['DOL','2026-10-10'],['CAS','2026-10-12']]){const row=(await f.publicRows('/events-new',city,'events'))[0];assert.equal(row.ciudad_id,city);assert.equal(row.fecha_desde,date);assert.equal(row.programacion.length,1);}
 const programs=await f.db.queryEqual('evento_programacion','evento_id',id);const before=f.stats.writes;
 await f.action('/events-new',{action:'updatevipevent',payload:{evento_id:id,img1:'https://prueba.test/nueva.jpg',programacion:programs}});
 assert.equal(f.stats.writes-before,1);assert.deepEqual(await f.db.queryEqual('evento_programacion','evento_id',id),programs);
 for(const city of ['DOL','CAS'])assert.equal((await f.publicRows('/events-new',city,'events')).length,0);
 await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id,decision:'APROBAR'},f.admin);
 await f.action('/events-new',{action:'pausevipevent',payload:{evento_id:id,pause:true}});
 for(const city of ['DOL','CAS'])assert.equal((await f.publicRows('/events-new',city,'events')).length,0);
 await f.action('/events-new',{action:'pausevipevent',payload:{evento_id:id,pause:false}});
 assert.equal((await f.publicRows('/events-new','CAS','events'))[0].img1,'https://prueba.test/nueva.jpg');
 await f.action('/events-new',{action:'deletevipevent',payload:{evento_id:id}});
 for(const city of ['DOL','CAS'])assert.equal((await f.publicRows('/events-new',city,'events')).length,0);
});
test('Eventos: quitar la instancia de una ciudad retira allí la publicación anterior',async f=>{
 const e=await f.action('/events-new',{action:'createvipevent',payload:{...f.event,programacion:[...f.event.programacion,{fecha:'2026-10-12',ciudad_id:'CAS',lugar_texto:'Club',direccion:'Centro'}]}});const id=e.evento_id;
 await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id,decision:'APROBAR'},f.admin);
 await f.action('/events-new',{action:'updatevipevent',payload:{evento_id:id,programacion:[e.evento.programacion[0]]}});
 await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id,decision:'APROBAR'},f.admin);
 assert.equal((await f.publicRows('/events-new','CAS','events')).length,0);assert.equal((await f.publicRows('/events-new','DOL','events')).length,1);
});
test('Actividades: editar imagen conserva horarios y acepta un lugar del catálogo de esa ciudad',async f=>{
 f.seed('lugares','LUGAR',{ciudad_id:'DOL',nombre:'Club'});
 const a=await f.action('/actividades',{action:'guardar',payload:{nombre:'Yoga',categoria:'Deporte',img1:'https://prueba.test/yoga.jpg',horarios:[{ciudad_id:'DOL',tipo_lugar:'LUGAR',lugar_id:'LUGAR'}]}});const id=a.actividad_id;
 await f.action('/superadmin/moderation/resolve',{tipo:'ACTIVIDAD',id,decision:'APROBAR'},f.admin);
 const hs=await f.db.queryEqual('actividad_horarios','actividad_id',id),before=f.stats.writes;
 await f.action('/actividades',{action:'guardar',payload:{actividad_id:id,img1:'https://prueba.test/yoga2.jpg',horarios:hs}});
 assert.equal(f.stats.writes-before,1);assert.deepEqual(await f.db.queryEqual('actividad_horarios','actividad_id',id),hs);
 assert.equal((await f.publicRows('/actividades?action=publicas','DOL','actividades'))[0].img1,'https://prueba.test/yoga2.jpg');
 const noWrite=f.stats.writes;await assert.rejects(()=>f.action('/actividades',{action:'guardar',payload:{actividad_id:id,horarios:[{ciudad_id:'CAS',lugar_id:'LUGAR'}]}}));assert.equal(f.stats.writes,noWrite);
});
test('Publicidad: editar una imagen conserva segmentación y las demás imágenes',async f=>{
 const payload={titulo:'Galería',formato:'GALERIA',media:[{url:'https://prueba.test/1.jpg'},{url:'https://prueba.test/2.jpg'}],ciudades:['DOL'],categorias:['UG:CAT']};
 const p=await f.action('/publicidad',{action:'guardar',payload});const id=p.publicidad_id;
 const seg=await f.db.queryEqual('publicidad_segmentacion','publicidad_id',id),media=await f.db.queryEqual('publicidad_media','publicidad_id',id),before=f.stats.writes;
 await f.action('/publicidad',{action:'guardar',payload:{...payload,publicidad_id:id,media:[{url:'https://prueba.test/nueva.jpg'},payload.media[1]]}});
 assert.equal(f.stats.writes-before,2);assert.deepEqual(await f.db.queryEqual('publicidad_segmentacion','publicidad_id',id),seg);
 const next=await f.db.queryEqual('publicidad_media','publicidad_id',id);assert.equal(next[0].media_id,media[0].media_id);assert.deepEqual(next[1],media[1]);
});
test('Promos: cambiar y retirar imagen actualiza un solo documento, con lectura pública desde KV',async f=>{
 const p=await f.action('/promos',{action:'createpromo',payload:{promo:'Oferta',categoria_id:'CAT',ciudad_id:'DOL',img:'https://prueba.test/promo.jpg'}});
 const id=p.promo.promo_id;
 for(const img of ['https://prueba.test/promo2.jpg','']){
  const before=f.stats.writes;await f.action('/promos',{action:'updatepromo',payload:{promo_id:id,img}});
  assert.equal(f.stats.writes-before,1);assert.equal((await f.publicRows('/promos','DOL','promos'))[0].img,img);
 }
});
let failures=0;for(const c of cases){try{await c.fn(panelFixture());console.log('OK:',c.name)}catch(e){failures++;console.error('FALLÓ:',c.name,e.message)}}
assert.equal(failures,0);console.log(`FLUJO EXISTENTE V35 OK: ${cases.length} circuitos, lecturas públicas sin Firestore y mutaciones sin recrear filas intactas`);
