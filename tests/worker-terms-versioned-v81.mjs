import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker from '../worker/WORKER_COMPLETO_V81.js';
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
 if(method==='PATCH'){if(u.searchParams.get('currentDocument.exists')==='false'&&rows.has(c+'/'+id))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});const patch=Object.fromEntries(Object.entries(body.fields).map(([k,v])=>[k,decode(v)]));seed(c,id,{...rows.get(c+'/'+id),...patch});return Response.json(doc(c,id,rows.get(c+'/'+id)));}
 if(method==='DELETE'){rows.delete(c+'/'+id);return new Response(null,{status:200});}
 const row=rows.get(c+'/'+id);return row?Response.json(doc(c,id,row)):Response.json({error:{message:'not found'}},{status:404});
};
let token;
const request=(path,body,auth=true)=>new Request('https://test.invalid'+path,{...(body?{method:'POST',body:JSON.stringify({...body,declaracion_publicacion:{aceptada:true,version:'2026-10-10'}})}:{}),headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&token?{Authorization:'Bearer '+token}:{})}});
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'81');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}


const log=console.log;console.log=()=>{};
try{
 seed('anunciantes_administracion','A',{actividades:true,actividades_cant:20,eventos:true,eventos_free:true,eventos_cant:20,eventos_free_cant:20,funcionalidades:'ACTIVIDADES,EVENTOS,EVENTOS_FREE,PUBLICIDAD',funcionalidades_config:{PUBLICIDAD:{activas_max:3,guardadas_max:6,cambios_activos_por_dia_max:5}}});
 seed('actividades','ACT',{actividad_id:'ACT',anunciante_id:'A',nombre:'Clase de música',categoria:'CULTURA',ciudad_id:'D',aprobado:true,activo:true,estado:'ACTIVA',vigente_desde:'2026-01-01',vigente_hasta:'2099-12-31',contenido_adulto:false,revision_adulto:'NO_APLICA'});
 seed('actividad_horarios','H',{actividad_horario_id:'H',actividad_id:'ACT',ciudad_id:'D',hora_desde:'10:00',tipo_lugar:'SEDE',sede_id:'SED',lugar_id:'',lugar_texto:'',direccion:'',maps:'',activo:true});
 const adm=Buffer.from(JSON.stringify({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',exp:Date.now()+3600000})).toString('base64url');const adminToken=adm+'.'+createHmac('sha256',env.SERVER_SECRET).update(adm).digest('base64url');

 token=adminToken;
 seed('eventos','E18',{evento_id:'E18',anunciante_id:'A',nombre_evento:'Prueba adulta futura',ciudad_id:'D',fecha_desde:'2099-01-01',fecha_hasta:'2099-01-01',contenido_adulto:true,revision_adulto:'PENDIENTE',estado_moderacion:'PENDIENTE',estado:'PENDIENTE'});
 const adultCold=await read(request('/superadmin/adult-review'));assert.equal(adultCold.reads,4);assert.equal(adultCold.body.results.length,1);
 const adultWarm=await read(request('/superadmin/adult-review'));assert.equal(adultWarm.reads,0);assert.equal(adultWarm.body.results.length,1);
 log('PASS +18: primera apertura con caché ausente 4 consultas; repetida 0, incluidas tres listas vacías.');
 const emptyFirst=await read(request('/superadmin/publications/blocked'));assert.equal(emptyFirst.body.results.length,0);assert.equal(emptyFirst.reads,2);
 const emptyAgain=await read(request('/superadmin/publications/blocked'));assert.equal(emptyAgain.body.results.length,0);assert.equal(emptyAgain.reads,0);
 log('PASS: bandeja vacía primera consulta 2 lecturas; segunda apertura 0.');
 const login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);const userToken=login.body.token;token=userToken;
 let terms=await read(request('/advertiser/terms'));assert.equal(terms.body.aceptada,false);assert.equal(terms.reads,0);
 const unsigned=await read(new Request('https://test.invalid/advertiser/terms'));assert.equal(unsigned.r.status,401);assert.equal(unsigned.calls.length,0);
 const wrong=await read(request('/advertiser/terms',{aceptada:false,version:'2026-10-11'}));assert.equal(wrong.r.status,400);assert.equal(wrong.calls.filter(x=>x.op==='PATCH').length,0);
 terms=await read(request('/advertiser/terms',{aceptada:true,version:'2026-10-11',usuario_id:'OTRO',fecha:'1900-01-01'}));assert.equal(terms.body.success,true);assert.equal(terms.reads,0);assert.equal(terms.calls.filter(x=>x.op==='PATCH').length,2);assert.equal(terms.body.aceptacion.usuario_id,'S');assert.notEqual(terms.body.aceptacion.fecha,'1900-01-01');assert.deepEqual(rows.get('suscriptores/S').aceptacion_terminos_anunciante,terms.body.aceptacion);
 const receipt=terms.body.aceptacion;
 terms=await read(request('/advertiser/terms',{aceptada:true,version:'2026-10-11'}));assert.equal(terms.body.ya_registrada,true);assert.equal(terms.reads,0);assert.equal(terms.calls.length,0);assert.deepEqual(terms.body.aceptacion,receipt);
 const againLogin=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.deepEqual(againLogin.body.suscriptor.aceptacion_terminos_anunciante,receipt);assert.equal(againLogin.reads,0);
 log('PASS términos: registro duradero del usuario real y fecha de servidor; 0 lecturas; 1 registro de cuenta y 1 archivo inicial del texto; 0 operaciones repetida; recibo disponible en otro ingreso.');

 const save=payload=>read(request('/actividades',{action:'guardar',advertiserId:'A',payload:{actividad_id:'ACT',...payload}}));
 let r=await save({nombre:'Clase de música nueva'});assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(rows.get('actividades/ACT').aprobado,true);assert.equal(rows.get('actividades/ACT').estado,'ACTIVA');assert.equal(r.calls.filter(c=>c.op==='PATCH').length,1);assert.equal(rows.get('actividades/ACT').declaracion_publicacion.usuario_id,'S');
 let pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.body.actividades.some(x=>x.nombre==='Clase de música nueva'),true);assert.equal(pub.reads,0);assert.equal(JSON.stringify(pub.body).includes('declaracion_publicacion'),false);
 r=await save({nombre:'Clase de música nueva'});assert.equal(r.calls.some(c=>c.op==='PATCH'),false);
 // El texto de una barrera no se confunde con la clasificación por edad.
 values.set('admin:catalogs:v2',JSON.stringify({moderacion_18:[{regla_id:'R',palabra:'contenido de prueba restringido',activo:true}]}));
 r=await save({descripcion:'Contenido de prueba restringido'});assert.equal(r.body.success,true);assert.equal(rows.get('actividades/ACT').aprobado,false);assert.equal(rows.get('actividades/ACT').contenido_adulto,false);
 pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.body.actividades.length,0);
 token=adminToken;let pending=await read(request('/superadmin/moderation/pending'));assert.equal(pending.body.actividades.some(x=>x.id==='ACT'),true);
 r=await read(request('/superadmin/moderation/resolve',{tipo:'ACTIVIDAD',id:'ACT',decision:'APROBAR'}));assert.equal(r.body.success,true);token=userToken;
 r=await save({contenido_adulto:true,descripcion:'Descripción ordinaria'});assert.equal(r.body.success,true);assert.equal(rows.get('actividades/ACT').aprobado,false);assert.equal(rows.get('actividades/ACT').revision_adulto,'PENDIENTE');
 pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.body.actividades.length,0);
 token=adminToken;r=await read(request('/superadmin/adult-review',{tipo:'ACTIVIDAD',id:'ACT',decision:'APROBAR'}));assert.equal(r.body.success,true);pub=await read(request('/actividades?action=publicas&ciudad_id=D',null,false));assert.equal(pub.body.actividades[0].bloqueado18,true);token=userToken;
 const eventPayload={nombre_evento:'Encuentro abierto',categoria:'Cultura',ciudad_id:'D',lugar:'Teatro',direccion:'Mitre602',tipo_lugar:'OTRO',fecha_desde:'2026-11-20',descripcion:'Prueba',acepta_responsabilidad:true,confirmar_similar:true};
 for(const action of ['createFreeEvent','createVipEvent']){r=await read(request('/events-new',{action,advertiserId:'A',payload:eventPayload}));assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(r.body.evento.estado_moderacion,'PUBLICADO');assert.equal(r.calls.filter(c=>c.op==='PATCH'&&c.c==='eventos').length,1);}
 r=await read(request('/events-new',{action:'createFreeEvent',advertiserId:'A',payload:{...eventPayload,nombre_evento:'Espectáculo adulto',contenido_adulto:true}}));assert.equal(r.body.success,true);assert.equal(r.body.evento.revision_adulto,'PENDIENTE');assert.equal(r.body.evento.estado_moderacion,'PENDIENTE');assert.equal(r.body.evento.estado,'PENDIENTE');const adultEvent=r.body.evento_id;
 pub=await read(request('/events-new?ciudad_id=D',null,false));assert.equal(pub.body.events.some(x=>x.evento_id===adultEvent),false);
 const missing=await read(new Request('https://test.invalid/actividades',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'guardar',advertiserId:'A',payload:{actividad_id:'ACT',nombre:'Sin aceptación'}})}));assert.equal(missing.r.status,400);assert.equal(missing.calls.length,0);
 const viaQuery=await read(new Request('https://test.invalid/events-new?action=createFreeEvent',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({advertiserId:'A',payload:eventPayload})}));assert.equal(viaQuery.r.status,400);assert.equal(viaQuery.calls.length,0);
 // Anuncio nuevo: no nivel ni cupos inventados, asociación propia y una sola escritura por documento.
 r=await read(request('/suscriptores',{action:'solicitar_anunciante',modo:'CREAR',nombre:'Comercio nuevo',ciudad:'D',direccion:'Salta560',descripcion:'Información general'}));assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(r.body.publicado,true);const aid=r.body.anunciante_id;assert.equal(rows.get('anunciantes_administracion/'+aid).nivel,'');assert.deepEqual(rows.get('anunciantes_administracion/'+aid).funcionalidades,[]);assert.equal(rows.get('suscriptor_anunciante/S__'+aid).rol,'PROPIETARIO');assert.equal(r.calls.filter(c=>c.op==='PATCH').length,4);assert.equal(r.reads,0,JSON.stringify(r.calls));log('Alta de anunciante:',r.reads,'consultas,',r.calls.filter(c=>c.op==='PATCH').length,'escrituras necesarias.');
 pub=await read(request('/guide?ciudad_id=D',null,false));assert.equal(JSON.stringify(pub.body).includes(aid),true);assert.equal(pub.reads,0);
 token=adminToken;r=await read(request('/superadmin/publications/recent'));assert.equal(r.body.success,true);assert.equal(r.reads,0);assert.equal(r.body.results.some(x=>x.id===aid),true);
 const stale='publication:recent:v77:'+new Date().toISOString().slice(0,10)+':eventos:OLD';values.set(stale,JSON.stringify({collection:'eventos',id:'OLD',fecha:new Date(Date.now()-11*86400000).toISOString(),ciudades:['D']}));r=await read(request('/superadmin/publications/recent'));assert.equal(r.body.results.some(x=>x.id==='OLD'),false);assert.equal(r.calls.length,0);
 token=userToken;r=await read(request('/superadmin/publications/recent'));assert.ok([401,403].includes(r.r.status));assert.equal(r.calls.length,0);
 // Barrera en publicidad: aparece en su bandeja y requiere una decisión explícita.
 r=await read(request('/publicidad',{action:'guardar',advertiserId:'A',payload:{publicidad_id:'P',titulo:'Contenido de prueba restringido'}}));assert.equal(r.body.success,true,JSON.stringify(r.body));assert.equal(rows.get('publicidades/P').aprobado,false);
 token=adminToken;r=await read(request('/superadmin/publications/blocked'));assert.equal(r.body.results.some(x=>x.id==='P'),true);r=await read(request('/superadmin/publications/blocked'));assert.equal(r.reads,0);
 r=await read(request('/superadmin/publications/blocked',{tipo:'PUBLICIDAD',id:'P',decision:'APROBAR'}));assert.equal(r.body.success,true);assert.equal(rows.get('publicidades/P').aprobado,true);
 token=userToken;r=await read(request('/publicidad',{action:'guardar',advertiserId:'A',payload:{publicidad_id:'P',titulo:'Título normal',contenido_adulto:true}}));assert.equal(r.body.success,true);assert.equal(rows.get('publicidades/P').revision_adulto,'PENDIENTE');assert.equal(rows.get('publicidades/P').contenido_adulto,true);
 r=await read(request('/publicidad',{action:'guardar',advertiserId:'A',payload:{publicidad_id:'P',contenido_adulto:false}}));assert.equal(r.body.success,true);assert.equal(rows.get('publicidades/P').contenido_adulto,false);assert.equal(rows.get('publicidades/P').revision_adulto,'NO_APLICA');
 token=adminToken;r=await read(request('/superadmin/publications/recent',{action:'retirar',collection:'anunciantes',id:aid}));assert.equal(r.body.success,true);assert.equal(rows.get('anunciantes/'+aid).estado_moderacion,'RECHAZADO');const card=JSON.parse(values.get('guide:city:v2:D')||values.get('guide:city:v1:D'));assert.equal(card.anunciantes.find(a=>a.id===aid).estado_moderacion,'RECHAZADO');
 r=await read(request('/superadmin/publications/recent'));assert.equal(r.body.results.some(x=>x.id===aid),false);pub=await read(request('/guide?ciudad_id=D',null,false));assert.equal(JSON.stringify(pub.body).includes(aid),false);assert.equal(pub.reads,0);
 const registration=await read(request('/suscriptores',{action:'crear',nombre:'Nueva persona',mail:'nueva@test.invalid',clave:'password-test',whatsapp:'123456',fecha_nacimiento:'1990-01-01'},false));assert.equal(registration.body.success,true,JSON.stringify(registration.body));const sub=[...rows.entries()].find(([k,v])=>k.startsWith('suscriptores/')&&v.mail==='nueva@test.invalid')[1];assert.equal(sub.aceptacion_terminos.usuario_id,sub.suscriptor_id||sub.id);
 // Versiones dinámicas: archivo de texto e historial de aceptaciones.
 token=adminToken;let config=await read(request('/superadmin/advertiser-terms'));assert.equal(config.body.actual.version,'2026-10-11');assert.equal(config.reads,0);const originalText=config.body.actual.contenido;
 let publish=await read(request('/superadmin/advertiser-terms',{action:'publicar',titulo:config.body.actual.titulo,contenido:originalText}));assert.equal(publish.body.sin_cambios,true);assert.equal(publish.calls.length,0);
 publish=await read(request('/superadmin/advertiser-terms',{action:'publicar',titulo:config.body.actual.titulo,contenido:originalText+'\n\n9. Actualización de prueba\nEsta es una condición nueva para comprobar la conservación de versiones y las aceptaciones.'}));assert.equal(publish.body.success,true);const nextVersion=publish.body.actual.version;assert.notEqual(nextVersion,'2026-10-11');assert.equal(publish.calls.filter(x=>x.op==='PATCH').length,1);assert.equal(rows.get('terminos_anunciantes/2026-10-11').contenido,originalText);
 token=userToken;let notice=await read(request('/advertiser/terms'));assert.equal(notice.body.aceptada,false);assert.equal(notice.body.requiere_revision,true);assert.equal(notice.reads,0);
 let obsolete=await save({nombre:'Publicación con términos anteriores'});assert.equal(obsolete.r.status,412);assert.equal(obsolete.body.code,'TERMS_REVIEW_REQUIRED');assert.equal(obsolete.calls.filter(x=>x.op==='PATCH').length,0);
 let accepted=await read(request('/advertiser/terms',{aceptada:true,version:nextVersion,hash:publish.body.actual.hash}));assert.equal(accepted.body.success,true);assert.equal(accepted.reads,0);assert.equal(accepted.calls.filter(x=>x.op==='PATCH').length,1);assert.equal(Object.keys(rows.get('suscriptores/S').historial_terminos_anunciante).length,2);assert.equal(rows.get('suscriptores/S').historial_terminos_anunciante['2026-10-11'].fecha,receipt.fecha);
 let historical=await read(request('/advertiser/terms/content?version=2026-10-11',null,false));assert.equal(historical.body.terms.contenido,originalText);assert.equal(historical.reads,0);
 token=adminToken;const proof=await read(request('/superadmin/advertiser-terms?suscriptor_id=S'));assert.equal(proof.body.registros.length,2);assert.equal(proof.body.registros[0].terminos.contenido,originalText);assert.equal(proof.reads,0);
 log('PASS V81: versión nueva desde GH sin editar Worker, texto original conservado, aviso de revisión, historial de dos aceptaciones y exportación exacta sin nuevas lecturas.');
 // Caché ausente no equivale a ausencia de reglas: no se escribe nada.
 token=userToken;values.delete('admin:catalogs:v2');r=await save({nombre:'Nuevo cambio'});assert.equal(r.r.status,503);assert.equal(r.calls.length,0);
 log('V77 PASS: publicación directa Free/VIP/actividades/anunciantes; barreras separadas de +18; aceptación obligatoria y recibo del usuario real; bandejas privadas; diez días sin escrituras; caché de reglas obligatoria.');
}finally{console.log=log;globalThis.fetch=original;}
