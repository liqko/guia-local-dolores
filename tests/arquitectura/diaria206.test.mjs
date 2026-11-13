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
