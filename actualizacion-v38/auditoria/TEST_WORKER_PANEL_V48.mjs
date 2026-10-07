import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import worker from '../../worker/WORKER_COMPLETO_V48.js';
const rows=new Map(),values=new Map(),calls=[];
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SERVER_SECRET:'test-only',FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@test.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}};
function seed(c,id,data){rows.set(c+'/'+id,{id,...data});}
function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};return {stringValue:String(v)};}
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return v.arrayValue.values.map(decode);if('nullValue'in v)return null;return v.stringValue??v.booleanValue??Number(v.integerValue);}
function doc(c,id,data){return {name:'projects/test/databases/(default)/documents/'+c+'/'+id,fields:Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id').map(([k,v])=>[k,encode(v)]))};}
seed('suscriptores','S',{mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true});
seed('suscriptor_anunciante','R',{suscriptor_id:'S',anunciante_id:'A',anunciante_nombre:'Comercio',rol:'PROPIETARIO',permisos:'PUBLICIDAD,TURNOS_FARMA',activo:true});
seed('anunciantes_administracion','A',{funcionalidades:'PUBLICIDAD,TURNOS_FARMA',turnos_farma:'*',funcionalidades_config:{PUBLICIDAD:{activas_max:3,guardadas_max:6,cambios_activos_por_dia_max:5}}});
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
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'48');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}
try{
 const login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);token=login.body.token;
 let publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.body.success,true);assert.equal(publicity.reads,5);assert.equal(publicity.body.publicidades[0].media[0].url,'imagen.jpg');assert.equal(publicity.body.categorias[0].categoria_id,'CAT');
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.publicidades.length,1);assert.equal(publicity.calls.length,0);
 let pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.body.success,true,JSON.stringify(pharma.body));assert.equal(pharma.reads,3);assert.equal(pharma.body.ciclos[0].participantes.length,1);assert.equal(pharma.body.farmacias.length,1);
 pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.reads,0);assert.equal(pharma.body.ciclos[0].participantes.length,1);
 const farmEdit=await read(request('/farmacias',{action:'guardar_ciclo',advertiserId:'A',payload:{ciclo_id:'C',observaciones:'Nota del ciclo'}}));assert.equal(farmEdit.body.success,true,JSON.stringify(farmEdit.body));assert.deepEqual(farmEdit.calls.filter(x=>x.op==='PATCH').map(x=>x.c),['farmacias_ciclos']);
 pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.reads,0);assert.equal(pharma.body.ciclos[0].observaciones,'Nota del ciclo');assert.equal(pharma.body.ciclos[0].hora_inicio,'08:00');assert.equal(pharma.body.ciclos[0].participantes.length,1);
 const farmCreate=await read(request('/farmacias',{action:'guardar_ciclo',advertiserId:'A',payload:{ciudad_id:'D',fecha_inicio:'2026-10-08',hora_inicio:'09:00',participantes:[{sede_id:'SED'}]}}));assert.equal(farmCreate.body.success,true,JSON.stringify(farmCreate.body));assert.equal(farmCreate.calls.some(x=>x.op==='GET'&&['farmacias_ciclos','farmacias_ciclo_sedes'].includes(x.c)),false);
 pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.reads,0);assert.equal(pharma.body.ciclos.length,2);assert.equal(pharma.body.ciclos.find(x=>x.ciclo_id===farmCreate.body.ciclo_id).participantes.length,1);
 const missing=await read(request('/publicidad?action=getpaneldata&advertiserId=A',null,false));assert.equal(missing.r.status,401);assert.equal(missing.reads,0);
 const denied=await read(request('/publicidad?action=getpaneldata&advertiserId=B'));assert.equal(denied.r.status,403);assert.equal(denied.reads,0);
 const publicTerritory=await read(request('/territory/public',null,false));assert.equal(publicTerritory.r.status,200);assert.equal(publicTerritory.reads,0);assert.equal(publicTerritory.r.headers.get('X-GLD-Source'),'public-kv');
 const publicFarm=await read(request('/farmacias?action=turnos&ciudad_id=D',null,false));assert.equal(publicFarm.r.status,200);assert.equal(publicFarm.reads,0);assert.equal(publicFarm.r.headers.get('X-GLD-Source'),'public-kv');
 const publicAds=await read(request('/publicidad?action=publicas&ciudad_id=D&modulo=GUIA',null,false));assert.equal(publicAds.r.status,200);assert.equal(publicAds.body.publicidades[0].img,'imagen.jpg');assert.equal(publicAds.reads,0);assert.equal(publicAds.r.headers.get('X-GLD-Source'),'public-kv');

 const rename=await read(request('/publicidad',{action:'guardar',advertiserId:'A',payload:{publicidad_id:'P',titulo:'Nuevo nombre'}}));assert.equal(rename.body.success,true,JSON.stringify(rename.body));
 assert.equal(rows.get('publicidades/P').titulo,'Nuevo nombre');assert.equal(rows.get('publicidades/P').estado,'INACTIVA');assert.equal(rows.get('publicidad_media/M').url,'imagen.jpg');
 assert.deepEqual(rename.calls.filter(x=>x.op==='PATCH').map(x=>x.c),['publicidades']);
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.publicidades[0].titulo,'Nuevo nombre');assert.equal(publicity.body.publicidades[0].media[0].url,'imagen.jpg');
 const image=await read(request('/publicidad',{action:'guardar',advertiserId:'A',payload:{publicidad_id:'P',media:[{url:'nueva.jpg'}]}}));assert.equal(image.body.success,true,JSON.stringify(image.body));assert.equal(rows.get('publicidades/P').titulo,'Nuevo nombre');
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.publicidades[0].media[0].url,'nueva.jpg');
 const create=await read(request('/publicidad',{action:'guardar',advertiserId:'A',payload:{titulo:'Segundo',formato:'IMAGEN',media:[{url:'segunda.jpg'}],ciudades:['D'],categorias:['U:CAT']}}));assert.equal(create.body.success,true,JSON.stringify(create.body));
 assert.equal(create.calls.some(x=>x.op==='GET'&&['publicidades','publicidad_media','publicidad_segmentacion'].includes(x.c)),false);
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.publicidades.length,2);assert.equal(publicity.body.publicidades.find(x=>x.publicidad_id===create.body.publicidad_id).media[0].url,'segunda.jpg');
 // Las listas hijas nuevas se preparan al crear; ambas cargas completas son cero.
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);
 const activate=await read(request('/publicidad',{action:'actualizar_activos',advertiserId:'A',publicidad_ids:['P']}));assert.equal(activate.body.success,true,JSON.stringify(activate.body));
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.publicidades.find(x=>x.publicidad_id==='P').estado,'ACTIVA');assert.equal(publicity.body.cambios_activos.usados,1);
 const visible=await read(request('/publicidad?action=publicas&ciudad_id=D&modulo=GUIA',null,false));assert.equal(visible.reads,0);assert.equal(visible.body.publicidades[0].img,'nueva.jpg');
 const pause=await read(request('/publicidad',{action:'actualizar_activos',advertiserId:'A',publicidad_ids:[]}));assert.equal(pause.body.success,true,JSON.stringify(pause.body));
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.cambios_activos.usados,2);
 const deletion=await read(request('/publicidad',{action:'eliminar',advertiserId:'A',publicidad_id:'P'}));assert.equal(deletion.body.success,true,JSON.stringify(deletion.body));
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.publicidades.length,1);assert.equal(publicity.body.publicidades[0].publicidad_id,create.body.publicidad_id);
 console.log('Bundle V48 PASS: Publicidad fría5/repetida0; Farmacias fría3/repetida0 con administración preparada; conserva contenido y permisos; público0Firestore.');
}finally{globalThis.fetch=original;}
