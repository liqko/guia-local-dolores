// Contrato de publicación transversal. Ejecuta las funciones REALES del Worker206.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const worker=fs.readFileSync(require('node:path').join(__dirname,'../worker/worker206.txt'),'utf8');
const activityPage=fs.readFileSync(require('node:path').join(__dirname,'../plataforma/actividades.html'),'utf8');
function extract(name){
 const start=worker.indexOf('function '+name+'(');
 assert(start>=0,'Falta '+name);
 const open=worker.indexOf('{',start);
 let depth=0;
 for(let i=open;i<worker.length;i++){
  if(worker[i]==='{')depth++;else if(worker[i]==='}'&&--depth===0)return worker.slice(start,i+1);
 }
 throw Error('Función incompleta: '+name);
}
const stubs=`
const adultFlag=v=>v===true||v===1||['SI','SÍ','TRUE','1'].includes(String(v||'').toUpperCase());
const bool4=v=>v===true||v===1;const bool8=v=>v===true||v===1;
const bool7=v=>v===true||v===1;
const text16=v=>String(v??'');const text14=v=>String(v??'');
const isWithinValidity=p=>!p.vigente_hasta||p.vigente_hasta>='2026-11-14';
const isPaused=p=>p.pausado===true||p.estado==='PAUSADA';
const promoPendingV91=p=>p.estado_moderacion==='PENDIENTE';
`;
const selected=['gldPublicacionAdmisible206','isPublic3','published','visible','isPublic2'];
const funcs=Function(stubs+selected.map(extract).join('\n')+'\nreturn {'+selected.join(',')+'};')();
const when=Date.parse('2026-11-14T12:00:00Z');
const activity={estado:'ACTIVA',activo:true,aprobado:false,estado_moderacion:'PUBLICADO',vigente_desde:'2026-11-01',vigente_hasta:'2026-11-30'};
test('actividad ACTIVA sin veto no necesita aprobación manual histórica',()=>{
 assert.equal(funcs.isPublic3(activity,when),true);
 assert.equal(funcs.isPublic3({...activity,aprobado:true},when),true);
});
for(const [field,value] of [['estado','PAUSADA'],['estado','BORRADOR'],['estado_moderacion','PENDIENTE'],['estado_moderacion','RECHAZADA'],['suspendido',true],['eliminado',true]]){
 test('actividad bloqueada por '+field+'='+value,()=>assert.equal(funcs.isPublic3({...activity,[field]:value},when),false));
}
test('la vigencia limita publicación de actividad',()=>{
 assert.equal(funcs.isPublic3({...activity,vigente_desde:'2026-11-15'},when),false);
 assert.equal(funcs.isPublic3({...activity,vigente_hasta:'2026-11-13'},when),false);
});
test('contenido adulto no aprobado NO se publica',()=>{
 assert.equal(funcs.isPublic3({...activity,contenido_adulto:'SI'},when),false);
 assert.equal(funcs.isPublic3({...activity,contenido_adulto:'SI',revision_adulto:'APROBADO'},when),true);
});
test('eventos Free y VIP usan la misma política de moderación',()=>{
 for(const nivel of ['FREE','VIP']){
  assert.equal(funcs.published({nivel,estado:'ACTIVA'}),true);
  assert.equal(funcs.published({nivel,estado:'ACTIVA',estado_moderacion:'PENDIENTE'}),false);
  assert.equal(funcs.published({nivel,estado:'ACTIVA',pausado:true}),false);
 }
});
test('promociones activas y pendientes/rechazadas',()=>{
 assert.equal(funcs.visible({estado:'ACTIVA'}),true);
 assert.equal(funcs.visible({estado:'ACTIVA',estado_moderacion:'PENDIENTE'}),false);
 assert.equal(funcs.visible({estado:'ACTIVA',estado_moderacion:'RECHAZADA'}),false);
});
test('publicidad conserva autorización comercial y moderación',()=>{
 assert.equal(funcs.isPublic2({estado:'ACTIVA',aprobado:false}),false);
 assert.equal(funcs.isPublic2({estado:'ACTIVA',aprobado:true}),true);
 assert.equal(funcs.isPublic2({estado:'ACTIVA',aprobado:true,estado_moderacion:'PENDIENTE'}),false);
});
test('circuito actividades comparte versión de paquete entre guardar y leer',()=>{
 const save=worker.slice(worker.indexOf('async function syncActivityPreparedV2('),worker.indexOf('async function getActivitiesCityV2('));
 const read=worker.slice(worker.indexOf('async function getActivitiesCityV2('),worker.indexOf('async function rebuildActivitiesAllV2('));
 assert.match(save,/activityCityKeyV2\(cityId\)/);
 assert.match(read,/activityCityKeyV2\(city\)/);
});
test('el sitio público consume edición consolidada antes de Worker',()=>{
 assert.match(activityPage,/GLD_PAQUETE_CIUDAD\?\.module\?\.\(ciudadContexto\.ciudad_id,'activities'\)/);
 assert.match(activityPage,/const response = cached\|\|await fetchJsonConTimeout/);
});
test('guardar, moderar y publicar actividades comparten la política automática',()=>{
 const policy=worker.slice(worker.indexOf('function publicationDbV77('),worker.indexOf('async function preparePublicationV77('));
 assert.match(policy,/patch\.aprobado=policy\.estado_moderacion!=='PENDIENTE'/);
 assert.match(policy,/patch\.estado=patch\.aprobado\?'ACTIVA':'PENDIENTE'/);
 assert.match(worker,/function gldPublicacionAdmisible206\(/);
});
