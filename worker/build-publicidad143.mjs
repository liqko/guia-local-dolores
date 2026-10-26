import './build-efemerides140.mjs';
import {readFileSync,writeFileSync} from 'node:fs';import{createHash}from'node:crypto';
let s=readFileSync(new URL('./login-efemerides140.mjs',import.meta.url),'utf8');
if(createHash('sha256').update(s).digest('hex')!=='a8e80feb59f7e86877d7cfefde508666f14b865c7658ef6d7519c9b0a13ad295')throw Error('Base140 changed');
function once(a,b){if(s.split(a).length!==2)throw Error('Unexpected anchor '+a.slice(0,100));s=s.replace(a,b);}
// Same saved-packet strategy already deployed for Guide/Efemerides. Oversized
// packets preserve the prior entity fallback instead of truncating records.
s=s.replace("['guide','efemerides'].includes(def.module)","['guide','efemerides','publicity','promos'].includes(def.module)");
once("if(def.module==='guide'){\n   const snapshot=this.guideSnapshot135(result);","if(['guide','publicity','promos'].includes(def.module)){\n   const snapshot=this.guideSnapshot135(result);");
s=s.replaceAll("def.module==='guide'?this.guideSnapshot135(","['guide','publicity','promos'].includes(def.module)?this.guideSnapshot135(");
// The outer request validates identity before access to a receipt. Reuse it
// only for this exact internal operation, never across independent requests.
once('async function verifySubscriberSession(env, request2) {',"async function verifySubscriberSession(env,request2){return GLD_BUSINESS143.trusted(env,request2,'subscriber')||await verifySubscriberSessionRaw143(env,request2); }\nasync function verifySubscriberSessionRaw143(env, request2) {");
once('async function verifyAdmin(env,request2){return GLD_ACTIONS138.authenticate(env,request2,verifyAdminUncached138);}',"async function verifyAdmin(env,request2){return GLD_BUSINESS143.trusted(env,request2,'admin')||await GLD_ACTIONS138.authenticate(env,request2,verifyAdminUncached138);}");
once("['promo_id','pausado','action','accion','advertiserId','advertiser_id','declaracion_publicacion']","['promo_id','pausado','action','accion','advertiserId','advertiser_id','declaracion_publicacion','operation_id','request_key']");
// Reject equivalent commercial patches before any original/cache write.
once('  let firestoreWrites = 0;\n  if (adminTouched) {',`  for(const key of Object.keys(adminPatch))if(!['actualizado_en','actualizado_por'].includes(key)&&GLD_BUSINESS143.equal(adminPatch[key],commercialSource.doc[key]))delete adminPatch[key];
  adminTouched=Object.keys(adminPatch).some(key=>!['actualizado_en','actualizado_por'].includes(key));
  let firestoreWrites = 0;
  if (adminTouched) {`);
once('    await db.patch("anunciantes", aid, { segmento_id: segmentoId, actualizado_en:',`    const advertiserBefore143=await db.get('anunciantes',aid);
    if(text72(advertiserBefore143?.segmento_id)!==segmentoId){
    await db.patch("anunciantes", aid, { segmento_id: segmentoId, actualizado_en:`);
once('    await patchGuideSegmentV2({ cache, advertiserId: aid, segmentoId });','    await patchGuideSegmentV2({ cache, advertiserId: aid, segmentoId });\n    }');
const commercialBegin=s.indexOf('async function updateAdvertiserCommercialV2('),commercialEnd=s.indexOf('// reconstruccion/worker/routes/admin-v4.js',commercialBegin);let commercial=s.slice(commercialBegin,commercialEnd).replace('    updated: true,','    updated: firestoreWrites>0,');s=s.slice(0,commercialBegin)+commercial+s.slice(commercialEnd);
// A stable create ID also prevents duplicates after a receipt has expired.
once('  const ctx = await validateContext({ db, cache, advertiserId, data });',`  const operation143=/^[a-f0-9-]{36}$/i.test(String(body.operation_id||''))?String(body.operation_id):'';
  const fingerprint143=operation143?await fieldRevisionInternal(data,Object.keys(data)):'';
  const stableId143=operation143?'PRO-'+operation143:'';
  if(stableId143){const prior143=await db.get('promos',stableId143);if(prior143){if(String(prior143.anunciante_id)!==String(advertiserId)||prior143.operation_fingerprint143!==fingerprint143)throw httpError('Ese identificador ya corresponde a otra promoción.',409);return {success:true,operation_recovered:true,promo:prior143,promo_id:stableId143};}}
  const ctx = await validateContext({ db, cache, advertiserId, data });`);
once('    promo_id: promoId(),',"    promo_id: stableId143||promoId(),...(operation143?{operation_fingerprint143:fingerprint143}:{}),");
once('const saved = await db.patch("promos", doc.promo_id, doc, {newDocument:true});','const saved = await db.patch("promos", doc.promo_id, doc, {newDocument:true,...(stableId143?{mustNotExist:true}:{})});');
// Quota exhaustion cannot be repaired by an immediate second KV write.
once('catch(first){await new Promise(resolve=>setTimeout(resolve,1100));await kv.put(key,value)}','catch(first){if(GLD_BUSINESS143.quotaError(first))throw first;await new Promise(resolve=>setTimeout(resolve,1100));await kv.put(key,value)}');
once('catch(_){await new Promise(r=>setTimeout(r,1100));await kv.put(key,JSON.stringify(value));}','catch(error){if(GLD_BUSINESS143.quotaError(error))throw error;await new Promise(r=>setTimeout(r,1100));await kv.put(key,JSON.stringify(value));}');
once('const ctx={path,request,url,env,db,cache};','const ctx={path,request,url,env,db,cache,request_id143:report.request_id};');
// Finish recovery of a commercial change using the authoritative contract.
once('  await syncGuideAdvertiserV2({db:source,cache,advertiserId:job.aid});',"  if(job.references.some(ref=>ref.collection==='anunciantes_administracion'))await GLD_BUSINESS143.restoreContract({db:source,cache,aid:job.aid});\n  await syncGuideAdvertiserV2({db:source,cache,advertiserId:job.aid});");
once('await db.flushLoginCache();\n  await this.finishGuide132(sourceMatches132);','await db.flushLoginCache();\n  await this.finishGuide132(sourceMatches132);');
once("if(body.op==='guide-save132')return await this.guideSave132(body);","if(body.op==='guide-save132')return await this.guideSave132(body);if(body.op==='business-save143')return await this.businessSave143(body);if(body.op==='business-status143')return await this.businessStatus143(body);");
once('      db=guideJournalDb132(db,env);','      db=GLD_BUSINESS143.journal(guideJournalDb132(db,env),env);');
once('      const guideDispatch=await routeGuideDispatch132(ctx);',"      const businessDispatch143=await GLD_BUSINESS143.dispatch(ctx);if(businessDispatch143){report.event='gld_business_dispatch143';report.source='business-dispatch';report.status=businessDispatch143.status;return businessDispatch143;}\n      const guideDispatch=await routeGuideDispatch132(ctx);");
once("  await this.repairGuide132();\n }\n catch(error){",`  await this.repairGuide132();
  if((await this.businessState143()).pending){try{await this.repairBusiness143();}catch(error){await this.retryBusiness143(error);}return;}
 }
 catch(error){`);
once('GldPublicCache119.prototype.guideSave132=async function(body){',`GldPublicCache119.prototype.guideSave132=async function(body){
 if((await this.businessState143()).pending){try{await this.repairBusiness143();}catch(error){await this.retryBusiness143(error);return json({success:false,previous_operation_pending:true,code:'PUBLICATION_SYNC_PENDING',message:'Hay un cambio anterior de publicidad o promociones pendiente. Este nuevo guardado no se aplicó.'},503);}}
`);
// Bound automatic recovery; retain pending intent for a subsequent manual retry.
once("  await this.state.storage.setAlarm(Date.now()+Math.min(3600000,60000*2**Math.min(job.attempts,6)));","  if(job.attempts>=6)await this.state.storage.deleteAlarm();else if(GLD_BUSINESS143.quotaError(error)){const next=new Date();next.setUTCHours(24,2,0,0);await this.state.storage.setAlarm(next.getTime());}else await this.state.storage.setAlarm(Date.now()+Math.min(3600000,60000*2**Math.min(job.attempts,6)));");
// Storage methods are assigned before the exported default can execute.
once('var app_main_v35_default = {',readFileSync(new URL('./modules/business-recovery143.js',import.meta.url),'utf8')+'\nvar app_main_v35_default = {');
s=s.replaceAll("worker_version:'140'","worker_version:'143'").replace('version:"140"','version:"143"');
writeFileSync(new URL('./login-publicidad143.mjs',import.meta.url),s);console.log(JSON.stringify({version:143,bytes:Buffer.byteLength(s),sha256:createHash('sha256').update(s).digest('hex')}));
