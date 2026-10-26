import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker,{GldPublicCache119} from '../guia/worker-instrumentado.mjs';
import fs from 'node:fs';
import {sqliteNamespace} from './namespace.mjs';
const rows=new Map(),values=new Map(),calls=[],allOperations=[];let revision=0;
const nativePush=calls.push.bind(calls);calls.push=(...entries)=>{allOperations.push(...entries);return nativePush(...entries);};
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SERVER_SECRET:'test-only',FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@test.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}};
function seed(c,id,data){rows.set(c+'/'+id,{id,...data});}
function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};return {stringValue:String(v)};}
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return v.arrayValue.values.map(decode);if('nullValue'in v)return null;return v.stringValue??v.booleanValue??Number(v.integerValue);}
function doc(c,id,data){return {updateTime:data._version||'2026-10-12T12:00:00.000000Z',name:'projects/test/databases/(default)/documents/'+c+'/'+id,fields:Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id').map(([k,v])=>[k,encode(v)]))};}
seed('suscriptores','S',{mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true,tipo_usuario:'RESIDENTE',ciudad_origen_otro:'Córdoba'});
seed('suscriptor_anunciante','R',{suscriptor_id:'S',anunciante_id:'A',anunciante_nombre:'Comercio',rol:'PROPIETARIO',permisos:'TURNOS_FARMA,PROMOS,EVENTOS,EVENTOS_FREE,ACTIVIDADES,EFEMERIDES',activo:true});
seed('anunciantes_administracion','A',{funcionalidades:'PUBLICIDAD,FARMACIAS',turnos_farma:'*',funcionalidades_config:{PUBLICIDAD:{activas_max:3,guardadas_max:6,cambios_activos_por_dia_max:5}}});
seed('publicidades','P',{anunciante_id:'A',publicidad_id:'P',titulo:'Anuncio',estado:'INACTIVA',aprobado:true,formato:'IMAGEN'});
seed('publicidad_media','M',{publicidad_id:'P',media_id:'M',url:'imagen.jpg',tipo_media:'IMAGEN',activo:true,orden:1});
seed('publicidad_segmentacion','G',{publicidad_id:'P',segmentacion_id:'G',ciudad_id:'D',ubicacion_id:'U',categoria_id:'CAT',activo:true});
seed('anunciantes_sedes','SED',{anunciante_id:'A',ciudad_id:'D',sede_id:'SED'});
seed('farmacias_ciclos','C',{anunciante_id:'A',ciclo_id:'C',nombre:'Ciclo',ciudad_id:'D',fecha_inicio:'2026-10-07',hora_inicio:'08:00',duracion_horas:24,farmacias_por_turno:1,activo:true});
seed('farmacias_ciclo_sedes','F',{ciclo_id:'C',sede_id:'SED'});
values.set('territorio:public:v1',JSON.stringify({version:1,ciudades:[{ciudad_id:'D',ciudad_visible:'DOLORES'}]}));
values.set('catalogs:publicidad:v1',JSON.stringify({categorias:[{categoria_id:'CAT'}],ubicaciones:[{ubicacion_id:'U',modulo:'GUIA'}]}));
values.set('farmacias:city:v2:D',JSON.stringify({turnos:[]}));
values.set('publicity:city:v2:D',JSON.stringify({publicidades:[{...rows.get('publicidades/P'),estado:'ACTIVA',media:[rows.get('publicidad_media/M')],segmentacion:[rows.get('publicidad_segmentacion/G')]}]}));
values.set('guide:city:v1:D',JSON.stringify({anunciantes:[{id:'A',nombre:'Farmacia Test',ciudad_id:'D',sedes:[{sede_id:'SED',ciudad_id:'D',estado:'ACTIVA'}]}]}));
values.set('admin:catalogs:v2',JSON.stringify({moderacion_18:[]}));
const original=globalThis.fetch;
const savedLog=console.log;const logRows=[];console.log=(...args)=>{if(String(args[0]).startsWith('{')){try{logRows.push(JSON.parse(args[0]))}catch{}}else savedLog(...args)};
globalThis.fetch=async(url,options={})=>{
 const u=new URL(String(url));if(u.host==='oauth2.googleapis.com')return Response.json({access_token:'test',expires_in:3600});assert.equal(u.host,'firestore.googleapis.com');
 const body=options.body?JSON.parse(options.body):null;
 if(u.pathname.endsWith(':batchGet')){return Response.json(body.documents.map(name=>{const path=name.split('/documents/')[1],[c,id]=path.split('/'),row=rows.get(path);calls.push({op:'GET',c,id});const readTime='2026-10-12T12:00:00.'+String(++revision).padStart(6,'0')+'Z';return row?{found:doc(c,id,row),readTime}:{missing:name,readTime};}));}
 if(u.pathname.endsWith(':commit')){
  for(const w of body.writes){const name=w.delete||w.update.name;const path=name.split('/documents/')[1];const current=rows.get(path);const pre=w.currentDocument;
   if(pre?.exists===false&&current||pre?.exists===true&&!current||pre?.updateTime&&pre.updateTime!==(current?._version||'2026-10-12T12:00:00.000000Z'))return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:409});
  }
  for(const w of body.writes){const name=w.delete||w.update.name;const path=name.split('/documents/')[1];const [c,id]=path.split('/');calls.push({op:w.delete?'DELETE':'PATCH',c,id});if(w.delete){revision++;rows.delete(path);continue;}const patch=Object.fromEntries(Object.entries(w.update.fields).map(([k,v])=>[k,decode(v)]));seed(c,id,{...rows.get(path),...patch,_version:'2026-10-12T12:00:00.'+String(++revision).padStart(6,'0')+'Z'});}
  return Response.json({writeResults:body.writes.map(()=>({updateTime:'2026-10-12T12:00:00.'+String(revision).padStart(6,'0')+'Z'}))});
 }
 if(u.pathname.endsWith(':runQuery')){const q=body.structuredQuery,c=q.from[0].collectionId;const f=q.where.fieldFilter;calls.push({op:'query',c});return Response.json([...rows.entries()].filter(([key,row])=>key.startsWith(c+'/')&&(f.op==='ARRAY_CONTAINS'?Array.isArray(row[f.field.fieldPath])&&row[f.field.fieldPath].includes(decode(f.value)):row[f.field.fieldPath]===decode(f.value))).slice(0,q.limit).map(([key,row])=>({document:doc(c,key.split('/')[1],row)})));}
 const path=u.pathname.split('/documents/')[1], [c,id]=path.split('/').map(decodeURIComponent);const method=options.method||'GET';calls.push({op:method,c,id});
 if(method==='GET'&&!id)return Response.json({documents:[...rows.entries()].filter(([key])=>key.startsWith(c+'/')).map(([key,row])=>doc(c,key.split('/')[1],row))});
 if(method==='PATCH'){if(u.searchParams.has('currentDocument.updateTime')&&u.searchParams.get('currentDocument.updateTime')!==(rows.get(c+'/'+id)._version||'2026-10-12T12:00:00.000000Z'))return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:409});if(u.searchParams.get('currentDocument.exists')==='false'&&rows.has(c+'/'+id))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});const patch=Object.fromEntries(Object.entries(body.fields).map(([k,v])=>[k,decode(v)]));if(patch.vinculos_ciudades&&[...u.searchParams.getAll('updateMask.fieldPaths')].some(x=>x.startsWith('vinculos_ciudades.')))patch.vinculos_ciudades={...rows.get(c+'/'+id)?.vinculos_ciudades,...patch.vinculos_ciudades};seed(c,id,{...rows.get(c+'/'+id),...patch,_version:'2026-10-12T12:00:00.'+String(++revision).padStart(6,'0')+'Z'});return Response.json(doc(c,id,rows.get(c+'/'+id)));}
 if(method==='DELETE'){rows.delete(c+'/'+id);return new Response(null,{status:200});}
 const row=rows.get(c+'/'+id);return row?Response.json(doc(c,id,row)):Response.json({error:{message:'not found'}},{status:404});
};

seed('anunciantes','A',{anunciante_id:'A',nombre:'Comercio',ciudad_ids:['D']});
values.set('catalogs:publicidad:v1',JSON.stringify({categorias:[{categoria_id:'CAT',ubicacion_id:'U',nombre:'Deportes'}],ubicaciones:[{ubicacion_id:'U',modulo:'GUIA',nombre:'Guía'}]}));
let token='';
async function call(path,body){calls.length=0;const r=await worker.fetch(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({...body,declaracion_publicacion:{aceptada:true,version:'2026-10-10'}})}:{})}),env);return {r,j:await r.json(),calls:[...calls]};}
env.GLD_PUBLIC_CACHE=sqliteNamespace(env,GldPublicCache119);
const reports=[],measures=[],physical={get:0,put:0,delete:0,list:0};
globalThis.__circuitCapture=r=>reports.push(structuredClone(r));
for(const method of Object.keys(physical)){const original=env.GLD_CACHE_KV[method].bind(env.GLD_CACHE_KV);env.GLD_CACHE_KV[method]=async(...args)=>{physical[method]++;return original(...args);};}
env.GLD_PUBLIC_CACHE_MIGRATION='source-bootstrap';
const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url');};
const adminToken=sign({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:0});let ownerToken='';
const roles={admin:()=>adminToken,owner:()=>ownerToken,public:()=>''};
async function as(role,path,body){token=roles[role]();return call(path,body);}
async function ok(role,path,body){const x=await as(role,path,body);assert.equal(x.r.status,200,path+': '+JSON.stringify(x.j));assert.notEqual(x.j.success,false,path+': '+JSON.stringify(x.j));return x;}
async function stage(module,action,work){
 const start=reports.length,k={...physical},sql={...env.GLD_PUBLIC_CACHE.counts};
 try{await work();}catch(error){measures.push({module,action,passed:false,error:String(error.message)});throw error;}
 const current=reports.slice(start),sum=f=>current.reduce((n,r)=>n+(r.totals?.[f]||0),0);
 const measure={module,action,passed:true,requests:current.filter(r=>r.source!=='guide-dispatch').length,guide_dispatches:current.filter(r=>r.source==='guide-dispatch').length,firestore:{read_calls:sum('read_calls'),documents_returned:sum('documents_returned'),writes:sum('write_calls'),deletes:sum('delete_calls')},cloudflare:{kv:Object.fromEntries(Object.keys(k).map(f=>[f,physical[f]-k[f]])),sql:{calls:env.GLD_PUBLIC_CACHE.counts.calls-sql.calls,rows_read:env.GLD_PUBLIC_CACHE.counts.read-sql.read,rows_written:env.GLD_PUBLIC_CACHE.counts.written-sql.written}}};
 measures.push(measure);fs.writeFileSync('circuits128/circuits.json',JSON.stringify(measures,null,2));
}
async function listed(kind,id){const x=await ok('admin','/superadmin/listados?tipo='+kind);return x.j.results.find(r=>r.id===id);}
async function publicRow(def,id){const x=await ok('public',def.public);return (x.j[def.publicField]||[]).find(r=>String(r[def.id]||r.id)===id);}
async function privateRow(def,id){const x=await ok('owner',def.panel,def.panelBody);return (x.j[def.field]||[]).find(r=>String(r[def.id]||r.id)===id);}
async function cross(def,id,{visible=true,present=true,title}={}){
 const p=await privateRow(def,id),g=await listed(def.kind,id),u=await publicRow(def,id);
 assert.equal(!!p,present,def.name+' advertiser presence');assert.equal(!!g,present,def.name+' GH presence');assert.equal(!!u,visible,def.name+' public visibility');
 if(title&&p){assert.equal(p[def.title],title);assert.equal(u?.[def.title],title);assert(JSON.stringify(g).includes(title));}
}




const makeKey=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let broken='';const put=env.GLD_CACHE_KV.put.bind(env.GLD_CACHE_KV);env.GLD_CACHE_KV.put=async(key,...args)=>{if(broken&&key.startsWith(broken))throw Error('KV put() limit exceeded for the day.');return put(key,...args)};
const sourceWrites=()=>allOperations.filter(x=>['PATCH','DELETE'].includes(x.op)).length;
try{
 seed('anunciantes_administracion','A',{nivel:4,aprobado:true,gold:true,funcionalidades:'PUBLICIDAD,PROMOS,MODIFICAR',promos_cant:3,funcionalidades_config:{PUBLICIDAD:{activas_max:3},PROMOS:{activas_max:3}}});
 values.set('catalogs:promos:v1',JSON.stringify({categorias:[{categoria_id:'PC',nombre:'Ofertas'}]}));
 await ok('admin','/superadmin/guide/rebuild-cache',{});
 let before=(await ok('admin','/superadmin/advertisers/A')).j;
 let result=await ok('admin','/superadmin/advertisers/A/commercial',{revision_comercial:before.revision_comercial,gold:true});
 assert.equal(result.j.updated,false);assert.equal(result.j.firestore_writes,0);assert.equal(result.calls.filter(x=>x.op==='PATCH').length,0);console.log('PASS commercial equivalent save causes no source write');
 broken='publicity:contract:v101:';
 result=await as('admin','/superadmin/advertisers/A/commercial',{revision_comercial:before.revision_comercial,funcionalidades_config:{PUBLICIDAD:{activas_max:2},PROMOS:{activas_max:3}}});
 assert.equal(result.r.status,503);assert.equal(rows.get('anunciantes_administracion/A').funcionalidades_config.PUBLICIDAD.activas_max,2);
 const wrote=sourceWrites();env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');broken='';await env.GLD_PUBLIC_CACHE.runAlarms();assert.equal(sourceWrites(),wrote);assert.equal(JSON.parse(values.get('publicity:contract:v101:A')).activas_max,2);console.log('PASS commercial contract recovered from committed source after actor restart, no repeated source mutation');
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'})).j.token;
 const pubKey=makeKey(1),pubId='PUB-'+pubKey;
 const publication={action:'guardar',advertiserId:'A',request_key:pubKey,payload:{titulo:'Publicidad nueva',nombre_interno:'Biblioteca',formato:'IMAGEN',ciudades:['D'],categorias:['U:CAT'],media:[{url:'https://example.invalid/ad.jpg'}]}};
 broken='publicity:private:v101:';result=await as('owner','/publicidad',publication);assert.equal(result.r.status,503,JSON.stringify(result.j));assert.equal(result.j.code,'PUBLICATION_SYNC_PENDING');assert(rows.has('publicidades/'+pubId));
 const pubWrites=sourceWrites();env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');broken='';await env.GLD_PUBLIC_CACHE.runAlarms();assert.equal(sourceWrites(),pubWrites);result=await ok('owner','/publicidad',publication);assert(result.j.operation_recovered);assert.equal(sourceWrites(),pubWrites);assert.equal(result.j.publicidad_id,pubId);
 const shown=(await ok('public','/publicidad?action=publicas&ciudad_id=D&modulo=GUIA')).j.publicidades;assert(shown.some(p=>p.publicidad_id===pubId));console.log('PASS Publicidad source/state commit survives publication failure, restart and replay without duplicate save');
 const collision=await as('owner','/publicidad',{...publication,payload:{...publication.payload,titulo:'Otro cambio'}});assert.equal(collision.r.status,409);console.log('PASS reused operation key with different content is rejected');
 const promoBody={action:'createpromo',advertiserId:'A',operation_id:makeKey(2),payload:{promo:'Promo nueva',ciudad_id:'D',categoria_id:'PC',desde:'2026-10-01',hasta:'2030-10-31'}};
 broken='admin:promos:item:v91:';result=await as('owner','/promos',promoBody);assert.equal(result.r.status,503,JSON.stringify(result.j));const promo=[...rows.values()].find(p=>p.promo==='Promo nueva');assert(promo);
 const promoWrites=sourceWrites();env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');broken='';await env.GLD_PUBLIC_CACHE.runAlarms();assert.equal(sourceWrites(),promoWrites);result=await ok('owner','/promos',promoBody);assert(result.j.operation_recovered);assert.equal(sourceWrites(),promoWrites);assert.equal(result.j.promo_id,promo.promo_id);console.log('PASS Promos create publishes committed source after restart and retry does not create another promo');
 broken='admin:promos:item:v91:';const remove={action:'deletepromo',advertiserId:'A',operation_id:makeKey(3),payload:{promo_id:promo.promo_id}};result=await as('owner','/promos',remove);assert.equal(result.r.status,503);assert(!rows.has('promos/'+promo.promo_id));const deletedWrites=sourceWrites();broken='';env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');await env.GLD_PUBLIC_CACHE.runAlarms();result=await ok('owner','/promos',remove);assert(result.j.operation_recovered);assert.equal(sourceWrites(),deletedWrites);assert(!(await ok('public','/promos?ciudad_id=D')).j.promos.some(p=>p.promo_id===promo.promo_id));console.log('PASS Promos delete recovery removes old-city projection without repeating source delete');
 broken='publicity:private:v101:';const removeOld={action:'eliminar',advertiserId:'A',operation_id:makeKey(4),publicidad_id:'P'};result=await as('owner','/publicidad',removeOld);assert.equal(result.r.status,503,JSON.stringify(result.j));assert(!rows.has('publicidades/P'));broken='';env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');await env.GLD_PUBLIC_CACHE.runAlarms();result=await ok('owner','/publicidad',removeOld);assert(result.j.operation_recovered);assert(!(await ok('public','/publicidad?action=publicas&ciudad_id=D&modulo=GUIA')).j.publicidades.some(p=>p.publicidad_id==='P'));console.log('PASS legacy Publicidad deletion preserves old segmentation for recovery');

 // Permission checks remain outside replay, including a formerly valid receipt.
 const countBeforeUnauthorized=sourceWrites();token='';let denied=await call('/publicidad',publication);assert.equal(denied.r.status,401);assert.equal(sourceWrites(),countBeforeUnauthorized);console.log('PASS unauthenticated replay cannot read receipt or mutate source');
 // Automatic recovery is bounded and retains its durable job; a later request resumes it.
 seed('promos','BUDGET',{promo_id:'BUDGET',anunciante_id:'A',promo:'Budget',ciudad_id:'D',categoria_id:'PC',pausado:false});
 const budget={action:'updatepromo',advertiserId:'A',operation_id:makeKey(5),payload:{promo_id:'BUDGET',promo:'Budget cambiado'}};
 broken='admin:promos:item:v91:';result=await as('owner','/promos',budget);assert.equal(result.r.status,503);const budgetWrites=sourceWrites();
 const blockedCommercial=await as('admin','/superadmin/advertisers/A/commercial',{revision_comercial:'0'.repeat(64),gold:false});assert.equal(blockedCommercial.r.status,503);assert.equal(blockedCommercial.j.previous_operation_pending,true);assert.equal(sourceWrites(),budgetWrites);assert.equal(await env.GLD_PUBLIC_CACHE.job('guide-save-v132:A'),undefined);
 for(let i=0;i<7;i++)await env.GLD_PUBLIC_CACHE.runAlarms();assert.equal(sourceWrites(),budgetWrites);assert((await env.GLD_PUBLIC_CACHE.businessJob('guide-save-v132:A')).attempts>=6);assert.equal(await env.GLD_PUBLIC_CACHE.alarmAt('guide-save-v132:A'),null);
 broken='';result=await ok('owner','/promos',budget);assert(result.j.operation_recovered);assert.equal(sourceWrites(),budgetWrites);console.log('PASS quota exhaustion stops automatic attempts at six, retains intent and resumes without source rewrite');
 const normalCreate={action:'createpromo',advertiserId:'A',operation_id:makeKey(6),payload:{promo:'Source no aplicado',ciudad_id:'D',categoria_id:'PC'}};
 const mockFetch=globalThis.fetch;globalThis.fetch=async(url,options={})=>options.method==='PATCH'&&String(url).includes('/documents/promos/')?Response.json({error:{message:'Injected source failure'}},{status:503}):mockFetch(url,options);
 result=await as('owner','/promos',normalCreate);assert.equal(result.r.status,503);globalThis.fetch=mockFetch;const beforeRecovery=sourceWrites();await env.GLD_PUBLIC_CACHE.runAlarms();result=await as('owner','/promos',normalCreate);assert.equal(result.r.status,409);assert.equal(result.j.code,'PUBLICATION_OPERATION_REVIEW');assert.equal(sourceWrites(),beforeRecovery);assert(!rows.has('promos/PRO-'+makeKey(6)));console.log('PASS failed source is never replayed or reported as committed');

 const adminDelete={action:'borrar',promo_id:'BUDGET',advertiserId:'A',operation_id:makeKey(7)};
 broken='admin:promos:item:v91:';result=await as('admin','/superadmin/promos',adminDelete);assert.equal(result.r.status,503);const adminDeletes=sourceWrites();broken='';env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');await env.GLD_PUBLIC_CACHE.runAlarms();result=await ok('admin','/superadmin/promos',adminDelete);assert.equal(result.j.deleted,true);assert.equal(sourceWrites(),adminDeletes);console.log('PASS Gran Hermano delete replay returns deleted status after source is already absent');
 const staleWrites=sourceWrites();result=await as('admin','/superadmin/advertisers/A/commercial',{revision_comercial:before.revision_comercial,gold:false});assert.equal(result.r.status,409);assert.equal(sourceWrites(),staleWrites);console.log('PASS stale commercial revision still rejects overwrite without source write');
 // Saved-packet reads survive instance eviction without rebuilding the entity list.
 for(const key of ['publicity:city:v2:D','promos:city:v1:D']){
  env.GLD_PUBLIC_CACHE.evict('public-city-v119:'+key);const path=key.startsWith('publicity')?'/publicidad?action=publicas&ciudad_id=D&modulo=GUIA':'/promos?ciudad_id=D';
  const out=await ok('public',path),meter=JSON.parse(decodeURIComponent(out.r.headers.get('X-GLD-Consumption')));assert(meter.cloudflare.public_store.components.some(c=>c.reads?.some(r=>r.source==='saved-packet')));assert.equal(meter.cloudflare.public_store.rows_written,0);assert.equal(meter.firestore.read_calls,0);
 }
 console.log('PASS Publicidad and Promos cold reads use saved packet without source reads or writes');


 const recentCreate={action:'createpromo',advertiserId:'A',operation_id:makeKey(8),payload:{promo:'Recientes',ciudad_id:'D',categoria_id:'PC'}};
 broken='publication:recent:';result=await as('owner','/promos',recentCreate);assert.equal(result.r.status,503);assert(rows.has('promos/PRO-'+makeKey(8)));const recentWrites=sourceWrites();broken='';env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');await env.GLD_PUBLIC_CACHE.runAlarms();result=await ok('owner','/promos',recentCreate);assert(result.j.operation_recovered);assert.equal(sourceWrites(),recentWrites);assert(values.has('publication:recent:latest:v77:promos:PRO-'+makeKey(8)));console.log('PASS failure before recent-publication copy also restores public projection and recent index without source rewrite');
 const beforeStatus={...physical},sourceBeforeStatus=sourceWrites();const status=await ok('admin','/superadmin/advertisers/A/recovery-status');assert.equal(status.j.business_pending,null);assert.equal(status.j.safe_to_restore_140_for_this_advertiser,true);assert.equal(sourceWrites(),sourceBeforeStatus);assert.equal(physical.put,beforeStatus.put);assert.equal(physical.delete,beforeStatus.delete);console.log('PASS scoped recovery status is read-only with no source or KV mutations');
 console.log('PASS business recovery suite');
}finally{globalThis.fetch=original;delete globalThis.__circuitCapture;console.log=savedLog;fs.mkdirSync('docs/evidencias',{recursive:true});fs.writeFileSync('docs/evidencias/publicidad143-local-recovery.json',JSON.stringify({environment:'LOCAL_NOT_PRODUCTION_BILLING',reports:logRows},null,2));}
