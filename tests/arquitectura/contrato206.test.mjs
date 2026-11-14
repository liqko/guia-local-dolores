import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {source} from '../observabilidad/worker-source.mjs';
import {fixture} from './fixture206.mjs';
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
test('el archivo único conserva una entrada común de lectura y una única autoridad diaria',async()=>{
 assert.equal((await readdir(new URL('../../worker/',import.meta.url))).filter(x=>x.endsWith('.txt')).length,1);
 assert(source.includes('editionReadEnvironment206(observeKv117(env,report))'));
 assert(source.includes('if(dataRead206)db=editionReader206(env,db)'));
 assert(!source.includes('COMMERCE_MASTER_TTL205'));assert(!source.includes('GH_ADMIN_DETAIL_TTL203'));
 const adapter=between('async function commerceMaster205','// reconstruccion/worker/core/commerce-cache-patch-v2.js');assert(!/cache\.(put|del)|db\.(get|queryEqual|listCollection)/.test(adapter));
 const previous=between('class PrivateDaily195','async function dailySubscribers195');assert(previous.includes('extends DailyEdition206'));assert(!previous.includes('listCollection'));
 const workflow=await readFile(new URL('../../.github/workflows/firebase-hosting-merge.yml',import.meta.url),'utf8');assert(workflow.includes('cron: "0 4 * * *"'));
});
test('todos los alias de lectura declarados por los módulos pasan por la misma barrera',()=>{
 const declaration=source.match(/request\.method==='POST'&&\[([^\]]+)\]\.includes\(readAction206\)/)?.[1];assert(declaration);
 const admitted=new Set([...declaration.matchAll(/'([^']+)'/g)].map(x=>x[1]));
 for(const declaration of source.matchAll(/const readActions = \[([^\]]+)\]/g))for(const item of declaration[1].matchAll(/"([^"]+)"/g))assert(admitted.has(item[1]),'Falta alias de lectura '+item[1]);
});
test('un lector frío no crea tablas, índices, documentos ni paquetes para resolver su ausencia',async t=>{
 const f=fixture(t),tables=()=>f.sql.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'edition_%'").all();assert.deepEqual(tables(),[]);
 await assert.rejects(f.op('read',{key:'master/A'}));assert.deepEqual(tables(),[]);assert.equal(f.metrics.sourceLists,0);
});
test('el publicador y el lector público no importan proyecciones operativas desde otros actores',()=>{
 const exporter=between('async function exportCityBookCut','const CITY_BOOK_ISSUER');assert(exporter.includes("action:'staged-read'"));assert(!/cityBookActor|createDb|listCollection|rebuild/.test(exporter));
 const reader=between('function editionReadEnvironment206','// Compatibility adapter:');assert(!/createDb|listCollection|rebuild|expirationTtl/.test(reader));
});
test('un lector no puede saltarse la barrera invocando otro actor que reconstruya su caché',async t=>{
 const {w}=await import('./fixture206.mjs');const f=fixture(t);await f.publish();const env=w.editionReadEnvironment206(f.env),before=f.metrics.calls;
 const actor=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('admin-pending-events-v126'));
 await assert.rejects(actor.fetch(new Request('https://fixture/',{method:'POST',body:JSON.stringify({op:'pending-events-read'})})),{code:'READ_SIDE_EFFECT_BLOCKED'});assert.equal(f.metrics.calls,before);assert.equal(f.metrics.sourceOutbox,0);
});
