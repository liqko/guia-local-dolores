import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker from './WORKER_COMPLETO_V69.js';
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
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'69');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}

const log=console.log;console.log=()=>{};
try{
 const signed=Buffer.from(JSON.stringify({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',exp:Date.now()+3600000})).toString('base64url');token=signed+'.'+createHmac('sha256',env.SERVER_SECRET).update(signed).digest('base64url');
 seed('eventos','EV',{evento_id:'EV',anunciante_id:'A',nombre_evento:'Pendiente',fecha_desde:'2026-11-10',lugar:'Teatro',nivel:'FREE',ciudad_id:'D',estado_moderacion:'PENDIENTE',estado:'PENDIENTE',pausado:false});
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

 let commercial=await read(request('/superadmin/advertisers/A/commercial',{payload:{funcionalidades:['EVENTOS_FREE','PROMOS','PUBLICIDAD','TURNOS_FARMA'],funcionalidades_config:{EVENTOS_FREE:{cantidad:3},PROMOS:{cantidad:2},PUBLICIDAD:{activas_max:1,guardadas_max:2,cambios_activos_por_dia_max:2},TURNOS_FARMA:{todas_ciudades:true,ciudades:[]}}}}));
 assert.equal(commercial.body.success,true,JSON.stringify(commercial.body));assert.equal(commercial.reads,0);assert.equal(commercial.calls.filter(c=>c.op==='PATCH').length,1);
 const adm=rows.get('anunciantes_administracion/A');assert.equal(adm.funcionalidades_config.EVENTOS_FREE.cantidad,3);assert.equal(adm.eventos_free,true);assert.equal(adm.turnos_farma,'*');
 const adminToken=token;
 let login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);token=login.body.token;
 let free=await read(request('/events-new',{action:'getFreeEventsPanelData',advertiserId:'A'}));assert.equal(free.body.success,true,JSON.stringify(free.body));assert.equal(free.body.eventos_free_cant,3);
 free=await read(request('/events-new',{action:'getFreeEventsPanelData',advertiserId:'A'}));assert.equal(free.reads,0);
 const packetKey='panel:administration:v47:A';
 const rev=values.get(packetKey+':revision')||'initial';
 const packet=JSON.parse(values.get(packetKey+':'+rev));
 const savedPacket=structuredClone(packet);
 packet.data.funcionalidades_config.EVENTOS_FREE.cantidad=0;
 values.set(packetKey+':'+rev,JSON.stringify(packet));
 const blocked=await read(request('/events-new',{action:'createFreeEvent',advertiserId:'A',payload:{nombre_evento:'Sin cupo',categoria:'Cultura',ciudad_id:'D',fecha_desde:'2026-11-10'}}));
 assert.equal(blocked.body.success,false);assert.equal(blocked.reads,0);assert.equal(blocked.calls.length,0);
 values.set(packetKey+':'+rev,JSON.stringify(savedPacket));
 const duplicateBody={action:'createFreeEvent',advertiserId:'A',payload:{nombre_evento:'Pendiente',categoria:'Cultura',ciudad_id:'D',lugar:'Teatro',direccion:'Mitre602',tipo_lugar:'OTRO',fecha_desde:'2026-11-10',descripcion:'Prueba',acepta_responsabilidad:true}};
 const coldDuplicate=await read(request('/events-new',duplicateBody));
 assert.equal(coldDuplicate.body.requires_confirmation,true,JSON.stringify(coldDuplicate.body));
 const ops=JSON.parse(decodeURIComponent(coldDuplicate.r.headers.get('X-GLD-Operations')));
 assert.ok(ops.some(x=>x.collection==='eventos'&&x.field==='ciudad_id'&&x.calls===1));
 assert.equal(coldDuplicate.r.headers.get('X-GLD-Action'),'createfreeevent');
 const warmDuplicate=await read(request('/events-new',duplicateBody));
 assert.equal(warmDuplicate.body.requires_confirmation,true);assert.equal(warmDuplicate.reads,0);
 assert.ok(JSON.parse(decodeURIComponent(warmDuplicate.r.headers.get('X-GLD-Cache-Checks'))).some(x=>x.collection==='eventos'&&x.field==='ciudad_id'&&x.result==='hit'));
 log('V68: duplicados por ciudad comprobados: primera consulta identificada; repetición desde caché, cero lecturas y sin omitir detección.');
 const created=await read(request('/events-new',{action:'createFreeEvent',advertiserId:'A',payload:{nombre_evento:'Prueba nueva',categoria:'Cultura',ciudad_id:'D',lugar:'Teatro',direccion:'Mitre602',tipo_lugar:'OTRO',fecha_desde:'2026-11-10',descripcion:'Prueba',acepta_responsabilidad:true,confirmar_similar:true}}));assert.equal(created.body.success,true,JSON.stringify(created.body));assert.equal(created.reads,0,JSON.stringify(created.calls));
 const eid=created.body.evento_id||created.body.evento?.evento_id;assert.ok(eid,JSON.stringify(created.body));token=adminToken;
 let newPending=await read(request('/superadmin/moderation/pending'));assert.ok(newPending.body.eventos.some(e=>e.id===eid));
 const approve=await read(request('/superadmin/moderation/resolve',{tipo:'EVENTO',id:eid,decision:'APROBAR'}));assert.equal(approve.body.success,true,JSON.stringify(approve.body));
 let published=await read(request('/events-new?ciudad_id=D',null,false));assert.equal(published.reads,0);assert.ok(published.body.events.some(e=>e.evento_id===eid));

 const advertiserToken=token;token=login.body.token;
 const deleted=await read(request('/events-new',{action:'deleteFreeEvent',advertiserId:'A',payload:{evento_id:eid}}));
 assert.equal(deleted.body.deleted,true,JSON.stringify(deleted.body));
 assert.equal(deleted.reads,0,JSON.stringify(deleted.calls));
 assert.deepEqual(deleted.calls.map(x=>[x.op,x.c,x.id]),[['DELETE','eventos',eid]]);
 let afterDelete=await read(request('/events-new',{action:'getFreeEventsPanelData',advertiserId:'A'}));
 assert.equal(afterDelete.reads,0);assert.equal(afterDelete.body.eventos_free.some(e=>(e.evento_id||e.id)===eid),false);
 let publicAfterDelete=await read(request('/events-new?ciudad_id=D',null,false));
 assert.equal(publicAfterDelete.reads,0);assert.equal(publicAfterDelete.body.events.some(e=>e.evento_id===eid),false);
 seed('eventos','OTHER',{evento_id:'OTHER',anunciante_id:'B',nivel:'FREE'});
 const unauthorizedDelete=await read(request('/events-new',{action:'deleteFreeEvent',advertiserId:'A',payload:{evento_id:'OTHER'}}));
 assert.equal(unauthorizedDelete.body.success,false);assert.equal(unauthorizedDelete.calls.some(x=>x.op==='DELETE'),false);
 const expired={id:'EXPIRED',evento_id:'EXPIRED',anunciante_id:'A',nivel:'VIP',ciudad_id:'D',fecha_desde:'2026-01-01',fecha_hasta:'2026-01-01',actualizado:'rev-expired'};
 seed('eventos','EXPIRED',expired);
 const ownerKey='panel:query:v48:eventos:A',ownerPacket=JSON.parse(values.get(ownerKey));ownerPacket.data.push(expired);values.set(ownerKey,JSON.stringify(ownerPacket));
 const child={id:'EXPIRED_CHILD',evento_programacion_id:'EXPIRED_CHILD',evento_id:'EXPIRED',ciudad_id:'D'};seed('evento_programacion','EXPIRED_CHILD',child);
 values.set('relations:prepared:v1:event:EXPIRED',JSON.stringify({revision:'rev-expired',data:[child]}));
 const expiredDeleted=await read(request('/events-new',{action:'deleteVipEvent',advertiserId:'A',payload:{evento_id:'EXPIRED'}}));
 assert.equal(expiredDeleted.body.deleted,true);assert.equal(expiredDeleted.reads,0,JSON.stringify(expiredDeleted.calls));
 assert.deepEqual(expiredDeleted.calls.map(x=>[x.op,x.c]),[['DELETE','evento_programacion'],['DELETE','eventos']]);
 seed('eventos','COLD',{evento_id:'COLD',anunciante_id:'A',nivel:'FREE',ciudad_id:'D'});
 values.set('relations:prepared:v1:event:COLD',JSON.stringify({revision:'',data:[]}));
 const coldDeleted=await read(request('/events-new',{action:'deleteFreeEvent',advertiserId:'A',payload:{evento_id:'COLD'}}));
 assert.equal(coldDeleted.body.deleted,true);assert.equal(coldDeleted.reads,1,JSON.stringify(coldDeleted.calls));
 assert.equal(coldDeleted.calls.filter(x=>x.op==='GET'&&x.c==='eventos').length,1,'La lectura de respaldo no se repite antes del borrado');
 log('V69 PASS: eliminar evento cacheado: cero lecturas, cero escrituras y una eliminación; panel y agenda actualizados; validación preservada.');

 token=adminToken;
 const detail=await read(request('/superadmin/advertisers/A'));
 assert.equal(detail.body.success,true,JSON.stringify(detail.body));
 const cachedEvents=JSON.parse(values.get('panel:query:v48:eventos:A')).data;
 assert.equal(detail.body.uso_funcionalidades.EVENTOS_FREE.disponible,true);
 assert.equal(detail.body.uso_funcionalidades.EVENTOS_FREE.guardadas,cachedEvents.filter(e=>e.nivel==='FREE').length);
 assert.equal(detail.calls.filter(c=>c.op==='query'&&!['anunciantes_sedes','suscriptor_anunciante'].includes(c.c)).length,0,'Usage must not load module collections');
 values.delete('panel:query:v48:promos:A');
 const coldDetail=await read(request('/superadmin/advertisers/A'));
 assert.equal(coldDetail.body.uso_funcionalidades.PROMOS.disponible,false);
 assert.equal(coldDetail.calls.some(c=>c.c==='promos'),false,'Missing cache must not query Firestore');
 commercial=await read(request('/superadmin/advertisers/A/commercial',{payload:{funcionalidades_config:{EVENTOS_FREE:{cantidad:20,guardadas_max:3},PUBLICIDAD:{activas_max:20,guardadas_max:1}}}}));
 assert.equal(commercial.body.success,true);
 assert.equal(Object.hasOwn(rows.get('anunciantes_administracion/A').funcionalidades_config.EVENTOS_FREE,'guardadas_max'),false);
 assert.equal(Object.hasOwn(rows.get('anunciantes_administracion/A').funcionalidades_config.PUBLICIDAD,'guardadas_max'),false);
 token=login.body.token;
 const savedPanel=await read(request('/events-new',{action:'getFreeEventsPanelData',advertiserId:'A'}));
 assert.equal(savedPanel.body.eventos_free_guardadas_max,40);
 values.set('catalogs:commerce:v1',JSON.stringify({nodos:[{nodo_id:'TERMAL',ciudad_id:'D',nombre:'Parque Termal'}]}));
 const beforeToken=token;token=adminToken;
 const nodes=await read(request('/superadmin/catalogs/nodos?ciudad_id=D'));
 assert.equal(nodes.body.results[0].nodo_id,'TERMAL');
 assert.equal(nodes.reads,0);
 token=beforeToken;

 token=login.body.token;
 const ownA={sede_id:'SED',ciudad_id:'D',instagram:'https://instagram.com/propia_a',web:'https://sede-a.test'};
 const ownB={sede_id:'SED2',ciudad_id:'D2',instagram:'https://instagram.com/propia_b',web:'https://sede-b.test'};
 const cards=[{id:'A',ciudad_id:'D',link:'https://old.test',sedes:[ownA]},{id:'A',ciudad_id:'D2',link:'https://old.test',sedes:[ownB]}];
 values.set('guide:advertiser:v2:A',JSON.stringify({cards,template:cards[0],ciudades:['D','D2']}));
 values.set('guide:city:v1:D',JSON.stringify({anunciantes:[cards[0]]}));
 values.set('guide:city:v1:D2',JSON.stringify({anunciantes:[cards[1]]}));
 const shared={habilitado:true,instagram:'https://instagram.com/comun',facebook:'https://facebook.com/comun',web:'https://comun.test'};
 const saveShared=await read(request('/commerce',{action:'set_datos',advertiserId:'A',id:'A',__id:'A',redes_web_comunes:shared}));
 assert.equal(saveShared.body.success,true,JSON.stringify(saveShared.body));
 assert.equal(saveShared.calls.filter(x=>x.op==='PATCH').length,1);
 assert.equal(saveShared.calls.some(x=>x.c==='anunciantes_sedes'),false);
 assert.equal(rows.get('anunciantes/A').redes_web_comunes.instagram,shared.instagram);
 for(const city of ['D','D2']){
  const guide=await read(request('/guide?ciudad_id='+city,null,false));
  assert.equal(guide.reads,0);
  assert.equal(guide.body.results[0].sedes[0].instagram,shared.instagram);
  assert.equal(guide.body.results[0].sedes[0].web,shared.web);
 }
 assert.equal(JSON.parse(values.get('guide:advertiser:v2:A')).cards[0].sedes[0].instagram,ownA.instagram);
 const saveIndependent=await read(request('/commerce',{action:'set_datos',id:'A',__id:'A',redes_web_comunes:{...shared,habilitado:false}}));
 assert.equal(saveIndependent.body.success,true,JSON.stringify(saveIndependent.body));
 const independent=await read(request('/guide?ciudad_id=D2',null,false));
 assert.equal(independent.body.results[0].sedes[0].instagram,ownB.instagram);
 token=adminToken;
 values.set('admin:catalogs:v2',JSON.stringify({nodos:[{nodo_id:'OTHER',ciudad_id:'OTRA',nombre:'Otra ciudad'}]}));
 const mergedNodes=await read(request('/superadmin/catalogs/nodos?ciudad_id=D'));
 assert.equal(mergedNodes.body.results[0].nodo_id,'TERMAL');
 assert.equal(mergedNodes.reads,0);
 log('V65 PASS: shared networks stored once; inherited in two cities with0 reads; independent values restored; admin+module node catalogs merged.');
 log('V64 PASS: obsolete storage fields removed on save; derived40 delivered from assigned20; cached catalogs require0 reads.');
 token=adminToken;
 commercial=await read(request('/superadmin/advertisers/A/commercial',{payload:{funcionalidades:[],funcionalidades_config:{EVENTOS_FREE:{cantidad:0},TURNOS_FARMA:{todas_ciudades:false,ciudades:[]}}}}));assert.equal(commercial.body.success,true);assert.equal(rows.get('anunciantes_administracion/A').eventos_free,false);assert.equal(rows.get('anunciantes_administracion/A').turnos_farma,'');
 commercial=await read(request('/superadmin/advertisers/A/commercial',{payload:{funcionalidades_config:{EVENTOS_FREE:{cantidad:-1}}}}));assert.equal(commercial.body.success,false);assert.equal(commercial.calls.filter(c=>c.op==='PATCH').length,0);
 commercial=await read(request('/superadmin/advertisers/A/commercial',{payload:{funcionalidades_config:{EVENTOS_FREE:{cantidad:1.5}}}}));assert.equal(commercial.body.success,false);assert.equal(commercial.calls.filter(c=>c.op==='PATCH').length,0);
 commercial=await read(request('/superadmin/advertisers/A/commercial',{payload:{funcionalidades:['EVENTOS_FREE']}},false));assert.equal(commercial.r.status,401);assert.equal(commercial.calls.length,0);

 const signSubscriber=sid=>{const body=Buffer.from(JSON.stringify({typ:'GLD_SUBSCRIBER',sid,sv:0,exp:Date.now()+3600000})).toString('base64url');return body+'.'+createHmac('sha256',env.SERVER_SECRET).update(body).digest('base64url');};
 seed('suscriptores','ADULT',{fecha_nacimiento:'1990-01-01',activo:true});
 seed('suscriptores','MINOR',{fecha_nacimiento:'2015-01-01',activo:true});
 seed('suscriptores','UNKNOWN',{activo:true});
 let access=await read(request('/adult/access',{confirmar:true},false));assert.equal(access.r.status,401);
 token=signSubscriber('MINOR');access=await read(request('/adult/access',{confirmar:true}));assert.equal(access.r.status,403);assert.equal(access.body.code,'UNDERAGE');
 token=signSubscriber('UNKNOWN');access=await read(request('/adult/access',{confirmar:true}));assert.equal(access.r.status,403);assert.equal(access.body.code,'AGE_UNKNOWN');
 token=signSubscriber('ADULT');access=await read(request('/adult/access',{confirmar:false}));assert.equal(access.r.status,400);
 access=await read(request('/adult/access',{confirmar:true}));assert.equal(access.body.success,true,JSON.stringify(access.body));const grant=access.body.token;
 values.set('events:city:v2:AD',JSON.stringify({ciudad_id:'AD',eventos:[{evento_id:'AD1',contenido_adulto:true,revision_adulto:'APROBADO',nombre_evento:'Privado',descripcion:'TEXTO_SECRETO',img1:'https://secret.invalid',ciudad_id:'AD',estado_moderacion:'APROBADO'},{evento_id:'AD2',contenido_adulto:true,revision_adulto:'PENDIENTE',nombre_evento:'NO_PUBLICADO'},{evento_id:'NORMAL',nombre_evento:'Para todos'}]}));
 let adultPublic=await read(request('/events-new?ciudad_id=AD',null,false));assert(!JSON.stringify(adultPublic.body).includes('TEXTO_SECRETO'));assert(!JSON.stringify(adultPublic.body).includes('secret.invalid'));assert(!JSON.stringify(adultPublic.body).includes('NO_PUBLICADO'));assert(JSON.stringify(adultPublic.body).includes('bloqueado18'));assert.equal(adultPublic.reads,0);
 adultPublic=await read(new Request('https://test.invalid/events-new?ciudad_id=AD',{headers:{'X-GLD-Adult-Token':grant,Authorization:'Bearer '+signSubscriber('ADULT')}}));assert(JSON.stringify(adultPublic.body).includes('TEXTO_SECRETO'));assert(!JSON.stringify(adultPublic.body).includes('NO_PUBLICADO'));assert.equal(adultPublic.reads,0);
 adultPublic=await read(new Request('https://test.invalid/events-new?ciudad_id=AD',{headers:{'X-GLD-Adult-Token':grant+'tampered'}}));assert(!JSON.stringify(adultPublic.body).includes('TEXTO_SECRETO'));
 token=adminToken;const queue=await read(request('/superadmin/adult-review'));assert.equal(queue.body.success,true,JSON.stringify(queue.body));

 const againQueue=await read(request('/superadmin/adult-review'));assert.equal(againQueue.reads,0);
 seed('eventos','ADP',{evento_id:'ADP',nombre_evento:'Pendiente adulto',contenido_adulto:true,revision_adulto:'PENDIENTE',estado_moderacion:'PENDIENTE',estado:'PENDIENTE',ciudad_id:'AD',anunciante_id:'A'});
 const reviewed=await read(request('/superadmin/adult-review',{tipo:'EVENTO',id:'ADP',decision:'APROBAR'}));assert.equal(reviewed.body.success,true,JSON.stringify(reviewed.body));assert.equal(rows.get('eventos/ADP').revision_adulto,'APROBADO');assert.equal(rows.get('eventos/ADP').estado_moderacion,'PENDIENTE');
 adultPublic=await read(request('/events-new?ciudad_id=AD',null,false));assert(!JSON.stringify(adultPublic.body).includes('Pendiente adulto'));
 log('V67 PASS: login and consent required; minors and missing birthdate blocked; protected fields absent from public response; approved adult access granted; pending adult hidden; forged grant denied; public0 reads.');
 log('GH V59 PASS: save functions and quotas once, panel reflects3, repeat0, disable legacy flags, reject invalid quotas, unauthorized no writes; approval/publication regression passed.');
}finally{globalThis.fetch=original;console.log=log;}
