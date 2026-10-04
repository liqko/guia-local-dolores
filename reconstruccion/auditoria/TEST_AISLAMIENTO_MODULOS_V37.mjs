import assert from 'node:assert/strict';
import {panelFixture} from './helpers/panel-fixture.mjs';
import {changedFieldsV1} from '../worker/core/changed-fields-v1.js';
const definitions=[
 {name:'Eventos',path:'/events-new',collection:'eventos',idKey:'evento_id',action:'updatevipevent',stamp:'actualizado',
 fields:['nombre_evento','img1','img2','img3','descripcion','organizador','categoria'],
 create:async f=>(await f.action('/events-new',{action:'createvipevent',payload:f.event})).evento_id,
 reads:['eventos']},
 {name:'Actividades',path:'/actividades',collection:'actividades',idKey:'actividad_id',action:'guardar',stamp:'actualizado',
 fields:['nombre','categoria','img1','img2','img3','descripcion'],
 create:async f=>(await f.action('/actividades',{action:'guardar',payload:{nombre:'Yoga',categoria:'Deporte',horarios:[f.schedule('DOL')]}})).actividad_id,
 reads:['anunciantes_administracion','actividades']},
 {name:'Publicidad',path:'/publicidad',collection:'publicidades',idKey:'publicidad_id',action:'guardar',stamp:'actualizado',
 fields:['titulo','nombre_interno','cta_texto','cta_destino'],
 create:async f=>(await f.action('/publicidad',{action:'guardar',payload:{titulo:'Anuncio',formato:'GALERIA',media:[{url:'original'}],ciudades:['DOL'],categorias:['UG:CAT']}})).publicidad_id,
 reads:['anunciantes_administracion','publicidades']},
 {name:'Efemérides',path:'/efemerides',collection:'efemerides_bis',idKey:'efemeride_id',action:'guardar',stamp:'actualizado_en',
 fields:['nombre','descripcion','imagen'],
 create:async f=>(await f.action('/efemerides',{action:'guardar',payload:{nombre:'Día',tipo:'LOCAL',ciudad_id:'DOL',tipo_fecha:'FIJA',mes:10,dia:4}})).efemeride.efemeride_id,
 reads:['anunciantes_administracion','efemerides_bis']},
 {name:'Farmacias',path:'/farmacias',collection:'farmacias_ciclos',idKey:'ciclo_id',action:'guardar_ciclo',stamp:'actualizado',
 fields:['observaciones','hora_inicio'],
 create:async f=>{
 const admin=f.collection('anunciantes_administracion').get('ADV');admin.funcionalidades_config.TURNOS_FARMA={ciudades:['DOL']};
 f.seed('anunciantes_sedes','F1',{sede_id:'F1',anunciante_id:'ADV',ciudad_id:'DOL',nombre_sede:'Farmacia'});
 return(await f.action('/farmacias',{action:'guardar_ciclo',payload:{ciudad_id:'DOL',fecha_inicio:'2026-10-01',hora_inicio:'00:00',participantes:[{sede_id:'F1'}]}})).ciclo_id;
 },reads:['anunciantes_administracion','farmacias_ciclos']}
];
function instrument(f){
 const log=[];for(const op of ['get','queryEqual','patch','delete','listCollection']){
  const original=f.db[op].bind(f.db);f.db[op]=async(...args)=>{log.push({op,args:structuredClone(args)});return original(...args)};
 }return log;
}
let cases=0;
for(const d of definitions){
 for(const field of d.fields){
  const f=panelFixture(),id=await d.create(f),log=instrument(f),before=structuredClone(f.collection(d.collection).get(id));
  const value=field==='hora_inicio'?'08:00':'Cambio.';
  await f.action(d.path,{action:d.action,payload:{[d.idKey]:id,[field]:value}});
  assert.deepEqual(log.filter(x=>x.op==='get').map(x=>x.args[0]),d.reads,d.name+': lecturas innecesarias');
  assert.equal(log.filter(x=>x.op==='queryEqual'||x.op==='listCollection').length,0,d.name+': consulta relaciones al cambiar '+field);
  const writes=log.filter(x=>x.op==='patch');assert.equal(writes.length,1,d.name);
  assert.equal(writes[0].args[0],d.collection);
  assert.deepEqual(Object.keys(writes[0].args[2]).sort(),[field,d.stamp].sort(),d.name+': campos ajenos');
  const saved=f.collection(d.collection).get(id);
  for(const [k,v]of Object.entries(before))if(k!==field&&k!==d.stamp)assert.deepEqual(saved[k],v);
  log.length=0;
  await f.action(d.path,{action:d.action,payload:{[d.idKey]:id,[field]:value}});
  assert.equal(log.filter(x=>x.op==='patch').length,0,d.name+': repetir mismo valor escribe');
  cases+=2;
 }
 console.log('OK:',d.name,d.fields.length,'campos generales y repetición intacta');
}
// Rechaza una copia KV de relaciones de una versión anterior.
for(const d of definitions){
 const f=panelFixture(),id=await d.create(f),row=f.collection(d.collection).get(id);
 for(const k of ['creado','creado_en','origen','activo','nivel','id_anunciante','nombre_interno','cta_tipo','vigente_hasta'])delete row[k];
 const log=instrument(f),field=d.fields[0];
 await f.action(d.path,{action:d.action,payload:{[d.idKey]:id,[field]:'Cambio histórico'}});
 const patch=log.find(x=>x.op==='patch'&&x.args[0]===d.collection);
 assert.deepEqual(Object.keys(patch.args[2]).sort(),[field,d.stamp].sort(),d.name+': rellenó campos históricos ajenos');cases++;
}
{
 const d=definitions[0],f=panelFixture(),id=await d.create(f);
 await f.cache.put('relations:prepared:v1:event:'+id,{revision:'VIEJA',data:[]});
 const log=instrument(f);await f.action(d.path,{action:d.action,payload:{evento_id:id,img1:'Nueva'}});
 assert.deepEqual(log.filter(x=>x.op==='queryEqual').map(x=>x.args.slice(0,3)),[['evento_programacion','evento_id',id]]);cases++;
}
// Moderación usa la copia preparada sin leer horarios/programación; retiro y aprobación actualizan KV.
for(const [d,tipo]of [[definitions[0],'EVENTO'],[definitions[1],'ACTIVIDAD']]){
 const f=panelFixture(),id=await d.create(f),log=instrument(f);
 await f.action('/superadmin/moderation/resolve',{tipo,id,decision:'APROBAR'},f.admin);
 assert.deepEqual(log.filter(x=>x.op==='get').map(x=>x.args[0]),[d.collection]);
 assert.equal(log.filter(x=>x.op==='queryEqual').length,0);assert.equal(log.filter(x=>x.op==='patch').length,1);cases++;
}
// Repetir un lote idéntico de participantes no reescribe las farmacias ni el ciclo.
{
 const d=definitions[4],f=panelFixture(),id=await d.create(f),log=instrument(f);
 await f.action(d.path,{action:d.action,payload:{ciclo_id:id,participantes:[{sede_id:'F1'}]}});
 assert.equal(log.filter(x=>x.op==='patch'||x.op==='delete').length,0);cases++;
}
// Horas e imágenes: sólo la fila y el campo modificados, sin recrear hermanos.
for(const kind of ['event','activity','publicity']){
 const f=panelFixture();
 let id,path,action,idKey,rows,collection,rowKey;
 if(kind==='event'){
  id=(await f.action('/events-new',{action:'createvipevent',payload:{...f.event,programacion:[...f.event.programacion,{...f.event.programacion[0],fecha:'2026-10-11'}]}})).evento_id;
  path='/events-new';action='updatevipevent';idKey='evento_id';collection='evento_programacion';rowKey='programacion';
  rows=await f.db.queryEqual(collection,'evento_id',id);
 }else if(kind==='activity'){
  id=(await f.action('/actividades',{action:'guardar',payload:{nombre:'Yoga',categoria:'Deporte',horarios:[f.schedule('DOL'),f.schedule('CAS')]}})).actividad_id;
  path='/actividades';action='guardar';idKey='actividad_id';collection='actividad_horarios';rowKey='horarios';
  rows=await f.db.queryEqual(collection,'actividad_id',id);
 }else{
  id=(await f.action('/publicidad',{action:'guardar',payload:{titulo:'Anuncio',formato:'GALERIA',media:[{url:'original'},{url:'intacta'}],ciudades:['DOL'],categorias:['UG:CAT']}})).publicidad_id;
  path='/publicidad';action='guardar';idKey='publicidad_id';collection='publicidad_media';rowKey='media';
  rows=await f.db.queryEqual(collection,'publicidad_id',id);
 }
 const desired=structuredClone(rows),field=kind==='publicity'?'url':'hora_desde';
 desired[0][field]=kind==='publicity'?'nueva':'09:00';
 const log=instrument(f);
 await f.action(path,{action,payload:{[idKey]:id,[rowKey]:desired}});
 const children=log.filter(x=>x.op==='patch'&&x.args[0]===collection);
 assert.equal(children.length,1,kind+': reescribió hermanos');
 assert.deepEqual(Object.keys(children[0].args[2]).sort(),[field,'actualizado'].sort());
 assert.equal(log.filter(x=>x.op==='delete').length,0);
 assert.deepEqual(log.filter(x=>x.op==='queryEqual').map(x=>x.args[0]),[collection],kind+': consultó relaciones ajenas');
 log.length=0;
 await f.action(path,{action,payload:{[idKey]:id,[rowKey]:desired}});
 assert.equal(log.filter(x=>x.op==='patch'||x.op==='delete').length,0,kind+': lote intacto escribió');
 cases+=2;
}
// Repetir una imagen intacta en un evento aprobado no lo retira por moderación.
{
 const f=panelFixture(),id=await definitions[0].create(f);
 await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id,decision:'APROBAR'},f.admin);
 const log=instrument(f);
 await f.action('/events-new',{action:'updatevipevent',payload:{evento_id:id,nombre_evento:'Encuentro'}});
 assert.equal(log.filter(x=>x.op==='patch').length,0);
 assert.equal((await f.publicRows('/events-new','DOL','events')).length,1);cases++;
}
// Caminos de ciclo de vida: ninguna colección fuera del módulo y su cupo.
const lifecycle=[
 [0,{action:'pausevipevent',payload:{pause:true}},['eventos']],
 [0,{action:'pausevipevent',payload:{pause:false}},['eventos']],
 [0,{action:'duplicatevipevent',payload:{}},['eventos','evento_programacion','anunciantes','anunciantes_administracion']],
 [0,{action:'deletevipevent',payload:{}},['eventos','evento_programacion']],
 [1,{action:'pausar'},['actividades']],
 [1,{action:'reanudar'},['actividades','anunciantes_administracion']],
 [1,{action:'renovar'},['actividades','anunciantes_administracion']],
 [1,{action:'eliminar'},['actividades','actividad_horarios']],
 [2,{action:'actualizar_activos',publicidad_ids:'SELF'},['publicidades','anunciantes_administracion','publicidad_cambios']],
 [2,{action:'actualizar_activos',publicidad_ids:[]},['publicidades','anunciantes_administracion']],
 [2,{action:'eliminar'},['publicidades','publicidad_media','publicidad_segmentacion']],
 [3,{action:'desactivar'},['efemerides_bis','anunciantes_administracion']],
 [3,{action:'activar'},['efemerides_bis','anunciantes_administracion']],
 [3,{action:'eliminar'},['efemerides_bis','anunciantes_administracion']],
 [4,{action:'guardar_ciclo',payload:{activo:false}},['farmacias_ciclos','anunciantes_administracion']]
];
for(const [index,raw,allowed]of lifecycle){
 const d=definitions[index],f=panelFixture(),id=await d.create(f),log=instrument(f),body=structuredClone(raw);
 if(body.publicidad_ids==='SELF')body.publicidad_ids=[id];
 if(body.payload)body.payload[d.idKey]=id;else body[d.idKey]=id;
 await f.action(d.path,body);
 assert.ok(log.every(x=>allowed.includes(x.args[0])),d.name+' '+body.action+': acceso ajeno al módulo');
 cases++;
}
assert.deepEqual(changedFieldsV1({nested:{a:1,b:2}},{nested:{b:2,a:1},actualizado:'ahora'}),{});
console.log('AISLAMIENTO MODULOS V37 OK:',cases,'casos; campos/colecciones exactos, relaciones KV con revisión y moderación coordinada');
