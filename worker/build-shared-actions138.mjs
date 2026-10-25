import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=readFileSync(new URL('./base-observado136.mjs',import.meta.url),'utf8');
if(createHash('sha256').update(base).digest('hex')!=='9b4530f90c33c4187023cb4bad0d2e9698d0545bbd3c341554568e70493d7bae')throw Error('Worker base changed: review current deployment before building');
let source=base;
function replace(before,after){if(source.split(before).length!==2)throw Error('Build anchor missing or repeated: '+before.slice(0,90));source=source.replace(before,after);}
replace('async function verifyAdmin(env, request2) {','async function verifyAdmin(env,request2){return GLD_ACTIONS138.authenticate(env,request2,verifyAdminUncached138);}\nasync function verifyAdminUncached138(env, request2) {');
// All territorial writers, including the global maintenance rebuild, use one coordinator.
replace('async function rebuildTerritory({ env, request: request2, db, cache }) {',`async function rebuildTerritory(ctx){
 if(GLD_ACTIONS138.isInternal(ctx.env))return rebuildTerritoryRaw138(ctx);
 const report=ctx.env.__gldRequestReport119;
 if(!report)return json({success:false,message:'Falta contexto del coordinador territorial.'},503);
 return GLD_ACTIONS138.route({...ctx,path:'/superadmin/territory/rebuild-cache'},report);
}
async function rebuildTerritoryRaw138({ env, request: request2, db, cache }) {`);
const territoryStart=source.indexOf('// reconstruccion/worker/modules/territory.js');
const territoryEnd=source.indexOf('// reconstruccion/worker/core/guide-read-model.js',territoryStart);
if(territoryStart<0||territoryEnd<0)throw Error('Missing territorial module');
source=source.slice(0,territoryStart)+source.slice(territoryStart,territoryEnd).replaceAll('await request2.json()','await GLD_ACTIONS138.readJson(request2)')+source.slice(territoryEnd);
replace('const body = await request2.clone().json();','const body = await GLD_ACTIONS138.readJson(request2);');
replace("const body=await ctx.request.clone().json().catch(()=>({})),action=", "const body=await GLD_ACTIONS138.readJson(ctx.request).catch(()=>({})),action=");
replace(' async fetch(request){\n  // Preserve ordering', ' async fetch(request){\n  if(this.actions138)return this.actions138.fetch(request);\n  // Preserve ordering');
replace("try{const body=await request.json();if(body.op==='guide-save132')", "try{const body=await request.json();if(body.op==='shared-action138'){if(!this.actions138)this.actions138=new GLD_ACTIONS138.Coordinator(this.state,this.env);return await this.actions138.fetch(request,body);}if(body.op==='guide-save132')");
replace('GldPublicCache119.prototype.alarm=async function(){','GldPublicCache119.prototype.alarm=async function(){\n if(this.actions138)return this.actions138.alarm();');
replace(' try{await this.repairGuide132();}\n catch(error){',` try{
  const markerRead=this.guidePending132===undefined?1:0;
  await this.guideJob132();
  if(this.guideState132?.action_kind138){this.actions138=new GLD_ACTIONS138.Coordinator(this.state,this.env);return await this.actions138.alarm(markerRead);}
  await this.repairGuide132();
 }\n catch(error){`);
replace("return new Proxy(env,{get(target,key){return key==='GLD_CACHE_KV'?kv:Reflect.get(target,key,target);}});", "return new Proxy(env,{get(target,key){return key==='__gldPrimeCache138'?(cacheKey,value)=>{invalidate(cacheKey);values.set(cacheKey,value);}:key==='GLD_CACHE_KV'?kv:Reflect.get(target,key,target);}});");
replace('      const guideDispatch=await routeGuideDispatch132(ctx);', '      const territorialAction=await GLD_ACTIONS138.route(ctx,report);if(territorialAction)return await traced(territorialAction);\n      const guideDispatch=await routeGuideDispatch132(ctx);');
replace('function consumption136(report){',`function consumption136(report){
 const result=consumptionBase136(report),action=report.action_store138;
 result.cloudflare.action_store=action||{calls:0,rows_read:0,rows_written:0,alarm_set_calls:0,alarm_cancel_calls:0};
 if(action?.rows_read===null){
  result.coverage.missing.push('action-store-unreported-internal-operations');result.coverage.operation_counters='INCOMPLETO';
  for(const field of Object.keys(result.firestore))result.firestore[field]=null;
  for(const field of Object.keys(result.cloudflare.kv))result.cloudflare.kv[field]=null;
 }
 if(action?.alarm_cancel_calls||action?.alarm_cancel_failures)result.coverage.missing.push('action-store-alarm-cancellation-row-billing');
 return result;
}
function consumptionBase136(report){`);
replace('Content-Type,Authorization,X-GLD-Adult-Token','Content-Type,Authorization,X-GLD-Adult-Token,Idempotency-Key');
source=source.replaceAll("worker_version:'136'","worker_version:'138'").replace('version:"136"','version:"138"');
source=readFileSync(new URL('./shared-actions138.mjs',import.meta.url),'utf8')+'\n'+source;
writeFileSync(new URL('./login-acciones138.mjs',import.meta.url),source);
console.log(JSON.stringify({version:138,bytes:Buffer.byteLength(source),sha256:createHash('sha256').update(source).digest('hex')}));
