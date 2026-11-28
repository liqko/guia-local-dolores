// P4-0007 (definición 28/11): eliminación territorial integral sobre el Worker único vigente.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const w=fs.readFileSync(new URL('../../worker/worker206.txt',import.meta.url),'utf8');
const src=w.slice(w.indexOf('const CITY_PURGE146='),w.indexOf('async function rebuildTerritoryRaw138('));
const J=v=>JSON.parse(JSON.stringify(v));
const CITY='C-X',OTHER='C-Y';
function seed(){return {
 ciudades:[{ciudad_id:CITY,ciudad_visible:'Ciudad X',activa:false}],
 eventos:[{evento_id:'E1',ciudad_id:CITY},{evento_id:'E2',ciudad_id:CITY},{evento_id:'E3',ciudad_id:OTHER,programacion_version:2,programacion:[{ciudad_id:CITY,fecha:'2026-12-01'},{ciudad_id:OTHER,fecha:'2026-12-02'}]},{evento_id:'E4',ciudad_id:OTHER}],
 evento_programacion:[{evento_programacion_id:'P1',evento_id:'E1',ciudad_id:CITY},{evento_programacion_id:'P2',evento_id:'E1',ciudad_id:''},{evento_programacion_id:'P3',evento_id:'E2',ciudad_id:CITY},{evento_programacion_id:'P4',evento_id:'E2',ciudad_id:OTHER},{evento_programacion_id:'P5',evento_id:'E4',ciudad_id:OTHER}],
 actividades:[{actividad_id:'A1',ciudad_id:CITY,horarios_version:2,horarios:[{ciudad_id:CITY}]},{actividad_id:'A2',ciudad_id:CITY}],
 actividad_horarios:[{actividad_horario_id:'H1',actividad_id:'A2',ciudad_id:CITY},{actividad_horario_id:'H2',actividad_id:'A2',ciudad_id:OTHER}],
 promos:[{promo_id:'PR1',ciudad_id:CITY},{promo_id:'PR2',ciudad_id:OTHER}],
 publicidades:[{publicidad_id:'PU1',ciudad_id:CITY,anunciante_id:'ANU-1'},{publicidad_id:'PU2',ciudad_id:OTHER,anunciante_id:'ANU-3',relaciones_version:2,segmentacion:[{ciudad_id:CITY},{ciudad_id:OTHER}],media:[]}],
 publicidad_segmentacion:[{segmentacion_id:'S1',publicidad_id:'PU1',ciudad_id:CITY}],
 publicidad_media:[{media_id:'M1',publicidad_id:'PU1'}],
 publicidad_estado:[{anunciante_id:'ANU-1',activas:['PU1'],guardadas:['PU1']}],
 farmacias_ciclos:[{ciclo_id:'F1',ciudad_id:CITY}],
 farmacias_ciclo_sedes:[{id:'F1__SD-X',ciclo_id:'F1',sede_id:'SD-X',ciudad_id:CITY}],
 efemerides_bis:[{efemeride_id:'EF1',tipo:'LOCAL',ciudad_id:CITY}],
 empleos:[{empleo_id:'J1',ciudad_id:CITY,ciudad_ids:[CITY,OTHER]},{empleo_id:'J2',ciudad_id:CITY,ciudad_ids:[CITY]}],
 lugares:[{lugar_id:'L1',ciudad_id:CITY}],
 anunciantes_sedes:[{sede_id:'SD-X',anunciante_id:'ANU-1',ciudad_id:CITY},{sede_id:'SD-Y',anunciante_id:'ANU-1',ciudad_id:OTHER},{sede_id:'SD-X2',anunciante_id:'ANU-2',ciudad_id:CITY}],
 anunciantes:[{anunciante_id:'ANU-1',ciudad_id:CITY},{anunciante_id:'ANU-2',ciudad_id:CITY},{anunciante_id:'ANU-3',ciudad_id:OTHER,ciudad_ids:[OTHER,CITY]}],
 suscriptores:[{suscriptor_id:'U1',ciudad_predeterminada_id:CITY},{suscriptor_id:'U2',ciudad_origen_id:CITY}],
 solicitudes_soporte:[{solicitud_id:'SS1',ciudad_id:CITY}],solicitudes_anunciante:[{solicitud_id:'SA1',ciudad_id:CITY}]
};}
const IDF={ciudades:'ciudad_id',eventos:'evento_id',evento_programacion:'evento_programacion_id',actividades:'actividad_id',actividad_horarios:'actividad_horario_id',promos:'promo_id',publicidades:'publicidad_id',publicidad_segmentacion:'segmentacion_id',publicidad_media:'media_id',publicidad_estado:'anunciante_id',farmacias_ciclos:'ciclo_id',farmacias_ciclo_sedes:'id',efemerides_bis:'efemeride_id',empleos:'empleo_id',lugares:'lugar_id',anunciantes_sedes:'sede_id',anunciantes:'anunciante_id',suscriptores:'suscriptor_id',solicitudes_soporte:'solicitud_id',solicitudes_anunciante:'solicitud_id'};
function setup({rol='SUPERADMIN_PRINCIPAL',data=seed(),rebuildOk=true,failOnce=null}={}){
 const store=new Map(Object.entries(data).map(([c,rows])=>[c,new Map(rows.map(r=>[r[IDF[c]],J(r)]))]));
 const col=c=>{if(!store.has(c))store.set(c,new Map());return store.get(c);};
 const log={writes:[],deletes:[],reads:0,synced:[],rebuilds:0};
 const kv=new Map([
  ['territorio:admin:v1',{ciudades:[{ciudad_id:CITY}]}],
  ['events:city:v2:'+CITY,{events:[{evento_id:'E1'},{evento_id:'E2'},{evento_id:'E3'}]}],
  ['activities:city:v2:'+CITY,{actividades:[{actividad_id:'A1'}]}],
  ['publicity:city:v2:'+CITY,{publicidades:[{publicidad_id:'PU2'}]}],
  ['guide:city:v1:'+CITY,{anunciantes:[{anunciante_id:'ANU-1'},{anunciante_id:'ANU-3'}]}],
  ['promos:city:v1:'+CITY,{promos:[{promo_id:'PR1'}]}]
 ]);
 const drop=(key,field,idf,id)=>{const p=kv.get(key);if(p)kv.set(key,{...p,[field]:p[field].filter(r=>r[idf]!==id)});};
 let failed=false;
 const sync=(name,fn=()=>{})=>async a=>{if(failOnce&&!failed&&failOnce(name,a)){failed=true;throw Error('corte simulado');}log.synced.push([name,J(a.next===undefined?null:a.next)?.[Object.keys(a).find(k=>k.endsWith('Id'))]??a.advertiserId??a.cycleId??a.efemerideId??a.publicityId??a.activityId??(a.current?.evento_id||a.next?.evento_id||a.current?.promo_id||a.current?.empleo_id)]);fn(a);};
 const ctx={json:(body,status=200)=>({status,ok:status<400,body:J(body)}),text3:v=>String(v??'').trim(),packet:v=>({ciudades:v?.ciudades||[]}),active:r=>r.activa!==false,ADMIN_KEY:'territorio:admin:v1',C:{ciudades:'ciudades'},
  guideCityKey2:c=>'guide:city:v1:'+c,promoCityKey:c=>'promos:city:v1:'+c,eventsCityKey:c=>'events:city:v2:'+c,activityCityKeyV2:c=>'activities:city:v2:'+c,publicityCityKey:c=>'publicity:city:v1:'+c,publicityCityKeyV2:c=>'publicity:city:v2:'+c,efemCityKey:c=>'efemerides:city:v1:'+c,efemCityKeyV2:c=>'efemerides:city:v2:'+c,farmCityKey:c=>'farmacias:city:v1:'+c,farmCityKeyV2:c=>'farmacias:city:v2:'+c,
  authOr401:async()=>({ok:true,rol,email:'admin@test'}),GLD_ACTIONS138:{readJson:async r=>J(r.body||{})},Response:class{},URL,crypto:globalThis.crypto,
  Request:class{constructor(u,o){this.url=u;this.method=o.method;}},
  rebuildTerritory:async({request})=>{log.rebuilds++;assert.match(request.url,/\/superadmin\/territory\/rebuild-cache$/);return {ok:rebuildOk};},
  syncEventV2:sync('event',a=>{const id=a.next?.evento_id||a.current?.evento_id;if(!a.next||!(a.programacion||[]).some(p=>(p.ciudad_id||a.next.ciudad_id)===CITY))drop('events:city:v2:'+CITY,'events','evento_id',id);}),
  syncActivityPreparedV2:sync('activity',a=>drop('activities:city:v2:'+CITY,'actividades','actividad_id',a.activityId)),
  syncPublicityPreparedV2:sync('publicity',a=>drop('publicity:city:v2:'+CITY,'publicidades','publicidad_id',a.publicityId)),
  syncPromo:sync('promo'),syncEfemeridePreparedV2:sync('efem'),syncEmpleo109:sync('job'),syncFarmCyclePreparedV2:sync('farm'),
  syncGuideAdvertiserV2:sync('guide',a=>drop('guide:city:v1:'+CITY,'anunciantes','anunciante_id',a.advertiserId)),
  syncAdvertiserIndexV2:sync('index'),syncSubscriberDirectory195:async(env,prev,next)=>{log.synced.push(['subscriber',next.suscriptor_id]);},
  publicityStateV101:async(db,aid)=>({state:J(col('publicidad_estado').get(aid)||{activas:[],guardadas:[]}),options:{}}),
  publicityCommitV101:async(db,cache,aid,state,options,changes)=>{await db.commitPatches([{collection:'publicidad_estado',id:aid,patch:state},...changes]);}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 const db={
  get:async(c,id)=>{log.reads++;const d=col(c).get(id);return d?J(d):null;},
  getVersioned:async(c,id)=>{log.reads++;const d=col(c).get(id);return {doc:d?J(d):null,updateTime:d?'t1':undefined};},
  queryEqual:async(c,f,v,n)=>{log.reads++;return J([...col(c).values()].filter(r=>r[f]===v).slice(0,n));},
  delete:async(c,id)=>{log.deletes.push(c+'/'+id);log.writes.push('delete '+c+'/'+id);col(c).delete(id);},
  patch:async(c,id,p)=>{log.writes.push('patch '+c+'/'+id);const next={...(col(c).get(id)||{}),...J(p)};col(c).set(id,next);return J(next);},
  commitPatches:async entries=>{for(const e of entries){if(e.remove){log.deletes.push(e.collection+'/'+e.id);log.writes.push('delete '+e.collection+'/'+e.id);col(e.collection).delete(e.id);}else{log.writes.push('patch '+e.collection+'/'+e.id);col(e.collection).set(e.id,{...(col(e.collection).get(e.id)||{}),...J(e.patch)});}}}
 };
 const cache={get:async k=>kv.has(k)?J(kv.get(k)):null,put:async(k,v)=>{kv.set(k,J(v));},del:async k=>{kv.delete(k);}};
 const call=body=>ctx.deleteCity146({env:{},request:{url:'https://w.test/superadmin/cities/'+CITY+'/eliminacion',headers:{get:()=>'Bearer t'},body},db,cache,idFromPath:CITY});
 const ids=c=>[...col(c).keys()].sort();
 return {log,kv,store,col,ids,call,setRebuild:v=>{rebuildOk=v;}};
}
async function runAll(x,plan,max=50){let r;for(let i=0;i<max;i++){r=await x.call({modo:'ejecutar',plan_id:plan,confirmacion:'Ciudad X'});if(r.body.eliminada||r.status!==200)return r;}return r;}
test('tres instancias: rol principal, ciudad suspendida, inventario vigente y nombre exacto; sin escrituras al rechazar',async()=>{
 let x=setup({rol:'SUPERADMIN'});assert.equal((await x.call({modo:'simular'})).status,403);
 const act=seed();act.ciudades[0].activa=true;x=setup({data:act});
 assert.equal((await x.call({modo:'simular'})).body.code,'CITY_MUST_BE_SUSPENDED');assert.equal((await x.call({modo:'ejecutar'})).body.code,'CITY_MUST_BE_SUSPENDED');
 x=setup();assert.equal((await x.call({modo:'ejecutar',plan_id:'nada',confirmacion:'Ciudad X'})).body.code,'CITY_PLAN_REQUIRED');
 const sim=await x.call({modo:'simular'});assert.equal(sim.status,200);assert.equal(sim.body.consumo.firestore_escrituras,0);
 assert.equal(sim.body.inventario['eventos.ciudad_id'],2);assert.equal(sim.body.inventario['publicados:events'],3);assert.equal(sim.body.inventario['anunciantes_sedes.ciudad_id'],2);
 assert.equal(sim.body.conservados['solicitudes_soporte.ciudad_id'],1);assert.equal(sim.body.confirmacion_requerida,'Ciudad X');
 assert.equal((await x.call({modo:'ejecutar',plan_id:sim.body.plan_id,confirmacion:'ciudad x'})).body.code,'CITY_CONFIRMATION_MISMATCH');
 const plan=x.kv.get('territorio:baja146:plan:'+CITY);x.kv.set('territorio:baja146:plan:'+CITY,{...plan,creado:Date.now()-864e5-1});
 assert.equal((await x.call({modo:'ejecutar',plan_id:sim.body.plan_id,confirmacion:'Ciudad X'})).body.code,'CITY_PLAN_REQUIRED','plan vencido');
 assert.deepEqual(x.log.writes,[],'ningún rechazo escribe en Firestore');assert.equal(x.kv.has('territorio:baja146:'+CITY),false);
});
test('eliminación integral: borra lo exclusivo, conserva y reproyecta lo de otras ciudades, cuentas e historial',async()=>{
 const x=setup();const sim=await x.call({modo:'simular'});
 const first=await x.call({modo:'ejecutar',plan_id:sim.body.plan_id,confirmacion:'Ciudad X'});assert.equal(first.body.pendiente,true,'avanza por lotes');
 const r=await runAll(x,sim.body.plan_id);assert.equal(r.status,200);assert.equal(r.body.eliminada,true);
 assert.deepEqual(x.ids('eventos'),['E2','E3','E4']);assert.equal(x.col('eventos').get('E2').ciudad_id,OTHER,'evento compartido cambia de ciudad de origen');
 assert.deepEqual(J(x.col('eventos').get('E3').programacion),[{ciudad_id:OTHER,fecha:'2026-12-02'}],'conserva sólo las funciones de otras ciudades');
 assert.deepEqual(x.ids('evento_programacion'),['P4','P5']);
 assert.deepEqual(x.ids('actividades'),['A2']);assert.equal(x.col('actividades').get('A2').ciudad_id,OTHER);assert.deepEqual(x.ids('actividad_horarios'),['H2']);
 assert.deepEqual(x.ids('promos'),['PR2']);
 assert.deepEqual(x.ids('publicidades'),['PU2']);assert.deepEqual(J(x.col('publicidades').get('PU2').segmentacion),[{ciudad_id:OTHER}]);
 assert.deepEqual(x.ids('publicidad_segmentacion'),[]);assert.deepEqual(x.ids('publicidad_media'),[]);assert.deepEqual(J(x.col('publicidad_estado').get('ANU-1').activas),[],'libera el cupo de la publicidad borrada');
 assert.deepEqual(x.ids('farmacias_ciclos'),[]);assert.deepEqual(x.ids('farmacias_ciclo_sedes'),[]);assert.deepEqual(x.ids('efemerides_bis'),[]);
 assert.deepEqual(x.ids('empleos'),['J1']);assert.deepEqual(J(x.col('empleos').get('J1')),{empleo_id:'J1',ciudad_id:OTHER,ciudad_ids:[OTHER]});
 assert.deepEqual(x.ids('lugares'),[]);assert.deepEqual(x.ids('anunciantes_sedes'),['SD-Y'],'conserva la sede de otra ciudad');
 assert.deepEqual(x.ids('anunciantes'),['ANU-1','ANU-2','ANU-3'],'ningún anunciante se borra');
 assert.equal(x.col('anunciantes').get('ANU-1').ciudad_id,OTHER);assert.equal(x.col('anunciantes').get('ANU-2').ciudad_id,'');assert.equal(x.col('anunciantes').get('ANU-2').ciudad_eliminada_id,CITY);
 assert.deepEqual(J(x.col('anunciantes').get('ANU-3').ciudad_ids),[OTHER]);
 assert.deepEqual(x.ids('suscriptores'),['U1','U2'],'las cuentas se conservan');assert.equal(x.col('suscriptores').get('U1').ciudad_predeterminada_id,'');assert.equal(x.col('suscriptores').get('U2').ciudad_origen_id,'');
 assert.deepEqual(x.ids('solicitudes_soporte'),['SS1']);assert.deepEqual(x.ids('solicitudes_anunciante'),['SA1']);
 const c=x.col('ciudades').get(CITY);assert.equal(c.eliminada,true);assert.equal(c.activa,false);
 for(const k of ['events:city:v2:','activities:city:v2:','publicity:city:v2:','guide:city:v1:','promos:city:v1:'])assert.equal(x.kv.has(k+CITY),false,'paquete retirado '+k);
 assert.equal(x.kv.has('territorio:baja146:'+CITY),false);assert.equal(x.kv.has('territorio:baja146:plan:'+CITY),false);
 const guide=x.log.synced.filter(s=>s[0]==='guide').map(s=>s[1]).sort();assert.deepEqual([...new Set(guide)],['ANU-1','ANU-2','ANU-3'],'reproyecta Guía de cada anunciante afectado');
 assert.equal(new Set(x.log.deletes).size,x.log.deletes.length,'ningún borrado se repite');assert.equal(x.log.rebuilds,1);
 const again=await x.call({modo:'ejecutar',plan_id:sim.body.plan_id,confirmacion:'Ciudad X'});assert.equal(again.body.eliminada,true);assert.equal(again.body.registros_procesados,0);
});
test('interrupciones: el reintento continúa desde el último lote sin repetir escrituras confirmadas',async()=>{
 const x=setup({failOnce:(name,a)=>name==='event'&&a.current?.evento_id==='E1'});const sim=await x.call({modo:'simular'});
 const cut=await x.call({modo:'ejecutar',plan_id:sim.body.plan_id,confirmacion:'Ciudad X'});assert.equal(cut.status,503);assert.equal(cut.body.pendiente,true);
 assert.equal(x.col('ciudades').get(CITY).eliminada,undefined,'la ciudad no se marca a mitad de camino');assert.ok(x.kv.has('territorio:baja146:'+CITY));
 const resim=await x.call({modo:'simular'});assert.equal(resim.body.code,'CITY_DELETION_IN_PROGRESS');assert.equal(resim.body.plan_id,sim.body.plan_id);
 assert.equal((await x.call({modo:'ejecutar',plan_id:'otro',confirmacion:'Ciudad X'})).body.code,'CITY_DELETION_IN_PROGRESS');
 const r=await runAll(x,sim.body.plan_id);assert.equal(r.body.eliminada,true);
 assert.equal(new Set(x.log.deletes).size,x.log.deletes.length,'ningún borrado se repite');
 assert.ok(x.log.synced.some(s=>s[0]==='event'&&s[1]==='E1'),'el evento cortado se reproyecta al reintentar');assert.equal(x.kv.has('events:city:v2:'+CITY),false);
 const y=setup({rebuildOk:false});const s2=await y.call({modo:'simular'});const fail=await runAll(y,s2.body.plan_id);assert.equal(fail.status,503);
 assert.equal(y.col('ciudades').get(CITY).eliminada,true);assert.ok(y.kv.has('territorio:baja146:'+CITY),'falló el catálogo: se conserva el avance');
 const writes=y.log.writes.length;y.setRebuild(true);const ok=await y.call({modo:'ejecutar',plan_id:s2.body.plan_id,confirmacion:'Ciudad X'});
 assert.equal(ok.body.eliminada,true);assert.equal(y.log.writes.length,writes,'completar el catálogo no reescribe datos');assert.equal(y.kv.has('territorio:baja146:'+CITY),false);
});
test('ruta, lápida y catálogos',()=>{
 assert.match(w,/cityDeletion && request2\.method === "POST"\) return deleteCity146\(/);
 assert.ok(!/request2\.method === "DELETE"\) return deleteCity146/.test(w),'sin baja directa sin plan');
 assert.match(w,/\(await db\.get\(C\.ciudades, id4\)\)\?\.eliminada === true\) return json\(\{ success: false, code: "CITY_ID_RETIRED"/);
 assert.equal((w.match(/db\.listCollection\(C\.ciudades\)\.then\(\(?rows\)? ?=> ?rows\.filter\(\(?c\)? ?=> ?c\.eliminada ?!== ?true\)\)/g)||[]).length,2);
 assert.match(w.slice(0,400),/WORKER 220/);assert.match(w.slice(0,400),/VERSIÓN 220/);assert.ok(!/\b219\b/.test(w.slice(0,400)),'encabezado sin 219');
});
