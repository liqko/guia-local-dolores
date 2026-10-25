// Shared request services and a durable action coordinator. Built into one Worker.
// The coordinator is used only by territorial mutations; public reads stay on KV.
var GLD_ACTIONS138 = (() => {
 const bodies=new WeakMap(),identities=new WeakMap(),internalEnvironments=new WeakSet();
 const actorName='territory-actions-v138';
 const clone=value=>structuredClone(value);
 const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>[k,stable(value[k])])):value;
 const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
 const changed=(current,patch,ignored=[])=>!current||Object.keys(patch).some(k=>!ignored.includes(k)&&patch[k]!==undefined&&!equal(current[k],patch[k]));
 async function readJson(request){
  if(!bodies.has(request))bodies.set(request,request.clone().json());
  return clone(await bodies.get(request));
 }
 async function authenticate(env,request,verify){
  let scopes=identities.get(request);if(!scopes){scopes=new WeakMap();identities.set(request,scopes);}
  if(!scopes.has(env))scopes.set(env,Promise.resolve().then(()=>verify(env,request)));
  return clone(await scopes.get(env));
 }
 function seed(env,request,auth,body){
  let scopes=identities.get(request);if(!scopes){scopes=new WeakMap();identities.set(request,scopes);}
  scopes.set(env,Promise.resolve(clone(auth)));bodies.set(request,Promise.resolve(clone(body)));
  internalEnvironments.add(env);
 }
 function identify(path,method){
  if(path==='/superadmin/territory/action-status'&&method==='GET')return {kind:'status'};
  if(path==='/superadmin/territory/rebuild-cache'&&method==='POST')return {kind:'rebuild'};
  const create=path.match(/^\/superadmin\/(countries|provinces|cities)\/create$/);
  if(create&&method==='POST')return {kind:create[1],id:''};
  const edit=path.match(/^\/superadmin\/(countries|provinces|cities)\/([^/]+)$/);
  if(edit&&method==='PATCH')return {kind:edit[1],id:decodeURIComponent(edit[2])};
  return null;
 }
 const definition={countries:{collection:'paises',field:'paises',id:'pais_id'},provinces:{collection:'provincias',field:'provincias',id:'provincia_id'},cities:{collection:'ciudades',field:'ciudades',id:'ciudad_id'}};
 async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(value))))),v=>v.toString(16).padStart(2,'0')).join('');}
 function resources(env,command){
  const report={event:'gld_action138',worker_version:'138',request_id:crypto.randomUUID(),started_at:new Date().toISOString(),path:command.path,method:command.method,operations:{},status:500};
  const scoped=requestCache121(observeKv117(env,report),report,false);
  return {env:scoped,db:observeDbV41(createDb(scoped),report),cache:createCache(scoped),report};
 }
 async function prepare(command,packets,resources,resolved){
  const spec=identify(command.path,command.method);if(!spec)throw Error('Invalid territorial action');
  const request=new Request('https://territory-actions.internal'+command.path,{method:command.method,headers:{'Content-Type':'application/json'},body:JSON.stringify(command.body)});
  seed(resources.env,request,command.auth,command.body);
  const writes=[],lists={},updates=new Map();
  const db={
   async patch(collection,id,patch){
    const def=Object.values(definition).find(d=>d.collection===collection);
    if(!def)throw Error('Unsupported territorial collection');
    const before=(packets.admin?.[def.field]||[]).find(row=>String(row[def.id]||row.id)===String(id))||null;
    const isChanged=changed(before,patch,['actualizado_en']);
    const candidate=isChanged?{...before,id:String(id),...patch}:clone(before);
    if(isChanged)writes.push({collection,id:String(id),patch:clone(patch),before:clone(before)});
    return resolved?.[collection+'/'+id]||candidate;
   },
   async listCollection(collection){
    const value=resolved?.lists?.[collection]||await resources.db.listCollection(collection);
    lists[collection]=value;return clone(value);
   }
  };
  const cache={async get(key){if(key===ADMIN_KEY)return clone(packets.admin);if(key===PUBLIC_KEY)return clone(packets.public);throw Error('Unexpected territorial cache dependency');},async put(key,value){updates.set(key,clone(value));}};
  const args={env:resources.env,request,db,cache,idFromPath:spec.id||''};
  const fn=spec.kind==='rebuild'?rebuildTerritory:spec.kind==='countries'?saveCountry:spec.kind==='provinces'?saveProvince:saveCity;
  const response=await fn(args),result=await response.json();
  if(response.status>=400)return {status:response.status,result,writes:[],updates:[],lists};
  // Rebuilding explicitly still scans Firestore, but does not rewrite equal packets.
  const comparable=p=>p?Object.fromEntries(Object.entries(p).filter(([key])=>key!=='updated_at')):p;
  const changedPackets=[...updates].filter(([key,value])=>!equal(comparable(key===ADMIN_KEY?packets.admin:packets.public),comparable(value)));
  const noop=!writes.length&&(!changedPackets.length||spec.kind!=='rebuild');
  return {status:response.status,result:{...result,updated:!noop},writes,updates:noop?[]:changedPackets,lists};
 }
 const territoryAdapter={
  identify,prepare,
  keys:()=>({admin:ADMIN_KEY,public:PUBLIC_KEY}),
  authorize:auth=>auth?.ok===true&&['SUPERADMIN_PRINCIPAL','SUPERADMIN'].includes(auth.rol),
  async bootstrap(command,res){
   const admin=await res.cache.get(ADMIN_KEY),pub=await res.cache.get(PUBLIC_KEY);
   if((!admin||!pub)&&identify(command.path,command.method)?.kind!=='rebuild')throw Object.assign(Error('Catálogo territorial no inicializado. Reconstruí el catálogo desde administración.'),{status:503});
   return {admin:admin||packet(null),public:pub||packet(null)};
  }
 };
 class Coordinator {
  constructor(state,env,adapter=territoryAdapter){
   this.state=state;this.env=env;this.adapter=adapter;this.snapshot=null;this.tail=Promise.resolve();this.markerKnown=false;
   state.storage.sql.exec('CREATE TABLE IF NOT EXISTS shared_action138 (slot INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  }
  query(sql,...args){try{const cursor=this.state.storage.sql.exec(sql,...args),rows=[...cursor];this.metrics.rows_read+=cursor.rowsRead||0;this.metrics.rows_written+=cursor.rowsWritten||0;return rows;}catch(error){this.metrics.sql_failures=(this.metrics.sql_failures||0)+1;throw error;}}
  measured(){return this.metrics.sql_failures?{...this.metrics,rows_read:null,rows_written:null}:this.metrics;}
  async load(command,res){
   if(!this.snapshot){const row=this.query('SELECT value FROM shared_action138 WHERE slot=1')[0];this.markerKnown=!!row;this.snapshot=row?JSON.parse(row.value):{version:138,packets:null,pending:null,receipts:[]};}
   if(!this.snapshot.packets){
    this.snapshot={...this.snapshot,packets:await this.adapter.bootstrap(command,res)};
   }
   return this.snapshot;
  }
  encode(next){
   const value=JSON.stringify(next);
   if(new TextEncoder().encode(value).byteLength>1800000)throw Object.assign(Error('La operación territorial supera el tamaño seguro de recuperación. No se aplicó una publicación incompleta.'),{status:503});
   return value;
  }
  persist(next){
   const value=this.encode(next);
   this.query('INSERT INTO shared_action138(slot,value) VALUES(1,?) ON CONFLICT(slot) DO UPDATE SET value=excluded.value',value);
   this.snapshot=clone(next);
  }
  async schedule(){await this.state.storage.setAlarm(Date.now()+60000);this.metrics.alarm_set_calls++;this.metrics.rows_written++;}
  async mark(){if(!this.markerKnown){await this.state.storage.put('guide-intent-v132',{action_kind138:true,pending:null,receipts:[]});this.metrics.marker_put_calls=(this.metrics.marker_put_calls||0)+1;this.metrics.rows_written++;this.markerKnown=true;}}
  async cancel(){try{await this.state.storage.deleteAlarm();this.metrics.alarm_cancel_calls++;}catch{this.metrics.alarm_cancel_failures=(this.metrics.alarm_cancel_failures||0)+1;}}
  publication(job,ready){
   const packets={...this.snapshot.packets};
   for(const [key,value]of ready.updates){const slot=Object.entries(this.adapter.keys()).find(([,cacheKey])=>cacheKey===key)?.[0];if(!slot)throw Error('Unexpected publication slot');packets[slot]=value;}
   return {...this.snapshot,packets,pending:{command:job.command,phase:'publish',ready:{status:ready.status,result:ready.result,keys:ready.updates.map(([key])=>key)},index:0,attempts:job.attempts||0}};
  }
  async resume(res,recovering){
   let job=this.snapshot.pending;if(!job)return null;
   if(job.phase==='source'){
    const saved={};
    for(const write of job.plan.writes){
     let row=null,options={};
     if(recovering){
      const current=await res.db.getVersioned(write.collection,write.id);
      if(current.doc&&!changed(current.doc,write.patch))row=current.doc;
      else{
       if(current.doc&&(!write.before||Object.keys(write.patch).some(key=>key!=='actualizado_en'&&!equal(current.doc[key],write.before[key])&&!equal(current.doc[key],write.patch[key]))))throw Object.assign(Error('El registro cambió durante la recuperación. Se conserva la operación para revisión; no se sobrescribieron datos nuevos.'),{status:409});
       options=current.doc?{updateTime:current.updateTime}:{mustNotExist:true};
      }
     }
     if(!row)row=await res.db.patch(write.collection,write.id,write.patch,options);
     saved[write.collection+'/'+write.id]=row;
    }
    saved.lists=job.plan.lists;
    const ready=job.plan.writes.length?await this.adapter.prepare(job.command,this.snapshot.packets,res,saved):job.plan;
    if(ready.status>=400)throw Error('Territorial publication could not be prepared');
    this.persist(this.publication(job,ready));
   }
   job=this.snapshot.pending;
   while(job.index<job.ready.keys.length){
    const key=job.ready.keys[job.index],slot=Object.entries(this.adapter.keys()).find(([,cacheKey])=>cacheKey===key)?.[0],value=this.snapshot.packets[slot];
    // Only recovery checks an ambiguous publication; ordinary saves do not add reads.
    if(!recovering||!equal(await res.cache.get(key),value))await res.cache.put(key,value);
    job={...job,index:job.index+1};
    if(job.index<job.ready.keys.length)this.persist({...this.snapshot,pending:job});
   }
   const now=Date.now(),receipts=(this.snapshot.receipts||[]).filter(r=>now-r.at<86400000&&r.key!==job.command.key);
   if(job.command.key)receipts.push({key:job.command.key,fingerprint:job.command.fingerprint,at:now,status:job.ready.status,result:job.ready.result});
   while(receipts.length>32||new TextEncoder().encode(JSON.stringify(receipts)).byteLength>48000)receipts.shift();
   this.persist({...this.snapshot,pending:null,receipts});
   // State is complete before cancellation; a stray alarm cannot repeat the save.
   await this.cancel();
   return {status:job.ready.status,result:job.ready.result};
  }
  async execute(command,res){
   if(this.adapter.identify(command.path,command.method)?.kind==='status'){
    if(!this.snapshot){const row=this.query('SELECT value FROM shared_action138 WHERE slot=1')[0];this.markerKnown=!!row;this.snapshot=row?JSON.parse(row.value):{version:138,packets:null,pending:null,receipts:[]};}
    const job=this.snapshot.pending;
    return {status:200,result:{success:true,coordinator_version:138,safe_to_restore_previous_worker:!job,pending:job?{path:job.command.path,phase:job.phase,attempts:job.attempts||0}:null}};
   }
   await this.load(command,res);
   if(this.snapshot.pending)await this.resume(res,true);
   if(command.key){const prior=this.snapshot.receipts.find(r=>r.key===command.key&&Date.now()-r.at<86400000);if(prior){if(prior.fingerprint!==command.fingerprint)return {status:409,result:{success:false,message:'Ese identificador ya se usó para otra operación.'}};return {status:prior.status,result:{...prior.result,operation_replayed:true}};}}
   const plan=await this.adapter.prepare(command,this.snapshot.packets,res);
   if(plan.status>=400||!plan.writes.length&&!plan.updates.length)return {status:plan.status,result:plan.result};
   const job={command,plan:{...plan,updates:undefined},phase:'source',attempts:0};
   // Check both durable representations before the first source-side effect.
   this.encode(this.publication(job,plan));
   await this.mark();
   this.persist(plan.writes.length?{...this.snapshot,pending:job}:this.publication(job,plan));
   await this.schedule();
   return this.resume(res,false);
  }
  async serialized(fn){const previous=this.tail;let release;this.tail=new Promise(resolve=>{release=resolve;});await previous;try{return await fn();}finally{release();}}
  async fetch(request,parsedBody){return this.serialized(async()=>{
   this.metrics={rows_read:0,rows_written:0,alarm_set_calls:0,alarm_cancel_calls:0};
   let res;
   try{
    const body=parsedBody||await request.json(),command=body.command;
    if(!command||!this.adapter.identify(command.path,command.method)||!this.adapter.authorize(command.auth))throw Object.assign(Error('Acción territorial no autorizada.'),{status:403});
    res=resources(this.env,command);
    const outcome=await this.execute(command,res);res.report.status=outcome.status;
    const publications=identify(command.path,command.method)?.kind==='rebuild'?{[ADMIN_KEY]:this.snapshot.packets.admin,[PUBLIC_KEY]:this.snapshot.packets.public}:undefined;
    return Response.json({...outcome,publications,metrics:this.measured(),operations:res.report.operations,kv:res.report.kv});
   }catch(error){
    const status=[400,401,403,409,503].includes(error.status)?error.status:503;
    if(res)res.report.status=status;
    return Response.json({status,result:{success:false,message:String(error.message||error),...(this.snapshot?.pending?{code:'TERRITORY_SYNC_PENDING',operation_pending:true}:{})},metrics:this.measured(),operations:res?.report.operations||{},kv:res?.report.kv||null});
   }
  });}
  async alarm(markerReads=0){return this.serialized(async()=>{
   this.metrics={rows_read:markerReads,rows_written:0,alarm_set_calls:0,alarm_cancel_calls:0,marker_get_calls:markerReads};this.markerKnown=true;
   if(!this.snapshot){const row=this.query('SELECT value FROM shared_action138 WHERE slot=1')[0];this.snapshot=row?JSON.parse(row.value):null;}
   if(!this.snapshot?.pending)return;
   const res=resources(this.env,this.snapshot.pending.command);
   try{await this.resume(res,true);res.report.status=200;}
   catch(error){
    const pending={...this.snapshot.pending,attempts:(this.snapshot.pending.attempts||0)+1};
    this.persist({...this.snapshot,pending});
    if(pending.attempts<6&&error.status!==409){await this.state.storage.setAlarm(Date.now()+Math.min(3600000,60000*2**pending.attempts));this.metrics.alarm_set_calls++;this.metrics.rows_written++;}
    res.report.status=503;res.report.error=String(error.message||error);
   }finally{
    res.report.action_store138={calls:1,...this.measured()};
    res.report.consumption=consumption136(res.report);res.report.consumption.cloudflare.worker_requests=0;
    console.log(JSON.stringify(finishObservationV42(res.report)));
   }
  });}
 }
 async function route(ctx,report){
  if(!identify(ctx.path,ctx.request.method))return null;
  const auth=await verifyAdmin(ctx.env,ctx.request);
  if(!auth.ok)return json({success:false,message:auth.message},401);
  if(!['SUPERADMIN_PRINCIPAL','SUPERADMIN'].includes(auth.rol))return json({success:false,message:'El acceso de moderador está limitado a las publicaciones y ciudades asignadas.'},403);
  if(!ctx.env.GLD_PUBLIC_CACHE)return json({success:false,message:'No está disponible el coordinador territorial. No se guardaron cambios.'},503);
  const body=ctx.request.method==='GET'?{}:await readJson(ctx.request).catch(()=>({})),rawKey=ctx.request.headers.get('Idempotency-Key')||'';
  if(rawKey&&!/^[A-Za-z0-9:_-]{1,100}$/.test(rawKey))return json({success:false,message:'Identificador de operación inválido.'},400);
  const command={path:ctx.path,method:ctx.request.method,body,auth,key:rawKey?auth.sid+':'+rawKey:'',fingerprint:await hash({path:ctx.path,method:ctx.request.method,body})};
  const stub=ctx.env.GLD_PUBLIC_CACHE.get(ctx.env.GLD_PUBLIC_CACHE.idFromName(actorName));
  report.action_store138={calls:1,rows_read:null,rows_written:null,alarm_set_calls:null,alarm_cancel_calls:null};
  const response=await stub.fetch(new Request('https://territory-actions.internal/',{method:'POST',body:JSON.stringify({op:'shared-action138',command})}));
  const outcome=await response.json();
  if(!Number.isInteger(outcome.status)||!outcome.result)throw Error('Respuesta inválida del coordinador territorial');
  for(const [key,stat]of Object.entries(outcome.operations||{})){
   const target=report.operations[key]??={operation:stat.operation,collection:stat.collection,field:stat.field||'',calls:0,documents_returned:0,failures:0};
   for(const field of ['calls','documents_returned','failures'])target[field]+=Number(stat[field]||0);
  }
  if(outcome.kv)for(const field of ['get_calls','put_calls','delete_calls','list_calls','failures'])report.kv[field]+=Number(outcome.kv[field]||0);
  if(outcome.kv?.write_groups)for(const [group,count]of Object.entries(outcome.kv.write_groups))report.kv.write_groups[group]=(report.kv.write_groups[group]||0)+count;
  report.action_store138={calls:1,...outcome.metrics};
  if(ctx.env.__gldPrimeCache138)for(const [key,value]of Object.entries(outcome.publications||{}))if([ADMIN_KEY,PUBLIC_KEY].includes(key))ctx.env.__gldPrimeCache138(key,JSON.stringify(value));
  return json(outcome.result,outcome.status);
 }
 return {readJson,authenticate,changed,equal,actorName,Coordinator,route,isInternal:env=>internalEnvironments.has(env)};
})();
