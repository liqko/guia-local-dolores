// P4-0007: baja segura de ciudad sobre el Worker único vigente.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const w=fs.readFileSync(new URL('../../worker/worker206.txt',import.meta.url),'utf8');
const src=w.slice(w.indexOf('async function deleteCity146('),w.indexOf('async function rebuildTerritoryRaw138('));
function setup({rol='SUPERADMIN_PRINCIPAL',city={ciudad_id:'C-TEST',activa:false},packetCities=[{ciudad_id:'C-TEST'}],rows={},guideCards=[],rebuildOk=true}={}){
 const log={queries:[],deleted:[],synced:[],indexed:[],rebuilds:0};
 const ctx={json:(body,status=200)=>({status,ok:status<400,body}),text3:v=>String(v??'').trim(),packet:v=>({ciudades:v?.ciudades||[]}),
  active:r=>r.activa!==false,ADMIN_KEY:'territorio:admin:v1',C:{ciudades:'ciudades'},guideCityKey2:id=>'guide:city:v1:'+id,
  authOr401:async()=>({ok:true,rol}),Response:class{},URL,Request:class{constructor(u,o){this.url=u;this.method=o.method;this.headers=new Map(Object.entries(o.headers));}},Promise,
  syncGuideAdvertiserV2:async({advertiserId,affectedCityIds})=>{log.synced.push([advertiserId,affectedCityIds])},
  syncAdvertiserIndexV2:async({advertiserId})=>{log.indexed.push(advertiserId)},
  rebuildTerritory:async({request})=>{log.rebuilds++;assert.equal(request.method,'POST');assert.match(request.url,/\/superadmin\/territory\/rebuild-cache$/);return {ok:rebuildOk}}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 const db={get:async(c,id)=>c==='ciudades'?city:null,queryEqual:async(c,f,v,n)=>{log.queries.push(c+'.'+f);return (rows[c+'.'+f]||[]).filter(r=>r[f]===v).slice(0,n)},delete:async(c,id)=>{log.deleted.push(c+'/'+id)}};
 const cache={get:async k=>k==='territorio:admin:v1'?{ciudades:packetCities}:k==='guide:city:v1:C-TEST'?{anunciantes:guideCards}:null};
 const request={url:'https://w.test/superadmin/cities/C-TEST',headers:{get:()=>'Bearer t'}};
 return {log,run:()=>ctx.deleteCity146({env:{},request,db,cache,idFromPath:'C-TEST'})};
}
test('sólo el administrador principal, con ciudad suspendida y sin referencias compartidas',async()=>{
 let x=setup({rol:'SUPERADMIN'});assert.equal((await x.run()).status,403);assert.equal(x.log.queries.length,0);
 x=setup({city:{ciudad_id:'C-TEST',activa:true}});assert.equal((await x.run()).body.code,'CITY_MUST_BE_SUSPENDED');assert.equal(x.log.deleted.length,0);
 x=setup({rows:{'eventos.ciudad_id':[{ciudad_id:'C-TEST'}],'anunciantes.ciudad_id':[{ciudad_id:'C-TEST'}]}});const r=await x.run();
 assert.equal(r.status,409);assert.deepEqual([...r.body.referencias],['anunciantes.ciudad_id','eventos.ciudad_id']);assert.equal(x.log.deleted.length,0);assert.equal(x.log.rebuilds,0);
});
test('multisede: borra sólo la sede de la ciudad, recalcula el anunciante y borra la ciudad al final',async()=>{
 const sedes=[{sede_id:'SD-DOL',anunciante_id:'ANU-1',ciudad_id:'C-TEST'},{sede_id:'SD-BEL',anunciante_id:'ANU-1',ciudad_id:'BELGRANO'}];
 const x=setup({rows:{'anunciantes_sedes.ciudad_id':sedes,'empleos.ciudad_id':[{empleo_id:'E1',ciudad_id:'C-TEST'}]}});const r=await x.run();
 assert.equal(r.status,200);assert.equal(r.body.eliminada,true);
 assert.deepEqual(x.log.deleted,['empleos/E1','anunciantes_sedes/SD-DOL','ciudades/C-TEST']);
 assert.deepEqual(JSON.parse(JSON.stringify(x.log.synced)),[['ANU-1',['C-TEST']]]);assert.deepEqual(x.log.indexed,['ANU-1']);assert.equal(x.log.rebuilds,1);
});
test('reintentos: sin duplicar borrados y recuperando proyecciones',async()=>{
 let x=setup({guideCards:[{anunciante_id:'ANU-2'}]});assert.equal((await x.run()).status,200);
 assert.deepEqual(x.log.deleted,['ciudades/C-TEST']);assert.deepEqual(JSON.parse(JSON.stringify(x.log.synced)),[['ANU-2',['C-TEST']]],'sedes ya borradas: recalcula desde la copia de Guía');
 x=setup({city:null});assert.equal((await x.run()).status,200);assert.equal(x.log.deleted.length,0);assert.equal(x.log.rebuilds,1,'ficha ya borrada: sólo republica el territorio');
 x=setup({city:null,packetCities:[]});const done=await x.run();assert.equal(done.status,200);assert.equal(x.log.rebuilds,0);assert.equal(done.body.registros_eliminados,0);
 x=setup({rebuildOk:false});assert.equal((await x.run()).status,503);
});
test('la ruta DELETE está registrada en el Worker y GH usa suspensión previa',()=>{
 assert.match(w,/request2\.method === "DELETE"\) return deleteCity146\(/);
 const gh=fs.readFileSync(new URL('../../plataforma/administracion.html',import.meta.url),'utf8');
 assert.match(gh,/method:'DELETE',headers:\{Authorization:'Bearer '\+TOKEN,'Idempotency-Key'/);
});
