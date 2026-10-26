import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker,{GldPublicCache119} from '../guia/worker-instrumentado.mjs';
import fs from 'node:fs';
import {sqliteNamespace} from '../publicidad143/namespace.mjs';
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
 seed('anunciantes','A',{anunciante_id:'A',nombre:'Comercio',ciudad_id:'D',ciudad_ids:['D']});
 seed('anunciantes_administracion','A',{nivel:4,aprobado:true,funcionalidades:'EVENTOS,EVENTOS_FREE,MODIFICAR',eventos_cant:20,eventos_free_cant:2,funcionalidades_config:{EVENTOS:{cantidad:20},EVENTOS_FREE:{cantidad:2,sin_limites:false}}});
 values.set('territorio:public:v1',JSON.stringify({ciudades:[{ciudad_id:'D',provincia_id:'BA',pais_id:'ARG'},{ciudad_id:'E',provincia_id:'BA',pais_id:'ARG'},{ciudad_id:'F',provincia_id:'COR',pais_id:'ARG'},{ciudad_id:'B',provincia_id:'SP',pais_id:'BRA'}]}));
 values.set('catalogs:eventos:v1',JSON.stringify({categorias:['Cultura'],lugares:[],partners:[]}));
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'})).j.token;
 const event=(name,scope)=>({nombre_evento:name,categoria:'Cultura',ciudad_id:'VIRTUAL',modalidad:'VIRTUAL',tipo_lugar:'VIRTUAL',lugar:'Virtual',fecha_desde:'2027-02-23',fecha_hasta:'',url_virtual:'https://example.invalid/join',descripcion:'Evento de prueba local',acepta_responsabilidad:true,programacion:[],...(scope?{alcance_publicacion:scope}:{})});
 const visible=async(city,id)=>!!(await ok('public','/events-new?ciudad_id='+city)).j.events.find(e=>e.evento_id===id);
 const create=async(level,name,scope,key)=>ok('owner','/events-new',{action:level==='FREE'?'createFreeEvent':'createVipEvent',advertiserId:'A',payload:event(name,scope),operation_id:makeKey(key)});
 let created=await create('FREE','Ciudad predeterminada',null,1),id=created.j.evento_id;
 assert.equal(rows.get('eventos/'+id).alcance_publicacion.ciudad_id,'D');assert(await visible('D',id));assert(!await visible('B',id));
 let writes=sourceWrites();await create('FREE','Ciudad predeterminada',null,1);assert.equal(sourceWrites(),writes);console.log('PASS FREE default advertiser city and identified replay without source writes');
 const cityFreeId=id;
 for(const [mode,scope,yes,no,key]of [
  ['manual',{modo:'CIUDADES',ciudades:['D','B']},['D','B'],['E','F'],2],
  ['province',{modo:'PROVINCIA',provincia_id:'BA',pais_id:'ARG'},['D','E'],['F','B'],3],
  ['country',{modo:'PAIS',pais_id:'ARG'},['D','E','F'],['B'],4],
  ['global',{modo:'TODAS'},['D','E','F','B'],[],5]
 ]){
  const made=await create('VIP',mode,scope,key);for(const city of yes)assert(await visible(city,made.j.evento_id),mode+' '+city);for(const city of no)assert(!await visible(city,made.j.evento_id),mode+' '+city);console.log('PASS VIP '+mode+' scope');
 }
 writes=sourceWrites();const invalid=await as('owner','/events-new',{action:'createVipEvent',advertiserId:'A',payload:event('Invalid',{modo:'PROVINCIA',provincia_id:'BA',pais_id:'BRA'}),operation_id:makeKey(6)});assert.equal(invalid.r.status,400);assert.equal(sourceWrites(),writes);console.log('PASS invalid geographic combination rejected before writing');
 let result=await ok('owner','/events-new',{action:'updateFreeEvent',advertiserId:'A',payload:{evento_id:cityFreeId,alcance_publicacion:{modo:'TODAS'}},operation_id:makeKey(7)});assert(await visible('B',cityFreeId));
 writes=sourceWrites();result=await ok('owner','/events-new',{action:'updateFreeEvent',advertiserId:'A',payload:{evento_id:cityFreeId,alcance_publicacion:{modo:'TODAS',version:1}},operation_id:makeKey(8)});assert.equal(result.j.updated,false);assert.equal(sourceWrites(),writes);console.log('PASS scope change and canonical equivalent save with no source mutation');
 await ok('owner','/events-new',{action:'pauseFreeEvent',advertiserId:'A',payload:{evento_id:cityFreeId,pausado:true},operation_id:makeKey(9)});assert(!await visible('D',cityFreeId));
 await ok('owner','/events-new',{action:'pauseFreeEvent',advertiserId:'A',payload:{evento_id:cityFreeId,pausado:false},operation_id:makeKey(10)});assert(await visible('D',cityFreeId));console.log('PASS pause and resume preserve scope');
 // Interrupt after the authoritative write, before its recent/public copies.
 broken='publication:recent:v77:';
 result=await as('owner','/events-new',{action:'createVipEvent',advertiserId:'A',payload:event('Recover',{modo:'CIUDAD',ciudad_id:'E'}),operation_id:makeKey(11)});assert.equal(result.r.status,503,JSON.stringify(result.j));
 const recovered=[...rows.values()].find(r=>r.nombre_evento==='Recover');assert(recovered);writes=sourceWrites();
 env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');broken='';await env.GLD_PUBLIC_CACHE.runAlarms();assert.equal(sourceWrites(),writes);assert(await visible('E',recovered.evento_id));assert(!await visible('B',recovered.evento_id));
 result=await ok('owner','/events-new',{action:'createVipEvent',advertiserId:'A',payload:event('Recover',{modo:'CIUDAD',ciudad_id:'E'}),operation_id:makeKey(11)});assert(result.j.operation_recovered);assert.equal(sourceWrites(),writes);console.log('PASS source-to-public recovery after eviction and replay without repeated source writes');
 await ok('owner','/events-new',{action:'deleteVipEvent',advertiserId:'A',payload:{evento_id:recovered.evento_id},operation_id:makeKey(12)});assert(!await visible('E',recovered.evento_id));console.log('PASS delete removes scoped publication');
 // Full public packets survive actor restarts; this is a fixture counter, not billing.
 await visible('D',cityFreeId);
 for(const key of ['events:city:v2:D','events:city:v2:VIRTUAL'])env.GLD_PUBLIC_CACHE.evict('public-city-v119:'+key);
 let before={...env.GLD_PUBLIC_CACHE.counts};const startCalls=allOperations.length;const kvBefore={...physical};
 const cold=await ok('public','/events-new?ciudad_id=D');
 const after=env.GLD_PUBLIC_CACHE.counts;const measure={test:'persistent public event read after actor eviction',sql_fixture:{rows_read:after.sqlRead-before.sqlRead,rows_written:after.sqlWritten-before.sqlWritten},kv:Object.fromEntries(Object.keys(physical).map(k=>[k,physical[k]-kvBefore[k]])),firestore:allOperations.slice(startCalls)};
 assert.equal(measure.firestore.length,0);assert.equal(measure.sql_fixture.rows_written,0);assert.equal(measure.sql_fixture.rows_read,4);assert.equal(measure.kv.get,3);assert(cold.j.events.length);console.log('PASS saved-packet cold read: 4 SQL fixture rows, no writes/Firestore; 1 territory KV get + 2 existing migration probes in fixture');
 fs.writeFileSync('docs/evidencias/eventos145-local-consumption.json',JSON.stringify(measure,null,2));
 token='';result=await call('/events-new',{action:'deleteFreeEvent',advertiserId:'A',payload:{evento_id:cityFreeId},operation_id:makeKey(13)});assert.equal(result.r.status,401);console.log('PASS anonymous mutation rejected');
 const vip=await create('VIP','Concurrent',{modo:'CIUDAD',ciudad_id:'D'},14),vipId=vip.j.evento_id,stale=vip.j.evento.revision_evento145;
 await ok('owner','/events-new',{action:'updateVipEvent',advertiserId:'A',payload:{evento_id:vipId,nombre_evento:'New title',revision_evento145:stale},operation_id:makeKey(15)});
 writes=sourceWrites();const conflict=await as('owner','/events-new',{action:'updateVipEvent',advertiserId:'A',payload:{evento_id:vipId,nombre_evento:'Stale title',revision_evento145:stale},operation_id:makeKey(16)});assert.equal(conflict.r.status,409);assert.equal(sourceWrites(),writes);console.log('PASS stale editor cannot overwrite a newer VIP event');
 // Existing Gran Hermano moderation keeps the selected distribution.
 await ok('admin','/superadmin/moderation/resolve',{tipo:'EVENTO',id:vipId,decision:'RECHAZAR',operation_id:makeKey(17)});assert(!await visible('D',vipId));
 await ok('admin','/superadmin/moderation/resolve',{tipo:'EVENTO',id:vipId,decision:'APROBAR',operation_id:makeKey(18)});assert(await visible('D',vipId));assert(!await visible('B',vipId));
 writes=sourceWrites();await ok('admin','/superadmin/moderation/resolve',{tipo:'EVENTO',id:vipId,decision:'APROBAR',operation_id:makeKey(19)});assert.equal(sourceWrites(),writes);console.log('PASS GH approve/reject preserve scope; repeated decision has no source write');
 // A second owner is not authorized for this advertiser's event or receipt.
 seed('suscriptores','T',{mail:'other@test.invalid',activo:true});const deniedToken=sign({sid:'T',tipo:'SUSCRIPTOR',persistent:true,sv:0});token=deniedToken;writes=sourceWrites();const denied=await call('/events-new',{action:'updateVipEvent',advertiserId:'A',payload:{evento_id:vipId,nombre_evento:'Not allowed'},operation_id:makeKey(15)});assert([401,403].includes(denied.r.status));assert.equal(sourceWrites(),writes);console.log('PASS unrelated subscriber cannot access mutation or replay');
 broken='publication:recent:v77:';
 result=await as('owner','/events-new',{action:'createFreeEvent',advertiserId:'A',payload:{...event('Free recover',{modo:'CIUDAD',ciudad_id:'D'}),confirmar_similar:true},operation_id:makeKey(20)});assert.equal(result.r.status,503);const freeRecovery=[...rows.values()].find(r=>r.nombre_evento==='Free recover');assert(freeRecovery);writes=sourceWrites();env.GLD_PUBLIC_CACHE.evict('guide-save-v132:A');broken='';await env.GLD_PUBLIC_CACHE.runAlarms();assert.equal(sourceWrites(),writes);assert(await visible('D',freeRecovery.evento_id));
 await ok('owner','/events-new',{action:'deleteFreeEvent',advertiserId:'A',payload:{evento_id:freeRecovery.evento_id},operation_id:makeKey(21)});assert.equal(rows.get('eventos/'+freeRecovery.evento_id).eliminado,true);assert(!await visible('D',freeRecovery.evento_id));writes=sourceWrites();
 result=await as('owner','/events-new',{action:'createFreeEvent',advertiserId:'A',payload:{...event('Over monthly quota',{modo:'CIUDAD',ciudad_id:'D'}),confirmar_similar:true},operation_id:makeKey(22)});assert.notEqual(result.j.success,true);assert.equal(sourceWrites(),writes);console.log('PASS limited FREE recovery and deletion preserve monthly slot; delete does not restore quota');
 console.log('PASS all Eventos145 integration checks');
}finally{globalThis.fetch=original;console.log=savedLog;fs.writeFileSync('docs/evidencias/eventos145-local-reports.json',JSON.stringify(logRows,null,2));}
