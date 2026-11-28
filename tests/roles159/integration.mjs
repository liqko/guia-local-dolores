import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker,{GldPublicCache119} from '../guia/worker-instrumentado.mjs';
import fs from 'node:fs';
import {sqliteNamespace} from '../guia/sqlite-namespace.mjs';
const rows=new Map(),values=new Map(),calls=[],allOperations=[];let revision=0;
const nativePush=calls.push.bind(calls);calls.push=(...entries)=>{allOperations.push(...entries);return nativePush(...entries);};
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SERVER_SECRET:'test-only',FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@test.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}};
function seed(c,id,data){rows.set(c+'/'+id,{id,...data});}
function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};return {stringValue:String(v)};}
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return v.arrayValue.values.map(decode);if('nullValue'in v)return null;return v.stringValue??v.booleanValue??Number(v.integerValue);}
function doc(c,id,data){return {updateTime:data._version||'2026-10-12T12:00:00.000000Z',name:'projects/test/databases/(default)/documents/'+c+'/'+id,fields:Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id').map(([k,v])=>[k,encode(v)]))};}
seed('suscriptores','S',{nombre:'Propietario de prueba',mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true,tipo_usuario:'RESIDENTE',ciudad_origen_otro:'Córdoba'});
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
values.set('catalogs:commerce:v1',JSON.stringify({niveles_anunciante:[{nivel_id:'CONFIG_GENERAL_ANUNCIANTES'}]}));
let token='';
async function call(path,body){calls.length=0;const make=()=>new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({...body,declaracion_publicacion:{aceptada:true,version:'2026-10-11'}})}:{})});let r=await worker.fetch(make(),env);if(!body&&r.status===503&&(await r.clone().json()).code==='COMMERCE_COPY_PREPARING'){assert.equal(calls.length,0);await env.GLD_PUBLIC_CACHE.runAlarms();r=await worker.fetch(make(),env);}return {r,j:await r.json(),calls:[...calls]};}
env.GLD_PUBLIC_CACHE=sqliteNamespace(env,GldPublicCache119);
const reports=[],measures=[],physical={get:0,put:0,delete:0,list:0};
globalThis.__circuitCapture=r=>reports.push(structuredClone(r));
for(const method of Object.keys(physical)){const original=env.GLD_CACHE_KV[method].bind(env.GLD_CACHE_KV);env.GLD_CACHE_KV[method]=async(...args)=>{physical[method]++;return original(...args);};}
env.GLD_PUBLIC_CACHE_MIGRATION='source-bootstrap';
const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url');};
let adminToken=sign({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:0});let ownerToken='';
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




const assertStatus=async(role,path,body,status)=>{const x=await as(role,path,body);assert.equal(x.r.status,status,path+': '+JSON.stringify(x.j));return x;};
try{
 // Real implementation with an isolated Firestore/KV/DO fixture: never production data.
 seed('suscriptores','M',{mail:'manager@test.invalid',clave:'test-password',activo:true,email_verificado:true});
 seed('anunciantes_administracion','A',{nivel:4,aprobado:true,funcionalidades:'EVENTOS,PROMOS'});
 ownerToken=(await ok('owner','/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'})).j.token;
 const initialOwner=ownerToken;
 values.set('admin:index:advertisers:v2',JSON.stringify({results:[{id:'A',nombre:'Comercio',aprobado:true,ciudad_ids:['D'],secret:'NO_PUBLICAR'}]}));
 let claimOptions=await ok('owner','/advertisers/claim-options?q=Comercio');assert.equal(claimOptions.j.results[0].id,'A');assert(!JSON.stringify(claimOptions.j).includes('NO_PUBLICAR'));assert.equal(claimOptions.calls.length,0);
 await assertStatus('public','/advertisers/claim-options',undefined,401);
 let grant=await ok('admin','/superadmin/advertisers/A/panel-access',{});
 const capability=grant.j.token;assert(!capability.includes('test-password'));assert.equal(grant.j.relacion.anunciante_id,'A');
 await assertStatus('public','/superadmin/advertisers/A/panel-access',{},401);
 ownerToken=sign({sid:'LOCAL',rol:'ADMIN_LOCAL',persistent:true});await assertStatus('owner','/superadmin/advertisers/A/panel-access',{},403);
 ownerToken=capability;
 await ok('owner','/empleo/panel?anunciante_id=A');
 await assertStatus('owner','/empleo/panel',undefined,401);
 await assertStatus('owner','/empleo/panel?anunciante_id=OTRO',undefined,401);
 const before=structuredClone(rows.get('anunciantes/A'));
 const current=(await ok('owner','/commerce?action=anunciante&advertiserId=A')).j.advertiser;
 await assertStatus('owner','/commerce?action=anunciante&advertiserId=OTRO',undefined,403);
 await assertStatus('owner','/suscriptores',{action:'actualizar_perfil',nombre:'No'},401);
 await assertStatus('owner','/superadmin/advertisers/A/panel-access',{},401);
 const terms=await ok('owner','/advertiser/terms');assert.equal(terms.j.administrativo,true);
 await ok('owner','/commerce',{action:'save_ficha',advertiserId:'A',datos:{revision_datos:current.revision_datos,redes_web_comunes:{habilitado:true,web:'https://ejemplo.invalid/verificada'}}});
 assert.equal(rows.get('anunciantes/A').redes_web_comunes.web,'https://ejemplo.invalid/verificada');
 assert.equal(rows.get('suscriptores/S').clave,'test-password');
 // Expiry and admin revocation deny writes before mutating.
 const decoded=JSON.parse(Buffer.from(capability.split('.')[0],'base64url'));
 ownerToken=sign({...decoded,exp:Date.now()-1});await assertStatus('owner','/commerce?action=anunciante&advertiserId=A',undefined,401);
 const accessActor=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('private-access-v201:ADMIN'));const revoked=await accessActor.fetch(new Request('https://access.internal/',{method:'POST',body:JSON.stringify({op:'private-access201',sid:'ADMIN',action:'revoke'})}));assert.equal(revoked.status,200);const revocation=(await revoked.json()).value;ownerToken=capability;await assertStatus('owner','/commerce?action=anunciante&advertiserId=A',undefined,401);adminToken=sign({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:revocation.state.version});
 // The proprietor delegates; GH only identifies the proprietor and opens the panel.
 let detail=(await ok('admin','/superadmin/advertisers/A')).j;
 assert.equal(detail.propietarios[0].nombre,'Propietario de prueba');assert.equal(detail.propietarios[0].mail,'persona@test.invalid');assert(!JSON.stringify(detail.propietarios).includes('test-password'));
 const relationBody={advertiserId:'A',suscriptor_id:'M',rol:'MANAGER',permisos:['EVENTOS'],activo:true,revision:detail.revision_vinculo_nuevo};
 await assertStatus('admin','/superadmin/advertisers/A/responsables',relationBody,403);
 await assertStatus('public','/commerce/team?advertiserId=A',undefined,401);
 await assertStatus('owner','/commerce/team?advertiserId=A',undefined,401); // scoped GH grant is not a proprietor
 ownerToken=initialOwner;
 let team=(await ok('owner','/commerce/team?advertiserId=A')).j;
 assert.equal(team.results[0].persona.mail,'persona@test.invalid');assert(team.funcionalidades.includes('EMPLEO'));
 await assertStatus('owner','/commerce/team?advertiserId=OTRO',undefined,403);
 values.set('admin:index:subscribers:v2',JSON.stringify({results:[{suscriptor_id:'M',nombre:'Manager de prueba',mail:'manager@test.invalid',activo:true,clave:'NO_PUBLICAR'}]}));
 let search=await ok('owner','/commerce/team/search?advertiserId=A&q=manager%40test.invalid');assert.equal(search.j.results[0].suscriptor_id,'M');assert(!JSON.stringify(search.j).includes('NO_PUBLICAR'));assert.equal(search.calls.length,0);
 search=await ok('owner','/commerce/team/search?advertiserId=A&q=manager');assert.equal(search.j.results.length,0);
 await assertStatus('owner','/commerce/team/responsables',{...relationBody,suscriptor_id:'S',rol:'ADMINISTRADOR',revision:team.results[0].revision},403);
 await assertStatus('owner','/commerce/team/responsables',{...relationBody,rol:'PROPIETARIO'},400);
 await assertStatus('owner','/commerce/team/responsables',{...relationBody,rol:'COADMINISTRADOR'},400);
 seed('suscriptores','N',{mail:'concurrent@test.invalid',clave:'test-password',activo:true,email_verificado:true});
 const concurrent=await Promise.all([as('owner','/commerce/team/responsables',{...relationBody,suscriptor_id:'N'}),as('owner','/commerce/team/responsables',{...relationBody,suscriptor_id:'N',permisos:['PROMOS']})]);assert.deepEqual(concurrent.map(x=>x.r.status).sort(),[200,409]);
 const added=await ok('owner','/commerce/team/responsables',relationBody);assert.equal(added.j.relacion.permisos_definidos,true);assert.equal(rows.get('suscriptor_anunciante/M__A').rol,'MANAGER');
 let rel=added.j;
 const noChange=await ok('owner','/commerce/team/responsables',{...relationBody,revision:rel.revision});assert.equal(noChange.j.updated,false);assert(!noChange.calls.some(x=>x.op==='PATCH'||x.op==='DELETE'));
 await assertStatus('owner','/commerce/team/responsables',{...relationBody,permisos:['PROMOS']},409);
 await assertStatus('owner','/commerce/team/responsables',{...relationBody,permisos:['NO_EXISTE'],revision:rel.revision},400);
 await assertStatus('owner','/commerce/team/responsables',{...relationBody,permisos:['MODIFICAR_DATOS'],revision:rel.revision},403);
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'manager@test.invalid',clave:'test-password'})).j.token;
 const managerToken=ownerToken;await assertStatus('owner','/commerce?action=anunciante&advertiserId=A',undefined,403);
 await assertStatus('owner','/commerce/team?advertiserId=A',undefined,403);
 await assertStatus('owner','/empleo/panel?anunciante_id=A',undefined,403);
 ownerToken=initialOwner;
 rel=(await ok('owner','/commerce/team/responsables',{...relationBody,rol:'ADMINISTRADOR',permisos:[],revision:rel.revision})).j;
 ownerToken=managerToken;await assertStatus('owner','/commerce?action=permisos_panel&advertiserId=A',undefined,401);
 for(let i=0;i<2;i++){
  const login=await ok('public','/suscriptores',{action:'login',mail:'manager@test.invalid',clave:'test-password'});assert.equal(login.j.anunciantes[0].permisos_definidos,true);assert.equal(login.j.anunciantes[0].permisos,'');
  ownerToken=login.j.token;await assertStatus('owner','/commerce?action=anunciante&advertiserId=A',undefined,403);await assertStatus('owner','/empleo/panel?anunciante_id=A',undefined,403);await assertStatus('owner','/commerce/team?advertiserId=A',undefined,403);
 }
 ownerToken=initialOwner;
 rel=(await ok('owner','/commerce/team/responsables',{...relationBody,rol:'ADMINISTRADOR',permisos:['MODIFICAR_DATOS'],revision:rel.revision})).j;
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'manager@test.invalid',clave:'test-password'})).j.token;
 await ok('owner','/commerce?action=anunciante&advertiserId=A');await assertStatus('owner','/empleo/panel?anunciante_id=A',undefined,403);
 const delegatedToken=ownerToken;ownerToken=initialOwner;
 rel=(await ok('owner','/commerce/team/responsables',{...relationBody,rol:'MANAGER',permisos:['EMPLEO'],revision:rel.revision})).j;
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'manager@test.invalid',clave:'test-password'})).j.token;
 await ok('owner','/empleo/panel?anunciante_id=A');await assertStatus('owner','/commerce?action=anunciante&advertiserId=A',undefined,403);
 const lastManager=ownerToken;ownerToken=initialOwner;
 await ok('owner','/commerce/team/responsables',{...relationBody,rol:'MANAGER',permisos:['EMPLEO'],activo:false,revision:rel.revision});
 ownerToken=lastManager;await assertStatus('owner','/commerce?action=permisos_panel&advertiserId=A',undefined,401);
 await assertStatus('admin','/superadmin/subscribers/S/reset-access',{nueva_clave:'NO_CAMBIAR',revision:'old'},404);
 assert.equal(rows.get('suscriptores/S').clave,'test-password');
 let login=await ok('public','/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'});
 // Claim: must select an existing advertiser and explain how ownership can be verified.
 ownerToken=login.j.token;
 await assertStatus('owner','/suscriptores',{action:'solicitar_anunciante',modo:'RECLAMAR',anunciante_id:'A',motivo:'corto'},400);
 const claim=await ok('owner','/suscriptores',{action:'solicitar_anunciante',modo:'RECLAMAR',anunciante_id:'A',motivo:'Soy titular y puedo acreditar la habilitación comercial',mail:'persona@test.invalid'});
 assert.equal(rows.get('solicitudes_anunciante/'+claim.j.solicitud_id).detalle.descripcion,'Soy titular y puedo acreditar la habilitación comercial');
 assert.equal(rows.get('solicitudes_anunciante/'+claim.j.solicitud_id).estado,'PENDIENTE');
 await assertStatus('admin','/superadmin/moderation/resolve',{tipo:'ANUNCIANTE',id:claim.j.solicitud_id,decision:'APROBAR'},400);
 await ok('admin','/superadmin/moderation/resolve',{tipo:'ANUNCIANTE',id:claim.j.solicitud_id,decision:'APROBAR',verificacion:'Titularidad verificada con la documentación aportada por el solicitante'});
 assert.equal(rows.get('solicitudes_anunciante/'+claim.j.solicitud_id).estado,'APROBADA');
 assert(rows.get('solicitudes_anunciante/'+claim.j.solicitud_id).verificacion_titularidad);
 await assertStatus('owner','/commerce?action=anunciante&advertiserId=A',undefined,401);
 // Ownership changes go through the complete Worker, source, KV, SQLite and renewed sessions.
 seed('suscriptores','X',{mail:'next@test.invalid',nombre:'Siguiente titular',clave:'test-password',activo:true,email_verificado:true});
 values.set('admin:index:subscribers:v2',JSON.stringify({results:[{suscriptor_id:'M',nombre:'Manager de prueba',mail:'manager@test.invalid',activo:true,clave:'NO_PUBLICAR'},{suscriptor_id:'X',nombre:'Siguiente titular',mail:'next@test.invalid',activo:true}]}));
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'})).j.token;
 const oldOwnerToken=ownerToken;
 let ownershipDetail=(await ok('admin','/superadmin/advertisers/A')).j;
 assert.equal(ownershipDetail.propietarios.length,1);assert.equal(ownershipDetail.propietarios[0].suscriptor_id,'S');assert.equal(typeof ownershipDetail.revision_titularidad,'string');
 const ownerMutation=(detail,sid,active)=>({suscriptor_id:sid,rol:'PROPIETARIO',activo:active,revision:detail.relaciones.find(r=>r.suscriptor_id===sid)?.revision||detail.revision_vinculo_nuevo,revision_titularidad:detail.revision_titularidad});
 const staleTransfer=ownerMutation(ownershipDetail,'X',true);
 const lookup=await ok('admin','/superadmin/advertisers/A/responsables?q=manager%40test.invalid');assert.equal(lookup.j.results[0].suscriptor_id,'M');assert.equal(lookup.calls.length,0);assert(!JSON.stringify(lookup.j).includes('NO_PUBLICAR'));
 await assertStatus('owner','/superadmin/advertisers/A/responsables?q=manager%40test.invalid',undefined,401);
 const preservedDelegate=structuredClone(rows.get('suscriptor_anunciante/N__A'));assert.equal(preservedDelegate.activo,true);
 await ok('admin','/superadmin/advertisers/A/responsables',ownerMutation(ownershipDetail,'M',true));
 assert.equal(rows.get('suscriptor_anunciante/R').activo,false);assert.equal(rows.get('suscriptor_anunciante/M__A').rol,'PROPIETARIO');assert.equal(rows.get('suscriptor_anunciante/M__A').activo,true);assert.equal(rows.get('suscriptor_anunciante/N__A').activo,false);assert.equal(rows.get('suscriptor_anunciante/N__A').permisos,preservedDelegate.permisos);
 ownerToken=oldOwnerToken;await assertStatus('owner','/commerce/team?advertiserId=A',undefined,401);
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'})).j.token;await assertStatus('owner','/commerce/team?advertiserId=A',undefined,403);
 await assertStatus('admin','/superadmin/advertisers/A/responsables',staleTransfer,409);
 ownershipDetail=(await ok('admin','/superadmin/advertisers/A')).j;assert.deepEqual(ownershipDetail.propietarios.map(x=>x.suscriptor_id),['M']);
 assert.equal((await ok('admin','/superadmin/advertisers/A')).calls.length,0,'La ficha GH preparada se reutiliza sin lecturas Firestore');
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'manager@test.invalid',clave:'test-password'})).j.token;
 const newOwnerToken=ownerToken;assert.equal((await ok('owner','/commerce/team?advertiserId=A')).j.results.filter(x=>x.activo&&x.rol==='PROPIETARIO').length,1);
 const suspended=(await ok('owner','/commerce/team?advertiserId=A')).j.results.find(x=>x.suscriptor_id==='N');assert.equal(suspended.activo,false);
 await ok('owner','/commerce/team/responsables',{advertiserId:'A',suscriptor_id:'N',rol:suspended.rol,activo:true,permisos:suspended.permisos.split(',').map(x=>x.trim()).filter(Boolean),revision:suspended.revision});
 assert.equal(rows.get('suscriptor_anunciante/N__A').activo,true);
 ownershipDetail=(await ok('admin','/superadmin/advertisers/A')).j;
 await ok('admin','/superadmin/advertisers/A/responsables',ownerMutation(ownershipDetail,'M',false));
 ownershipDetail=(await ok('admin','/superadmin/advertisers/A')).j;assert.equal(ownershipDetail.propietarios.length,0);assert.equal(rows.get('suscriptor_anunciante/N__A').activo,false);assert.equal(rows.get('suscriptor_anunciante/N__A').permisos,preservedDelegate.permisos);
 ownerToken=newOwnerToken;await assertStatus('owner','/commerce/team?advertiserId=A',undefined,401);
 assert.equal((await ok('admin','/superadmin/advertisers/A/panel-access',{})).j.relacion.rol,'ADMINISTRADOR');
 const activeOwners=()=>[...rows.values()].filter(r=>r.anunciante_id==='A'&&r.rol==='PROPIETARIO'&&r.activo===true);
 assert.equal(activeOwners().length,0);
 ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'next@test.invalid',clave:'test-password'})).j.token;
 const newClaim=await ok('owner','/suscriptores',{action:'solicitar_anunciante',modo:'RECLAMAR',anunciante_id:'A',motivo:'Soy titular y puedo acreditar documentación comercial',mail:'next@test.invalid'});
 assert.equal(activeOwners().length,0,'Enviar el reclamo no concede titularidad');
 await ok('admin','/superadmin/moderation/resolve',{tipo:'ANUNCIANTE',id:newClaim.j.solicitud_id,decision:'APROBAR',verificacion:'Titularidad confirmada mediante documentación comercial presentada'});
 assert.deepEqual(activeOwners().map(x=>x.suscriptor_id),['X']);assert.equal(rows.get('solicitudes_anunciante/'+newClaim.j.solicitud_id).estado,'APROBADA');
 assert.deepEqual((await ok('admin','/superadmin/advertisers/A')).j.propietarios.map(x=>x.suscriptor_id),['X']);
 {const op='0b5c2a52-7f8e-4c1d-9a3b-1234567890ab',aid='ADV-0B5C2A527F8E4C1D',body={operacion_id:op,nombre:'Alta GH',ciudad_id:'D',suscriptor_id:'X',actividad:'Ferretería'};
  await assertStatus('owner','/superadmin/advertisers/create',body,401);
  await assertStatus('admin','/superadmin/advertisers/create',{...body,nombre:''},400);
  await assertStatus('admin','/superadmin/advertisers/create',{...body,operacion_id:'1'},400);
  await assertStatus('admin','/superadmin/advertisers/create',{...body,suscriptor_id:'NO-EXISTE'},404);
  await assertStatus('admin','/superadmin/advertisers/create',{...body,ciudad_id:'',direccion:'Calle 1'},400);
  assert.equal(rows.has('anunciantes/'+aid),false,'Un alta rechazada no deja registros');
  const created=await ok('admin','/superadmin/advertisers/create',body);
  assert.equal(created.j.anunciante_id,aid);assert.equal(created.j.updated,true);assert.equal(created.j.nivel,'3');
  assert.equal(rows.get('anunciantes_administracion/'+aid).nivel,'3');assert.equal(rows.get('anunciantes_administracion/'+aid).creado_por,'ADMIN');
  assert.equal(rows.get('anunciantes/'+aid).nombre,'Alta GH');
  {const kv=k=>{const x=values.get(k);return typeof x==='string'?JSON.parse(x):x;},hasta=rows.get('anunciantes_administracion/'+aid).vigencia_hasta;assert.match(hasta,/^\d{4}-\d{2}-\d{2}$/);
   assert.equal(kv('admin:index:advertisers:v2').results.find(r=>r.id===aid).vigencia_hasta,hasta,'el listado GH recibe la vigencia del alta');
   const g=kv('guide:advertiser:v2:'+aid);if(g)assert.ok(g.cards.length&&g.cards.every(c=>c.vigente_hasta===hasta),'la tarjeta de Guía recibe la vigencia del alta');
   assert.equal(created.calls.filter(c=>c.op==='GET'&&c.c==='anunciantes_administracion').length,0,'proyección sin releer la ficha');}
  const owners=[...rows.values()].filter(r=>r.anunciante_id===aid&&r.rol==='PROPIETARIO'&&r.activo===true);assert.deepEqual(owners.map(r=>r.suscriptor_id),['X']);
  assert.equal([...rows.values()].filter(r=>r.anunciante_id===aid&&r.ciudad_id==='D'&&r.sede_id).length,1);
  const retry=await ok('admin','/superadmin/advertisers/create',body);
  assert.equal(retry.j.updated,false);assert.equal(retry.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,0,'Reintento sin escrituras');
  const chosen=await ok('admin','/superadmin/advertisers/create',{...body,operacion_id:'1c5c2a52-7f8e-4c1d-9a3b-1234567890ab',nivel:'5'});
  assert.equal(rows.get('anunciantes_administracion/'+chosen.j.anunciante_id).nivel,'5');
  const bare=await ok('admin','/superadmin/advertisers/create',{operacion_id:'2c5c2a52-7f8e-4c1d-9a3b-1234567890ab',nombre:'Básico sin titular'});
  assert.equal(bare.calls.filter(c=>c.op==='query'&&c.c==='anunciantes_sedes').length,0,'alta sin releer sedes');assert.equal(bare.calls.filter(c=>c.op==='GET'&&c.c==='anunciantes').length,1,'alta: sólo la comprobación de idempotencia');
  const bareId=bare.j.anunciante_id;assert.equal(bare.j.titular,null);assert.equal(rows.get('anunciantes_administracion/'+bareId).nivel,'3');
  assert.equal([...rows.values()].filter(r=>r.anunciante_id===bareId&&r.suscriptor_id).length,0,'Sin titular no se crean vínculos ficticios');
  assert.equal((await ok('admin','/superadmin/advertisers/'+bareId)).j.propietarios?.length||0,0);
  await ok('admin','/superadmin/advertisers/'+bareId+'/panel-access',{});
  {const adm=()=>rows.get('anunciantes_administracion/'+aid),act=(role,accion,status=200)=>role==='admin'?assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:accion},status):assertStatus('owner','/commerce',{action:'set_actividad',advertiserId:aid,accion_actividad:accion},status);
   ownerToken=(await ok('public','/suscriptores',{action:'login',mail:'next@test.invalid',clave:'test-password'})).j.token;
   const v0=adm().vigencia_hasta;assert.match(v0,/^\d{4}-\d{2}-\d{2}$/,'nivel 3 nace con vigencia');
   const off=await act('owner','desactivar');assert.equal(adm().inactivo_motivo,'VOLUNTARIA');
   assert.equal(off.calls.filter(c=>c.op==='query'&&c.c==='anunciantes_sedes').length,0,'sin relectura de sedes');assert.equal(off.calls.filter(c=>c.op==='GET'&&c.c==='anunciantes').length,0,'sin relectura del anunciante');
   assert.equal(off.calls.filter(c=>c.op==='GET'&&c.c==='anunciantes_administracion').length,1,'una lectura con revisión');assert.equal(off.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,1,'una escritura');
   await assertStatus('owner','/commerce?action=anunciante&advertiserId='+aid,undefined,200);
   const ownRen=await act('owner','renovar');assert.ok(ownRen.j.vigencia_hasta>v0,'el titular renueva el nivel 3 desde su panel');await act('admin','desactivar');assert.equal(adm().inactivo_motivo,'ADMINISTRATIVA');
   await act('owner','activar',409);await act('owner','desactivar',409);
   await assertStatus('owner','/commerce?action=anunciante&advertiserId='+aid,undefined,200);
   await act('admin','activar');assert.equal(adm().inactivo_motivo,'');
   const again=await act('admin','activar');assert.equal(again.j.updated,false);assert.equal(again.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,0);
   const renewed=await act('admin','renovar');assert.ok(renewed.j.vigencia_hasta>v0,'renovar suma 30 días a la vigencia vigente');
   const r1=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'renovar',operacion_id:'REN-1'},200),r2=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'renovar',operacion_id:'REN-1'},200);
   assert.equal(r1.j.updated,true);assert.equal(r2.j.updated,false,'reintento de renovación sin segunda escritura');assert.equal(r2.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,0);assert.equal(adm().vigencia_hasta,r1.j.vigencia_hasta);
   const cat=extra=>values.set('catalogs:commerce:v1',JSON.stringify({niveles_anunciante:[{nivel_id:'CONFIG_GENERAL_ANUNCIANTES'},...extra]})),vBefore=adm().vigencia_hasta,dd=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/864e5);
   await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'excepcion',excepcion_modo:'PERMANENTE',excepcion_motivo:'Convenio'},409);
   cat([{nivel_id:'3',numero:3,vigencia_con_titular_modo:'DIAS',vigencia_con_titular_dias:10,vigencia_sin_titular_modo:'PERMANENTE',vigencia_excepciones:true}]);
   assert.equal(adm().vigencia_hasta,vBefore,'cambiar la regla no altera vigencias otorgadas');
   const r10=await act('admin','renovar');assert.equal(dd(r10.j.vigencia_hasta,vBefore),10,'la renovación usa la regla configurada en el catálogo');assert.equal(adm().vigencia_regla.dias,10);
   const ex=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'excepcion',excepcion_modo:'PERMANENTE',excepcion_motivo:'Convenio institucional'},200);
   assert.equal(adm().vigencia_excepcion.modo,'PERMANENTE');assert.equal(ex.j.vigencia_hasta,'');assert.equal(adm().nivel,'3','la excepción no modifica el nivel');
   const exAgain=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'excepcion',excepcion_modo:'PERMANENTE',excepcion_motivo:'Convenio institucional'},200);assert.equal(exAgain.j.updated,false);assert.equal(exAgain.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,0);
   await act('admin','renovar',409);await act('owner','renovar',409);
   await assertStatus('owner','/commerce',{action:'set_actividad',advertiserId:aid,accion_actividad:'excepcion',excepcion_modo:'PERMANENTE',excepcion_motivo:'yo mismo'},400);
   const unex=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'quitar_excepcion'},200);assert.ok(!adm().vigencia_excepcion?.modo);assert.equal(unex.j.vigencia_hasta,adm().vigencia_hasta);
   {const vBase=adm().vigencia_hasta,exF=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'excepcion',excepcion_modo:'FECHA',excepcion_hasta:'2099-01-01',excepcion_motivo:'Prórroga acordada'},200);
    assert.equal(exF.j.vigencia_hasta,'2099-01-01');assert.equal(adm().vigencia_hasta,vBase,'la excepción con fecha no pisa la vigencia otorgada');
    const unF=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'quitar_excepcion'},200);assert.equal(unF.j.vigencia_hasta,vBase,'quitar la excepción restaura la vigencia otorgada');assert.equal(adm().vigencia_hasta,vBase);}
   cat([]);
   const catUrl='/superadmin/catalogs/niveles_anunciante';
   const badMode=await as('admin',catUrl,{item:{nivel_id:'3',vigencia_con_titular_modo:'SEMANAL'}});assert.notEqual(badMode.r.status,200,'modo inválido rechazado');
   const badDays=await as('admin',catUrl,{item:{nivel_id:'3',vigencia_con_titular_modo:'DIAS',vigencia_con_titular_dias:0}});assert.notEqual(badDays.r.status,200,'días inválidos rechazados');
   const okCat=await assertStatus('admin',catUrl,{item:{nivel_id:'3',vigencia_con_titular_modo:'DIAS',vigencia_con_titular_dias:45}},200);assert.equal(okCat.j.success,true);
   assert.equal(rows.get('niveles_anunciante/3').vigencia_con_titular_dias,45);
   const hoy=new Date(Date.now()-3*3600e3).toISOString().slice(0,10),commercial=async(nivel,status=200)=>{const d=await assertStatus('admin','/superadmin/advertisers/'+aid,undefined,200);return assertStatus('admin','/superadmin/advertisers/'+aid+'/commercial',{revision_comercial:d.j.revision_comercial,nivel},status);};
   cat([{nivel_id:'3',numero:3},{nivel_id:'5',numero:5}]);adm().vigencia_hasta='2027-01-15';
   await commercial('5');assert.equal(adm().nivel,'5');assert.equal(adm().vigencia_hasta,'2027-01-15','nivel por contratación: conserva la vigencia otorgada');assert.equal(adm().contratacion_actual,undefined,'cambiar de nivel no crea contrataciones');
   await commercial('3');assert.equal(adm().vigencia_desde,hoy);assert.equal(adm().vigencia_regla.origen,'CAMBIO_NIVEL');const vLevel=adm().vigencia_hasta;
   const same=await commercial('3');assert.equal(same.calls.filter(c=>['PATCH','DELETE'].includes(c.op)&&c.c==='anunciantes_administracion').length,0,'guardar sin cambiar el nivel no escribe');assert.equal(adm().vigencia_hasta,vLevel);
   delete adm().con_titular;adm().vigencia_hasta='';{const ix=JSON.parse(values.get('admin:index:advertisers:v2'));for(const r of ix.results)if(r.id===aid){delete r.con_titular;r.vigencia_hasta='';}values.set('admin:index:advertisers:v2',JSON.stringify(ix));}
   const sim=await assertStatus('admin','/superadmin/advertisers/validity-regularization',{modo:'simular'},200);assert.equal(sim.j.firestore_writes,0);assert.equal(sim.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,0,'simular no escribe');assert.ok(sim.j.a_regularizar>=1);assert.ok(sim.j.consumo_estimado.firestore_lecturas>=sim.j.vinculos_leidos);
   await assertStatus('admin','/superadmin/advertisers/validity-regularization',{modo:'ejecutar'},400);assert.ok(sim.j.plan_id);await assertStatus('admin','/superadmin/advertisers/validity-regularization',{modo:'ejecutar',confirmacion:'REGULARIZAR_TITULARES'},409);await assertStatus('owner','/superadmin/advertisers/validity-regularization',{modo:'simular'},401);
   const run=await assertStatus('admin','/superadmin/advertisers/validity-regularization',{modo:'ejecutar',confirmacion:'REGULARIZAR_TITULARES',plan_id:sim.j.plan_id,lote:100},200);assert.equal(run.calls.filter(c=>c.c==='suscriptor_anunciante'&&(c.op==='query'||!c.id)).length,0,'ejecutar no relee los vínculos');assert.ok(run.calls.filter(c=>c.c==='suscriptor_anunciante').length<=sim.j.a_regularizar,'sólo el vínculo de cada candidato');assert.equal(run.j.pendientes,0);assert.equal(adm().con_titular,true);assert.equal(adm().vigencia_desde,hoy,'nivel 3 con titular inicia su vigencia');assert.ok(run.j.escrituras>=1);
   const rerun=await assertStatus('admin','/superadmin/advertisers/validity-regularization',{modo:'ejecutar',confirmacion:'REGULARIZAR_TITULARES',plan_id:sim.j.plan_id,lote:100},200);assert.equal(rerun.j.procesados,0);assert.equal(rerun.calls.filter(c=>['PATCH','DELETE'].includes(c.op)&&c.id===aid).length,0,'repetir no vuelve a escribir');
   {delete adm().con_titular;adm().vigencia_hasta='';{const ix=JSON.parse(values.get('admin:index:advertisers:v2'));for(const r of ix.results)if(r.id===aid){delete r.con_titular;r.vigencia_hasta='';}values.set('admin:index:advertisers:v2',JSON.stringify(ix));}
    const sim2=await assertStatus('admin','/superadmin/advertisers/validity-regularization',{modo:'simular'},200);assert.equal(sim2.j.consumo_estimado.firestore_lecturas,sim2.j.vinculos_leidos+2*sim2.j.a_regularizar);
    const relKey=[...rows.keys()].find(k=>k.startsWith('suscriptor_anunciante/')&&rows.get(k).anunciante_id===aid&&rows.get(k).rol==='PROPIETARIO'&&rows.get(k).activo===true);assert.ok(relKey);rows.get(relKey).activo=false;
    const run2=await assertStatus('admin','/superadmin/advertisers/validity-regularization',{modo:'ejecutar',confirmacion:'REGULARIZAR_TITULARES',plan_id:sim2.j.plan_id,lote:100},200);
    assert.ok(run2.j.anunciantes_con_cambio.includes(aid),'titular revocado después de simular: se omite');assert.equal(adm().con_titular,undefined);assert.equal(adm().vigencia_hasta,'');
    assert.equal(run2.calls.filter(c=>c.op==='query'||(c.c==='suscriptor_anunciante'&&!c.id)).length,0,'sin releer todos los vínculos');assert.equal(run2.calls.filter(c=>['PATCH','DELETE'].includes(c.op)&&c.id===aid).length,0);
    rows.get(relKey).activo=true;adm().con_titular=true;}
   {cat([{nivel_id:'3',numero:3,vigencia_con_titular_modo:'PERMANENTE',vigencia_sin_titular_modo:'PERMANENTE'}]);adm().vigencia_hasta='2020-01-01';
    const perm=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'renovar',operacion_id:'REN-PERM'},200);assert.equal(perm.j.estado.visible,true,'regla permanente: el vencido se recupera');assert.equal(adm().vigencia_hasta,'');assert.equal(adm().vigencia_regla.modo,'PERMANENTE');
    const permAgain=await assertStatus('admin','/superadmin/advertisers/'+aid+'/activity',{accion_actividad:'renovar',operacion_id:'REN-PERM'},200);assert.equal(permAgain.j.updated,false);assert.equal(permAgain.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,0);
    await act('admin','renovar',409);}
   cat([]);
   adm().vigencia_hasta='2020-01-01';const expired=await assertStatus('admin','/superadmin/advertisers/'+aid,undefined,200);
   const rec=await act('admin','renovar');assert.equal(rec.j.estado.visible,true);assert.ok(adm().vigencia_hasta>'2026-01-01');assert.equal(rows.has('anunciantes/'+aid),true,'recupera el mismo identificador');
   await assertStatus('admin','/superadmin/advertisers/'+chosen.j.anunciante_id+'/activity',{accion_actividad:'renovar'},409);
   console.log('PASS Unidades 2 y 7: desactivación voluntaria y administrativa, panel accesible, reactivación, renovación de 30 días y recuperación de vencidos con el mismo ID.');}
  {rows.set('planes_precios/CATALOGO',{revision:1,precios:{niveles:{'3':{importe:1000,publico:true},'5':{importe:3000,publico:true}}}});
   const admB=()=>rows.get('anunciantes_administracion/'+bareId),today=new Date(Date.now()-3*3600e3).toISOString().slice(0,10);
   await assertStatus('admin','/superadmin/advertisers/'+bareId+'/activity',{accion_actividad:'desactivar'},200);admB().vigencia_hasta='2020-01-01';
   const close=await assertStatus('admin','/superadmin/sales/contracts/close',{anunciante_id:bareId,operacion_id:'CT_unidad5basico0001',nivel:3,funcionalidades:{}},200);
   assert.equal(close.j.importe,1000);assert.equal(admB().contratacion_actual.nivel,'3');assert.equal(admB().inactivo_motivo,'ADMINISTRATIVA','contratar no reactiva');assert.equal(admB().vigencia_hasta,'2020-01-01','sin titular, contratar nivel 3 no inicia vigencia');assert.equal(close.calls.filter(c=>c.op==='query'&&c.c==='anunciantes_sedes').length,0,'contratar sin releer sedes');
   const retry=await assertStatus('admin','/superadmin/sales/contracts/close',{anunciante_id:bareId,operacion_id:'CT_unidad5basico0001',nivel:3,funcionalidades:{}},200);assert.equal(retry.j.updated,false);assert.equal(retry.calls.filter(c=>['PATCH','DELETE'].includes(c.op)).length,0);
   const v3=admB().vigencia_hasta;await assertStatus('admin','/superadmin/sales/contracts/close',{anunciante_id:bareId,operacion_id:'CT_unidad5basico0002',nivel:5,funcionalidades:{}},200);assert.equal(admB().nivel,'5');assert.ok(v3==='2020-01-01');assert.equal(admB().vigencia_desde,today,'nivel 5: 90 días desde la contratación');assert.ok(admB().vigencia_hasta>today);
   assert.equal([...rows.keys()].some(k=>k.startsWith('suscriptor_anunciante/')&&rows.get(k).anunciante_id===bareId),false,'contratar no crea titular');
   console.log('PASS Unidad 5: contratación sobre anunciante básico, sin titular, incompleto e inactivo; nivel y vigencia; idempotencia; calculadora existente.');
   const owners=()=>[...rows.entries()].filter(([k,v])=>k.startsWith('suscriptor_anunciante/')&&v.anunciante_id===bareId&&v.rol==='PROPIETARIO'&&v.activo===true).map(([,v])=>v.suscriptor_id);
   const base=rows.get('suscriptores/N');assert.ok(base,'usuario N de prueba');
   rows.set('suscriptores/U6',{...base,id:'U6',suscriptor_id:'U6',mail:'u6@test.invalid',email_verificado:false});rows.set('suscriptores/U7',{...base,id:'U7',suscriptor_id:'U7',mail:'u7@test.invalid',activo:false});
   const link=async(sid,status)=>{const d=(await ok('admin','/superadmin/advertisers/'+bareId)).j;return assertStatus('admin','/superadmin/advertisers/'+bareId+'/responsables',{suscriptor_id:sid,rol:'PROPIETARIO',activo:true,revision:d.revision_vinculo_nuevo,revision_titularidad:d.revision_titularidad},status);};
   await link('NOEXISTE',404);await link('U7',404);await link('U6',409);assert.deepEqual(owners(),[]);
   await assertStatus('admin','/superadmin/advertisers/create',{operacion_id:'3c5c2a52-7f8e-4c1d-9a3b-1234567890ab',nombre:'Sin verificar',suscriptor_id:'U6'},409);
   rows.get('suscriptores/U6').email_verificado=true;await link('U6',200);assert.deepEqual(owners(),['U6']);
   await link('N',200);assert.deepEqual(owners(),['N'],'transferencia mantiene titular único');
   assert.equal(rows.get('anunciantes/'+bareId).nombre.startsWith('Básico'),true);assert.equal(admB().contratacion_actual.operacion_id,'CT_unidad5basico0002','conserva contratación');
   assert.equal(typeof admB().con_titular,'boolean','el fence de titularidad registra si hay titular');assert.equal(admB().vigencia_desde,today,'asignar titular no reinicia la vigencia de nivel 5');
   console.log('PASS Unidad 6: vinculación directa de usuario verificado, rechazo de inexistente, inactivo y sin verificar, vinculación posterior a la verificación, transferencia con titular único, sin cuentas ficticias.');}
  console.log('PASS Unidad 4: alta desde GH con o sin titular, nivel 3 por defecto, ficha GH y Abrir panel inmediatos, permisos, validación e idempotencia.');}
 console.log('PASS Unidad 1 end-to-end: search, transfer, stale confirmation, sessions, durable GH detail, delegation suspension and ratification, zero owners, independent GH access and verified claim.');
 fs.mkdirSync('docs/evidencias',{recursive:true});fs.writeFileSync('docs/evidencias/roles159-local.json',JSON.stringify({entorno:'LOCAL_SIMULADO_NO_FACTURACION',version:'159',fecha:new Date().toISOString(),requests:reports.map(r=>({event:r.event,path:r.path,action:r.action,status:r.status,request_id:r.request_id,firestore:r.totals,kv:r.kv,sql:r.public_store119||null,consumption:r.consumption||null}))},null,2));
 console.log('PASS administrative panel: read/save web, advertiser scope, expiry, revocation, account isolation; owner-only delegation, exact-email lookup, manager restrictions, explicit empty admin permissions, revocation, protected proprietor, no GH password reset; verified claim context.');
}finally{globalThis.fetch=original;}
