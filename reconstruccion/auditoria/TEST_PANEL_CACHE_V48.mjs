import assert from 'node:assert/strict';
import {withPanelCacheV48} from '../worker/core/panel-cache-v48.js';
import {withPrivateCacheV46} from '../worker/core/private-cache-v46.js';
const kv=new Map(),docs=new Map();let reads=0,lists=0;
const env={GLD_CACHE_KV:{async get(k){return kv.get(k)||null},async put(k,v){kv.set(k,v)},async delete(k){kv.delete(k)},async list({prefix,cursor}){lists++;const names=[...kv.keys()].filter(k=>k.startsWith(prefix)).sort();const at=Number(cursor||0);return {keys:names.slice(at,at+2).map(name=>({name})),list_complete:at+2>=names.length,cursor:String(at+2)};}}};
function put(c,id,data){docs.set(c+'/'+id,{id,...data});}
put('anunciantes_administracion','A',{funcionalidades:'PUBLICIDAD,TURNOS_FARMA',turnos_farma:'*'});
put('publicidades','P',{anunciante_id:'A',titulo:'Uno',estado:'ACTIVA'});
put('publicidades','Q',{anunciante_id:'B',titulo:'Otro'});
put('publicidad_media','M',{publicidad_id:'P',url:'uno.jpg'});
put('publicidad_segmentacion','G',{publicidad_id:'P',ciudad_id:'D'});
put('anunciantes_sedes','S',{anunciante_id:'A',ciudad_id:'D'});
put('farmacias_ciclos','C',{anunciante_id:'A',nombre:'Ciclo'});
put('farmacias_ciclo_sedes','R',{ciclo_id:'C',sede_id:'S'});
const raw={async get(c,id){reads++;return structuredClone(docs.get(c+'/'+id)||null)},async queryEqual(c,f,v){reads++;return [...docs.entries()].filter(([k,row])=>k.startsWith(c+'/')&&row[f]===v).map(([,r])=>structuredClone(r))},async patch(c,id,p){const row={...docs.get(c+'/'+id),...p,id};docs.set(c+'/'+id,row);return structuredClone(row)},async delete(c,id){docs.delete(c+'/'+id);return true}};
const make=()=>withPanelCacheV48(withPrivateCacheV46(raw,env),env);
let db=make(),panel=db.panelReadDb();
await panel.get('anunciantes_administracion','A');await panel.queryEqual('publicidades','anunciante_id','A',500);await panel.queryEqual('publicidad_media','publicidad_id','P',500);await panel.queryEqual('publicidad_segmentacion','publicidad_id','P',500);await panel.get('publicidad_cambios','A_2026-10-07');
assert.equal(reads,5);
reads=0;db=make();panel=db.panelReadDb();assert.equal((await panel.queryEqual('publicidades','anunciante_id','A',500))[0].titulo,'Uno');await panel.get('anunciantes_administracion','A');await panel.queryEqual('publicidad_media','publicidad_id','P',500);await panel.queryEqual('publicidad_segmentacion','publicidad_id','P',500);await panel.get('publicidad_cambios','A_2026-10-07');assert.equal(reads,0);assert.equal(lists,0);
await panel.queryEqual('publicidades','anunciante_id','B',500);
await panel.queryEqual('anunciantes_sedes','anunciante_id','A',500);await panel.queryEqual('farmacias_ciclos','anunciante_id','A',500);await panel.queryEqual('farmacias_ciclo_sedes','ciclo_id','C',500);
reads=0;await db.patch('publicidad_media','M',{url:'dos.jpg'},{mustExist:true});await db.patch('publicidades','P',{titulo:'Dos'},{mustExist:true});await db.patch('publicidad_cambios','A_2026-10-07',{usados:1});await db.flushLoginCache();assert.equal(reads,0);
db=make();panel=db.panelReadDb();assert.equal((await panel.queryEqual('publicidades','anunciante_id','A',500))[0].titulo,'Dos');assert.equal((await panel.queryEqual('publicidad_media','publicidad_id','P',500))[0].url,'dos.jpg');assert.equal((await panel.get('publicidad_cambios','A_2026-10-07')).usados,1);assert.equal((await panel.queryEqual('publicidades','anunciante_id','B',500))[0].titulo,'Otro');assert.equal(reads,0);
// Mutaciones desde otra solicitud: lectura puntual del documento, sin barrido.
db=make();reads=0;await db.patch('publicidades','P',{anunciante_id:'B'},{mustExist:true});assert.equal(reads,1);await db.flushLoginCache();db=make();panel=db.panelReadDb();reads=0;assert.equal((await panel.queryEqual('publicidades','anunciante_id','A',500)).length,0);assert.equal((await panel.queryEqual('publicidades','anunciante_id','B',500)).length,2);assert.equal(reads,0);
await panel.queryEqual('anunciantes_sedes','anunciante_id','A',500);await db.delete('anunciantes_sedes','S');await db.patch('farmacias_ciclos','C',{nombre:'Nuevo'},{mustExist:true});await db.patch('farmacias_ciclo_sedes','R2',{ciclo_id:'C',sede_id:'S2'},{newDocument:true});await db.flushLoginCache();db=make();panel=db.panelReadDb();reads=0;assert.equal((await panel.queryEqual('anunciantes_sedes','anunciante_id','A',500)).length,0);assert.equal((await panel.queryEqual('farmacias_ciclos','anunciante_id','A',500))[0].nombre,'Nuevo');assert.equal((await panel.queryEqual('farmacias_ciclo_sedes','ciclo_id','C',500)).length,2);assert.equal(reads,0);
await db.patch('anunciantes_administracion','A',{funcionalidades:'PUBLICIDAD'},{mustExist:true});await db.flushLoginCache();db=make();assert.equal((await db.panelReadDb().get('anunciantes_administracion','A')).funcionalidades,'PUBLICIDAD');
// Dos cambios sobre documentos diferentes no pierden ninguno.
const d1=make(),d2=make();await Promise.all([d1.patch('publicidad_media','N1',{publicidad_id:'P',url:'tres.jpg'},{newDocument:true}),d2.patch('publicidad_media','N2',{publicidad_id:'P',url:'cuatro.jpg'},{newDocument:true})]);await Promise.all([d1.flushLoginCache(),d2.flushLoginCache()]);db=make();reads=0;assert.equal((await db.panelReadDb().queryEqual('publicidad_media','publicidad_id','P',500)).length,3);assert.equal(reads,0);
// Sin vencimiento por hora; tras propagación no se vuelve a listar deltas.
const now=Date.now;Date.now=()=>now()+120000;try{db=make();await db.panelReadDb().queryEqual('publicidad_media','publicidad_id','P',500);lists=0;db=make();await db.panelReadDb().queryEqual('publicidad_media','publicidad_id','P',500);assert.equal(reads,0);assert.equal(lists,0);}finally{Date.now=now;}
console.log('V48 PASS: lectura fría acotada, repetida cero; altas, bajas, edición, cambio de propietario, administración y concurrencia actualizan sólo sus listas.');
