import assert from 'node:assert/strict';
import {panelFixture} from './helpers/panel-fixture.mjs';
import {rebuildEventsAllV2} from '../worker/core/events-read-model-v2.js';
import {rebuildActivitiesAllV2} from '../worker/core/activities-read-model-v2.js';
import {rebuildPublicityAllV2} from '../worker/core/publicity-read-model-v2.js';
import {rebuildFarmAllV2} from '../worker/core/farmacias-read-model-v2.js';
const f=panelFixture();
const e=await f.action('/events-new',{action:'createvipevent',payload:f.event});
const a=await f.action('/actividades',{action:'guardar',payload:{nombre:'Yoga',categoria:'Deporte',horarios:[f.schedule('DOL')]}});
const p=await f.action('/publicidad',{action:'guardar',payload:{titulo:'Anuncio',formato:'GALERIA',media:[{url:'original'}],ciudades:['DOL'],categorias:['UG:CAT']}});
const adm=f.collection('anunciantes_administracion').get('ADV');adm.funcionalidades_config.TURNOS_FARMA={ciudades:['DOL']};
f.seed('anunciantes_sedes','F1',{sede_id:'F1',ciudad_id:'DOL',nombre_sede:'Farmacia'});
const farm=await f.action('/farmacias',{action:'guardar_ciclo',payload:{ciudad_id:'DOL',fecha_inicio:'2026-10-01',hora_inicio:'00:00',activo:false,participantes:[{sede_id:'F1'}]}});
const ids=[['event',e.evento_id],['activity',a.actividad_id],['publicity-media',p.publicidad_id],['publicity-seg',p.publicidad_id],['farm',farm.ciclo_id]];
for(const [type,id]of ids)await f.cache.put('relations:prepared:v1:'+type+':'+id,null);
// Sólo el mantenimiento explícito puede recorrer colecciones completas.
const scanned=[];f.db.listCollection=async collection=>{scanned.push(collection);return structuredClone([...f.collection(collection).values()])};
await Promise.all([rebuildEventsAllV2(f),rebuildActivitiesAllV2(f),rebuildPublicityAllV2(f),rebuildFarmAllV2(f)]);
assert.equal(scanned.length,10);
for(const [type,id]of ids)assert.ok((await f.cache.get('relations:prepared:v1:'+type+':'+id))?.data,'Seed omitió relaciones de contenido pendiente/inactivo');
f.db.listCollection=async()=>{throw new Error('Scan fuera del mantenimiento')};
f.db.queryEqual=async()=>{throw new Error('Edición simple consultó relaciones después del seed')};
await f.action('/events-new',{action:'updatevipevent',payload:{evento_id:e.evento_id,img1:'Nueva'}});
await f.action('/actividades',{action:'guardar',payload:{actividad_id:a.actividad_id,img1:'Nueva'}});
await f.action('/publicidad',{action:'guardar',payload:{publicidad_id:p.publicidad_id,titulo:'Nuevo'}});
await f.action('/farmacias',{action:'guardar_ciclo',payload:{ciclo_id:farm.ciclo_id,observaciones:'Nueva'}});
console.log('PREPARACION KV V37 OK: seed explícito incluye pendientes/inactivos; 4 módulos editan después sin consultas de relaciones ni barridos');

