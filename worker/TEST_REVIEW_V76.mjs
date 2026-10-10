import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker from './WORKER_COMPLETO_V76.mjs';
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
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'76');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}


const savedLog=console.log;console.log=()=>{};
try{
 seed('anunciantes_administracion','A',{actividades:true,actividades_cant:10,funcionalidades:'ACTIVIDADES'});
 seed('actividades','ACT',{actividad_id:'ACT',anunciante_id:'A',nombre:'Clase de música',categoria:'CULTURA',ciudad_id:'D',aprobado:true,activo:true,estado:'ACTIVA',vigente_desde:'2026-01-01',vigente_hasta:'2099-12-31',contenido_adulto:false,revision_adulto:'NO_APLICA'});
 seed('actividad_horarios','H',{actividad_horario_id:'H',actividad_id:'ACT',ciudad_id:'D',hora_desde:'10:00',tipo_lugar:'SEDE',sede_id:'SED',lugar_id:'',lugar_texto:'',direccion:'',maps:'',activo:true});
 const adm=Buffer.from(JSON.stringify({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',exp:Date.now()+3600000})).toString('base64url');
 const adminToken=adm+'.'+createHmac('sha256',env.SERVER_SECRET).update(adm).digest('base64url');
 const login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);const userToken=login.body.token;token=userToken;
 const save=payload=>read(request('/actividades',{action:'guardar',advertiserId:'A',payload:{actividad_id:'ACT',...payload}}));
 let r=await save({nombre:'Clase de música'});assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(r.calls.filter(c=>c.op==='PATCH').length,0);assert.equal(rows.get('actividades/ACT').aprobado,true);
 token=adminToken;await read(request('/superadmin/moderation/pending'));token=userToken;
 r=await save({nombre:'Clase de música nueva'});assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(rows.get('actividades/ACT').aprobado,false,'Una edición debe retirar la aprobación');assert.equal(rows.get('actividades/ACT').estado,'PENDIENTE');assert.deepEqual(r.calls.filter(c=>c.op==='PATCH').map(c=>c.c),['actividades']);
 let pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.body.actividades.some(a=>a.actividad_id==='ACT'),false);assert.equal(pub.reads,0);
 token=adminToken;let pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.body.actividades.some(a=>a.actividad_id==='ACT'),true);assert.equal(pending.reads,0);
 r=await read(request('/superadmin/moderation/resolve',{tipo:'ACTIVIDAD',id:'ACT',decision:'APROBAR'}));assert.equal(r.body.success,true,JSON.stringify(r.body));
 pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.body.actividades.some(a=>a.actividad_id==='ACT'&&a.nombre==='Clase de música nueva'),true);
 token=userToken;r=await save({nombre:'Clase de música nueva'});assert.equal(r.calls.some(c=>c.op==='PATCH'),false);assert.equal(rows.get('actividades/ACT').aprobado,true);assert.equal(r.body.updated,false);
 const horario={...rows.get('actividad_horarios/H'),hora_desde:'11:00'};delete horario.id;
 r=await save({horarios:[horario]});assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(rows.get('actividades/ACT').aprobado,false);assert.equal(rows.get('actividad_horarios/H').hora_desde,'11:00');assert.deepEqual(r.calls.filter(c=>c.op==='PATCH').map(c=>c.c).sort(),['actividad_horarios','actividades']);
 pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.body.actividades.some(a=>a.actividad_id==='ACT'),false);
 token=adminToken;r=await read(request('/superadmin/moderation/resolve',{tipo:'ACTIVIDAD',id:'ACT',decision:'APROBAR'}));assert.equal(r.body.success,true);token=userToken;
 r=await save({horarios:[horario]});assert.equal(r.body.success,true);assert.equal(r.calls.some(c=>c.op==='PATCH'),false);assert.equal(rows.get('actividades/ACT').aprobado,true);
 r=await save({aprobado:false,estado:'PENDIENTE'});assert.equal(r.calls.some(c=>c.op==='PATCH'),false);assert.equal(rows.get('actividades/ACT').aprobado,true);
 r=await save({contenido_adulto:true,nombre:'Actividad para adultos'});assert.equal(r.body.success,true);assert.equal(rows.get('actividades/ACT').revision_adulto,'PENDIENTE');assert.equal(rows.get('actividades/ACT').aprobado,false);
 token=adminToken;r=await read(request('/superadmin/moderation/resolve',{tipo:'ACTIVIDAD',id:'ACT',decision:'APROBAR'}));assert.equal(r.body.success,true);token=userToken;
 // Una actividad con revisión adulta previa aprobada debe volver a revisión adulta al editarse.
 rows.get('actividades/ACT').revision_adulto='APROBADO';
 for(const key of [...values.keys()])if(key.startsWith('panel:'))values.delete(key);
 r=await save({nombre:'Actividad para adultos editada'});assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(rows.get('actividades/ACT').revision_adulto,'PENDIENTE');assert.equal(rows.get('actividades/ACT').aprobado,false);
 const unauthorized=await read(request('/actividades',{action:'guardar',advertiserId:'A',payload:{actividad_id:'ACT',nombre:'Sin permiso'}},false));assert.equal(unauthorized.r.status,401);assert.equal(unauthorized.calls.some(c=>c.op==='PATCH'),false);
 savedLog('V76 PASS: edición de contenido/horarios → retiro público → pendiente GH → aprobación → publicación; guardar sin cambios no escribe ni retira aprobación; sesión obligatoria.');
}finally{console.log=savedLog;globalThis.fetch=original;}
