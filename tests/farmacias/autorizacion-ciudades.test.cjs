'use strict';
// P4-0028-T01: ciudades de Farmacias de turno con denegación por defecto y un único resolvedor.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const w=fs.readFileSync(path.join(__dirname,'../../worker/worker206.txt'),'utf8');
const slice=(a,b)=>w.slice(w.indexOf(a),w.indexOf(b));
const src=slice('async function allowedFarmCities({ db, cache, aid }) {','async function routePanelV4(ctx) {');
const f=new Function('text40','truthy3',src+';return {allowedFarmCities,farmCitiesFromAdmin};')(v=>String(v??'').trim(),v=>v===true||['true','1','si','sí'].includes(String(v??'').trim().toLowerCase()));
const territory={ciudades:[{ciudad_id:'DOL'},{ciudad_id:'MAI'}]};
const cache={reads:0,get:async()=>{cache.reads++;return territory;}};
const run=admin=>f.allowedFarmCities({db:{get:async()=>admin},cache,aid:'A'});
test('sin ciudades asignadas se niega; «todas» sólo explícito',async()=>{
 assert.deepEqual(await run(null),[]);
 assert.deepEqual(await run({}),[]);
 assert.deepEqual(await run({funcionalidades_config:{TURNOS_FARMA:{ciudades:[]}}}),[]);
 assert.deepEqual(await run({farmacias_ciudades:[]}),[]);
 assert.equal(cache.reads,0,'sin «todas» no lee el territorio');
 assert.deepEqual(await run({funcionalidades_config:{TURNOS_FARMA:{todas_ciudades:true}}}),['DOL','MAI']);
 assert.deepEqual(await run({turnos_farma:'*'}),['DOL','MAI']);
 assert.deepEqual(await run({funcionalidades_config:{TURNOS_FARMA:{ciudades:['DOL',' DOL ']}}}),['DOL']);
 assert.deepEqual(await run({farmacias_ciudades:['MAI']}),['MAI']);
 assert.deepEqual(await run({turnos_farma:'DOL;MAI'}),['DOL','MAI']);
});
test('todas las rutas usan el mismo resolvedor y ningún destino trata la lista vacía como permiso total',()=>{
 assert.ok(!/allowedCityIds\.length\s*&&/.test(w),'sin atajo de lista vacía');
 assert.ok(!/allowedCityIds\.length\s*\n?\s*\?\s*\(\(territorio/.test(w),'el panel no muestra todas las ciudades con lista vacía');
 assert.match(slice('async function allowedFarmCities2(','async function routePanelV15('),/return allowedFarmCities\(\{ db, cache, aid \}\)/);
 const v3=slice('async function routePanelV3(','async function farmaciasPanelDataV3(');
 assert.ok(!v3.includes('farmacias_ciudades.length ?'),'sin respaldo a todas las ciudades');
 assert.equal((w.match(/Esta cuenta no tiene ciudades habilitadas para Farmacias de turno\./g)||[]).length,2);
});
