import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker from './WORKER_COMPLETO_V74.mjs';
const rows=new Map(),values=new Map(),calls=[];
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SERVER_SECRET:'test-only',FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@test.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}};
function seed(c,id,data){rows.set(c+'/'+id,{id,...data});}
function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};return {stringValue:String(v)};}
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return v.arrayValue.values.map(decode);if('nullValue'in v)return null;return v.stringValue??v.booleanValue??Number(v.integerValue);}
function doc(c,id,data){return {name:'projects/test/databases/(default)/documents/'+c+'/'+id,fields:Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id').map(([k,v])=>[k,encode(v)]))};}
seed('suscriptores','S',{mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true});
seed('suscriptor_anunciante','R',{suscriptor_id:'S',anunciante_id:'A',anunciante_nombre:'Comercio',rol:'PROPIETARIO',permisos:'PUBLICIDAD,TURNOS_FARMA,PROMOS,EVENTOS,EVENTOS_FREE,ACTIVIDADES,EFEMERIDES',activo:true});
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
const original=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const u=new URL(String(url));if(u.host==='oauth2.googleapis.com')return Response.json({access_token:'test',expires_in:3600});assert.equal(u.host,'firestore.googleapis.com');
 const body=options.body?JSON.parse(options.body):null;
 if(u.pathname.endsWith(':runQuery')){const q=body.structuredQuery,c=q.from[0].collectionId;const f=q.where.fieldFilter;calls.push({op:'query',c});return Response.json([...rows.entries()].filter(([key,row])=>key.startsWith(c+'/')&&row[f.field.fieldPath]===decode(f.value)).slice(0,q.limit).map(([key,row])=>({document:doc(c,key.split('/')[1],row)})));}
 const path=u.pathname.split('/documents/')[1], [c,id]=path.split('/').map(decodeURIComponent);const method=options.method||'GET';calls.push({op:method,c,id});
 if(method==='PATCH'){const patch=Object.fromEntries(Object.entries(body.fields).map(([k,v])=>[k,decode(v)]));seed(c,id,{...rows.get(c+'/'+id),...patch});return Response.json(doc(c,id,rows.get(c+'/'+id)));}
 if(method==='DELETE'){rows.delete(c+'/'+id);return new Response(null,{status:200});}
 const row=rows.get(c+'/'+id);return row?Response.json(doc(c,id,row)):Response.json({error:{message:'not found'}},{status:404});
};
let token;
const request=(path,body,auth=true)=>new Request('https://test.invalid'+path,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&token?{Authorization:'Bearer '+token}:{})}});
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'74');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}

const sign=p=>{const body=Buffer.from(JSON.stringify({...p,exp:Date.now()+3600000})).toString('base64url');return body+'.'+createHmac('sha256',env.SERVER_SECRET).update(body).digest('base64url')};
const principal=sign({sid:'MASTER',rol:'SUPERADMIN_PRINCIPAL'});
const log=console.log;console.log=()=>{};
try{
 const recovery={tipo:'RECUPERACION',request_key:'11111111-1111-4111-8111-111111111111',mail:'persona@test.invalid',detalle:'Necesito ayuda para recuperar la contraseña.',clave:'NO_GUARDAR',token:'NO_GUARDAR'};
 let created=await read(request('/support/requests',recovery,false));assert.equal(created.body.success,true,JSON.stringify(created.body));assert.equal(created.reads,0);assert.equal(created.calls.filter(c=>c.op==='PATCH').length,1);
 const rid=created.body.solicitud_id,row=rows.get('solicitudes_soporte/'+rid);assert.equal(row.clave,undefined);assert.equal(row.token,undefined);
 let repeat=await read(request('/support/requests',recovery,false));assert.equal(repeat.body.solicitud_id,rid);assert.equal(repeat.calls.length,0);
 let denied=await read(request('/superadmin/support/requests',null,false));assert.equal(denied.r.status,401);assert.equal(denied.calls.length,0);
 token=principal;
 let list=await read(request('/superadmin/support/requests'));assert.equal(list.body.results.length,1);assert.equal(list.reads,2);
 list=await read(request('/superadmin/support/requests'));assert.equal(list.reads,0);
 let result=await read(request('/superadmin/support/resolve',{solicitud_id:rid,estado:'EN_ATENCION',nota:'Se contactó a la persona.'}));assert.equal(result.body.success,true);assert.equal(result.reads,0);assert.equal(result.calls.filter(c=>c.op==='PATCH').length,1);
 list=await read(request('/superadmin/support/requests?estado=EN_ATENCION'));assert.equal(list.reads,0);assert.equal(list.body.results.length,1);
 result=await read(request('/superadmin/support/resolve',{solicitud_id:rid,estado:'CERRADA',nota:''}));assert.equal(result.r.status,400);assert.equal(result.calls.length,0);
 result=await read(request('/superadmin/support/resolve',{solicitud_id:rid,estado:'CERRADA',nota:'La persona recuperó el acceso por correo.'}));assert.equal(result.body.success,true);assert.equal(result.reads,0);assert.equal(result.calls.filter(c=>c.op==='PATCH').length,1);
 list=await read(request('/superadmin/support/requests'));assert.equal(list.reads,0);assert.equal(list.body.results.length,0);
 result=await read(request('/superadmin/support/resolve',{solicitud_id:rid,estado:'CERRADA',nota:'La persona recuperó el acceso por correo.'}));assert.equal(result.body.updated,false);assert.equal(result.calls.length,0);
 token=sign({sid:'LOCAL',rol:'ADMIN_LOCAL',ciudades:['D']});denied=await read(request('/superadmin/support/requests'));assert.equal(denied.r.status,403);assert.equal(denied.calls.length,0);
 created=await read(request('/support/requests',{tipo:'SOPORTE',mail:'persona@test.invalid',detalle:'No puedo guardar mi actividad.',anunciante_id:'A'},false));assert.equal(created.r.status,401);assert.equal(created.calls.length,0);
 const login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);token=login.body.token;
 created=await read(request('/support/requests',{tipo:'SOPORTE',mail:'persona@test.invalid',detalle:'No puedo guardar mi actividad.',anunciante_id:'A'}));assert.equal(created.body.success,true,JSON.stringify(created.body));assert.equal(created.reads,0);assert.equal(created.calls.filter(c=>c.op==='PATCH').length,1);
 denied=await read(request('/support/requests',{tipo:'SOPORTE',mail:'persona@test.invalid',detalle:'No puedo guardar mi actividad.',anunciante_id:'AJENO'}));assert.equal(denied.r.status,403);assert.equal(denied.calls.length,0);
 token=principal;list=await read(request('/superadmin/support/requests'));assert.equal(list.reads,0);assert.equal(list.body.results.length,1);assert.equal(list.body.results[0].suscriptor_id,'S');
}finally{console.log=log;globalThis.fetch=original;}
console.log('V73: solicitud 0 lecturas/1 escritura; repetición 0/0; bandeja cacheada 0 lecturas; atención/cierre 0 lecturas/1 escritura; auth y permisos preservados.');

