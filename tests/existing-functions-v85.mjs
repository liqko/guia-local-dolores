import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker from '../worker/WORKER_COMPLETO_V85.js';
const rows=new Map(),values=new Map(),calls=[];let revision=0;
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SERVER_SECRET:'test-only',FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@test.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}};
function seed(c,id,data){rows.set(c+'/'+id,{id,...data});}
function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};return {stringValue:String(v)};}
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return v.arrayValue.values.map(decode);if('nullValue'in v)return null;return v.stringValue??v.booleanValue??Number(v.integerValue);}
function doc(c,id,data){return {updateTime:data._version||'2026-10-12T12:00:00.000000Z',name:'projects/test/databases/(default)/documents/'+c+'/'+id,fields:Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id').map(([k,v])=>[k,encode(v)]))};}
seed('suscriptores','S',{mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true,tipo_usuario:'RESIDENTE',ciudad_origen_otro:'Córdoba'});
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
 if(method==='GET'&&!id)return Response.json({documents:[...rows.entries()].filter(([key])=>key.startsWith(c+'/')).map(([key,row])=>doc(c,key.split('/')[1],row))});
 if(method==='PATCH'){if(u.searchParams.has('currentDocument.updateTime')&&u.searchParams.get('currentDocument.updateTime')!==(rows.get(c+'/'+id)._version||'2026-10-12T12:00:00.000000Z'))return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:409});if(u.searchParams.get('currentDocument.exists')==='false'&&rows.has(c+'/'+id))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});const patch=Object.fromEntries(Object.entries(body.fields).map(([k,v])=>[k,decode(v)]));if(patch.vinculos_ciudades&&[...u.searchParams.getAll('updateMask.fieldPaths')].some(x=>x.startsWith('vinculos_ciudades.')))patch.vinculos_ciudades={...rows.get(c+'/'+id)?.vinculos_ciudades,...patch.vinculos_ciudades};seed(c,id,{...rows.get(c+'/'+id),...patch,_version:'2026-10-12T12:00:00.'+String(++revision).padStart(6,'0')+'Z'});return Response.json(doc(c,id,rows.get(c+'/'+id)));}
 if(method==='DELETE'){rows.delete(c+'/'+id);return new Response(null,{status:200});}
 const row=rows.get(c+'/'+id);return row?Response.json(doc(c,id,row)):Response.json({error:{message:'not found'}},{status:404});
};
let token;
const request=(path,body,auth=true)=>new Request('https://test.invalid'+path,{...(body?{method:'POST',body:JSON.stringify({...body,declaracion_publicacion:{aceptada:true,version:'2026-10-10'}})}:{}),headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&token?{Authorization:'Bearer '+token}:{})}});
async function read(req){calls.length=0;const r=await worker.fetch(req,env);const body=await r.json();assert.equal(r.headers.get('X-GLD-Worker-Version'),'85');return {r,body,calls:[...calls],reads:Number(r.headers.get('X-GLD-Read-Calls'))};}


const log=console.log;console.log=()=>{};
try{
 seed('anunciantes_administracion','A',{actividades:true,actividades_cant:20,eventos:true,eventos_free:true,eventos_cant:20,eventos_free_cant:20,funcionalidades:'ACTIVIDADES,EVENTOS,EVENTOS_FREE,PUBLICIDAD',funcionalidades_config:{PUBLICIDAD:{activas_max:3,guardadas_max:6,cambios_activos_por_dia_max:5}}});
 seed('actividades','ACT',{actividad_id:'ACT',anunciante_id:'A',nombre:'Clase de música',categoria:'CULTURA',ciudad_id:'D',aprobado:true,activo:true,estado:'ACTIVA',vigente_desde:'2026-01-01',vigente_hasta:'2099-12-31',contenido_adulto:false,revision_adulto:'NO_APLICA'});
 seed('actividad_horarios','H',{actividad_horario_id:'H',actividad_id:'ACT',ciudad_id:'D',hora_desde:'10:00',tipo_lugar:'SEDE',sede_id:'SED',lugar_id:'',lugar_texto:'',direccion:'',maps:'',activo:true});
 const adm=Buffer.from(JSON.stringify({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',exp:Date.now()+3600000})).toString('base64url');const adminToken=adm+'.'+createHmac('sha256',env.SERVER_SECRET).update(adm).digest('base64url');

 token=adminToken;
 seed('eventos','E18',{evento_id:'E18',anunciante_id:'A',nombre_evento:'Prueba adulta futura',ciudad_id:'D',fecha_desde:'2099-01-01',fecha_hasta:'2099-01-01',contenido_adulto:true,revision_adulto:'PENDIENTE',estado_moderacion:'PENDIENTE',estado:'PENDIENTE'});


 const schema=await read(new Request('https://test.invalid/suscriptores/territory-schema'));assert.equal(schema.body.version,84);assert.equal(schema.calls.length,0);
 const territoryUnauthorized=await read(new Request('https://test.invalid/suscriptores/territory'));assert.equal(territoryUnauthorized.r.status,401);assert.equal(territoryUnauthorized.calls.length,0);
 const territoryLogin=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));token=territoryLogin.body.token;
 const legacy=await read(request('/suscriptores/territory'));assert.equal(legacy.body.suscriptor.residencia_declarada,null);assert.equal(legacy.body.suscriptor.ciudad_origen_otro,'Córdoba');assert.equal(legacy.reads,0);
 const residence={ciudad_id:'',ciudad:'Córdoba',provincia:'Córdoba',pais:'Argentina'};
 const declared=await read(request('/suscriptores/territory',{residencia_declarada:residence,ciudad_natal:'Córdoba',ciudad_id:'D',condicion_ciudad:'VISITANTE_TURISTA'}));assert.equal(declared.body.success,true);assert.equal(declared.body.suscriptor.vinculos_ciudades.D.condicion,'VISITANTE_TURISTA');assert.equal(declared.body.suscriptor.ciudad_origen_otro,'Córdoba');assert.equal(declared.reads,0);assert.equal(declared.calls.filter(x=>x.op==='PATCH').length,1);
 const unchanged=await read(request('/suscriptores/territory',{residencia_declarada:residence,ciudad_natal:'Córdoba',ciudad_id:'D',condicion_ciudad:'VISITANTE_TURISTA'}));assert.equal(unchanged.body.updated,false);assert.equal(unchanged.calls.length,0);
 const contradictory=await read(request('/suscriptores/territory',{ciudad_id:'D',condicion_ciudad:'RESIDENTE'}));assert.equal(contradictory.r.status,400);assert.equal(contradictory.calls.length,0);
 const moved=await read(request('/suscriptores/territory',{residencia_declarada:{ciudad_id:'D'},ciudad_id:'D',condicion_ciudad:'RESIDENTE'}));assert.equal(moved.body.suscriptor.residencia_declarada.ciudad,'DOLORES');assert.equal(moved.body.suscriptor.ciudad_natal,'Córdoba');
 values.set('territorio:public:v1',JSON.stringify({ciudades:[{ciudad_id:'D',ciudad_visible:'DOLORES'},{ciudad_id:'D2',ciudad_visible:'OTRA'}]}));
 const anotherCity=await read(request('/suscriptores/territory',{ciudad_id:'D2',condicion_ciudad:'VISITANTE_TURISTA'}));assert.equal(anotherCity.body.suscriptor.vinculos_ciudades.D.condicion,'RESIDENTE');assert.equal(anotherCity.body.suscriptor.vinculos_ciudades.D2.condicion,'VISITANTE_TURISTA');
 const movedAway=await read(request('/suscriptores/territory',{residencia_declarada:residence}));assert.equal(movedAway.body.suscriptor.vinculos_ciudades.D.condicion,'SIN_CONFIRMAR');assert.equal(movedAway.body.suscriptor.vinculos_ciudades.D2.condicion,'VISITANTE_TURISTA');
 token=adminToken;
 const search=await read(request('/superadmin/subscribers/search?q=C%C3%B3rdoba&ciudad_id=D2&tipo=VISITANTE_TURISTA'));assert.equal(search.body.success,true);assert.equal(search.body.results.length,1);assert.equal(search.reads,0);
 const badFilter=await read(request('/superadmin/subscribers/search?tipo=RESIDENTE'));assert.equal(badFilter.r.status,400);
 const regContradiction=await read(request('/suscriptores',{action:'crear',nombre:'Prueba',mail:'new-city@test.invalid',clave:'test-password',residencia_declarada:residence,ciudad_predeterminada_id:'D',condicion_ciudad:'RESIDENTE'},false));assert.equal(regContradiction.r.status,400);assert.equal(regContradiction.calls.length,0);
 const regGood=await read(request('/suscriptores',{action:'crear',nombre:'Visitante',mail:'new-city@test.invalid',clave:'test-password',residencia_declarada:residence,ciudad_natal:'Rosario',ciudad_predeterminada_id:'D',condicion_ciudad:'VISITANTE_TURISTA'},false));assert.equal(regGood.body.success,true);assert.equal(regGood.body.suscriptor.tipo_usuario,'');assert.equal(regGood.body.suscriptor.residencia_declarada.ciudad,'Córdoba');assert.equal(regGood.body.suscriptor.vinculos_ciudades.D.condicion,'VISITANTE_TURISTA');
 values.set('territorio:public:v1',JSON.stringify({ciudades:[{ciudad_id:'D',ciudad_visible:'DOLORES'}]}));
 log('PASS territorio: legado sin inferencias, Córdoba visitante de Dolores, nacimiento independiente, vínculos por ciudad preservados, contradicción rechazada, mudanza exige reconfirmar, guardar igual 0 operaciones y alta validada.');

 const detailWarm=await read(request('/superadmin/subscribers/S'));assert.equal(detailWarm.body.success,true);assert.equal(detailWarm.reads,0);assert.equal(Object.hasOwn(detailWarm.body.suscriptor,'clave'),false);assert.equal(detailWarm.body.suscriptor.fecha_nacimiento,'');assert.equal(detailWarm.body.relaciones.length,1);
 seed('suscriptores','LEGACY',{mail:'legacy@test.invalid',nombre:'Cuenta anterior',activo:true});
 const legacyDetail=await read(request('/superadmin/subscribers/LEGACY'));assert.equal(legacyDetail.body.success,true);assert.equal(legacyDetail.body.suscriptor.nombre,'Cuenta anterior');assert.equal(Object.hasOwn(legacyDetail.body.suscriptor,'clave'),false);
 seed('suscriptores','MANY',{mail:'many@test.invalid',nombre:'Con muchos vínculos',clave:'test-password',activo:true,email_verificado:true});
 for(let i=0;i<101;i++)seed('suscriptor_anunciante','RM'+i,{suscriptor_id:'MANY',anunciante_id:'AM'+i,rol:'PROPIETARIO',activo:true});
 const manyLogin=await read(request('/suscriptores',{action:'login',mail:'many@test.invalid',clave:'test-password'},false));assert.equal(manyLogin.body.success,true);
 const manyDetail=await read(request('/superadmin/subscribers/MANY'));assert.equal(manyDetail.body.relaciones.length,101);assert.equal(manyDetail.reads,1);assert.equal(Object.hasOwn(manyDetail.body.suscriptor,'clave'),false);
 const repeatDetail=await read(request('/superadmin/subscribers/MANY'));assert.equal(repeatDetail.reads,0);assert.equal(repeatDetail.body.relaciones.length,101);
 const anonDetail=await read(new Request('https://test.invalid/superadmin/subscribers/S'));assert.equal(anonDetail.r.status,401);assert.equal(anonDetail.calls.length,0);
 log('PASS ficha GH: cuenta cacheada y vínculos completos sin lectura repetida; credenciales excluidas; 101 relaciones sin truncar al límite de login; ficha anterior sin contraseña sigue consultable.');

 const quota=await read(request('/superadmin/advertisers/A/commercial',{payload:{funcionalidades_config:{EVENTOS_FREE:{cantidad:20,guardadas_max:3},PUBLICIDAD:{activas_max:20,guardadas_max:1}}}}));assert.equal(quota.body.success,true);assert.equal(Object.hasOwn(rows.get('anunciantes_administracion/A').funcionalidades_config.EVENTOS_FREE,'guardadas_max'),false);assert.equal(Object.hasOwn(rows.get('anunciantes_administracion/A').funcionalidades_config.PUBLICIDAD,'guardadas_max'),false);
 token=territoryLogin.body.token;const quotaPanel=await read(request('/events-new',{action:'getFreeEventsPanelData',advertiserId:'A'}));assert.equal(quotaPanel.body.eventos_free_guardadas_max,40);
 token=adminToken;values.set('catalogs:commerce:v1',JSON.stringify({nodos:[{nodo_id:'TERMAL',ciudad_id:'D',nombre:'Parque Termal'},{nodo_id:'FOREIGN',ciudad_id:'OTRA',nombre:'Ajeno'}]}));
 const localNodes=await read(request('/superadmin/catalogs/nodos?ciudad_id=D'));assert.equal(localNodes.body.results.length,1);assert.equal(localNodes.body.results[0].nodo_id,'TERMAL');assert.equal(localNodes.reads,0);
 log('PASS existente: guardado derivado 40 para asignado 20; campos anteriores eliminados al guardar; nodos sólo de la ciudad solicitada con 0 lecturas.');
 const calendarToday=new Date(Date.now()-3*3600000).toISOString().slice(0,10),birthAdult='1990-'+calendarToday.slice(5),birthMinor=String(Number(calendarToday.slice(0,4))-10)+calendarToday.slice(4);
 seed('suscriptores','BIRTHADULT',{mail:'birthday@test.invalid',clave:'test-password',activo:true,fecha_nacimiento:birthAdult});
 seed('suscriptores','BIRTHMINOR',{mail:'birthday-child@test.invalid',clave:'test-password',activo:true,fecha_nacimiento:birthMinor});
 seed('suscriptores','BIRTHINACTIVE',{activo:false,fecha_nacimiento:birthAdult});
 seed('suscriptores','BIRTHINVALID',{activo:true,fecha_nacimiento:'2000-02-30'});
 const noAuth=await read(new Request('https://test.invalid/superadmin/birthdays'));assert.equal(noAuth.r.status,401);assert.equal(noAuth.calls.length,0);
 const coldBirth=await read(request('/superadmin/birthdays'));assert.equal(coldBirth.body.preparado,false);assert.equal(coldBirth.body.total,null);assert.equal(coldBirth.calls.length,0);
 const prepared=await read(request('/superadmin/birthdays/prepare',{}));assert.equal(prepared.body.total,2);assert.equal(prepared.body.mayores18,1);assert.equal(prepared.body.menores18,1);assert.equal(prepared.calls.filter(x=>x.op==='GET').length,1);assert.equal(prepared.calls.filter(x=>x.op==='PATCH').length,0);

 seed('suscriptores','NEWBIRTH',{mail:'new-birthday@test.invalid',clave:'test-password',activo:true,email_verificado:true});
 const birthdayLogin=await read(request('/suscriptores',{action:'login',mail:'new-birthday@test.invalid',clave:'test-password'},false));token=birthdayLogin.body.token;
 const birthdayFilled=await read(request('/suscriptores',{action:'actualizar_perfil',fecha_nacimiento:birthAdult}));assert.equal(birthdayFilled.body.success,true);
 token=adminToken;const birthdayAdded=await read(request('/superadmin/birthdays'));assert.equal(birthdayAdded.body.total,3);assert.equal(birthdayAdded.calls.length,0);
 token=birthdayLogin.body.token;const birthdayDeleted=await read(request('/suscriptores',{action:'eliminar_cuenta',clave_actual:'test-password'}));assert.equal(birthdayDeleted.body.success,true);
 token=adminToken;const birthdayRemoved=await read(request('/superadmin/birthdays'));assert.equal(birthdayRemoved.body.total,2);assert.equal(birthdayRemoved.calls.length,0);
 log('PASS actualización: completar fecha agrega al resumen; eliminar cuenta la quita sin lecturas del contador.');
 const repeatedPrepare=await read(request('/superadmin/birthdays/prepare',{}));assert.equal(repeatedPrepare.calls.length,0);assert.equal(repeatedPrepare.body.total,2);
 const birthdayDashboard=await read(request('/superadmin/dashboard'));assert.equal(birthdayDashboard.body.cumpleanos.total,2);assert.equal(birthdayDashboard.calls.length,0);assert.equal(birthdayDashboard.body.cumpleanos.dias.length,7);
 values.set('efemerides:city:v2:D',JSON.stringify({efemerides:[{efemeride_id:'FIXED',nombre:'Fecha general',tipo:'GENERAL',tipo_fecha:'FIJA',mes:Number(calendarToday.slice(5,7)),dia:Number(calendarToday.slice(8)),activo:true},{efemeride_id:'OFF',nombre:'Inactiva',tipo:'GENERAL',tipo_fecha:'FIJA',mes:Number(calendarToday.slice(5,7)),dia:Number(calendarToday.slice(8)),activo:false}]}));
 values.set('territorio:public:v1',JSON.stringify({ciudades:[{ciudad_id:'D'},{ciudad_id:'D2'}]}));
 values.set('efemerides:city:v2:D2',values.get('efemerides:city:v2:D'));
 const upcoming=await read(request('/superadmin/ephemerides/upcoming'));assert.equal(upcoming.body.results.length,1);assert.equal(upcoming.body.incompleto,false);assert.equal(upcoming.calls.length,0);
 values.delete('efemerides:city:v2:D2');
 const partial=await read(request('/superadmin/ephemerides/upcoming'));assert.equal(partial.body.incompleto,true);assert.deepEqual(partial.body.ciudades_sin_cache,['D2']);assert.equal(partial.calls.length,0);
 const badCity=await read(request('/superadmin/ephemerides/upcoming?ciudad_id=BAD'));assert.equal(badCity.r.status,400);assert.equal(badCity.calls.length,0);
 values.set('territorio:public:v1',JSON.stringify({ciudades:[{ciudad_id:'D'}]}));
 const localPayload=Buffer.from(JSON.stringify({sid:'LOCAL',rol:'ADMIN_LOCAL',ciudades:['D'],exp:Date.now()+3600000})).toString('base64url');const localToken=localPayload+'.'+createHmac('sha256',env.SERVER_SECRET).update(localPayload).digest('base64url');
 for(const path of ['/superadmin/birthdays','/superadmin/ephemerides/upcoming']){const denied=await read(new Request('https://test.invalid'+path,{headers:{Authorization:'Bearer '+localToken}}));assert.equal(denied.r.status,403);assert.equal(denied.calls.length,0);}
 log('PASS calendario: preparación única sin escrituras Firestore, conteos válidos por edad, Inicio 0 lecturas, 7 días, efemérides sin duplicación, caché incompleta visible y acceso administrativo protegido.');
 const adultCold=await read(request('/superadmin/adult-review'));assert.equal(adultCold.reads,4);assert.equal(adultCold.body.results.length,1);
 const adultWarm=await read(request('/superadmin/adult-review'));assert.equal(adultWarm.reads,0);assert.equal(adultWarm.body.results.length,1);
 log('PASS +18: primera apertura con caché ausente 4 consultas; repetida 0, incluidas tres listas vacías.');
 const emptyFirst=await read(request('/superadmin/publications/blocked'));assert.equal(emptyFirst.body.results.length,0);assert.equal(emptyFirst.reads,2);
 const emptyAgain=await read(request('/superadmin/publications/blocked'));assert.equal(emptyAgain.body.results.length,0);assert.equal(emptyAgain.reads,0);
 log('PASS: bandeja vacía primera consulta 2 lecturas; segunda apertura 0.');
 const login=await read(request('/suscriptores',{action:'login',mail:'persona@test.invalid',clave:'test-password'},false));assert.equal(login.body.success,true);const userToken=login.body.token;token=userToken;

 const profile=await read(request('/suscriptores?action=perfil'));assert.equal(profile.body.suscriptor.fecha_nacimiento,'');assert.equal(profile.reads,0);
 const invalidBirth=await read(request('/suscriptores',{action:'actualizar_perfil',fecha_nacimiento:'2000-02-30'}));assert.equal(invalidBirth.body.success,false);assert.equal(invalidBirth.calls.length,0);
 const initialBirth=await read(request('/suscriptores',{action:'actualizar_perfil',fecha_nacimiento:'2000-01-01'}));assert.equal(initialBirth.body.success,true);assert.equal(initialBirth.body.suscriptor.fecha_nacimiento,'2000-01-01');assert.equal(initialBirth.reads,1);assert.equal(initialBirth.calls.filter(x=>x.op==='PATCH').length,1);
 const changedBirth=await read(request('/suscriptores',{action:'actualizar_perfil',fecha_nacimiento:'1990-01-01'}));assert.equal(changedBirth.body.success,false);assert.match(changedBirth.body.message,/Soporte/);assert.equal(changedBirth.calls.filter(x=>x.op==='PATCH').length,0);
 const adultAccess=await read(request('/adult/access',{confirmar:true}));assert.equal(adultAccess.body.success,true);assert.equal(adultAccess.reads,0);
 const repeatBirth=await read(request('/suscriptores',{action:'actualizar_perfil',fecha_nacimiento:'2000-01-01'}));assert.equal(repeatBirth.body.success,true);assert.equal(repeatBirth.calls.filter(x=>x.op==='PATCH').length,0);

 seed('suscriptores','CHILD',{mail:'menor@test.invalid',clave:'test-password',activo:true,email_verificado:true,fecha_nacimiento:'2015-01-01'});
 const childLogin=await read(request('/suscriptores',{action:'login',mail:'menor@test.invalid',clave:'test-password'},false));assert.equal(childLogin.body.success,true);token=childLogin.body.token;
 const childDenied=await read(request('/adult/access',{confirmar:true}));assert.equal(childDenied.r.status,403);assert.equal(childDenied.body.code,'UNDERAGE');assert.equal(childDenied.reads,0);
 const childChange=await read(request('/suscriptores',{action:'actualizar_perfil',fecha_nacimiento:'1990-01-01'}));assert.equal(childChange.body.success,false);assert.equal(rows.get('suscriptores/CHILD').fecha_nacimiento,'2015-01-01');
 seed('suscriptores','RACE',{mail:'race@test.invalid',clave:'test-password',activo:true,email_verificado:true});
 const raceLogin=await read(request('/suscriptores',{action:'login',mail:'race@test.invalid',clave:'test-password'},false));token=raceLogin.body.token;
 const missingBirth=await read(request('/adult/access',{confirmar:true}));assert.equal(missingBirth.body.code,'AGE_UNKNOWN');
 const raced=await Promise.all(['1990-01-01','2015-01-01'].map(birth=>worker.fetch(request('/suscriptores',{action:'actualizar_perfil',fecha_nacimiento:birth}),env).then(async r=>({r,body:await r.json()}))));
 assert.equal(raced.filter(x=>x.body.success).length,1);
 token=userToken;
 log('PASS menor: sin acceso y no puede cambiar fecha; fecha ausente bloquea; dos cargas simultáneas permiten una sola escritura de fecha.');
 log('PASS fecha: perfil caché, fecha imposible rechazada, primera carga 1 lectura/1 escritura con precondición, cambio bloqueado, acceso adulto 0 lecturas.');
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
