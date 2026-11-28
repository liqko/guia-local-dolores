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
test('compatibilidad con las configuraciones existentes: sólo cambia el caso sin ciudades',async()=>{
 // Resolvedor de main antes de P4-0028 (lista vacía = todas), comparado con el vigente sobre cada formato que GH o versiones anteriores guardaron.
 const {execFileSync}=require('child_process');
 let old;try{old=execFileSync('git',['show','f528dbe3:worker/worker206.txt'],{cwd:path.join(__dirname,'../..'),encoding:'utf8',maxBuffer:64e6});}catch{old=null;}
 const formatos=[
  [{funcionalidades_config:{TURNOS_FARMA:{ciudades:['DOL']}},turnos_farma:'DOL',farmacias_ciudades:['DOL']},['DOL']],
  [{funcionalidades_config:{FARMACIAS:{ciudades:['MAI']}}},['MAI']],
  [{funcionalidades_config:{turnos_farma:{ciudades:['DOL','MAI']}}},['DOL','MAI']],
  [{turnos_farma:' DOL , MAI | DOL '},['DOL','MAI']],
  [{funcionalidades_config:{TURNOS_FARMA:{todas_ciudades:'si'}}},['DOL','MAI']],
  [{funcionalidades_config:{TURNOS_FARMA:{todas_ciudades:true,ciudades:[]}},turnos_farma:'*',farmacias_ciudades:[]},['DOL','MAI']],
  [{turnos_farma:'SI'},['SI']],
 ];
 for(const [admin,want] of formatos)assert.deepEqual(await run(admin),want,JSON.stringify(admin));
 const vacios=[{funcionalidades_config:{TURNOS_FARMA:{ciudades:[],todas_ciudades:false}},turnos_farma:'',farmacias_ciudades:[]},{turnos_farma:''},{}];
 for(const admin of vacios)assert.deepEqual(await run(admin),[],'sin ciudades: ninguna');
 if(old){
  const i=old.indexOf('async function allowedFarmCities({ db, cache, aid }) {'),j=old.indexOf('\n}\n',i)+3;
  const prev=new Function('text40','truthy3',old.slice(i,j)+';return allowedFarmCities;')(v=>String(v??'').trim(),v=>v===true||['true','1','si','sí'].includes(String(v??'').trim().toLowerCase()));
  for(const [admin,want] of formatos)assert.deepEqual(await prev({db:{get:async()=>admin},cache,aid:'A'}),want,'mismo resultado que antes: '+JSON.stringify(admin));
  for(const admin of vacios)assert.deepEqual(await prev({db:{get:async()=>admin},cache,aid:'A'}),['DOL','MAI'],'antes, sin ciudades equivalía a todas');
 }
 const gh=fs.readFileSync(path.join(__dirname,'../../plataforma/administracion.html'),'utf8');
 assert.match(gh,/d\.id==='TURNOS_FARMA'&&document\.querySelector\('\[data-anu-fun="TURNOS_FARMA"\]'\)\?\.checked&&!cfg\.todas_ciudades&&!cfg\.ciudades\.length\)throw Error/,'GH no guarda Farmacias habilitado sin ciudades');
});
