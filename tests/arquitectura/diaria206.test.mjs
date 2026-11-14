import {test} from 'node:test';
import assert from 'node:assert/strict';
import {w,fixture,cutoff,day} from './fixture206.mjs';
test('preparar y publicar sobre todas las fuentes con un único corte',async t=>{
 const f=fixture(t);const staged=await f.op('stage');assert.equal(staged.preparado,true);
 await assert.rejects(w.editionCall206(f.env,{action:'read',key:'master/A'}));
 await f.op('commit');const m=await f.op('read',{key:'master/A'});assert.equal(m.datos.nombre,'Original');assert.deepEqual(m.datos.campo_futuro,{x:1});
});
test('dos cambios del mismo registro se consolidan una vez; stage y nuevas aperturas no publican',async t=>{
 const f=fixture(t);await f.publish();const scans=f.metrics.sourceLists;
 f.events.push({at:cutoff+1000,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Primera'}}]},{at:cutoff+2000,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Última',nuevo_campo:['extensible']}}]});
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
 f.now=cutoff+day+60000;await f.op('stage');assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
 await f.op('commit');const row=await f.op('read',{key:'master/A'});assert.equal(row.datos.nombre,'Última');assert.deepEqual(row.datos.nuevo_campo,['extensible']);assert.deepEqual(row.datos.campo_futuro,{x:1});
 assert.equal(f.sql.prepare('SELECT count(*) AS n FROM edition_records206 WHERE key=? AND cutoff=?').get('master/A',cutoff+day).n,1);
 assert.equal(f.metrics.sourceLists,scans);assert.equal(f.metrics.sourceOutbox,1);
});
test('ediciones posteriores al corte quedan para el día siguiente',async t=>{
 const f=fixture(t);await f.publish();f.events.push({at:cutoff+day-1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Antes'}}]},{at:cutoff+day+1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Después'}}]});
 f.now=cutoff+day+60000;await f.publish();assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Antes');
 f.now=cutoff+2*day+60000;await f.publish();assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Después');
});
test('fallo del productor conserva la última edición, incluso después de reiniciar',async t=>{
 const f=fixture(t);await f.publish();f.events.push({at:cutoff+1,entries:[{collection:'NO_REGISTRADA',id:'x',patch:{}}]});f.now=cutoff+day+60000;
 await assert.rejects(f.op('stage'));f.restart();assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
 f.events.length=0;await f.publish();assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
});
test('stage concurrente, reintentos y commit son idempotentes',async t=>{
 const f=fixture(t);await Promise.all([f.op('stage'),f.op('stage'),f.op('stage')]);assert.equal(f.metrics.sourceLists,w.EDITION_COLLECTIONS206.size);
 await Promise.all([f.op('commit'),f.op('commit')]);assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
 const writes=f.sql.prepare('SELECT count(*) AS n FROM edition_records206').get().n;await f.op('stage');assert.equal(f.sql.prepare('SELECT count(*) AS n FROM edition_records206').get().n,writes);
});
test('commit sin stage completo y referencias temporales falsas se rechazan',async t=>{
 const f=fixture(t);await assert.rejects(f.op('commit'));await assert.rejects(f.op('stage',{cutoff:cutoff+123}));await assert.rejects(f.op('read',{key:'master/A'}));
});
test('caché de trabajo ausente nunca causa migración ni consulta de fuentes desde un lector',async t=>{
 const f=fixture(t),env=w.editionReadEnvironment206(f.env),db=w.editionReader206(env,{});
 await assert.rejects(db.get('anunciantes','A'));await assert.rejects(env.GLD_CACHE_KV.get('territorio:public:v1'));assert.equal(f.metrics.sourceLists,0);assert.equal(f.metrics.sourceOutbox,0);
});
test('caché fría tras reinicio y caché caliente consultan exclusivamente la edición guardada',async t=>{
 const f=fixture(t);await f.publish();const scanned=f.metrics.sourceLists;f.restart();
 for(let n=0;n<3;n++){const env=w.editionReadEnvironment206(f.env),db=w.editionReader206(env,{});const [a,b,c]=await Promise.all([db.get('anunciantes','A'),db.get('anunciantes_administracion','A'),db.queryEqual('anunciantes_sedes','anunciante_id','A',500)]);assert.equal(a.nombre,'Original');assert(b.funcionalidades);assert.equal(c.length,1);assert.equal((await env.GLD_CACHE_KV.get('territorio:public:v1')).includes('Dolores'),true);}
 assert.equal(f.metrics.sourceLists,scanned);assert.equal(f.metrics.sourceOutbox,0);
});
test('los módulos comparten una sola lectura del maestro por petición',async t=>{
 const f=fixture(t);await f.publish();const env=w.editionReadEnvironment206(f.env),db=w.editionReader206(env,{}),before=f.metrics.calls;
 await Promise.all([db.get('anunciantes','A'),db.get('anunciantes_administracion','A'),db.queryEqual('anunciantes_sedes','anunciante_id','A',500),db.publishedMaster206('A')]);assert.equal(f.metrics.calls-before,2,'abrir una edición y leer un maestro; sin 4 lecturas de fuentes');
});
test('una petición conserva su corte aunque se confirme otro entre sus lecturas',async t=>{
 const f=fixture(t);await f.publish();const env=w.editionReadEnvironment206(f.env),db=w.editionReader206(env,{});await db.get('anunciantes','A');
 f.events.push({at:cutoff+1,entries:[{collection:'anunciantes_administracion',id:'A',patch:{nivel:'nuevo'}}]});f.now=cutoff+day+60000;await f.publish();
 assert.equal((await db.get('anunciantes_administracion','A')).nivel,undefined);const fresh=w.editionReader206(w.editionReadEnvironment206(f.env),{});assert.equal((await fresh.get('anunciantes_administracion','A')).nivel,'nuevo');
});
test('corrupción y desaparición de un maestro declarado fallan sin Firestore ni recuperación en lectura',async t=>{
 const f=fixture(t);await f.publish();const scans=f.metrics.sourceLists;
 f.sql.prepare('UPDATE edition_records206 SET value=? WHERE key=?').run('{malformed','master/A');await assert.rejects(f.op('read',{key:'master/A'}));
 f.sql.prepare('DELETE FROM edition_records206 WHERE key=?').run('master/A');await assert.rejects(f.op('read',{key:'master/A'}));assert.equal(f.metrics.sourceLists,scans);
});
test('una fuente declarada ausente no se interpreta como una lista legítimamente vacía',async t=>{
 const f=fixture(t);f.rows.promos=[{id:'P',anunciante_id:'A',titulo:'Promo'}];await f.publish();f.sql.prepare('DELETE FROM edition_records206 WHERE key=?').run('source/promos/P');
 await assert.rejects(f.op('read',{prefix:'source/promos/'}));await assert.rejects(w.editionReader206(w.editionReadEnvironment206(f.env),{}).get('promos','P'));
});
test('consultas indexadas no vuelven a leer toda la colección ni duplican registros',async t=>{
 const f=fixture(t);f.rows.promos=Array.from({length:100},(_,n)=>({id:'P'+n,anunciante_id:n<2?'A':'B',titulo:'Promo'+n}));await f.publish();
 const env=w.editionReadEnvironment206(f.env),db=w.editionReader206(env,{}),before=f.metrics.calls;
 const list=await db.queryEqual('promos','anunciante_id','A',500);assert.equal(list.length,2);assert.equal(f.metrics.calls-before,4);assert.equal(f.sql.prepare("SELECT count(*) AS n FROM edition_records206 WHERE key LIKE 'source/promos/%'").get().n,100);
});
test('una baja es un tombstone y un cambio de sede no pierde datos de otro anunciante',async t=>{
 const f=fixture(t);f.rows.anunciantes.push({id:'B',nombre:'Segundo'});await f.publish();f.events.push({at:cutoff+1,entries:[{collection:'anunciantes_sedes',id:'S',patch:{anunciante_id:'B'}}]},{at:cutoff+2,entries:[{collection:'anunciantes',id:'A',remove:true},{collection:'anunciantes_administracion',id:'A',remove:true}]});f.now=cutoff+day+60000;await f.publish();
 assert.equal(await f.op('read',{key:'master/A'}),null);assert.equal((await f.op('read',{key:'master/B'})).sedes.length,1);assert.equal((await w.editionReader206(w.editionReadEnvironment206(f.env),{}).get('anunciantes_sedes','S')).anunciante_id,'B');
});
test('no se copian contraseñas, verificadores ni datos privados al catálogo público',async t=>{
 const f=fixture(t);f.rows.suscriptores=[{id:'U',nombre:'Privado',mail:'privado@example.invalid',clave:'secreto-fixture',salt:'salt-fixture',digest:'digest-fixture'}];await f.publish();
 const raw=await f.op('read',{key:'source/suscriptores/U'});assert.equal(raw.clave,undefined);assert.equal(raw.digest,undefined);assert.equal(raw.salt,undefined);
 const pub=await f.op('read',{key:'cache/territorio:public:v1'});assert(!JSON.stringify(pub).includes('privado@example.invalid'));assert(!JSON.stringify(await f.op('read',{key:'cache/guide:city:v1:D'})).includes('secreto-fixture'));
});
test('las lecturas rechazan escrituras, bajas y preparaciones de caché',async t=>{
 const f=fixture(t);await f.publish();const env=w.editionReadEnvironment206(f.env),db=w.editionReader206(env,{});
 await assert.rejects(env.GLD_CACHE_KV.put('catalogs:commerce:v1','{}'),{code:'READ_SIDE_EFFECT_BLOCKED'});await assert.rejects(env.GLD_CACHE_KV.delete('catalogs:commerce:v1'));await assert.rejects(db.patch('anunciantes','A',{}));await assert.rejects(db.commitPatches([]));
});
test('un cambio en trabajo de KV permanece invisible hasta stage y commit',async t=>{
 const f=fixture(t);await f.publish();f.now=cutoff+2000;await f.op('capture',{key:'notifications:fixture',value:{data:'nuevo'}});assert.equal(await f.op('read',{key:'cache/notifications:fixture'}),null);
 f.now=cutoff+day+60000;await f.op('stage');assert.equal(await f.op('read',{key:'cache/notifications:fixture'}),null);await f.op('commit');assert.equal((await f.op('read',{key:'cache/notifications:fixture'})).data,'nuevo');
});
test('un campo visual nuevo no requiere alterar publicadores ni listas de campos',async t=>{
 const f=fixture(t);await f.publish();f.events.push({at:cutoff+100,entries:[{collection:'anunciantes_administracion',id:'A',patch:{condicion_futura:{enabled:true,limite:55}}}]});f.now=cutoff+day+60000;await f.publish();assert.deepEqual((await f.op('read',{key:'master/A'})).administracion.condicion_futura,{enabled:true,limite:55});
});
test('publicador no duplica el maestro en caches privadas por formulario',async t=>{
 const f=fixture(t);await f.publish();const copies=f.sql.prepare("SELECT key FROM edition_records206 WHERE key LIKE 'cache/commerce:advertiser:master:%' OR key LIKE 'cache/admin:advertiser:detail:%' OR key LIKE 'source/anunciantes/%' OR key LIKE 'source/anunciantes_administracion/%' OR key LIKE 'source/anunciantes_sedes/%'").all();assert.deepEqual(copies,[]);
});
test('paquetes grandes usan fragmentos persistentes verificados sin reconstrucción desde Firestore',async t=>{
 const f=fixture(t);f.rows.anunciantes[0].campo_grande='á'.repeat(1900000);await f.publish();f.restart();
 assert.equal((await f.op('read',{key:'master/A'})).datos.campo_grande.length,1900000);assert(f.sql.prepare('SELECT count(*) n FROM edition_chunks206').get().n>1);
 f.sql.prepare('DELETE FROM edition_chunks206 WHERE key=? AND part=0').run('master/A');await assert.rejects(f.op('read',{key:'master/A'}));
});
test('eliminar el último registro de una ciudad publica un vacío preparado y no conserva paquetes anteriores',async t=>{
 const f=fixture(t);f.rows.promos=[{id:'P',promo_id:'P',anunciante_id:'A',ciudad_id:'D',promo:'Visible',aprobado:true,estado_moderacion:'PUBLICADO'}];await f.publish();assert.equal((await f.op('read',{key:'cache/promos:city:v1:D'})).promos.length,1);
 f.events.push({at:cutoff+1,entries:[{collection:'promos',id:'P',remove:true}]});f.now=cutoff+day+60000;await f.publish();assert.deepEqual((await f.op('read',{key:'cache/promos:city:v1:D'})).promos,[]);
});
test('la publicación pública incorpora una fuente confirmada aunque haya fallado su proyección operativa',async t=>{
 const f=fixture(t);f.rows.anunciantes[0].aprobado=true;f.rows.anunciantes_administracion[0].aprobado=true;f.rows.anunciantes_administracion[0].nivel=4;await f.publish();f.events.push({at:cutoff+1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Fuente confirmada'}}]});
 // No cache.put ni journal de proyección: sólo el commit/outbox durable.
 f.now=cutoff+day+60000;await f.op('stage');const cache={get:async key=>(await w.editionCall206(f.env,{action:'staged-read',cutoff:cutoff+day,key:'cache/'+key})).value};
 const cut=await w.exportCityBookCut({env:f.env,cache,after:cutoff,cutoff:cutoff+day,known:['D'],report:{}});assert.equal(cut.cities[0].replacements.guide.results[0].nombre,'Fuente confirmada');
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
});
test('máscaras de campos anidados conservan aceptaciones simultáneas y permiten bajas precisas',async t=>{
 const f=fixture(t);f.rows.suscriptores=[{id:'U',nombre:'Persona',historial:{vieja:{version:1},eliminar:{version:0}}}];await f.publish();
 f.events.push({at:cutoff+1,entries:[{collection:'suscriptores',id:'U',patch:{historial:{'nueva.1':{version:2}}},fieldPaths:['historial.`nueva.1`']}]},{at:cutoff+2,entries:[{collection:'suscriptores',id:'U',patch:{historial:{otra:{version:3}}},fieldPaths:['historial.otra','historial.eliminar']}]});
 f.now=cutoff+day+60000;await f.publish();const user=await f.op('read',{key:'source/suscriptores/U'});assert.deepEqual(user.historial,{vieja:{version:1},'nueva.1':{version:2},otra:{version:3}});
});


test('costo de preparación inicial, día sin cambios y cincuenta ediciones del mismo registro',async t=>{
 const f=fixture(t);await f.publish();
 const initial={lists:f.metrics.sourceLists,documents:f.metrics.sourceListDocuments};
 assert.equal(initial.lists,w.EDITION_COLLECTIONS206.size);
 f.now=cutoff+day+60000;f.restart();await f.publish();
 assert.equal(f.metrics.sourceLists,initial.lists,'un día vacío no puede releer colecciones Firestore');
 assert.equal(f.metrics.sourceOutbox,1);assert.equal(f.metrics.sourceOutboxDocuments,0);
 for(let n=0;n<50;n++)f.events.push({at:cutoff+day+1000+n,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Edición '+n}}]});
 f.now=cutoff+2*day+60000;f.restart();await f.publish();
 assert.equal(f.metrics.sourceLists,initial.lists,'las ocho familias públicas no pueden releer sus fuentes Firestore');
 assert.equal(f.metrics.sourceOutbox,2);assert.equal(f.metrics.sourceOutboxDocuments,50,'una consulta no significa un solo documento leído');
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Edición 49');
 assert.equal(f.sql.prepare('SELECT count(*) n FROM edition_records206 WHERE key=? AND cutoff=?').get('master/A',cutoff+2*day).n,1,'las 50 novedades producen una única versión del maestro');
 console.log('PUBLICATION_SOURCE_COST207 '+JSON.stringify({initial,emptyDay:{outboxQueries:1,returnedChanges:0,collectionScans:0},fiftyEdits:{outboxQueries:1,returnedChanges:50,collectionScans:0,masterVersions:1},scope:'adaptador aislado; no factura Firestore ni SQL total'}));
});


test('el productor comparte una única lectura SQL de maestros para reconstrucción, comparación y bajas',async t=>{
 const f=fixture(t);await f.publish();
 const original=w.DailyEdition206.prototype.all,calls=[];
 t.mock.method(w.DailyEdition206.prototype,'all',function(cut,prefix){calls.push(prefix);return original.call(this,cut,prefix);});
 f.events.push({at:cutoff+1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Cambio'}}]});
 f.now=cutoff+day+60000;await f.publish();
 assert.equal(calls.filter(prefix=>prefix==='master/').length,1,'el mismo maestro no se relee para cada fase del productor');
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Cambio');
});


test('un único recorrido SQL de la edición abastece todos los compiladores y comparaciones',async t=>{
 const f=fixture(t);f.rows.anunciantes.push(...Array.from({length:100},(_,i)=>({id:'B'+i,nombre:'Otro '+i})));
 await f.publish();const q=w.DailyEdition206.prototype.q,queries=[];
 t.mock.method(w.DailyEdition206.prototype,'q',function(sql,...args){queries.push(sql);return q.call(this,sql,...args);});
 f.events.push({at:cutoff+1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Final'}}]});
 f.now=cutoff+day+60000;await f.op('stage');
 assert.equal(queries.filter(sql=>sql.startsWith('SELECT r.key,r.cutoff,r.value')).length,1,'una sola lectura de la edición anterior');
 assert.equal(queries.filter(sql=>sql.startsWith('SELECT key,cutoff,value FROM edition_records206')).length,0,'comparar cada paquete no vuelve a leer SQL');
 await f.op('commit');assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Final');
 assert.equal((await f.op('read',{key:'master/B99'})).datos.nombre,'Otro 99');
});

test('un fallo libera la copia del productor y elimina filas huérfanas de un corte abandonado',async t=>{
 const f=fixture(t);await f.publish();
 // An interrupted producer can have persisted rows before marking ready.
 f.sql.prepare('INSERT INTO edition_records206(key,cutoff,value) VALUES(?,?,?)').run('cache/orphan-fixture',cutoff+day,JSON.stringify({stale:true}));
 f.sql.prepare('INSERT INTO edition_state206(cutoff,ready,published) VALUES(?,1,0)').run(cutoff+day);
 f.events.push({at:cutoff+1,entries:[{collection:'NO_REGISTRADA',id:'x',patch:{}}]});
 f.now=cutoff+2*day+60000;await assert.rejects(f.op('stage'));
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
 f.events.length=0;f.events.push({at:cutoff+day+1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Recuperado'}}]});
 f.restart();await f.publish();
 assert.equal(await f.op('read',{key:'cache/orphan-fixture'}),null,'una publicación fallida no filtra datos en un corte posterior');
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Recuperado');
 assert.equal(f.sql.prepare('SELECT count(*) n FROM edition_state206 WHERE cutoff=?').get(cutoff+day).n,0);
});

test('las ocho familias llegan al paquete diario y conservan altas, cambios, bajas y reanudación',async t=>{
 const f=fixture(t);
 Object.assign(f.rows.anunciantes[0],{aprobado:true});
 Object.assign(f.rows.anunciantes_administracion[0],{aprobado:true,nivel:6,funcionalidades:'EVENTOS,EVENTOS_FREE,PROMOS,ACTIVIDADES,PUBLICIDAD,TURNOS_FARMA',publicidad_activas_max:2});
 Object.assign(f.rows,{
  eventos:[{id:'E',evento_id:'E',anunciante_id:'A',nombre_evento:'Evento',nivel:'VIP',estado:'ACTIVA',estado_moderacion:'PUBLICADO',fecha_desde:'2026-11-01',fecha_hasta:'2040-01-01'}],
  evento_programacion:[{id:'EP',evento_id:'E',ciudad_id:'D',fecha_desde:'2026-11-01',fecha_hasta:'2040-01-01',hora_desde:'20:00'}],
  actividades:[{id:'ACT',actividad_id:'ACT',anunciante_id:'A',nombre:'Actividad',activo:true,aprobado:false,estado:'ACTIVA',estado_moderacion:'PUBLICADO'}],
  actividad_horarios:[{id:'H',actividad_id:'ACT',ciudad_id:'D',dia:'LUNES',hora_desde:'10:00'}],
  promos:[{id:'PR',promo_id:'PR',anunciante_id:'A',ciudad_id:'D',promo:'Promo',estado:'ACTIVA',estado_moderacion:'PUBLICADO'}],
  publicidades:[{id:'PUB',publicidad_id:'PUB',anunciante_id:'A',estado:'ACTIVA',aprobado:true,titulo:'Pieza',formato:'IMAGEN',relaciones_version:1,cta_tipo:'FICHA_ANUNCIANTE'}],
  publicidad_media:[{id:'M',publicidad_id:'PUB',url:'https://example.invalid/image.jpg',tipo_media:'IMAGEN',activo:true,orden:1}],
  publicidad_segmentacion:[{id:'SG',publicidad_id:'PUB',ciudad_id:'D',ubicacion_id:'GUIA',activo:true}],
  publicidad_ubicaciones:[{id:'GUIA',ubicacion_id:'GUIA',modulo:'GUIA',activo:true}],
  farmacias_ciclos:[{id:'C',ciclo_id:'C',ciudad_id:'D',anunciante_id:'A',activo:true,fecha_inicio:'2026-11-01',hora_inicio:'00:00',duracion_horas:24,farmacias_por_turno:1}],
  farmacias_ciclo_sedes:[{id:'CP',ciclo_id:'C',sede_id:'S',orden:1,activo:true}],
  efemerides_bis:[{id:'EF',efemeride_id:'EF',tipo:'LOCAL',ciudad_id:'D',activo:true,nombre:'Efeméride'}],
  empleos:[{id:'EMP',empleo_id:'EMP',tipo:'OFREZCO',nombre:'Empleo',ciudad_id:'D',ciudad_ids:['D'],hasta:'2040-01-01',estado_moderacion:'PUBLICADO'}]
 });
 const specs=w.PUBLIC_FEATURES191;
 const packet=async cut=>{
  const cache={get:async key=>(await w.editionCall206(f.env,{action:'staged-read',cutoff:cut,key:'cache/'+key})).value};
  const out=await w.exportCityBookCut({env:f.env,cache,after:cut-day,cutoff:cut,known:[],report:{}});
  return out.initial.find(x=>x.city==='D').modules;
 };
 await f.op('stage');const first=await packet(cutoff);
 for(const [name,spec]of Object.entries(specs))assert.equal(first[name][spec.field].length,1,'falta alta pública en '+name);
 await f.op('commit');const scans=f.metrics.sourceLists;
 const states=[
  ['anunciantes_administracion','A',{aprobado:false},{aprobado:true}],
  ['eventos','E',{pausado:true},{pausado:false}],
  ['actividades','ACT',{estado:'PAUSADA'},{estado:'ACTIVA'}],
  ['promos','PR',{pausado:true},{pausado:false}],
  ['publicidades','PUB',{estado:'INACTIVA'},{estado:'ACTIVA'}],
  ['farmacias_ciclos','C',{activo:false},{activo:true}],
  ['efemerides_bis','EF',{activo:false},{activo:true}],
  ['empleos','EMP',{pausado:true},{pausado:false}]
 ];
 f.events.push({at:cutoff+1000,entries:states.map(([collection,id,patch])=>({collection,id,patch}))});
 f.now=cutoff+day+60000;await f.op('stage');const hidden=await packet(cutoff+day);
 for(const [name,spec]of Object.entries(specs))assert.equal(hidden[name][spec.field].length,0,'contenido deshabilitado en '+name);
 assert.equal((await f.op('read',{key:'master/A'})).administracion.aprobado,true,'stage no adelanta la edición');await f.op('commit');
 f.events.push({at:cutoff+day+1000,entries:states.map(([collection,id,,patch])=>({collection,id,patch}))});
 f.now=cutoff+2*day+60000;await f.op('stage');const resumed=await packet(cutoff+2*day);
 for(const [name,spec]of Object.entries(specs))assert.equal(resumed[name][spec.field].length,1,'falta reanudación de '+name);
 await f.op('commit');
 const restricted=['eventos','actividades','promos','publicidades'];
 const ids=['E','ACT','PR','PUB'];
 f.events.push({at:cutoff+2*day+1000,entries:restricted.map((collection,n)=>({collection,id:ids[n],patch:{estado_moderacion:'PENDIENTE'}}))});
 f.now=cutoff+3*day+60000;await f.op('stage');const moderated=await packet(cutoff+3*day);
 for(const name of ['events','activities','promos','ads'])assert.equal(moderated[name][specs[name].field].length,0,'restricción de moderación perdida en '+name);
 await f.op('commit');
 f.events.push({at:cutoff+3*day+1000,entries:[...states.map(([collection,id])=>({collection,id,remove:true})),{collection:'anunciantes',id:'A',remove:true}]});
 f.now=cutoff+4*day+60000;await f.op('stage');const deleted=await packet(cutoff+4*day);
 for(const [name,spec]of Object.entries(specs))assert.equal(deleted[name][spec.field].length,0,'baja perdida en '+name);
 await f.op('commit');
 assert.equal(f.metrics.sourceLists,scans,'los módulos no vuelven a Firestore por separado');
});


test('recompilar una ficha no reescribe las otras fichas sólo por cambiar su sello horario',async t=>{
 const f=fixture(t);for(let i=0;i<100;i++)f.rows.anunciantes.push({id:'B'+i,nombre:'Otro '+i});
 await f.publish();const old=await f.op('read',{key:'cache/guide:advertiser:v2:B99'});
 f.events.push({at:cutoff+1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Final',updated_at:'cambio-operativo'}}]});
 f.now=cutoff+day+60000;await f.publish();
 const keys=f.sql.prepare('SELECT key FROM edition_records206 WHERE cutoff=?').all(cutoff+day).map(x=>x.key);
 assert.equal(keys.filter(key=>key.startsWith('cache/guide:advertiser:v2:B')).length,0,'las fichas sin cambios no crean versiones');
 assert.deepEqual(await f.op('read',{key:'cache/guide:advertiser:v2:B99'}),old);
 assert.equal((await f.op('read',{key:'master/A'})).datos.updated_at,'cambio-operativo','el sello del dato fuente sí se conserva');
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Final');
});
