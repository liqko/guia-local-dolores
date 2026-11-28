// P4-0007: baja segura de ciudad sobre el Worker único vigente.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const w=fs.readFileSync(new URL('../../worker/worker206.txt',import.meta.url),'utf8');
const src=w.slice(w.indexOf('async function deleteCity146('),w.indexOf('async function rebuildTerritoryRaw138('));
function setup({rol='SUPERADMIN_PRINCIPAL',city={ciudad_id:'C-TEST',activa:false},packetCities=[{ciudad_id:'C-TEST'}],rows={},guideCards=[],rebuildOk=true,journal=null,failAt=null}={}){
 const log={queries:[],deleted:[],patched:[],synced:[],indexed:[],rebuilds:0},kv=new Map(journal?[['territorio:baja146:C-TEST',journal]]:[]);
 const ctx={json:(body,status=200)=>({status,ok:status<400,body}),text3:v=>String(v??'').trim(),packet:v=>({ciudades:v?.ciudades||[]}),
  active:r=>r.activa!==false,ADMIN_KEY:'territorio:admin:v1',C:{ciudades:'ciudades'},guideCityKey2:id=>'guide:city:v1:'+id,
  authOr401:async()=>({ok:true,rol,email:'admin@test'}),Response:class{},URL,Request:class{constructor(u,o){this.url=u;this.method=o.method;this.headers=new Map(Object.entries(o.headers));}},Promise,Set,Array,Date,
  syncGuideAdvertiserV2:async({advertiserId,affectedCityIds})=>{if(failAt==='sync')throw Error('corte');log.synced.push([advertiserId,[...affectedCityIds]])},
  syncAdvertiserIndexV2:async({advertiserId})=>{log.indexed.push(advertiserId)},
  rebuildTerritory:async({request})=>{log.rebuilds++;assert.equal(request.method,'POST');assert.match(request.url,/\/superadmin\/territory\/rebuild-cache$/);return {ok:rebuildOk}}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 const db={get:async(c,id)=>c==='ciudades'?city:null,queryEqual:async(c,f,v,n)=>{log.queries.push(c+'.'+f);return (rows[c+'.'+f]||[]).filter(r=>r[f]===v).slice(0,n)},
  delete:async(c,id)=>{log.deleted.push(c+'/'+id);for(const k of Object.keys(rows))if(k.startsWith(c+'.'))rows[k]=rows[k].filter(r=>Object.values(r)[0]!==id)},
  patch:async(c,id,v)=>{log.patched.push([c,id,JSON.parse(JSON.stringify(v))]);city={...city,...v};return city}};
 const cache={get:async k=>k==='territorio:admin:v1'?{ciudades:packetCities}:k==='guide:city:v1:C-TEST'?{anunciantes:guideCards}:kv.get(k)??null,put:async(k,v)=>{kv.set(k,JSON.parse(JSON.stringify(v)))},delete:async k=>{kv.delete(k)}};
 const request={url:'https://w.test/superadmin/cities/C-TEST',headers:{get:()=>'Bearer t'}};
 return {log,kv,state:()=>city,run:()=>ctx.deleteCity146({env:{},request,db,cache,idFromPath:'C-TEST'})};
}
test('sólo el administrador principal, con ciudad suspendida y sin referencias ni publicaciones',async()=>{
 let x=setup({rol:'SUPERADMIN'});assert.equal((await x.run()).status,403);assert.equal(x.log.queries.length,0);
 x=setup({city:{ciudad_id:'C-TEST',activa:true}});assert.equal((await x.run()).body.code,'CITY_MUST_BE_SUSPENDED');assert.equal(x.log.deleted.length,0);
 x=setup({rows:{'eventos.ciudad_id':[{ciudad_id:'C-TEST'}],'anunciantes.ciudad_id':[{ciudad_id:'C-TEST'}],'empleos.ciudad_id':[{empleo_id:'E1',ciudad_id:'C-TEST'}]}});const r=await x.run();
 assert.equal(r.status,409);assert.deepEqual([...r.body.referencias],['anunciantes.ciudad_id','eventos.ciudad_id','empleos.ciudad_id']);
 assert.equal(x.log.deleted.length+x.log.patched.length,0);assert.equal(x.log.rebuilds,0);assert.equal(x.kv.size,0,'el rechazo no deja registro de baja');
});
test('multisede: borra sólo la sede de la ciudad, conserva historial y deja lápida',async()=>{
 const sedes=[{sede_id:'SD-DOL',anunciante_id:'ANU-1',ciudad_id:'C-TEST'},{sede_id:'SD-BEL',anunciante_id:'ANU-1',ciudad_id:'BELGRANO'}];
 const x=setup({rows:{'anunciantes_sedes.ciudad_id':sedes,'lugares.ciudad_id':[{lugar_id:'L1',ciudad_id:'C-TEST'}],'solicitudes_soporte.ciudad_id':[{solicitud_id:'S1',ciudad_id:'C-TEST'}],'solicitudes_anunciante.ciudad_id':[{solicitud_id:'A1',ciudad_id:'C-TEST'}]}});const r=await x.run();
 assert.equal(r.status,200);assert.equal(r.body.eliminada,true);
 assert.deepEqual(x.log.deleted,['lugares/L1','anunciantes_sedes/SD-DOL'],'sede de otra ciudad y solicitudes intactas');
 assert.ok(!x.log.queries.some(q=>q.startsWith('solicitudes_')),'el historial de solicitudes no se consulta ni se borra');
 assert.deepEqual(JSON.parse(JSON.stringify(x.log.synced)),[['ANU-1',['C-TEST']]]);assert.deepEqual(x.log.indexed,['ANU-1']);assert.equal(x.log.rebuilds,1);
 assert.equal(x.log.patched.length,1);assert.equal(x.log.patched[0][2].eliminada,true);assert.equal(x.log.patched[0][2].activa,false);assert.equal(x.kv.size,0,'registro de baja retirado al terminar');
});
test('interrupciones: el reintento recupera anunciantes y no duplica borrados',async()=>{
 const rows={'anunciantes_sedes.ciudad_id':[{sede_id:'SD-DOL',anunciante_id:'ANU-1',ciudad_id:'C-TEST'}]};
 let x=setup({rows,failAt:'sync'});await assert.rejects(x.run());
 assert.deepEqual(x.log.deleted,['anunciantes_sedes/SD-DOL']);assert.equal(x.log.patched.length,0,'la ciudad no se marca si faltan proyecciones');
 const journal=x.kv.get('territorio:baja146:C-TEST');assert.deepEqual([...journal.afectados],['ANU-1']);
 x=setup({rows,journal});const r=await x.run();assert.equal(r.status,200);
 assert.equal(x.log.deleted.length,0,'la sede ya borrada no se vuelve a borrar');assert.deepEqual(JSON.parse(JSON.stringify(x.log.synced)),[['ANU-1',['C-TEST']]],'recupera el anunciante desde el registro de baja');
 assert.equal(x.log.patched.length,1);assert.equal(x.kv.size,0);
 x=setup({rebuildOk:false});assert.equal((await x.run()).status,503);assert.equal(x.state().eliminada,true);assert.equal(x.kv.size,1,'falló el catálogo: se conserva el registro');
 x=setup({city:x.state(),journal:x.kv.get('territorio:baja146:C-TEST')});const again=await x.run();assert.equal(again.status,200);assert.equal(x.log.patched.length+x.log.deleted.length,0);assert.equal(x.log.rebuilds,1);assert.equal(x.kv.size,0);
 x=setup({city:{ciudad_id:'C-TEST',activa:false,eliminada:true},packetCities:[]});const done=await x.run();assert.equal(done.status,200);assert.equal(x.log.rebuilds,0);assert.equal(done.body.registros_eliminados,0);
 x=setup({city:null,packetCities:[]});assert.equal((await x.run()).status,200);
});
test('la lápida queda fuera de los catálogos y su ID no se reutiliza',()=>{
 assert.match(w,/\(await db\.get\(C\.ciudades, id4\)\)\?\.eliminada === true\) return json\(\{ success: false, code: "CITY_ID_RETIRED"/);
 assert.equal((w.match(/db\.listCollection\(C\.ciudades\)\.then\(\(?rows\)? ?=> ?rows\.filter\(\(?c\)? ?=> ?c\.eliminada ?!== ?true\)\)/g)||[]).length,2);
});
test('la ruta DELETE está registrada en el Worker y GH usa suspensión previa',()=>{
 assert.match(w,/request2\.method === "DELETE"\) return deleteCity146\(/);
 const gh=fs.readFileSync(new URL('../../plataforma/administracion.html',import.meta.url),'utf8');
 assert.match(gh,/method:'DELETE',headers:\{Authorization:'Bearer '\+TOKEN,'Idempotency-Key'/);
});
