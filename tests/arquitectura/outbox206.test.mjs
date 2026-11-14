import {test} from 'node:test';
import assert from 'node:assert/strict';
import {source} from '../observabilidad/worker-source.mjs';
const w=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {createDb,observeKv117};export function fixtureToken206(){tokenCache.token="isolated";tokenCache.expiresAt=Date.now()+3600000;}').toString('base64'));
test('dos commits en el mismo milisegundo se ordenan por revisión de servidor, no por UUID del outbox',async t=>{
 w.fixtureToken206();let query;
 const event=(name,at,nombre)=>({document:{name:'projects/fixture/databases/(default)/documents/_gld_publication_outbox206/'+name,updateTime:at,fields:{entries:{arrayValue:{values:[{mapValue:{fields:{collection:{stringValue:'anunciantes'},id:{stringValue:'A'},patch:{mapValue:{fields:{nombre:{stringValue:nombre}}}}}}}]}}}}});
 t.mock.method(globalThis,'fetch',async(url,init)=>{query=JSON.parse(init.body);return Response.json([event('a','2026-11-13T04:00:00.123456002Z','Final'),event('z','2026-11-13T04:00:00.123456001Z','Primero')]);});
 const rows=await w.createDb({FIREBASE_PROJECT_ID:'fixture'}).editionOutbox206(Date.parse('2026-11-13T04:00:00Z'),Date.parse('2026-11-14T04:00:00Z'));
 assert.deepEqual(rows.map(x=>x.entries[0].patch.nombre),['Primero','Final']);assert.equal(query.readTime,undefined,'El outbox es inmutable: se puede recuperar un corte aunque haya pasado más de una hora');assert.equal(query.structuredQuery.where.compositeFilter.filters[0].fieldFilter.op,'GREATER_THAN_OR_EQUAL');
});
test('el filtro preciso no pierde cambios inmediatamente posteriores a un corte ni adelanta el corte siguiente',async t=>{
 w.fixtureToken206();
 const event=stamp=>({document:{name:'projects/x/databases/(default)/documents/_gld_publication_outbox206/id',updateTime:stamp,fields:{entries:{arrayValue:{values:[]}}}}});
 t.mock.method(globalThis,'fetch',async()=>Response.json([event('2026-11-13T04:00:00.000000001Z'),event('2026-11-14T04:00:00.000000001Z')]));
 const rows=await w.createDb({FIREBASE_PROJECT_ID:'fixture'}).editionOutbox206(Date.parse('2026-11-13T04:00:00Z'),Date.parse('2026-11-14T04:00:00Z'));assert.equal(rows.length,1);
});


test('la captura de KV se mide como SQL/DO adicional y conserva marcadores de texto sin copiar cada edición',async t=>{
 const {fixture,cutoff,day}=await import('./fixture206.mjs');const f=fixture(t);await f.publish();f.now=cutoff+1000;
 const raw=new Map(),report={operations:{}},env={...f.env,GLD_CACHE_KV:{get:async k=>raw.get(k)||null,put:async(k,v)=>{raw.set(k,v);},delete:async k=>raw.delete(k),list:async()=>({keys:[],list_complete:true})}};
 const observed=w.observeKv117(env,report);await observed.GLD_CACHE_KV.put('panel:revision:fixture','marca-uno');await observed.GLD_CACHE_KV.put('panel:revision:fixture','marca-dos');
 assert.equal(report.kv.put_calls,2);assert.equal(report.edition_store206.calls,2);assert(report.edition_store206.rows_written>=2);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM edition_cache_work206 WHERE key=?').get('panel:revision:fixture').n,1);
 f.now=cutoff+day+60000;await f.publish();const reader=w.editionReadEnvironment206(env);assert.equal(await reader.GLD_CACHE_KV.get('panel:revision:fixture'),'marca-dos');
});

test('la barrera de la fuente impide Firestore incluso si una ruta intenta usar el adaptador operativo directamente',async t=>{
 w.fixtureToken206();let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Egreso prohibido');});const db=w.createDb({FIREBASE_PROJECT_ID:'fixture',__editionReader206:true});
 for(const operation of [()=>db.get('anunciantes','A'),()=>db.queryEqual('eventos','anunciante_id','A',500),()=>db.listCollection('eventos'),()=>db.patch('anunciantes','A',{nombre:'No'}),()=>db.commitPatches([{collection:'anunciantes',id:'A',patch:{nombre:'No'}}])])await assert.rejects(operation(),{code:'READ_SOURCE_ACCESS_BLOCKED'});
 assert.equal(calls,0);
});
