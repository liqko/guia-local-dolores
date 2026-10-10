import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker from './WORKER_COMPLETO_V77.js';
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
values.set('admin:catalogs:v2',JSON.stringify({moderacion_18:[]}));
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
const request=(path,body,auth=true)=>new Request('https://test.invalid'+path,{...(body?{method:'POST',body:JSON.stringify({...body,declaracion_publicacion:{aceptada:true,version:'2026-10-10'}})}:{}),headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&token?{Authorization:'Bearer '+token}:{})}});
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'77');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}

const sign=p=>{const body=Buffer.from(JSON.stringify({...p,exp:Date.now()+3600000})).toString('base64url');return body+'.'+createHmac('sha256',env.SERVER_SECRET).update(body).digest('base64url')};
const principal=sign({sid:'MASTER',rol:'SUPERADMIN_PRINCIPAL'}),nonce='11111111-1111-4111-8111-111111111111';
const log=console.log;console.log=()=>{};
try{
 let created=await read(request('/support/requests',{tipo:'RECUPERACION',mail:'persona@test.invalid',detalle:'Necesito ayuda para recuperar mi acceso.',request_key:nonce},false));assert.equal(created.body.success,true);assert.ok(created.body.ticket_token);assert.equal(created.reads,0);
 const id=created.body.solicitud_id,receipt=created.body.ticket_token;
 let other=await read(request('/support/requests',{tipo:'RECUPERACION',mail:'persona@test.invalid',detalle:'Necesito ayuda para recuperar mi acceso.',request_key:'22222222-2222-4222-8222-222222222222'},false));assert.notEqual(other.body.solicitud_id,id);assert.notEqual(other.body.ticket_token,receipt);
 token=principal;let result=await read(request('/superadmin/support/reply',{solicitud_id:id,texto:'Ingresá el correo con el que registraste la cuenta y solicitá el código.',request_key:nonce}));assert.equal(result.body.success,true);assert.equal(result.reads,0);assert.equal(result.calls.filter(c=>c.op==='PATCH').length,1);
 token=receipt;let conversation=await read(request('/support/conversation?solicitud_id='+id));assert.equal(conversation.body.success,true,JSON.stringify(conversation.body));assert.equal(conversation.body.mensajes[0].autor,'ADMIN');
 conversation=await read(request('/support/conversation?solicitud_id='+id));assert.equal(conversation.reads,0);
 result=await read(request('/support/reply',{solicitud_id:id,texto:'Ya recibí el código, gracias.',request_key:nonce}));assert.equal(result.body.success,true);assert.equal(result.reads,0);assert.equal(result.calls.filter(c=>c.op==='PATCH').length,1);
 result=await read(request('/support/reply',{solicitud_id:id,texto:'Ya recibí el código, gracias.',request_key:nonce}));assert.equal(result.calls.length,0);
 token=principal;conversation=await read(request('/superadmin/support/conversation?solicitud_id='+id));assert.equal(conversation.reads,0);assert.equal(conversation.body.mensajes.length,2);assert.equal(conversation.body.mensajes[1].autor,'USUARIO');
 result=await read(request('/superadmin/support/resolve',{solicitud_id:id,estado:'CERRADA',nota:'Acceso recuperado por correo.'}));assert.equal(result.body.success,true);assert.equal(result.reads,0);
 token=receipt;conversation=await read(request('/support/conversation?solicitud_id='+id));assert.equal(conversation.body.solicitud.resolucion,'Acceso recuperado por correo.');
 result=await read(request('/support/reply',{solicitud_id:id,texto:'Otro mensaje',request_key:nonce}));assert.equal(result.r.status,409);assert.equal(result.calls.length,0);
 result=await read(request('/support/conversation?solicitud_id='+other.body.solicitud_id));assert.equal(result.r.status,401);assert.equal(result.calls.length,0);
 token=receipt.slice(0,-1)+'x';result=await read(request('/support/conversation?solicitud_id='+id));assert.equal(result.r.status,401);assert.equal(result.calls.length,0);
 token=sign({sid:'LOCAL',rol:'ADMIN_LOCAL',ciudades:['D']});result=await read(request('/superadmin/support/conversation?solicitud_id='+id));assert.equal(result.r.status,401);
 const login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);token=login.body.token;
 const mineTicket=await read(request('/support/requests',{tipo:'SOPORTE',mail:'persona@test.invalid',detalle:'Ayuda con el panel de actividades.',anunciante_id:'A'}));assert.equal(mineTicket.body.success,true);
 let mine=await read(request('/support/mine'));assert.equal(mine.body.results.length,1);assert.equal(mine.body.results[0].solicitud_id,mineTicket.body.solicitud_id);mine=await read(request('/support/mine'));assert.equal(mine.reads,0);
 result=await read(request('/support/conversation?solicitud_id='+mineTicket.body.solicitud_id));assert.equal(result.body.success,true);
 result=await read(request('/support/conversation?solicitud_id='+id));assert.equal(result.r.status,403);
}finally{console.log=log;globalThis.fetch=original;}
console.log('V74: usuario sin login y administrador conversan dentro del panel; recibo privado aislado; respuesta 0 lecturas/1 escritura; repetición 0/0; cierre visible y permisos comprobados.');

