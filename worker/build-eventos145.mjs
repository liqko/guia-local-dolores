import './build-publicidad143.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
let s=readFileSync(new URL('./login-publicidad143.mjs',import.meta.url),'utf8');
if(createHash('sha256').update(s).digest('hex')!=='5264e4602939bbad90025d53067b9056d6b1191bdbf1c8f958a5baa352cd92aa')throw Error('Worker143 base changed');
function once(a,b){if(s.split(a).length!==2)throw Error('Ambiguous source anchor: '+a.slice(0,100));s=s.replace(a,b);}
// Extend the persistent full packet optimization; oversized packets retain
// their complete entity fallback, never a truncated public result.
s=s.replaceAll("['guide','efemerides','publicity','promos']","['guide','efemerides','publicity','promos','events']");
s=s.replaceAll("['guide','publicity','promos']","['guide','publicity','promos','events']");
once('  await validateEvent({ db, cache, advertiserId, data, level });','  await GLD_EVENTS145.scope({db,cache,advertiserId,data,advertiser});\n  await validateEvent({ db, cache, advertiserId, data, level });');
once('  const hasDataChanges = Object.keys(changedFieldsV1(current, next)).length > 0;',`  await GLD_EVENTS145.scope({db,cache,advertiserId,data:next,current});
  if(Object.hasOwn(data,'alcance_publicacion'))data.alcance_publicacion=next.alcance_publicacion;
  const hasDataChanges = Object.keys(changedFieldsV1(current, next)).length > 0;`);
once('events:sort2([...byId.values()]),cold:!packet&&!virtual','events:sort2(await GLD_EVENTS145.publicRows([...byId.values()],city,cache)),cold:!packet&&!virtual');
once('    await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), events: sort2(rows) });',`    const sorted=sort2(rows);
    if(!GLD_BUSINESS143.equal(packet2.events||[],sorted))await cache.put(key3,{version:2,ciudad_id:cityId,updated_at:new Date().toISOString(),events:sorted});`);
once('  await cache.put(coverageKey(id4), { ciudades: nextCities });',"  if(!GLD_BUSINESS143.equal(previous?.ciudades||[],nextCities))await cache.put(coverageKey(id4),{ciudades:nextCities});");
// Reuse the own-event query for quota, monthly slots and identified retries.
once('    total: rows.length,\n    active: rows.filter((e)', '    own,\n    total: rows.length,\n    active: rows.filter((e)');
once('  const own=free?await db.queryEqual("eventos","anunciante_id",advertiserId,500):[];', '  const own=free?q.own:[];');
const payloadAnchor='    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};';
// Only event routes pass the operation ID; do not persist request metadata.
for(const name of ['routePanelV3','routePanelV4']){
 const start=s.indexOf('async function '+name+'('),end=s.indexOf('\nasync function ',start+20);let block=s.slice(start,end);
 if(!block.includes(payloadAnchor))throw Error(name+' payload missing');
 block=block.replace(payloadAnchor,payloadAnchor+"\n    Object.defineProperty(payload,'__operation_id145',{value:body.operation_id,enumerable:false});");s=s.slice(0,start)+block+s.slice(end);
}
once('  const free = level === "FREE";\n  const policy=',`  const free = level === "FREE";
  const operation145=/^[a-f0-9-]{36}$/i.test(String(payload?.__operation_id145||''))?String(payload.__operation_id145):'';
  delete data.operation_id145;delete data.operation_fingerprint145;
  const fingerprint145=operation145?await fieldRevisionInternal({level,data},['level','data']):'';
  const policy=`);
once('  const q = await quota2({ db, advertiserId, max, free });',`  const q = await quota2({ db, advertiserId, max, free });
  if(operation145){const prior=q.own.find(e=>e.operation_id145===operation145);if(prior){if(prior.operation_fingerprint145!==fingerprint145)throw httpError('Ese identificador corresponde a otro evento.',409);if(prior.eliminado)throw httpError('Ese evento fue borrado. Actualizá el listado antes de crear otro.',409);return {success:true,operation_recovered:true,evento_id:prior.evento_id,evento:prior};}}`);
once('const now = (/* @__PURE__ */ new Date()).toISOString(), eventId = id(free ? "free" : "vip");','const now = (/* @__PURE__ */ new Date()).toISOString(), eventId = operation145?(free?"free-":"vip-")+operation145:id(free ? "free" : "vip");');
once('    ...data,\n    ...adultFields(null,data),\n    evento_id: eventId,','    ...data,\n    ...(operation145?{operation_id145:operation145,operation_fingerprint145:fingerprint145}:{}),\n    ...adultFields(null,data),\n    evento_id: eventId,');
once('  delete out2.__id;','  delete out2.operation_id145;delete out2.operation_fingerprint145;\n  delete out2.__id;');
once("fecha_carga:current.fecha_carga||current.creado,eliminado:true", "fecha_carga:current.fecha_carga||current.creado,...(current.operation_id145?{operation_id145:current.operation_id145,operation_fingerprint145:current.operation_fingerprint145}:{}),eliminado:true");
once('"moderado_por", "moderado_en"]) delete copy[k];','"moderado_por", "moderado_en", "operation_id145", "operation_fingerprint145"]) delete copy[k];');
// A stale editor must not overwrite a newer event. Use the document version
// already read for this action as the atomic precondition on source mutation.
for(const name of ['updateEventV3','pauseEventV3','deleteEventV3']){
 const start=s.indexOf('async function '+name+'('),end=s.indexOf('\nasync function ',start+20);let b=s.slice(start,end);
 b=b.replace('const current = await db.get("eventos", eventId);','const eventVersion145=await db.getVersioned("eventos",eventId);\n  const current=eventVersion145.doc;');
 if(name==='updateEventV3')b=b.replace('  if(level===\'FREE\')removeFreeEventLinks(data);',`  if(data.revision_evento145&&data.revision_evento145!==await GLD_EVENTS145.revision(current))throw httpError('El evento cambió. Volvé a abrirlo antes de guardar.',409);
  delete data.revision_evento145;
  if(level==='FREE')removeFreeEventLinks(data);`);
 b=b.replaceAll('{ mustExist: true }','{mustExist:true,...(eventVersion145.updateTime?{updateTime:eventVersion145.updateTime}:{})}').replace('{mustExist:true,quotaReceiptOnly:true}','{mustExist:true,quotaReceiptOnly:true,...(eventVersion145.updateTime?{updateTime:eventVersion145.updateTime}:{})}');
 b=b.replace('...(editVersion?.updateTime?{updateTime:editVersion.updateTime}:{})','...((editVersion?.updateTime||eventVersion145.updateTime)?{updateTime:editVersion?.updateTime||eventVersion145.updateTime}:{})');
 b=b.replaceAll('evento: { ...current, programacion: previousProgramacion }','evento: await GLD_EVENTS145.result(current,previousProgramacion)').replaceAll('evento: { ...current, programacion }','evento: await GLD_EVENTS145.result(current,programacion)').replaceAll('evento: { ...saved, programacion: Array.isArray(programacion) ? programacion : [] }','evento: await GLD_EVENTS145.result(saved,Array.isArray(programacion)?programacion:[])').replaceAll('evento: current','evento: await GLD_EVENTS145.result(current)').replaceAll('evento: saved','evento: await GLD_EVENTS145.result(saved)');
 s=s.slice(0,start)+b+s.slice(end);
}
once('    evento: { ...saved, programacion }','    evento: await GLD_EVENTS145.result(saved,programacion)');
// The panel computes revisions from the source row, before adding legacy children.
once('  const enriched = await Promise.all(events.filter(e=>!e.eliminado).map(async (e) => ({\n    ...e,','  const enriched = await Promise.all(events.filter(e=>!e.eliminado).map(async (e) => ({\n    ...e,revision_evento145:await GLD_EVENTS145.revision(e),');
once('  const approved = dec === "APROBAR";\n  const saved =',`  const approved = dec === "APROBAR";
  if(current.estado_moderacion===(approved?'APROBADO':'RECHAZADO')&&current.estado===(approved?'ACTIVO':'RECHAZADO'))return {success:true,updated:false,tipo:'EVENTO',id:id4,decision:dec,estado_moderacion:current.estado_moderacion};
  const saved =`);
// Reuse the existing per-advertiser durable intent, lock, bounded alarms and
// receipts. Recovery restores derived data only; it never repeats source writes.
once("const collections=new Set(['promos','publicidades','publicidad_estado','publicidad_media','publicidad_segmentacion']);","const collections=new Set(['promos','publicidades','publicidad_estado','publicidad_media','publicidad_segmentacion','eventos','evento_programacion']);");
once("  const statusPath=path.match(","  const eventResponse145=await GLD_EVENTS145.dispatch(ctx);if(eventResponse145)return eventResponse145;\n  const statusPath=path.match(");
once('   selected.push({...entry,before});',`   if(entry.collection==='eventos'&&before&&!Array.isArray(before.programacion))before={...before,programacion:await getPreparedRelationsV1({cache:createCache(env),type:'event',id:entry.id,current:before,load:()=>db.queryEqual('evento_programacion','evento_id',entry.id,500)})};
   selected.push({...entry,before});`);
once("['publicidad_id','promo_id','anunciante_id'","['evento_id','programacion','programacion_version','alcance_publicacion','publicidad_id','promo_id','anunciante_id'");
once('  await db.flushLoginCache();await this.finishBusiness143(applied);report.status=200;',"  if(job.kind==='eventos')await GLD_EVENTS145.repair({job,source,cache,db});\n  await db.flushLoginCache();await this.finishBusiness143(applied);report.status=200;");
once("const deleted=['deletepromo','borrar','eliminar'].includes(receipt.action)","const deleted=['deletefreeevent','deletevipevent','deletepromo','borrar','eliminar'].includes(receipt.action)");
once("  if(receipt.kind==='promos')Object.assign(result,", "  if(receipt.kind==='eventos')Object.assign(result,{evento:saved[0]||null,evento_id:receipt.refs[0]?.id});\n  else if(receipt.kind==='promos')Object.assign(result,");
once('var app_main_v35_default = {',readFileSync(new URL('./modules/events-scope145.js',import.meta.url),'utf8')+'\nvar app_main_v35_default = {');
s=s.replaceAll("worker_version:'143'","worker_version:'145'").replaceAll("'X-GLD-Worker-Version':'143'","'X-GLD-Worker-Version':'145'").replace('version:"143"','version:"145",event_scope_version:1');
writeFileSync(new URL('./login-eventos145.mjs',import.meta.url),s);
console.log(JSON.stringify({version:145,bytes:Buffer.byteLength(s),sha256:createHash('sha256').update(s).digest('hex')}));
