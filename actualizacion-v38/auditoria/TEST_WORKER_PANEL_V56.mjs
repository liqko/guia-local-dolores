import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import worker from '../../worker/WORKER_COMPLETO_V56.js';
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
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'56');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}
try{
 const login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);token=login.body.token;
 let publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.body.success,true);assert.equal(publicity.reads,5);assert.equal(publicity.body.publicidades[0].media[0].url,'imagen.jpg');assert.equal(publicity.body.categorias[0].categoria_id,'CAT');
 publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));assert.equal(publicity.reads,0);assert.equal(publicity.body.publicidades.length,1);assert.equal(publicity.calls.length,0);
 let pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.body.success,true,JSON.stringify(pharma.body));assert.equal(pharma.reads,2);assert.equal(pharma.body.ciclos[0].participantes.length,1);assert.equal(pharma.body.farmacias.length,1);
 pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.reads,0);assert.equal(pharma.body.ciclos[0].participantes.length,1);
 const farmEdit=await read(request('/farmacias',{action:'guardar_ciclo',advertiserId:'A',payload:{ciclo_id:'C',observaciones:'Nota del ciclo'}}));assert.equal(farmEdit.body.success,true,JSON.stringify(farmEdit.body));assert.deepEqual(farmEdit.calls.filter(x=>x.op==='PATCH').map(x=>x.c),['farmacias_ciclos']);
 pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.reads,0);assert.equal(pharma.body.ciclos[0].observaciones,'Nota del ciclo');assert.equal(pharma.body.ciclos[0].hora_inicio,'08:00');assert.equal(pharma.body.ciclos[0].participantes.length,1);
 const farmCreate=await read(request('/farmacias',{action:'guardar_ciclo',advertiserId:'A',payload:{ciudad_id:'D',fecha_inicio:'2026-10-08',hora_inicio:'09:00',participantes:[{sede_id:'SED'}]}}));assert.equal(farmCreate.body.success,true,JSON.stringify(farmCreate.body));assert.equal(farmCreate.calls.some(x=>x.op==='GET'&&['farmacias_ciclos','farmacias_ciclo_sedes'].includes(x.c)),false);
 pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(pharma.reads,0);assert.equal(pharma.body.ciclos.length,2);assert.equal(pharma.body.ciclos.find(x=>x.ciclo_id===farmCreate.body.ciclo_id).participantes.length,1);
 const missing=await read(request('/publicidad?action=getpaneldata&advertiserId=A',null,false));assert.equal(missing.r.status,401);assert.equal(missing.reads,0);
 const denied=await read(request('/publicidad?action=getpaneldata&advertiserId=B'));assert.equal(denied.r.status,403);assert.equal(denied.reads,0);
 const publicTerritory=await read(request('/territory/public',null,false));assert.equal(publicTerritory.r.status,200);assert.equal(publicTerritory.reads,0);assert.equal(publicTerritory.r.headers.get('X-GLD-Source'),'public-kv');
 const publicFarm=await read(request('/farmacias?action=turnos&ciudad_id=D&fecha=2026-10-07',null,false));assert.equal(publicFarm.body.turnos[0].nombre_ref,'Farmacia Test');assert.equal(publicFarm.body.turnos[0].sede_id,'SED');assert.equal(publicFarm.body.turnos[0].hora_desde,'08:00');assert.equal(publicFarm.r.status,200);assert.equal(publicFarm.reads,0);assert.equal(publicFarm.r.headers.get('X-GLD-Source'),'public-kv');
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
 // Alternar módulos después de mutaciones no invalida listas ajenas.
 pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));
 assert.equal(pharma.reads,0);assert.equal(pharma.calls.length,0);
 const cycleBefore=structuredClone(rows.get('farmacias_ciclos/C'));
 const participantBefore=structuredClone(rows.get('farmacias_ciclo_sedes/F'));
 const adsBefore=[...rows.entries()].filter(([key])=>key.startsWith('publicidad')).map(([key,row])=>[key,structuredClone(row)]);
 for(const activo of [false,true]){
  const toggle=await read(request('/farmacias',{action:'guardar_ciclo',advertiserId:'A',payload:{ciclo_id:'C',activo}}));
  assert.equal(toggle.body.success,true,JSON.stringify(toggle.body));
  assert.deepEqual(toggle.calls.filter(x=>x.op==='PATCH').map(x=>[x.c,x.id]),[['farmacias_ciclos','C']]);
  assert.equal(toggle.calls.some(x=>x.c.startsWith('publicidad')||x.c==='publicidades'),false);
  const cycle=rows.get('farmacias_ciclos/C');
  assert.equal(cycle.activo,activo);
  for(const field of ['hora_inicio','fecha_inicio','ciudad_id','observaciones','duracion_horas'])assert.deepEqual(cycle[field],cycleBefore[field]);
  assert.deepEqual(rows.get('farmacias_ciclo_sedes/F'),participantBefore);
  pharma=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));
  assert.equal(pharma.reads,0);assert.equal(pharma.body.ciclos.find(x=>x.ciclo_id==='C').activo,activo);
  publicity=await read(request('/publicidad?action=getpaneldata&advertiserId=A'));
  assert.equal(publicity.reads,0);assert.equal(publicity.calls.length,0);
 }
 assert.deepEqual([...rows.entries()].filter(([key])=>key.startsWith('publicidad')),adsBefore);
 const farmMissing=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'},false));
 assert.equal(farmMissing.r.status,401);assert.equal(farmMissing.calls.length,0);
 const farmDenied=await read(request('/farmacias',{action:'getPanelData',advertiserId:'B'}));
 assert.equal(farmDenied.r.status,403);assert.equal(farmDenied.calls.length,0);
 const adminBase=structuredClone(rows.get('anunciantes_administracion/A'));
 for(const funcionalidades of ['TURNOS_FARMA','FARMACIAS','FARMACIA','Farmacias de turno','farmacias_turno',['FARMACIAS']]){
  seed('anunciantes_administracion','A',{...adminBase,funcionalidades});for(const key of [...values.keys()])if(key.startsWith('panel:administration:v47:A:'))values.delete(key);
  const allowed=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));
  assert.equal(allowed.body.success,true,JSON.stringify({funcionalidades,body:allowed.body}));
  const warm=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(warm.reads,0);
 }
 for(const funcionalidades of ['', 'PUBLICIDAD','NO_FARMACIAS']){
  seed('anunciantes_administracion','A',{...adminBase,funcionalidades,turnos_farma:false});for(const key of [...values.keys()])if(key.startsWith('panel:administration:v47:A:'))values.delete(key);
  const notEnabled=await read(request('/farmacias',{action:'getPanelData',advertiserId:'A'}));assert.equal(notEnabled.body.success,false);
 }
 seed('anunciantes','A',{nombre:'Comercio',descripcion:'Texto completo',img1:'foto.jpg'});
 let commerce=await read(request('/commerce?action=anunciante&advertiserId=A'));assert.equal(commerce.body.success,true,JSON.stringify(commerce.body));
 commerce=await read(request('/commerce?action=anunciante&advertiserId=A'));assert.equal(commerce.reads,0);assert.equal(commerce.body.advertiser.datos.descripcion,'Texto completo');assert.equal(commerce.body.advertiser.sedes.length,1);
 seed('anunciantes_administracion','A',{...adminBase,funcionalidades:['PROMOS'],funcionalidades_config:{PROMOS:{cupo:10}}});for(const key of [...values.keys()])if(key.startsWith('panel:administration:v47:A:'))values.delete(key);
 values.set('catalogs:promos:v1',JSON.stringify({categorias:[{categoria_id:'CAT',nombre:'Oferta'}]}));
 seed('promos','PRO1',{promo_id:'PRO1',anunciante_id:'A',ciudad_id:'D',categoria_id:'CAT',promo:'Anterior',img:'foto',otros:'Conservar',pausado:false});
 seed('promos','OTRO',{promo_id:'OTRO',anunciante_id:'B',ciudad_id:'D',promo:'Ajeno',pausado:false});
 let panel=await read(request('/promos',{action:'getPanelData',advertiserId:'A'}));assert.equal(panel.body.success,true,JSON.stringify(panel.body));assert.equal(panel.reads,2);assert.equal(panel.body.promos.length,1);
 panel=await read(request('/promos',{action:'getPanelData',advertiserId:'A'}));assert.equal(panel.reads,0);assert.equal(panel.body.advertiser.img1,'foto.jpg');assert.equal(panel.body.sedes.length,1);
 let list=await read(request('/promos',{action:'getPromos',advertiserId:'A'}));assert.equal(list.reads,0);assert.equal(list.body.promos.length,1);
 let changed=await read(request('/promos',{action:'updatePromo',advertiserId:'A',payload:{promo_id:'PRO1',promo:'Con punto.'}}));assert.equal(changed.body.success,true,JSON.stringify(changed.body));assert.deepEqual(changed.calls.filter(c=>c.op==='PATCH').map(c=>c.c),['promos']);assert.equal(changed.calls.filter(c=>c.op==='query').length,0);
 list=await read(request('/promos',{action:'getPromos',advertiserId:'A'}));assert.equal(list.reads,0);assert.equal(list.body.promos[0].promo,'Con punto.');assert.equal(list.body.promos[0].img,'foto');assert.equal(list.body.promos[0].otros,'Conservar');
 changed=await read(request('/promos',{action:'updatePromo',advertiserId:'A',payload:{promo_id:'PRO1',pausado:true}}));assert.equal(changed.body.success,true);
 list=await read(request('/promos',{action:'getPromos',advertiserId:'A'}));assert.equal(list.reads,0);assert.equal(list.body.promos[0].pausado,true);
 changed=await read(request('/promos',{action:'createPromo',advertiserId:'A',payload:{ciudad_id:'D',categoria_id:'CAT',promo:'Nueva',pausado:true}}));assert.equal(changed.body.success,true,JSON.stringify(changed.body));assert.equal(changed.calls.some(c=>c.op==='GET'&&c.c==='promos'&&c.id===changed.body.promo.promo_id),false);
 list=await read(request('/promos',{action:'getPromos',advertiserId:'A'}));assert.equal(list.reads,0);assert.equal(list.body.promos.length,2);
 changed=await read(request('/promos',{action:'deletePromo',advertiserId:'A',payload:{promo_id:'PRO1'}}));assert.equal(changed.body.success,true);
 panel=await read(request('/promos',{action:'getPanelData',advertiserId:'A'}));assert.equal(panel.reads,0);assert.equal(panel.body.promos.length,1);assert.equal(rows.get('promos/OTRO').promo,'Ajeno');
 const deniedPromo=await read(request('/promos',{action:'getPanelData',advertiserId:'B'}));assert.equal(deniedPromo.r.status,403);assert.equal(deniedPromo.reads,0);
 seed('anunciantes_administracion','A',{...adminBase,funcionalidades:['EVENTOS','EVENTOS_FREE','ACTIVIDADES'],funcionalidades_config:{EVENTOS:{cupo:10},EVENTOS_FREE:{cupo:10},ACTIVIDADES:{cupo:10}}});for(const key of [...values.keys()])if(key.startsWith('panel:administration:v47:A:'))values.delete(key);
 values.set('catalogs:eventos:v1',JSON.stringify({categorias:[{categoria_id:'EV',nombre:'Evento'}],lugares:[],partners:[]}));
 values.set('catalogs:actividades:v1',JSON.stringify({categorias:[],lugares:[]}));
 seed('eventos','E',{evento_id:'E',anunciante_id:'A',nivel:'VIP',nombre_evento:'Evento propio',ciudad_id:'D',pausado:false,estado:'APROBADO',estado_moderacion:'APROBADO'});
 seed('eventos','E2',{evento_id:'E2',anunciante_id:'A',nivel:'FREE',nombre_evento:'Gratis',ciudad_id:'D',pausado:false});
 seed('eventos','EB',{evento_id:'EB',anunciante_id:'B',nivel:'VIP',nombre_evento:'Ajeno',ciudad_id:'D'});
 seed('evento_programacion','EP',{evento_programacion_id:'EP',evento_id:'E',ciudad_id:'D',fecha:'2026-10-09',hora:'20:00'});
 seed('evento_programacion','EP2',{evento_programacion_id:'EP2',evento_id:'E2',ciudad_id:'D',fecha:'2026-10-10',hora:'21:00'});
 let ev=await read(request('/events-new',{action:'getPanelData',advertiserId:'A'}));assert.equal(ev.body.success,true,JSON.stringify(ev.body));assert.equal(ev.body.eventos.length,1);assert.equal(ev.body.eventos_free.length,1);assert.equal(ev.body.eventos[0].programacion[0].hora,'20:00');
 ev=await read(request('/events-new',{action:'getPanelData',advertiserId:'A'}));assert.equal(ev.reads,0);assert.equal(ev.body.eventos_free[0].programacion.length,1);
 let evList=await read(request('/events-new',{action:'getVipEvents',advertiserId:'A'}));assert.equal(evList.reads,0);assert.equal(evList.body.events.length,1);
 let evChange=await read(request('/events-new',{action:'pauseVipEvent',advertiserId:'A',payload:{evento_id:'E',pausado:true}}));assert.equal(evChange.body.success,true,JSON.stringify(evChange.body));
 ev=await read(request('/events-new',{action:'getPanelData',advertiserId:'A'}));assert.equal(ev.reads,0);assert.equal(ev.body.eventos[0].pausado,true);assert.equal(ev.body.eventos[0].programacion[0].hora,'20:00');
 evChange=await read(request('/events-new',{action:'deleteVipEvent',advertiserId:'A',payload:{evento_id:'E'}}));assert.equal(evChange.body.success,true,JSON.stringify(evChange.body));
 ev=await read(request('/events-new',{action:'getPanelData',advertiserId:'A'}));assert.equal(ev.reads,0);assert.equal(ev.body.eventos.length,0);assert.equal(ev.body.eventos_free.length,1);assert.ok(rows.has('eventos/EB'));
 seed('actividades','AC',{actividad_id:'AC',anunciante_id:'A',titulo:'Actividad propia',activo:true,aprobado:true,estado:'ACTIVA'});
 seed('actividad_horarios','AH',{actividad_horario_id:'AH',actividad_id:'AC',ciudad_id:'D',hora_inicio:'18:00'});
 let ac=await read(request('/actividades?action=getpaneldata&advertiserId=A'));assert.equal(ac.body.success,true,JSON.stringify(ac.body));assert.equal(ac.body.actividades[0].horarios[0].hora_inicio,'18:00');
 ac=await read(request('/actividades?action=getpaneldata&advertiserId=A'));assert.equal(ac.reads,0);
 let acChange=await read(request('/actividades',{action:'pausar',advertiserId:'A',actividad_id:'AC'}));assert.equal(acChange.body.success,true,JSON.stringify(acChange.body));
 ac=await read(request('/actividades?action=getpaneldata&advertiserId=A'));assert.equal(ac.reads,0);assert.equal(ac.body.actividades[0].activo,false);assert.equal(ac.body.actividades[0].horarios[0].hora_inicio,'18:00');
 acChange=await read(request('/actividades',{action:'eliminar',advertiserId:'A',actividad_id:'AC'}));assert.equal(acChange.body.success,true,JSON.stringify(acChange.body));
 ac=await read(request('/actividades?action=getpaneldata&advertiserId=A'));assert.equal(ac.reads,0);assert.equal(ac.body.actividades.length,0);
 seed('anunciantes_administracion','A',{...adminBase,funcionalidades:['EF GENERAL','EF PROVINCIAL','EF LOCAL'],funcionalidades_config:{EFEMERIDES_PROVINCIAL:{todas_provincias:true},EFEMERIDES_LOCAL:{todas_ciudades:true}}});for(const key of [...values.keys()])if(key.startsWith('panel:administration:v47:A:'))values.delete(key);
 seed('efemerides_bis','EFG',{efemeride_id:'EFG',tipo:'GENERAL',nombre:'General',tipo_fecha:'FIJA',mes:10,dia:9,activo:true});
 seed('efemerides_bis','EFL',{efemeride_id:'EFL',tipo:'LOCAL',ciudad_id:'D',nombre:'Local',tipo_fecha:'FIJA',mes:10,dia:9,activo:true});
 seed('efemerides_bis','EFP',{efemeride_id:'EFP',tipo:'PROVINCIAL',provincia_id:'P',nombre:'Provincial',tipo_fecha:'FIJA',mes:10,dia:9,activo:true});
 let ef=await read(request('/efemerides',{action:'getPanelData',advertiserId:'A'}));assert.equal(ef.body.success,true,JSON.stringify(ef.body));assert.equal(ef.body.efemerides.length,3);assert.equal(ef.body.permisos.efemerides_local,true);
 ef=await read(request('/efemerides',{action:'getPanelData',advertiserId:'A'}));assert.equal(ef.reads,0);assert.equal(ef.body.efemerides.length,3);
 let efChange=await read(request('/efemerides',{action:'desactivar',advertiserId:'A',efemeride_id:'EFL'}));assert.equal(efChange.body.success,true,JSON.stringify(efChange.body));
 ef=await read(request('/efemerides',{action:'getPanelData',advertiserId:'A'}));assert.equal(ef.reads,0);assert.equal(ef.body.efemerides.find(x=>x.id==='EFL').activo,false);
 efChange=await read(request('/efemerides',{action:'guardar',advertiserId:'A',payload:{efemeride_id:'EFL',nombre:'Local editada',tipo:'PROVINCIAL',provincia_id:'P'}}));assert.equal(efChange.body.success,true,JSON.stringify(efChange.body));
 ef=await read(request('/efemerides',{action:'getPanelData',advertiserId:'A'}));assert.equal(ef.reads,0);assert.equal(ef.body.efemerides.length,3);assert.equal(ef.body.efemerides.find(x=>x.id==='EFL').tipo,'PROVINCIAL');
 efChange=await read(request('/efemerides',{action:'eliminar',advertiserId:'A',efemeride_id:'EFL'}));assert.equal(efChange.body.success,true);
 ef=await read(request('/efemerides',{action:'getPanelData',advertiserId:'A'}));assert.equal(ef.reads,0);assert.equal(ef.body.efemerides.length,2);
 console.log('Bundle V56 PASS: autorización histórica y negativa; cargas repetidas0; alternancia entre módulos0; pausar/reactivar sólo ciclo propio; conserva horarios, participantes y publicidad; permisos401/403 sin Firestore.');
}finally{globalThis.fetch=original;}
