import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker from '../../worker/WORKER_COMPLETO_V57.js';
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
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'57');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}

const log=console.log;console.log=()=>{};
try{
 const signed=Buffer.from(JSON.stringify({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',exp:Date.now()+3600000})).toString('base64url');token=signed+'.'+createHmac('sha256',env.SERVER_SECRET).update(signed).digest('base64url');
 seed('eventos','EV',{evento_id:'EV',anunciante_id:'A',nombre_evento:'Pendiente',nivel:'FREE',ciudad_id:'D',estado_moderacion:'PENDIENTE',estado:'PENDIENTE',pausado:false});
 seed('eventos','REV',{evento_id:'REV',anunciante_id:'A',nombre_evento:'Revisión',ciudad_id:'D',estado_moderacion:'REVISION',estado:'PENDIENTE',pausado:false});
 seed('actividades','ACT',{actividad_id:'ACT',anunciante_id:'A',nombre:'Actividad pendiente',ciudad_id:'D',aprobado:false,activo:true,estado:'PENDIENTE'});
 seed('actividad_horarios','H',{horario_id:'H',actividad_id:'ACT',ciudad_id:'D',hora_desde:'10:00',activo:true});
 seed('solicitudes_anunciante','REQ',{solicitud_id:'REQ',modo:'RECLAMAR',anunciante_id:'A',suscriptor_id:'S',estado:'PENDIENTE'});
 seed('anunciantes','A',{nombre:'Comercio existente'});
 values.set('relations:prepared:v1:event:EV',JSON.stringify({revision:'',data:[]}));
 values.set('relations:prepared:v1:event:REV',JSON.stringify({revision:'',data:[]}));
 values.set('relations:prepared:v1:activity:ACT',JSON.stringify({revision:'',data:[rows.get('actividad_horarios/H')]}));
 let pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.r.status,200);assert.equal(pending.reads,4);assert.deepEqual(pending.body.cantidades,{eventos:2,actividades:1,anunciantes:1,total:4});
 pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.reads,0);assert.equal(pending.body.eventos.length,2);
 let result=await read(request('/superadmin/moderation/resolve',{tipo:'EVENTO',id:'EV',decision:'APROBAR'}));assert.equal(result.body.success,true,JSON.stringify(result.body));assert.equal(result.reads,1);assert.deepEqual(result.calls.filter(x=>x.op==='PATCH').map(x=>[x.c,x.id]),[['eventos','EV']]);assert.equal(result.calls.some(x=>x.op==='query'),false);
 pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.reads,0);assert.deepEqual(pending.body.eventos.map(x=>x.id),['REV']);
 let pub=await read(request('/events-new?ciudad_id=D',null,false));assert.equal(pub.reads,0);assert.equal(pub.body.events.some(x=>x.evento_id==='EV'),true);
 result=await read(request('/superadmin/moderation/resolve',{tipo:'ACTIVIDAD',id:'ACT',decision:'APROBAR'}));assert.equal(result.body.success,true,JSON.stringify(result.body));assert.equal(result.reads,1);assert.deepEqual(result.calls.filter(x=>x.op==='PATCH').map(x=>[x.c,x.id]),[['actividades','ACT']]);assert.equal(rows.get('actividad_horarios/H').hora_desde,'10:00');
 pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.reads,0);assert.equal(pending.body.actividades.length,0);
 pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.reads,0);assert.equal(pub.body.actividades[0].actividad_id,'ACT');assert.equal(pub.body.actividades[0].horarios[0].hora_desde,'10:00');
 result=await read(request('/superadmin/moderation/resolve',{tipo:'EVENTO',id:'REV',decision:'RECHAZAR'}));assert.equal(result.body.success,true);pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.reads,0);assert.equal(pending.body.eventos.length,0);
 result=await read(request('/superadmin/moderation/resolve',{tipo:'ANUNCIANTE',id:'REQ',decision:'APROBAR'}));assert.equal(result.body.success,true,JSON.stringify(result.body));assert.equal(rows.get('suscriptor_anunciante/S__A').rol,'PROPIETARIO');
 pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.reads,0);assert.equal(pending.body.cantidades.total,0);
 let unauthorized=await read(request('/superadmin/moderation/pending',null,false));assert.equal(unauthorized.r.status,401);assert.equal(unauthorized.reads,0);
 result=await read(request('/superadmin/moderation/resolve',{tipo:'EVENTO',id:'NOEXISTE',decision:'APROBAR'}));assert.equal(result.body.success,false);assert.equal(result.calls.filter(x=>x.op==='PATCH').length,0);
 log('PASS GH V57: pendientes frío4/repetición0; aprobación evento y actividad 1 lectura+1 escritura; publicación KV0; rechazo y reclamo conservan listas actualizadas; autorización y faltantes.');
}finally{globalThis.fetch=original;console.log=log;}
