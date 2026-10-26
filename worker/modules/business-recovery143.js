// Durable recovery for existing Publicidad/Promos mutations. Reuses the
// advertiser actor; no source mutation is retried by recovery.
var GLD_BUSINESS143=(()=>{
 const collections=new Set(['promos','publicidades','publicidad_estado','publicidad_media','publicidad_segmentacion']);
 const equal=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
 function normalize(v){return Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;}
 const quotaError=e=>/KV (?:put|delete|list|get)\(\) limit exceeded|daily.*(?:write|quota).*limit|quota.*exceeded/i.test(String(e?.message||e));
 const uuid=v=>/^[a-f0-9-]{36}$/i.test(String(v||''))?String(v):'';
 async function dispatch(ctx){
  const {request,path,url,env,db}=ctx;
  if(env.__gldBusinessActor143||env.__gldGuideActor132||!env.GLD_PUBLIC_CACHE)return null;
  const statusPath=path.match(/^\/superadmin\/advertisers\/([^/]+)\/recovery-status$/);
  if(statusPath&&request.method==='GET'){
   const auth=await verifyAdmin(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);if(!isTopAdmin(auth))return json({success:false,message:'Sólo superadministración puede revisar la recuperación.'},403);
   const aid=decodeURIComponent(statusPath[1]),actor=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('guide-save-v132:'+aid));return actor.fetch(new Request('https://business.internal/',{method:'POST',body:JSON.stringify({op:'business-status143',aid})}));
  }
  if(request.method!=='POST')return null;
  if(!['/promos','/publicidad','/superadmin/promos','/superadmin/publicidad'].includes(path))return null;
  const body=await GLD_ACTIONS138.readJson(request),action=String(body.action||body.accion||'').toLowerCase();
  const admin=path.startsWith('/superadmin/'),promo=path.endsWith('/promos');
  const actions=admin?(promo?['pausar','reanudar','borrar','aprobar','rechazar']:['pausar','eliminar']):(promo?['createpromo','updatepromo','deletepromo']:['guardar','actualizar_activos','eliminar']);
  if(!actions.includes(action))return null;
  let aid,identity;
  if(admin){
   const auth=await verifyAdmin(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);
   if(!isTopAdmin(auth))return json({success:false,message:'No tenés permiso para administrar esta publicación.'},403);identity={kind:'admin',value:auth};
   const id=String(promo?body.promo_id||body.id||'':body.publicidad_id||'');
   if(!id)return null;
   const row=await db.get(promo?'promos':'publicidades',id);
   aid=row?String(row.anunciante_id||row.id_comercio||''):aidOf4(url,body);
   if(!aid)return null;
  }else{
   aid=aidOf4(url,body);if(!aid)return null;
   const auth=await requirePanel(env,request,aid,promo?'promos':'publicidad',true);if(auth.response)return auth.response;identity={kind:'subscriber',value:auth.session};
  }
  if(!aid)return null;
  const data=body.payload&&typeof body.payload==='object'?body.payload:body;
  const publishRecent=!admin&&(promo?(action==='createpromo'||action==='updatepromo'&&Object.keys(data).some(k=>!['promo_id','pausado','action','accion','advertiserId','advertiser_id','declaracion_publicacion','operation_id','request_key'].includes(k))):action==='guardar');
  const actor=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('guide-save-v132:'+aid));
  const response=await actor.fetch(new Request('https://business.internal/',{method:'POST',body:JSON.stringify({op:'business-save143',origin_request_id:ctx.request_id143,aid,url:request.url,headers:[...request.headers].filter(([key])=>!['host','content-length'].includes(key.toLowerCase())),body,action,identity,kind:promo?'promos':'publicidades',publishRecent,key:uuid(body.operation_id)||uuid(body.request_key)||uuid(request.headers.get('Idempotency-Key'))})}));
  const renewal=SESSION_RENEWALS_V87.get(request);if(!renewal||response.headers.has('X-GLD-Session-Token'))return response;
  const headers=new Headers(response.headers);headers.set('X-GLD-Session-Token',renewal.token);headers.set('X-GLD-Session-Kind',renewal.kind);headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
 function trusted(env,request,kind){
  const command=env.__gldBusinessActor143?.businessCommand143;
  if(!command||command.identity?.kind!==kind||request.method!=='POST'||request.url!==command.url||request.headers.get('Authorization')!==new Headers(command.headers).get('Authorization'))return null;
  return structuredClone(command.identity.value);
 }
 async function prepareEntries143(entries,db,env){
  const selected=[];
  for(const entry of entries.filter(e=>collections.has(e.collection))){
   let before=entry.before;
   if(entry.collection==='publicidades'&&before&&!Array.isArray(before.segmentacion))before={...before,segmentacion:await getPreparedRelationsV1({cache:createCache(env),type:'publicity-seg',id:entry.id,current:before,load:()=>db.queryEqual('publicidad_segmentacion','publicidad_id',entry.id,500)})};
   selected.push({...entry,before});
  }
  return selected;
 }
 function journal(db,env){
  const actor=env.__gldBusinessActor143;if(!actor)return db;
  return {...db,
   async commitPatches(entries){await actor.beginBusiness143(await prepareEntries143(entries,db,env));return db.commitPatches(entries);},
   async patch(collection,id,patch,options={}){if(collections.has(collection)){const before=options.newDocument||options.mustNotExist?null:(await db.getVersioned(collection,id)).doc;await actor.beginBusiness143(await prepareEntries143([{collection,id,patch,before}],db,env));}return db.patch(collection,id,patch,options);},
   async delete(collection,id,options={}){if(collections.has(collection))await actor.beginBusiness143(await prepareEntries143([{collection,id,remove:true,before:(await db.getVersioned(collection,id)).doc}],db,env));return db.delete(collection,id,options);}
  };
 }
 async function restoreContract({db,cache,aid}){
  const admin=await db.get('anunciantes_administracion',aid);if(!admin)return;
  const next={...publicityContractV101(admin),habilitada:featureEnabled2(admin,'PUBLICIDAD')},key='publicity:contract:v101:'+aid;
  if(!equal(await cache.get(key),next))await cache.put(key,next);
 }
 return {dispatch,journal,equal,quotaError,restoreContract,trusted};
})();
GldPublicCache119.prototype.businessState143=async function(){
 if(!this.business143)this.business143=await this.state.storage.get('business-intent-v143')||{pending:null,receipts:[]};
 return this.business143;
};
GldPublicCache119.prototype.storeBusiness143=async function(value){
 if(new TextEncoder().encode(JSON.stringify(value)).byteLength>120000)throw httpError('Guardá menos cambios de publicidad o promociones juntos.',400);
 await this.state.storage.put('business-intent-v143',value);this.business143=value;
};
GldPublicCache119.prototype.beginBusiness143=async function(entries){
 if(!entries.length)return;
 const state=await this.businessState143(),job=structuredClone(state.pending||{aid:this.businessCommand143.aid,publishRecent:!!this.businessCommand143.publishRecent,key:this.businessCommand143.key,fingerprint:this.businessFingerprint143,action:this.businessCommand143.action,kind:this.businessCommand143.kind,refs:[],attempts:0});
 for(const e of entries){
  const keys=Object.keys(e.patch||{}).filter(k=>k!=='_version'&&e.patch[k]!==undefined);
  const expectation=e.remove?{removed:true}:{keys,hash:await fieldRevisionInternal(e.patch||{},keys)};
  let ref=job.refs.find(r=>r.collection===e.collection&&r.id===String(e.id));
  if(!ref){const old=e.before||{};ref={collection:e.collection,id:String(e.id),before:{id:String(e.id),...Object.fromEntries(['publicidad_id','promo_id','anunciante_id','id_comercio','ciudad_id','segmentacion','relaciones_version','actualizado','estado_moderacion','revision_adulto','aprobado'].filter(k=>old[k]!==undefined).map(k=>[k,old[k]]))},checks:[]};job.refs.push(ref);}
  ref.checks.push(expectation);
 }
 // Alarm must exist before source mutation, including a process interruption.
 await this.storeBusiness143({...state,pending:job});await this.state.storage.setAlarm(Date.now()+60000);
};
GldPublicCache119.prototype.finishBusiness143=async function(applied,result=null){
 const state=await this.businessState143(),job=state.pending;if(!job)return;
 const receipts=state.receipts.filter(r=>Date.now()-r.at<86400000&&r.key!==job.key);
 if(job.key){const small=result&&new TextEncoder().encode(JSON.stringify(result)).byteLength<=32000;receipts.push({key:job.key,fingerprint:job.fingerprint,at:Date.now(),applied,result:small?result:null,kind:job.kind,action:job.action,refs:job.refs.filter(r=>r.collection===job.kind).map(r=>({collection:r.collection,id:r.id}))});}
 while(receipts.length>20||new TextEncoder().encode(JSON.stringify(receipts)).byteLength>48000)receipts.shift();
 await this.storeBusiness143({pending:null,receipts});await this.state.storage.deleteAlarm();
};
GldPublicCache119.prototype.retryBusiness143=async function(error){
 const state=await this.businessState143();if(!state.pending)return;
 const next=structuredClone(state);next.pending.attempts++;next.pending.last_error=String(error?.message||error).slice(0,300);
 await this.storeBusiness143(next);
 if(next.pending.attempts>=6){await this.state.storage.deleteAlarm();return;}
 let at=Date.now()+Math.min(3600000,60000*2**next.pending.attempts);
 if(GLD_BUSINESS143.quotaError(error)){const d=new Date();d.setUTCHours(24,2,0,0);at=d.getTime();}
 await this.state.storage.setAlarm(at);
};
GldPublicCache119.prototype.repairBusiness143=async function(){
 const state=await this.businessState143(),job=state.pending;if(!job)return;
 const report={event:'gld_business_recovery143',worker_version:'143',started_at:new Date().toISOString(),status:500,request_id:crypto.randomUUID(),method:'RECOVER',path:'/internal/business/recover',operations:{}};
 const env=coordinatedCities119(requestCache121(observeKv117(this.env,report),report),report),source=requestDb119(observeDbV41(createDb(env),report),report);
 const db=withPanelCacheV48(withPrivateCacheV46(source,env),env,report),cache=createCache(env);let applied=true;
 try{
  for(const ref of job.refs){
   const row=await source.get(ref.collection,ref.id);
   for(const check of ref.checks)if(check.removed?!!row:!row||await fieldRevisionInternal(row,check.keys)!==check.hash){applied=false;console.warn('gld_business_recovery_mismatch143',ref.collection,ref.id,check.keys);}
   db.repairPanelGuide132(ref.collection,ref.id,ref.before,row);
   if(ref.collection==='promos'){
    await syncPromo({cache,current:ref.before,next:row});
    if(row&&job.publishRecent){
     const id=ref.id,key='publication:recent:latest:v77:promos:'+id,prior=await cache.get(key);
     if(row.estado_moderacion==='PUBLICADO'&&!row.contenido_adulto){
      if(!GLD_BUSINESS143.equal(prior?.publicacion,row)){const date=row.actualizado||row.creado||new Date().toISOString(),item={collection:'promos',id,nombre:row.nombre_evento||row.nombre||row.titulo||id,ciudad_id:row.ciudad_id||'',ciudades:[...new Set([row.ciudad_id].filter(Boolean))],anunciante_id:row.anunciante_id||id,fecha:date,publicacion:row};await cache.put('publication:recent:v77:'+date.slice(0,10)+':promos:'+id,item,{expirationTtl:11*86400});await cache.put(key,item,{expirationTtl:11*86400});}
     }else{const item={retirado:true,collection:'promos',id};if(!GLD_BUSINESS143.equal(prior,item))await cache.put(key,item,{expirationTtl:11*86400});}
    }
   }
   if(ref.collection==='publicidad_estado'){
    if(row&&!GLD_BUSINESS143.equal(await cache.get('publicity:usage:v101:'+job.aid),row))await cache.put('publicity:usage:v101:'+job.aid,row);
   }
   if(ref.collection==='publicidades'){
    const media=row?await getPreparedRelationsV1({cache,type:'publicity-media',id:ref.id,current:row,load:()=>source.queryEqual('publicidad_media','publicidad_id',ref.id,500)}):[];
    const segmentacion=row?await getPreparedRelationsV1({cache,type:'publicity-seg',id:ref.id,current:row,load:()=>source.queryEqual('publicidad_segmentacion','publicidad_id',ref.id,500)}):[];
    await syncPublicityPreparedV2({cache,publicityId:ref.id,current:ref.before,next:row,media,segmentacion,previousCities:[...new Set((ref.before.segmentacion||[]).map(s=>s.ciudad_id).filter(Boolean))]});
    if(row&&job.action==='guardar'){
     const now=row.actualizado||row.creado,id=ref.id;
     if(row.estado_moderacion==='PUBLICADO'&&!row.contenido_adulto){const item={collection:'publicidades',id,nombre:row.titulo,ciudades:[...new Set(segmentacion.map(s=>s.ciudad_id))],anunciante_id:job.aid,fecha:now,publicacion:row};for(const key of ['publication:recent:v77:'+now.slice(0,10)+':publicidades:'+id,'publication:recent:latest:v77:publicidades:'+id])if(!GLD_BUSINESS143.equal(await cache.get(key),item))await cache.put(key,item,{expirationTtl:11*86400});}
     else await cache.put('publication:recent:latest:v77:publicidades:'+id,{retirado:true,collection:'publicidades',id},{expirationTtl:11*86400});
    }
   }
  }
  await db.flushLoginCache();await this.finishBusiness143(applied);report.status=200;
 }finally{delete report.source_versions119;delete report.source_parents119;report.consumption=consumption136(report);console.log(JSON.stringify(finishObservationV42(report)));}
};
GldPublicCache119.prototype.businessExecute143=async function(command){
 try{await this.repairGuide132();await this.repairBusiness143();}catch(error){await this.retryBusiness143(error);return json({success:false,code:'PUBLICATION_SYNC_PENDING',operation_unconfirmed:true,message:'Hay una sincronización pendiente. No repitas el cambio anterior; se conserva para recuperarlo.'},503);}
 const fingerprint=await fieldRevisionInternal({path:new URL(command.url).pathname,body:command.body},['path','body']);
 const state=await this.businessState143(),receipt=command.key&&state.receipts.find(r=>r.key===command.key&&Date.now()-r.at<86400000);
 if(receipt){
  if(receipt.fingerprint!==fingerprint)return json({success:false,message:'Ese identificador pertenece a otro cambio.'},409);
  if(!receipt.applied)return json({success:false,code:'PUBLICATION_OPERATION_REVIEW',message:'El guardado anterior requiere revisión. Actualizá el listado antes de repetirlo.'},409);
  if(receipt.result)return json({...receipt.result,operation_recovered:true});
  return this.replayBusiness143(receipt,command);
 }
 this.businessCommand143=command;this.businessFingerprint143=fingerprint;
 const env=new Proxy(this.env,{get:(target,key)=>key==='__gldBusinessActor143'?this:Reflect.get(target,key,target)});
 const response=await app_main_v35_default.fetch(new Request(command.url,{method:'POST',headers:command.headers,body:JSON.stringify(command.body)}),env);
 const pending=(await this.businessState143()).pending;
 if(pending&&response.ok){try{await this.finishBusiness143(true,await response.clone().json());}catch(error){await this.retryBusiness143(error);return json({success:false,operation_unconfirmed:true,code:'PUBLICATION_SYNC_PENDING',message:'El cambio se guardó, pero falta confirmar la sincronización. No lo repitas.'},503);}}
 else if(pending&&response.status>=500){const error=await response.clone().json().catch(()=>({}));await this.retryBusiness143(error.message);return json({success:false,operation_unconfirmed:true,code:'PUBLICATION_SYNC_PENDING',message:'Falta confirmar la publicación. No repitas el cambio: la recuperación verificará lo ya guardado.'},503);}
 return response;
};

GldPublicCache119.prototype.businessSave143=async function(command){
 const original=this.state,counts={storage_get_calls:0,storage_put_calls:0,alarm_set_calls:0,alarm_cancel_calls:0};
 const names={get:'storage_get_calls',put:'storage_put_calls',setAlarm:'alarm_set_calls',deleteAlarm:'alarm_cancel_calls'};
 const storage=new Proxy(original.storage,{get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?(...args)=>{if(names[key])counts[names[key]]++;return value.apply(target,args);}:value;}});
 this.state=new Proxy(original,{get(target,key){return key==='storage'?storage:Reflect.get(target,key,target);}});
 let response;
 try{
  response=await this.businessExecute143(command);
  const headers=new Headers(response.headers),existing=JSON.parse(decodeURIComponent(headers.get('X-GLD-Consumption')||'%7B%7D'));
  existing.cloudflare??={};existing.cloudflare.business_store={calls:1,...counts,rows_read:null,rows_written:null};
  headers.set('X-GLD-Consumption',encodeURIComponent(JSON.stringify(existing)));
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }finally{this.state=original;delete this.businessCommand143;delete this.businessFingerprint143;console.log(JSON.stringify({event:'gld_business_storage143',worker_version:'143',path:new URL(command.url).pathname,origin_request_id:command.origin_request_id||null,advertiser_id:command.aid,operation_id:command.key||null,status:response?.status||500,consumption:{cloudflare:{business_store:{calls:1,...counts,rows_read:null,rows_written:null}}}}));}
};

GldPublicCache119.prototype.replayBusiness143=async function(receipt,command){
 const report={event:'gld_business_replay143',worker_version:'143',started_at:new Date().toISOString(),status:500,request_id:crypto.randomUUID(),method:'REPLAY',path:'/internal/business/replay',operations:{}};
 const db=observeDbV41(createDb(this.env),report),saved=[];
 try{
  for(const ref of receipt.refs){const row=await db.get(ref.collection,ref.id);if(row)saved.push(row);}
  const deleted=['deletepromo','borrar','eliminar'].includes(receipt.action),result={success:true,operation_recovered:true,...(deleted?{deleted:true}:{})};
  if(receipt.kind==='promos')Object.assign(result,{promo:saved[0]||null,promo_id:receipt.refs[0]?.id});
  else{
   const [state,admin]=await Promise.all([db.get('publicidad_estado',command.aid),db.get('anunciantes_administracion',command.aid)]);
   Object.assign(result,{publicidad:saved[0]||null,publicidad_id:receipt.refs[0]?.id,cambios_activos:publicityUsageV101(state,publicityContractV101(admin||{}))});
   if(receipt.action==='actualizar_activos')Object.assign(result,{publicidades:await db.queryEqual('publicidades','anunciante_id',command.aid,500),sin_cambios:false,cambios:receipt.refs.length});
  }
  report.status=200;const {totals}=finishObservationV42(report);report.consumption=consumption136(report);
  return json(result,200,{'X-GLD-Worker-Version':'143','X-GLD-Request-Id':report.request_id,'X-GLD-Read-Calls':String(totals.read_calls),'X-GLD-Write-Calls':'0','X-GLD-Delete-Calls':'0','X-GLD-Source':'business-replay','X-GLD-Consumption':encodeURIComponent(JSON.stringify(report.consumption))});
 }finally{console.log(JSON.stringify(finishObservationV42(report)));}
};

GldPublicCache119.prototype.businessStatus143=async function(body){
 const business=await this.businessState143(),guide=await this.guideJob132();
 return json({success:true,advertiser_id:body.aid,scope:'this-advertiser-only',business_pending:business.pending?{kind:business.pending.kind,attempts:business.pending.attempts,automatic_retries_stopped:business.pending.attempts>=6}:null,guide_pending:!!guide,safe_to_restore_140_for_this_advertiser:!business.pending&&!guide});
};
