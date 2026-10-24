function pubTags107(/** @type {any} */ value){
 if(value!=null&&typeof value!=='string'&&!Array.isArray(value))throw new Error('Los tags deben ser palabras o frases de texto.');
 const parts=Array.isArray(value)?value:String(value??'').split(/[,;\n\r]+/);
 const unique=new Map();
 for(const part of parts){
  if(typeof part!=='string')throw new Error('Los tags deben ser palabras o frases de texto.');
  const tag=part.trim().replace(/\s+/g,' ');if(!tag)continue;
  const key=tag.toLocaleLowerCase('es');if(!unique.has(key))unique.set(key,tag);
 }
 const tags=[...unique.values()];
 if(tags.length>50)throw new Error('Podés cargar hasta 50 tags.');
 if(tags.join(', ').length>2000)throw new Error('Los tags pueden tener hasta 2.000 caracteres en total, incluidos los separadores.');
 return tags;
}

function pubInternalDestination106(raw){
 const value=String(raw||'').trim();
 if(!value||/[\\\s]/.test(value))return '';
 try{
  const url=new URL(/^(?:www\.)?guialocal\.ar\//i.test(value)?'https://'+value:value);
  if(url.protocol!=='https:'||!['guialocal.ar','www.guialocal.ar'].includes(url.hostname)||url.port||url.username||url.password||url.pathname==='/')return '';
  url.hostname='www.guialocal.ar';return url.href;
 }catch{return '';}
}

const DIRECTORY102={eventos:'eventos',actividades:'actividades',promos:'promos',publicidad:'publicidades',moderadores:'superadmins',empleo:'empleos'};
const directoryKey102=(/** @type {string} */ kind)=>'admin:directory:v102:'+kind;
function directoryState102(/** @type {any} */ row){
 if(row.revision_definitiva)return 'BLOQUEADA';
 const states=[row.estado_moderacion,row.revision_adulto,row.estado].map((/** @type {any} */ x)=>String(x||'').toUpperCase());
 if(states.some(x=>['RECHAZADO','RECHAZADA'].includes(x)))return 'RECHAZADA';
 if(states.includes('PENDIENTE')||row.aprobado===false)return 'PENDIENTE';
 if(row.empleo_id&&Date.parse(row.hasta)<=Date.now())return 'VENCIDA';
 const until=String(row.hasta||row.fecha_fin||'').slice(0,10);
 if(/^\d{4}-\d{2}-\d{2}$/.test(until)&&until<new Date(Date.now()-10800000).toISOString().slice(0,10))return 'VENCIDA';
 if(row.pausado===true||row.pausado==='true'||row.pausado===1||row.activo===false||states.some(x=>['INACTIVA','PAUSADA','PAUSADO'].includes(x)))return 'PAUSADA';
 return 'ACTIVA';
}
function directorySafe102(/** @type {any} */ row,/** @type {string} */ kind){
 if(kind!=='moderadores')return row;
 return {id:row.id,suscriptor_id:row.suscriptor_id,nombre:row.nombre||row.suscriptor_nombre,rol:row.rol,activo:row.activo,ciudades:row.ciudades,permisos:row.permisos,actualizado_en:row.actualizado_en};
}
function directoryProjection102(/** @type {any} */ row,/** @type {string} */ kind,/** @type {any} */ references){
 const id=String(row.id||row.evento_id||row.actividad_id||row.promo_id||row.publicidad_id||row.suscriptor_id||'');
 const advertiser=references.advertisers.get(String(row.anunciante_id||''));
 const ownCityIds=[...new Set([row.ciudad_id,...(row.ciudad_ids||[]),...(row.ciudades||[]).filter((/** @type {any} */ x)=>typeof x==='string'),...(row.segmentacion||[]).map((/** @type {any} */ x)=>x.ciudad_id),...(row.programacion||row.horarios||[]).map((/** @type {any} */ x)=>x.ciudad_id)].filter(Boolean).map(String))];
 const cityIds=ownCityIds.length?ownCityIds:(advertiser?.ciudad_ids||[]).map(String);
 const cities=cityIds.map((/** @type {string} */ id)=>references.cities.get(id)||id);
 const subscriber=references.subscribers.get(String(row.suscriptor_id||row.id||''));
 const name=String(row.anunciante_nombre||row.organizador_nombre||advertiser?.nombre||row.anunciante_id||row.nombre||subscriber?.nombre||'');
 const date=String(row.fecha_inicio||row.fecha||row.desde||row.creado_en||row.creado||row.actualizado_en||'');
 return {id,titulo:String(row.nombre_evento||row.actividad||row.nombre||row.promo||row.titulo||row.nombre_interno||(kind==='moderadores'?name:'')||id),anunciante_id:String(row.anunciante_id||''),anunciante_nombre:name,ciudad_ids:cityIds,ciudades:cities,fecha:date,estado:directoryState102(row),clase:kind==='eventos'?(isFree(row)?'FREE':'VIP'):'',search:norm6([name,...cities,row.organizador||''].join(' ')),row:directorySafe102(row,/** @type {string} */ kind)};
}
async function directoryReferences102(/** @type {any} */ cache){
 const [advertisers,territory,subscribers]=await Promise.all([cache.get(ADMIN_ADVERTISERS_KEY),cache.get('territorio:public:v1'),cache.get(ADMIN_SUBSCRIBERS_KEY)]);
 return {subscribers:new Map((subscribers?.results||[]).map((/** @type {any} */ x)=>[String(x.id||x.suscriptor_id),x])),advertisers:new Map((advertisers?.results||[]).map((/** @type {any} */ x)=>[String(x.id||x.anunciante_id),x])),cities:new Map((territory?.ciudades||[]).map((/** @type {any} */ x)=>[String(x.ciudad_id||x.id),String(x.ciudad_visible||x.nombre||x.ciudad_id||x.id)]))};
}
async function directoryDelta102(/** @type {any} */ cache,/** @type {string} */ c,/** @type {string} */ id,/** @type {any} */ row){
 const kind=Object.keys(DIRECTORY102).find(k=>DIRECTORY102[k]===c);if(!/** @type {string} */ kind)return;
 // Always retain concurrent mutations while an explicit initial snapshot is being prepared.
 await cache.put(directoryKey102(/** @type {string} */ kind)+':delta:'+encodeURIComponent(id),{id,row:row?directorySafe102(row,/** @type {string} */ kind):null});
 if(c==='eventos'&&cache.invalidatePendingEvents126)await cache.invalidatePendingEvents126();
}
async function routeDirectories102(/** @type {any} */ ctx){
 const {path,request,env,db,cache,url}=ctx;
 if(!['/superadmin/listados','/superadmin/listados/prepare'].includes(path))return null;
 const auth=await verifyAdmin(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);
 const kind=String(url.searchParams.get('tipo')||'');
 if(!isTopAdmin2(auth)||kind==='moderadores'&&auth.rol!=='SUPERADMIN_PRINCIPAL')return json({success:false,message:'No tenés permiso para consultar este listado.'},403);
 if(!DIRECTORY102[kind])return json({success:false,message:'Listado inválido.'},400);
 const key=directoryKey102(/** @type {string} */ kind);
 if(path.endsWith('/prepare')){
  if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
  const ready=await cache.get(key+':manifest');if(ready)return json({success:true,preparado:true,procesadas:ready.total});
  let progress=await cache.get(key+':progress')||{generation:crypto.randomUUID(),pageToken:'',chunks:0,total:0};
  const page=await db.listPage102(DIRECTORY102[kind],progress.pageToken);
  const rows=page.rows.filter((/** @type {any} */ r)=>!r.eliminado&&!r.eliminada&&(kind!=='moderadores'||r.rol==='ADMIN_LOCAL')).map((/** @type {any} */ r)=>directorySafe102(r,/** @type {string} */ kind));
  await cache.put(key+':chunk:'+progress.generation+':'+progress.chunks,{rows});
  progress={...progress,pageToken:page.nextPageToken,chunks:progress.chunks+1,total:progress.total+rows.length};
  if(page.nextPageToken)await cache.put(key+':progress',progress);
  else{await cache.put(key+':manifest',{...progress,prepared_at:new Date().toISOString()});}
  return json({success:true,preparado:!page.nextPageToken,continuar:!!page.nextPageToken,procesadas:progress.total});
 }
 if(request.method!=='GET')return json({success:false,message:'Método inválido.'},405);
 const manifest=await cache.get(key+':manifest');if(!manifest)return json({success:true,preparado:false,results:[],total:null,next_cursor:null});
 let after='';const cursor=url.searchParams.get('cursor');if(cursor){try{after=JSON.parse(b64decode(cursor)).after;if(typeof after!=='string')throw Error();}catch{return json({success:false,message:'Página inválida. Actualizá el listado.'},400);}}
 const refs=await directoryReferences102(cache),q=norm6(url.searchParams.get('q')||''),city=String(url.searchParams.get('ciudad_id')||''),state=String(url.searchParams.get('estado')||''),clase=String(url.searchParams.get('clase')||'');
 const deltas=new Map();let deltaCursor;
 do{const p=await env.GLD_CACHE_KV.list({prefix:key+':delta:',...(deltaCursor?{cursor:deltaCursor}:{})});for(const k of p.keys){const d=await cache.get(k.name);if(d)deltas.set(d.id,d.row);}deltaCursor=p.list_complete?null:p.cursor;}while(deltaCursor);
 let total=0;const selected=[];
 const consider=(/** @type {any} */ r)=>{
  if(!r||r.eliminado||r.eliminada||kind==='moderadores'&&r.rol!=='ADMIN_LOCAL')return;
  const p=directoryProjection102(r,kind,refs);if(q&&!p.search.includes(q)||city&&!p.ciudad_ids.includes(city)||state&&state!==p.estado||clase&&clase!==p.clase)return;
  total++;const order=p.fecha+'\u0001'+p.id;if(after&&order<=after)return;
  selected.push({...p,order});selected.sort((a,b)=>a.order<b.order?-1:a.order>b.order?1:0);if(selected.length>11)selected.pop();
 };
 for(let n=0;n<manifest.chunks;n+=8){const chunks=await Promise.all(Array.from({length:Math.min(8,manifest.chunks-n)},(/** @type {unknown} */ _,i)=>cache.get(key+':chunk:'+manifest.generation+':'+(n+i))));for(const chunk of chunks){if(!chunk||!Array.isArray(chunk.rows))return json({success:false,message:'El listado aún se está sincronizando. Volvé a consultar.'},503);for(const r of chunk.rows){const id=String(r.id||r.evento_id||r.actividad_id||r.promo_id||r.publicidad_id||r.suscriptor_id||'');if(!deltas.has(id))consider(r);}}}
 for(const r of deltas.values())consider(r);
 const results=selected.slice(0,10),next=selected.length>10?b64(JSON.stringify({after:results[9].order})):null;
 return new Response(JSON.stringify({success:true,preparado:true,results:results.map(({order,...p})=>p),total,next_cursor:next}),{headers:{...cors(),'Content-Type':'application/json','Cache-Control':'no-store'}});
}

const REVIEW102={ACTIVIDAD:'actividades',EVENTO:'eventos',EVENTO_FREE:'eventos',PROMO:'promos',PUBLICIDAD:'publicidades',EMPLEO:'empleos'};
function reviewReference102(/** @type {any} */ body){
 if(body.revision&&REVIEW102[body.revision.tipo]&&/^[\w-]{1,180}$/.test(body.revision.id))return {tipo:body.revision.tipo,id:body.revision.id};
 const detail=String(body.detalle||'');if(!detail.startsWith('Solicitud de revisión de publicación rechazada\n'))return null;
 const type=detail.match(/^Tipo: (.+)$/m)?.[1],id=detail.match(/^Referencia: ([\w-]{1,180})$/m)?.[1];
 const tipo=({'Actividad':'ACTIVIDAD','Evento VIP':'EVENTO','Evento Free':'EVENTO_FREE','Promoción':'PROMO','Publicidad':'PUBLICIDAD'})[type||''];
 return tipo&&id?{tipo,id}:null;
}
async function validateReview102(/** @type {any} */ db,/** @type {string} */ aid,/** @type {any} */ reference,/** @type {string} */ sid=''){
 const row=await db.get(REVIEW102[reference.tipo],reference.tipo==='EMPLEO'?empRecord109(reference.id):reference.id);
 if(reference.tipo==='EMPLEO'&&(!row||row.empleo_id!==reference.id||!aid&&(row.owner_type!=='PERSONA'||row.owner_id!==sid)))throw httpError('La publicación no pertenece a esta cuenta o ya venció su período.',403);
 if(!row||String(row.anunciante_id||'')!==aid)throw httpError('La publicación no pertenece a este anunciante.',403);
 if(row.revision_definitiva)throw httpError('La revisión ya fue rechazada definitivamente. Esta publicación está bloqueada.',403);
 if(directoryState102(row)!=='RECHAZADA')throw httpError('Esta publicación no tiene un rechazo que pueda apelarse.',409);
 return row;
}
async function knownReviews102(/** @type {any} */ db,/** @type {any} */ cache,/** @type {string} */ sid,/** @type {string} */ aid){
 const read=db.panelReadDb?db.panelReadDb():db;
 const rows=await read.queryEqual('solicitudes_soporte','suscriptor_id',sid,500);
 const result=[];
 for(const row of rows){
  if(aid&&String(row.anunciante_id||'')!==aid)continue;
  const ref=row.revision||reviewReference102(row);if(!ref)continue;
  const entry={tipo:ref.tipo,id:ref.id,estado:row.estado,solicitud_id:row.solicitud_id||row.id};result.push(entry);
  if(row.estado==='CERRADA'){
   const key='review:closed:v102:'+REVIEW102[ref.tipo]+':'+ref.id;
   // Compatibilidad de revisiones antiguas: preparar sólo la copia faltante.
   // La respuesta y el control de apelaciones usan la solicitud ya cargada.
   if(!await cache.get(key)){
    try{await cache.put(key,entry);}
    catch(error){if(!/KV put\(\) limit exceeded for (?:the day|today)/i.test(String(error?.message||error)))throw error;}
   }
  }
 }
 return result;
}
async function rejectReview102(/** @type {any} */ ctx,/** @type {any} */ auth,/** @type {string} */ id,/** @type {string} */ nota){
 const {db,cache}=ctx,version=await db.getVersioned('solicitudes_soporte',id),current=version.doc;
 if(!current)throw httpError('Solicitud no encontrada.',400);
 const reference=current.revision||reviewReference102(current);if(!reference||!REVIEW102[reference.tipo])throw httpError('La solicitud no corresponde a una revisión de publicación.',400);
 const collection=REVIEW102[reference.tipo],recordId=reference.tipo==='EMPLEO'?empRecord109(reference.id):reference.id,publication=await db.getVersioned(collection,recordId),row=publication.doc;
 if(reference.tipo==='EMPLEO'&&(!row||row.empleo_id!==reference.id||!current.anunciante_id&&row.owner_id!==current.suscriptor_id))throw httpError('La publicación de esta revisión ya no está vigente.',409);
 if(!row||String(row.anunciante_id||'')!==String(current.anunciante_id||''))throw httpError('La publicación no coincide con la solicitud.',409);
 if(current.estado==='CERRADA'&&row.revision_definitiva)return json({success:true,updated:false,estado:'CERRADA',publicacion_bloqueada:true});
 const now=new Date().toISOString(),supportPatch={estado:'CERRADA',nota,atendido_por:auth.sid,actualizado_en:now,revision:reference,decision_revision:'RECHAZAR'},publicationPatch={revision_definitiva:true,revision_definitiva_en:now,revision_solicitud_id:id,estado_moderacion:'RECHAZADO',aprobado:false,...(row.contenido_adulto?{revision_adulto:'RECHAZADO'}:{})};
 const saved=await db.commitPatches([{collection:'solicitudes_soporte',id,before:current,patch:supportPatch,options:{updateTime:version.updateTime}},{collection,id:recordId,before:row,patch:publicationPatch,options:{updateTime:publication.updateTime}}]);
 await cache.put('support:record:v73:'+id,saved[0]);
 await syncPublicationReviewV77({db,cache,collection,id:reference.id,current:row,next:saved[1]});
 return json({success:true,updated:true,estado:'CERRADA',publicacion_bloqueada:true});
}
async function notify102(/** @type {any} */ cache,/** @type {string} */ collection,/** @type {string} */ id,/** @type {any} */ row){
 if(!row)return;
 let sid=String(row.suscriptor_id||''),aid=String(row.anunciante_id||''),title='',detail='',ticket='',entity=collection+':'+id;
 if(collection==='solicitudes_soporte'){title=row.decision_revision==='RECHAZAR'?'Revisión rechazada definitivamente':'Solicitud de soporte: '+String(row.estado||'registrada');detail=String(row.nota||'Tu solicitud quedó registrada y podés consultar su estado.');ticket=id;}
 else if(collection==='solicitudes_anunciante'){title='Solicitud de anuncio: '+String(row.estado||'registrada');detail=String(row.nota||row.nombre||'Podés consultar el estado de tu solicitud.');}
 else if(collection==='solicitudes_soporte_mensajes'&&row.autor==='ADMIN'){
  const parent=await cache.get('support:record:v73:'+row.solicitud_id);sid=String(parent?.suscriptor_id||'');aid=String(parent?.anunciante_id||'');title='Tenés una respuesta de Soporte';detail=String(row.texto||'');ticket=String(row.solicitud_id||'');
 }
 if(!sid||!title)return;
 const date=String(row.actualizado_en||row.creado_en||new Date().toISOString()),stamp=Date.parse(date)||Date.now();
 const key='notifications:v102:'+encodeURIComponent(sid)+':'+String(9999999999999-stamp).padStart(13,'0')+':'+encodeURIComponent(entity);
 await cache.put(key,{id:entity,titulo:title,detalle:detail,fecha:date,solicitud_id:ticket,anunciante_id:aid});
}
async function routeNotifications102(/** @type {any} */ ctx){
 if(ctx.path!=='/notifications')return null;
 if(ctx.request.method!=='GET')return json({success:false,message:'Método inválido.'},405);
 const auth=await verifySubscriberSession(ctx.env,ctx.request);if(!auth.ok)return json({success:false,message:auth.message},401);
 const aid=String(ctx.url.searchParams.get('anunciante_id')||'');
 if(aid&&!(auth.auth||[]).some((/** @type {any} */ r)=>String(r.anunciante_id||'')===aid))return json({success:false,message:'No tenés acceso a este anunciante.'},403);
 const prefix='notifications:v102:'+encodeURIComponent(auth.sid)+':',page=await ctx.env.GLD_CACHE_KV.list({prefix,limit:100});
 const records=await Promise.all(page.keys.map((/** @type {any} */ k)=>ctx.cache.get(k.name))),seen=new Set(),results=[];
 records.sort((a,b)=>String(b?.fecha||'').localeCompare(String(a?.fecha||'')));
 for(const n of records)if(n&&(!aid||n.anunciante_id===aid)&&!seen.has(n.id)){seen.add(n.id);results.push(n);}
 const legacy=ctx.db.cachedPanelRows?await ctx.db.cachedPanelRows('solicitudes_soporte','suscriptor_id',auth.sid):null;
 for(const r of legacy||[]){if(aid&&String(r.anunciante_id||'')!==aid)continue;const id=String(r.solicitud_id||r.id),entity='solicitudes_soporte:'+id;if(!seen.has(entity)){seen.add(entity);results.push({id:entity,titulo:'Solicitud de soporte: '+r.estado,detalle:String(r.nota||'Podés abrir la solicitud para consultar sus respuestas.'),fecha:r.actualizado_en||r.creado_en,solicitud_id:id,anunciante_id:String(r.anunciante_id||'')});}}
 const activeTerms=await currentTermsV81(ctx.cache),profile=await ctx.db.cachedSubscriberProjection(auth.sid),acceptance=profile?.aceptacion_terminos_anunciante;
 if(acceptance&&acceptance.version!==activeTerms.version)results.unshift({id:'terminos:'+activeTerms.version,titulo:'Cambios en los términos para anunciantes',detalle:'Revisá la versión vigente de los términos y condiciones.',fecha:activeTerms.publicado_en||activeTerms.version,tipo:'TERMINOS'});
 return new Response(JSON.stringify({success:true,results:results.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).slice(0,100)}),{headers:{...cors(),'Content-Type':'application/json','Cache-Control':'no-store'}});
}

function publicityRelationsComparableV101(/** @type {any[]} */ rows){
 return rows.map((r,i)=>r.url!==undefined?{url:text(r.url),poster:text(r.poster),tipo_media:text(r.tipo_media).toUpperCase(),orden:Number(r.orden||i+1),activo:activeMedia2(r)}:{ciudad_id:text(r.ciudad_id),ubicacion_id:text(r.ubicacion_id),categoria_id:text(r.categoria_id),activo:activeSeg2(r)}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
async function routeAdminPublicityV101(/** @type {any} */ ctx){
 const {path,request,env,db,cache,url}=ctx;
 if(!['/superadmin/publicidad','/superadmin/publicidad/prepare'].includes(path))return null;
 const auth=await verifyAdmin(env,request);
 if(!auth.ok)return json({success:false,message:auth.message},401);
 if(!isTopAdmin2(auth))return json({success:false,message:'La administración comercial de publicidad corresponde a Gran Hermano.'},403);
 if(path.endsWith('/prepare')){
  if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
  if(await cache.get('publicity:private:ready:v101'))return json({success:true,ya_preparado:true});
  const docs=await db.listCollection('publicidades');
  for(const p of docs){
   const id=text(p.publicidad_id||p.id);
   // Do not overwrite an index already maintained by a later mutation.
   if(await cache.get('publicity:private:v101:'+encodeURIComponent(id)))continue;
   const [media,segmentacion]=await Promise.all([getPreparedRelationsV1({cache,type:'publicity-media',id,current:p,load:()=>db.queryEqual('publicidad_media','publicidad_id',id,500)}),getPreparedRelationsV1({cache,type:'publicity-seg',id,current:p,load:()=>db.queryEqual('publicidad_segmentacion','publicidad_id',id,500)})]);
   await cache.put('publicity:private:v101:'+encodeURIComponent(id),{...p,publicidad_id:id,media,segmentacion});
  }
  await cache.put('publicity:private:ready:v101',true);
  return json({success:true,preparado:true});
 }
 if(request.method==='GET'){
  const page=await env.GLD_CACHE_KV.list({prefix:'publicity:private:v101:',limit:100,...(url.searchParams.get('cursor')?{cursor:url.searchParams.get('cursor')}:{})});
  const rows=await Promise.all(page.keys.map((/** @type {any} */ k)=>cache.get(k.name)));
  return json({success:true,results:rows.filter((/** @type {any} */ p)=>p&&!p.eliminada),preparado:!!await cache.get('publicity:private:ready:v101'),next_cursor:page.list_complete?null:page.cursor});
 }
 if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
 const body=await request.json(),id=text(body.publicidad_id),action=text(body.action);
 if(!id||!['pausar','eliminar'].includes(action))return json({success:false,message:'Acción inválida.'},400);
 const version=await db.getVersioned('publicidades',id),current=version.doc;
 if(!current)return json({success:false,message:'Publicidad no encontrada.'},404);
 if(action==='eliminar')return json(await publicityDeleteMonthlyV101({db,cache,advertiserId:text(current.anunciante_id),publicityId:id}));
 if(current.estado!=='ACTIVA')return json({success:true,sin_cambios:true});
 const aid=text(current.anunciante_id),{state,options}=await publicityStateV101(db,aid);
 state.activas=state.activas.filter((/** @type {any} */ x)=>x!==id);
 const [next]=await publicityCommitV101(db,cache,aid,state,options,[{collection:'publicidades',id,before:current,patch:{...current,estado:'INACTIVA',actualizado:new Date().toISOString()},options:{updateTime:version.updateTime}}]);
 const [media,segmentacion]=await Promise.all([getPreparedRelationsV1({cache,type:'publicity-media',id,current,load:()=>db.queryEqual('publicidad_media','publicidad_id',id,500)}),getPreparedRelationsV1({cache,type:'publicity-seg',id,current,load:()=>db.queryEqual('publicidad_segmentacion','publicidad_id',id,500)})]);
 await syncPublicityPreparedV2({cache,publicityId:id,current,next,media,segmentacion,previousCities:segmentacion.map((/** @type {any} */ s)=>s.ciudad_id)});
 return json({success:true});
}

// Publicidad: contrato y cupos mensuales. Sólo datos; nunca archivos binarios.
function publicityContractV101(/** @type {any} */ admin){
 const c=admin?.funcionalidades_config?.PUBLICIDAD||admin?.funcionalidades_config?.PUBLI||{};
 const count=(/** @type {any} */ v,f=0)=>v===undefined||v===null||v===''?f:Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
 const list=(/** @type {any} */ v)=>[...new Set((Array.isArray(v)?v:String(v||'').split(/[;,\n]/)).map((/** @type {any} */ x)=>String(x).trim()).filter(Boolean))];
 const n=Number(admin?.nivel)===3?0:count(c.activas_max??c.activas??admin?.publicidad_activas_max);
 return {activas_max:n,guardadas_max:n*2,renovaciones_mes_max:n,rectificaciones_por_pieza:1,
  ciudades_max:count(c.ciudades_max,1),categorias_max:count(c.categorias_max,1),ciudades_sin_limite:c.ciudades_sin_limite===true,categorias_sin_limite:c.categorias_sin_limite===true,
  ciudades_ids:list(c.ciudades_ids),ubicaciones_ids:list(c.ubicaciones_ids),categorias_keys:list(c.categorias_keys),
  permite_imagen:c.permite_imagen!==false,permite_carrusel:c.permite_carrusel!==false,permite_short:c.permite_short!==false,
  vigente_desde:String(c.vigente_desde||''),vigente_hasta:String(c.vigente_hasta||''),
  nivel:Number(admin?.nivel)||4,prioridad_id:''};
}
function publicityMonthV101(){return new Date(Date.now()-10800000).toISOString().slice(0,7);}
function publicityUsageV101(/** @type {any} */ state,/** @type {any} */ cfg){
 const monthly=state?.mes===publicityMonthV101()?state:{};
 return {mes:publicityMonthV101(),usados:(monthly.renovadas||[]).length,max:cfg.activas_max,
 disponibles:Math.max(0,cfg.activas_max-(monthly.renovadas||[]).length)};
}
async function publicityStateV101(/** @type {any} */ db,/** @type {any} */ aid){
 const version=await db.getVersioned('publicidad_estado',aid);
 let state=version.doc;
 if(!state){
  const rows=await db.queryEqual('publicidades','anunciante_id',aid,500);
  state={anunciante_id:aid,iniciales_usadas:rows.length,guardadas:rows.map((/** @type {any} */ p)=>String(p.publicidad_id||p.id)),activas:rows.filter((/** @type {any} */ p)=>p.estado==='ACTIVA').map((/** @type {any} */ p)=>String(p.publicidad_id||p.id))};
 }
 state=structuredClone(state);
 if(state.mes!==publicityMonthV101())Object.assign(state,{mes:publicityMonthV101(),renovadas:[],ediciones:{},reactivaciones:[]});
 return {state,options:version.updateTime?{updateTime:version.updateTime}:{mustNotExist:true}};
}
function publicityRenewV101(/** @type {any} */ state,/** @type {any} */ id,/** @type {any} */ cfg){
 if(!state.renovadas.includes(id)){
  if(state.renovadas.length>=cfg.activas_max)throw httpError('Agotaste las renovaciones de este mes. El cupo se restablece el próximo mes calendario.',409);
  state.renovadas.push(id);
 }
}
async function publicityCommitV101(/** @type {any} */ db,/** @type {any} */ cache,/** @type {any} */ aid,/** @type {any} */ state,/** @type {any} */ options,/** @type {any} */ changes){
 const rows=await db.commitPatches([{collection:'publicidad_estado',id:aid,patch:state,options},...changes]);
 await cache.put('publicity:usage:v101:'+aid,state);
 return rows.slice(1);
}
async function publicityScopeV101(/** @type {any} */ cache,/** @type {any} */ data,/** @type {any} */ current,/** @type {any} */ cfg,/** @type {any} */ id){
 const old=current?.segmentacion||[];
 const cities=Array.isArray(data.ciudades)?[...new Set(data.ciudades.map(text).filter(Boolean))]:[...new Set(old.map((/** @type {any} */ s)=>s.ciudad_id))];
 const cats=Array.isArray(data.categorias)?[...new Set(data.categorias.map(text).filter(Boolean))]:[...new Set(old.map((/** @type {any} */ s)=>s.categoria_key||s.ubicacion_id+':'+s.categoria_id))];
 const catalogs=await getPublicidadCatalogs(cache),territory=await cache.get('territorio:public:v1');
 const validCities=new Set((territory?.ciudades||[]).map((/** @type {any} */ c)=>text(c.ciudad_id||c.id)));
 const validLocations=new Set((catalogs.ubicaciones||[]).filter(active3).map((/** @type {any} */ c)=>text(c.ubicacion_id||c.id)));
 if(!cities.length||!cats.length)throw httpError('Seleccioná ciudad, sección y categoría de la publicidad.',400);
 if(cities.some((/** @type {any} */ c)=>!validCities.has(c)))throw httpError('Elegí ciudades disponibles en Guía Local.',400);
 if(cfg.ciudades_ids.length&&cities.some((/** @type {any} */ c)=>!cfg.ciudades_ids.includes(c)))throw httpError('La ciudad no está incluida en tu contratación.',403);
 if(!cfg.ciudades_sin_limite&&cities.length>cfg.ciudades_max)throw httpError('Superaste la cantidad de ciudades contratadas.',403);
 if(!cfg.categorias_sin_limite&&cats.length>cfg.categorias_max)throw httpError('Superaste la cantidad de categorías contratadas.',403);
 const seg=[];
 for(const key of cats){
  const split=key.indexOf(':'),location=key.slice(0,split),category=key.slice(split+1);
  if(split<1||!validLocations.has(location))throw httpError('Elegí una sección habilitada.',400);
  const valid=(catalogs.categorias||[]).find((/** @type {any} */ c)=>active3(c)&&text(c.ubicacion_id)===location&&text(c.categoria_id||c.id)===category);
  if(!valid)throw httpError('Elegí una categoría habilitada para esa sección.',400);
  if(cfg.ubicaciones_ids.length&&!cfg.ubicaciones_ids.includes(location)||cfg.categorias_keys.length&&!cfg.categorias_keys.includes(key))throw httpError('La sección o categoría no está incluida en tu contratación.',403);
  for(const city of cities)seg.push({publicidad_id:id,segmentacion_id:id+':'+city+':'+key,ciudad_id:city,ubicacion_id:location,categoria_id:category,categoria_nombre:text(valid.categoria||valid.nombre),categoria_key:key,activo:true});
 }
 return seg;
}
async function publicitySaveMonthlyV101(/** @type {any} */ {db,cache,advertiserId:aid,body,config:cfg}){
 const data=body?.payload||{},draft=/^[a-f0-9-]{36}$/i.test(String(body.request_key||''))?String(body.request_key):crypto.randomUUID(),id=text(data.publicidad_id)||'PUB-'+draft;
 const prepared=text(data.publicidad_id)?await db.get('publicidades',id):null;
 if(data.publicidad_id&&!prepared)throw httpError('Publicidad no encontrada.',404);
 if(prepared&&text(prepared.anunciante_id)!==aid)throw httpError('La publicidad no pertenece al anunciante.',403);
 const current=prepared;
 const oldSeg=current?await getPreparedRelationsV1({cache,type:'publicity-seg',id,current,load:()=>db.queryEqual('publicidad_segmentacion','publicidad_id',id,500)}):[];
 const oldMedia=current?await getPreparedRelationsV1({cache,type:'publicity-media',id,current,load:()=>db.queryEqual('publicidad_media','publicidad_id',id,500)}):[];
 const formato=text(data.formato??current?.formato).toUpperCase();
 if(!({IMAGEN:cfg.permite_imagen,CARRUSEL:cfg.permite_carrusel,SHORT:cfg.permite_short})[formato])throw httpError('El formato no está habilitado en tu contratación.',403);
 const media=Array.isArray(data.media)?data.media.map((/** @type {any} */ m,/** @type {number} */ i)=>({publicidad_id:id,media_id:id+':'+i,tipo_media:formato,url:text(m.url),poster:text(m.poster),orden:i+1,activo:true})):oldMedia;
 if(formato==='CARRUSEL'?(media.length<2||media.length>5):media.length!==1)throw httpError('Cargá una imagen o Short, o entre dos y cinco imágenes para un carrusel.',400);
 if(Array.isArray(data.media)||data.formato&&data.formato!==current?.formato)for(const m of media){let u;try{u=new URL(m.url);}catch{throw httpError('Ingresá un enlace válido para el contenido.',400);}if(!['https:','http:'].includes(u.protocol))throw httpError('El contenido debe usar un enlace http o https.',400);if(formato==='SHORT'){const vid=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)||!/^[A-Za-z0-9_-]{11}$/.test(vid||''))throw httpError('Ingresá un enlace de YouTube válido para el Short.',400);}}
 const segmentacion=await publicityScopeV101(cache,data,{segmentacion:oldSeg},cfg,id);
 const fields=['nombre_interno','titulo','cta_texto','cta_tipo','cta_destino'];
 const doc={...(current||{}),publicidad_id:id,anunciante_id:aid,formato,media,segmentacion,relaciones_version:2,legacy_children:!!current&&(current.legacy_children===true||current.relaciones_version!==2),nivel:cfg.nivel};
 for(const field of fields)doc[field]=text(data[field]??current?.[field]);
 if(!doc.cta_tipo){doc.cta_destino='';}
 else if(doc.cta_tipo==='FICHA_ANUNCIANTE'){doc.cta_destino='';}
 else if(['MICROSITIO','WEB_EMBEBIDA'].includes(doc.cta_tipo)){
  const destination=pubInternalDestination106(doc.cta_destino);
  if(!destination)throw httpError('El destino debe ser una página interna: https://www.guialocal.ar/tu-pagina.',400);
  doc.cta_destino=destination;
 }else throw httpError('Elegí un destino válido para la publicidad.',400);
 if(!doc.titulo)throw httpError('Completá el título de la publicidad.',400);
 if(doc.titulo.length>100||doc.nombre_interno.length>80||doc.cta_texto.length>35||doc.cta_destino.length>500)throw httpError('Revisá la extensión de los textos de la publicidad.',400);
 doc.contenido_adulto=Object.hasOwn(data,'contenido_adulto')?adultFlag(data.contenido_adulto):adultFlag(current?.contenido_adulto);
 doc.vigente_desde=cfg.vigente_desde||current?.vigente_desde||'';doc.vigente_hasta=cfg.vigente_hasta||current?.vigente_hasta||'';
 let storedTags;try{storedTags=pubTags107(current?.tags||[]);doc.tags=Object.hasOwn(data,'tags')?pubTags107(data.tags):storedTags;}catch(error){throw httpError(error.message,400);}
 const relationValue=publicityRelationsComparableV101;
 if(new TextEncoder().encode(JSON.stringify(doc)).byteLength>800000)throw httpError('La cobertura y el contenido son demasiado extensos para una sola pieza. Reducí la selección o distribuí la campaña entre varias piezas.',400);
 const same=current&&JSON.stringify(storedTags)===JSON.stringify(doc.tags)&&fields.every((/** @type {any} */ k)=>text(current[k])===doc[k])&&current.formato===formato&&adultFlag(current.contenido_adulto)===doc.contenido_adulto&&JSON.stringify(relationValue(oldMedia))===JSON.stringify(relationValue(media))&&JSON.stringify(relationValue(oldSeg))===JSON.stringify(relationValue(segmentacion));
 if(same)return {success:true,sin_cambios:true,publicidad_id:id,publicidad:{...current,media:oldMedia,segmentacion:oldSeg},cambios_activos:publicityUsageV101(await cache.get('publicity:usage:v101:'+aid),cfg)};
 const version=current?await db.getVersioned('publicidades',id):null;
 if(current&&(!version.doc||text(version.doc.actualizado)!==text(current.actualizado)))throw httpError('La publicidad cambió. Actualizá la lista antes de guardar.',409);
 const stateInfo=await publicityStateV101(db,aid),state=stateInfo.state;
 if(!current&&state.guardadas.includes(id)){const existing=await db.get('publicidades',id);if(existing&&text(existing.anunciante_id)===aid)return {success:true,ya_registrada:true,publicidad_id:id,publicidad:existing,cambios_activos:publicityUsageV101(state,cfg)};throw httpError('La biblioteca cambió. Actualizá la lista.',409);}
 if(!cfg.activas_max)throw httpError('No tenés cupo de Publicidad asignado.',403);
 if(!current){
  if(state.guardadas.length>=cfg.guardadas_max)throw httpError('Alcanzaste el cupo de biblioteca: el doble de tus publicidades activas.',409);
  if(state.iniciales_usadas<cfg.activas_max)state.iniciales_usadas++;else publicityRenewV101(state,id,cfg);
  state.guardadas.push(id);state.ediciones[id]=1;
  doc.estado=state.activas.length<cfg.activas_max?'ACTIVA':'INACTIVA';
  if(doc.estado==='ACTIVA')state.activas.push(id);
 }else{
  const edits=Number(state.ediciones[id]||0);
  if(edits>=2)throw httpError('Esta pieza ya utilizó la renovación y la rectificación de este mes.',409);
  if(edits===1&&(current.formato!==formato||JSON.stringify(relationValue(oldSeg))!==JSON.stringify(relationValue(segmentacion))))throw httpError('La rectificación adicional permite corregir texto, contenido o destino; la cobertura y el formato se renuevan el próximo mes.',409);
  if(!edits)publicityRenewV101(state,id,cfg);
  state.ediciones[id]=edits+1;
 }
 const now=new Date().toISOString();doc.creado=current?.creado||now;doc.actualizado=now;
 const context=db.publicationContext;
 if(!context)throw httpError('Confirmá los términos y la declaración de responsabilidad.',400);
 const policy=publicationPolicyV77(doc,context.rules);
 Object.assign(doc,policy,{aprobado:policy.estado_moderacion!=='PENDIENTE',declaracion_publicacion:{version:PUBLICATION_TERMS_V77,usuario_id:context.sid,fecha:now}});
 const [saved]=await publicityCommitV101(db,cache,aid,state,stateInfo.options,[{collection:'publicidades',id,patch:doc,before:current,options:current?{updateTime:version.updateTime}:{mustNotExist:true}}]);
 await syncPublicityPreparedV2({cache,publicityId:id,current,next:saved,media,segmentacion,previousCities:[...new Set(oldSeg.map((/** @type {any} */ s)=>s.ciudad_id))]});
 if(saved.estado_moderacion==='PUBLICADO'&&!saved.contenido_adulto){const item={collection:'publicidades',id,nombre:saved.titulo,ciudades:[...new Set(segmentacion.map(s=>s.ciudad_id))],anunciante_id:aid,fecha:now,publicacion:saved};await cache.put('publication:recent:v77:'+now.slice(0,10)+':publicidades:'+id,item,{expirationTtl:11*86400});await cache.put('publication:recent:latest:v77:publicidades:'+id,item,{expirationTtl:11*86400});}else await cache.put('publication:recent:latest:v77:publicidades:'+id,{retirado:true,collection:'publicidades',id},{expirationTtl:11*86400});
 return {success:true,publicidad_id:id,created:!current,updated:!!current,publicidad:saved,cambios_activos:publicityUsageV101(state,cfg)};
}
async function publicityActiveMonthlyV101(/** @type {any} */ {db,cache,advertiserId:aid,ids}){
 const cfg=publicityContractV101(await db.get('anunciantes_administracion',aid));
 const selected=[...new Set((ids||[]).map(text).filter(Boolean))];
 const own=await db.queryEqual('publicidades','anunciante_id',aid,500);
 const equal=(/** @type {any} */ a,/** @type {any} */ b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
 if(equal(own.filter((/** @type {any} */ p)=>p.estado==='ACTIVA').map((/** @type {any} */ p)=>text(p.publicidad_id||p.id)),selected))return {success:true,sin_cambios:true,publicidades:own};
 const {state,options}=await publicityStateV101(db,aid);
 if(selected.some((/** @type {any} */ id)=>!state.guardadas.includes(id)))throw httpError('La publicidad no pertenece al anunciante.',403);
 if(selected.some((/** @type {any} */ id)=>!state.activas.includes(id))&&selected.length>cfg.activas_max)throw httpError('Revisá el cupo de publicidades activas contratado.',409);
 const changedIds=[...new Set([...state.activas,...selected])].filter((/** @type {any} */ id)=>state.activas.includes(id)!==selected.includes(id));
 const changes=[];
 for(const id of changedIds){
  const version=await db.getVersioned('publicidades',id),p=version.doc;
  if(!p||text(p.anunciante_id)!==aid)throw httpError('La biblioteca cambió. Actualizá la lista.',409);
  const active=selected.includes(id);
  if(active){
   if(Number(state.reactivaciones.filter((/** @type {any} */ x)=>x===id).length)>=1)throw httpError('Esta pieza ya fue reactivada este mes. Podés volver a cambiarla el próximo mes.',409);
   if(!state.ediciones[id])publicityRenewV101(state,id,cfg);
   state.reactivaciones.push(id);
  }
  changes.push({collection:'publicidades',id,before:p,patch:{...p,estado:active?'ACTIVA':'INACTIVA',actualizado:new Date().toISOString()},options:{updateTime:version.updateTime}});
 }
 if(!changes.length)return {success:true,sin_cambios:true,publicidades:own};
 state.activas=selected;
 const saved=await publicityCommitV101(db,cache,aid,state,options,changes);
 for(let i=0;i<changes.length;i++){
  const p=changes[i].before,id=changes[i].id;
  const [media,segmentacion]=await Promise.all([getPreparedRelationsV1({cache,type:'publicity-media',id,current:p,load:()=>db.queryEqual('publicidad_media','publicidad_id',id,500)}),getPreparedRelationsV1({cache,type:'publicity-seg',id,current:p,load:()=>db.queryEqual('publicidad_segmentacion','publicidad_id',id,500)})]);
  await syncPublicityPreparedV2({cache,publicityId:id,current:p,next:saved[i],media,segmentacion,previousCities:segmentacion.map((/** @type {any} */ s)=>s.ciudad_id)});
 }
 const byId=new Map(saved.map((/** @type {any} */ p)=>[text(p.publicidad_id||p.id),p]));
 return {success:true,sin_cambios:false,cambios:saved.length,publicidades:own.map((/** @type {any} */ p)=>byId.get(text(p.publicidad_id||p.id))||p),cambios_activos:publicityUsageV101(state,cfg)};
}
async function publicityDeleteMonthlyV101(/** @type {any} */ {db,cache,advertiserId:aid,publicityId:id}){
 const version=await db.getVersioned('publicidades',id),p=version.doc;
 if(!p||text(p.anunciante_id)!==aid)throw httpError('La publicidad no pertenece al anunciante.',403);
 const {state,options}=await publicityStateV101(db,aid);
 const rejected=p.revision_definitiva===true||[p.estado_moderacion,p.revision_adulto,p.estado].some(v=>['RECHAZADO','RECHAZADA'].includes(String(v||'').toUpperCase()));
 if((state.activas.includes(id)||p.estado==='ACTIVA')&&!rejected)throw httpError('Pausá la publicidad antes de borrarla.',409);
 state.activas=state.activas.filter(activeId=>activeId!==id);
 const seg=await getPreparedRelationsV1({cache,type:'publicity-seg',id,current:p,load:()=>db.queryEqual('publicidad_segmentacion','publicidad_id',id,500)});
 const changes=[{collection:'publicidades',id,remove:true,before:p,options:{updateTime:version.updateTime}}];
 if(p.relaciones_version!==2||p.legacy_children)for(const [collection,key]of [['publicidad_media','media_id'],['publicidad_segmentacion','segmentacion_id']]){
  const rows=await db.queryEqual(collection,'publicidad_id',id,500);
  for(const row of rows)changes.push({collection,id:text(row[key]||row.id),remove:true,before:row,options:{updateTime:undefined}});
 }
 state.guardadas=state.guardadas.filter((/** @type {any} */ x)=>x!==id);
 await publicityCommitV101(db,cache,aid,state,options,changes);
 await syncPublicityPreparedV2({cache,publicityId:id,current:p,next:null,previousCities:seg.map((/** @type {any} */ s)=>s.ciudad_id)});
 return {success:true,deleted:true,publicidad_id:id};
}

const SESSION_RENEWALS_V87 = new WeakMap();
function gldClassificationV86(){
  /** @param {any} v */
  const text=v=>String(v??'').trim();
  /** @param {any} row */
  const ids=row=>[row?.nivel_id,row?.numero,row?.id].filter(v=>text(v)!=='').map(text);
  /** @param {any} v */
  const flag=v=>v===undefined||v===null||text(v)===''?null:v===true||v===1||['true','1','si','sí','x','activo','activa'].includes(text(v).toLowerCase());
  /** @param {any} row */
  const levelNumber=row=>{for(const v of [row?.numero,row?.nivel_id,row?.id])if(text(v)!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0)return Number(v);return null;};
  const findLevel=(rows,value)=>{const v=text(value);if(!v)return {};return (rows||[]).find(row=>text(row?.nivel_id)===v||text(row?.id)===v)||(rows||[]).find(row=>text(row?.numero)===v)||{};};
  /** @param {any} row */
  const name=row=>text(row?.titulo||row?.nombre||row?.label);
  /** @param {any} value @param {number} fallback */
  const limit=(value,fallback)=>value===null||value===undefined||text(value)===''?fallback:Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
  const rules=(row={},value)=>{const n=levelNumber(row)??levelNumber({id:value});return {
    descripcion_max:limit(row.descripcion_max,500),adicionales_max:limit(row.adicionales_max,150),
    tags_max:flag(row.tags_habilitados)===false?0:limit(row.tags_max,300),
    imagenes_max:flag(row.imagenes_habilitadas)===false?0:Math.min(5,limit(row.imagenes_max,n===3?0:n===1||n===2?3:5))
  };};
  return {text,ids,flag,levelNumber,name,findLevel,rules,active:row=>flag(row?.activo??row?.activa)!==false,levelLabel:row=>{const n=levelNumber(row),label=name(row);return (n===null?'Nivel sin número':'Nivel '+n)+(label?' · '+label:'');}};
}
const GLD_CLASSIFICATION_V86=gldClassificationV86();
// reconstruccion/worker/core/db.js
var tokenCache = { token: "", expiresAt: 0, pending: null };
function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}
function text(v) {
  return String(v ?? "").trim();
}
function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((x) => binary += String.fromCharCode(x));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function pemBuffer(pem) {
  const clean2 = String(pem || "").replace(/\\n/g, "\n").replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
  const bin = atob(clean2);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function newToken(env) {
  const project = text(env.FIREBASE_PROJECT_ID), email = text(env.FIREBASE_CLIENT_EMAIL), privateKey = text(env.FIREBASE_PRIVATE_KEY);
  if (!project || !email || !privateKey) throw new Error("Faltan credenciales Firebase.");
  const now = Math.floor(Date.now() / 1e3);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = head + "." + payload;
  const key3 = await crypto.subtle.importKey("pkcs8", pemBuffer(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key3, new TextEncoder().encode(unsigned));
  const jwt = unsigned + "." + b64url(new Uint8Array(sig));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("No se pudo obtener token Google.");
  tokenCache.token = j.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(60, Number(j.expires_in || 3600) - 120) * 1e3;
  return tokenCache.token;
}
async function token(env) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  if (tokenCache.pending) return tokenCache.pending;
  tokenCache.pending = newToken(env);
  try {
    return await tokenCache.pending;
  } finally {
    tokenCache.pending = null;
  }
}
function base(env) {
  const project = text(env.FIREBASE_PROJECT_ID);
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
}
function fromFs(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue && v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return fieldsFromFs(v.mapValue && v.mapValue.fields || {});
  return null;
}
function fieldsFromFs(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) o[k] = fromFs(v);
  return o;
}
function toFs(v) {
  if (v == null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") {
    const fields = {};
    for (const [k, x] of Object.entries(v)) if (x !== void 0) fields[k] = toFs(x);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
function docToJs(doc, id4 = "") {
  if (!doc) return null;
  return { id: id4 || String(doc.name || "").split("/").pop(), ...fieldsFromFs(doc.fields || {}) };
}
async function request(env, path, { method = "GET", body = null, allow404 = false } = {}) {
  const r = await fetch(base(env) + "/" + path, { method, headers: { Authorization: "Bearer " + await token(env), ...body !== null ? { "Content-Type": "application/json" } : {} }, ...body !== null ? { body: JSON.stringify(body) } : {} });
  if (allow404 && r.status === 404) return null;
  const raw = await r.text();
  let j = null;
  try {
    j = raw ? JSON.parse(raw) : null;
  } catch (_) {
  }
  if (!r.ok) {
    if(['PATCH','DELETE'].includes(method)&&[409,412].includes(r.status))throw httpError('Hubo otro cambio simultáneo. Volvé a abrir la ficha antes de guardar.',409);
    throw new Error(`Firestore ${method} ${path}: ${r.status} ${raw.slice(0, 250)}`);
  }
  return j;
}
function firestoreFieldName115(value){
 const key=String(value);
 return /^[A-Za-z_][A-Za-z_0-9]*$/.test(key)?key:'`'+key.replace(/\\/g,'\\\\').replace(/`/g,'\\`')+'`';
}
function createDb(env) {
  async function sourceDocument119(collection,id){
    if(!env.GLD_PUBLIC_CACHE||!RECOVERABLE119.has(collection))return request(env,`${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,{allow404:true});
    // batchGet costs one document read, just like get. Its server readTime also
    // proves an absent record without inventing a client-clock delete version.
    const name='projects/'+text(env.FIREBASE_PROJECT_ID)+'/databases/(default)/documents/'+collection+'/'+id;
    const response=await fetch(base(env)+':batchGet',{method:'POST',headers:{Authorization:'Bearer '+await token(env),'Content-Type':'application/json'},body:JSON.stringify({documents:[name]})});
    if(!response.ok)throw httpError('No se pudo consultar el registro. Reintentá.',503);
    const records=await response.json(),record=records.find(x=>x.found?.name===name||x.missing===name);
    if(!record)throw Error('Firestore batchGet missing response');
    const d=record.found||null;noteSource119(env,collection,id,docToJs(d,id),d?.updateTime||record.readTime);return d;
  }
  return {
    async commitPatches(/** @type {any[]} */ entries){
      if(!entries.length||entries.length>500)throw httpError('Demasiados cambios en una operación.',400);
      const name=(c,id)=>'projects/'+text(env.FIREBASE_PROJECT_ID)+'/databases/(default)/documents/'+c+'/'+id;
      const writes=entries.map(e=>{
        const pre=e.options?.updateTime?{updateTime:e.options.updateTime}:e.options?.mustNotExist?{exists:false}:e.options?.mustExist?{exists:true}:null;
        const write=e.remove?{delete:name(e.collection,e.id)}:{update:{name:name(e.collection,e.id),fields:Object.fromEntries(Object.entries(e.patch).filter(([,v])=>v!==undefined).map(([k,v])=>[k,toFs(v)]))},updateMask:{fieldPaths:Object.keys(e.patch).filter(k=>e.patch[k]!==undefined).map(firestoreFieldName115)}};
        if(pre)write.currentDocument=pre;
        return write;
      });
      const r=await fetch(base(env)+':commit',{method:'POST',headers:{Authorization:'Bearer '+await token(env),'Content-Type':'application/json'},body:JSON.stringify({writes})});
      if(!r.ok){if([400,409,412].includes(r.status))throw httpError('Hubo otro cambio simultáneo. Actualizá la lista y reintentá.',409);throw httpError('No se pudieron guardar los cambios. Reintentá.',503);}
      const committed119=await r.json();
      entries.forEach((e,i)=>noteSource119(env,e.collection,e.id,{...e.before,...e.patch},committed119.writeResults?.[i]?.updateTime||committed119.commitTime));
      return entries.map(e=>e.remove?null:{...e.before,...e.patch,id:e.id});
    },
    async get(collection, id4) {
      const d = await sourceDocument119(collection,id4);
      noteSource119(env,collection,id4,docToJs(d,id4),d?.updateTime);
      return docToJs(d, id4);
    },
    async getVersioned(collection, id4) {
      const d = await sourceDocument119(collection,id4);
      noteSource119(env,collection,id4,docToJs(d,id4),d?.updateTime);
      return {doc:docToJs(d,id4),updateTime:d?.updateTime};
    },
    async patch(collection, id4, patch, { mustExist = false, mustNotExist = false, fieldPaths = null, updateTime = null } = {}) {
      const clean2 = {};
      for (const [k, v] of Object.entries(patch || {})) if (v !== void 0) clean2[k] = v;
      const qs = new URLSearchParams();
      (fieldPaths||Object.keys(clean2).map(firestoreFieldName115)).forEach((k) => qs.append("updateMask.fieldPaths", k));
      if (updateTime) qs.set("currentDocument.updateTime", updateTime);
      else if (mustExist) qs.set("currentDocument.exists", "true");
      if (mustNotExist) qs.set("currentDocument.exists", "false");
      const fields = {};
      for (const [k, v] of Object.entries(clean2)) fields[k] = toFs(v);
      const d = await request(env, `${encodeURIComponent(collection)}/${encodeURIComponent(id4)}?${qs}`, { method: "PATCH", body: { fields } });
      noteSource119(env,collection,id4,docToJs(d,id4),d?.updateTime);
      return docToJs(d, id4);
    },
    async delete(collection, id4, { mustExist = false } = {}) {
      if(env.GLD_PUBLIC_CACHE){
        // Firestore commit supplies a server revision for the tombstone. A
        // missing document remains an idempotent deletion, as in the REST path.
        await this.commitPatches([{collection,id:id4,remove:true,options:{mustExist}}]);return true;
      }
      const qs = new URLSearchParams();
      if (mustExist) qs.set("currentDocument.exists", "true");
      const suffix = qs.toString() ? "?" + qs.toString() : "";
      await request(env, `${encodeURIComponent(collection)}/${encodeURIComponent(id4)}${suffix}`, { method: "DELETE" });
      return true;
    },
    /**
     * Sólo para mantenimiento explícito / seed de cachés.
     * No usar dentro de acciones interactivas normales.
     */
    async listPage102(/** @type {string} */ collection,pageToken='') {
      const qs=new URLSearchParams({pageSize:'500'});if(pageToken)qs.set('pageToken',pageToken);
      const page=await request(env,encodeURIComponent(collection)+'?'+qs)||{};
      return {rows:(page.documents||[]).map(d=>docToJs(d)),nextPageToken:String(page.nextPageToken||'')};
    },
    async listCollection(collection, pageSize = 1e3) {
      let pageToken = "";
      const out2 = [];
      do {
        const qs = new URLSearchParams({ pageSize: String(pageSize) });
        if (pageToken) qs.set("pageToken", pageToken);
        const j = await request(env, `${encodeURIComponent(collection)}?${qs}`) || {};
        for (const d of j.documents || []) {const row=docToJs(d);noteSource119(env,collection,row.id,row,d.updateTime);out2.push(row);}
        pageToken = String(j.nextPageToken || "");
      } while (pageToken);
      return out2;
    },
    async queryEqual(collection, field, value, limit = 1e3) {
      const project = text(env.FIREBASE_PROJECT_ID);
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents:runQuery`;
      const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + await token(env), "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: toFs(value) } }, limit: Number(limit) } }) });
      const rows = await r.json().catch(() => []);
      if (!r.ok) throw new Error(`Firestore query ${collection}.${field}: ${r.status}`);
      return (Array.isArray(rows) ? rows : []).filter((x) => x.document).map((x) => {const row=docToJs(x.document);noteSource119(env,collection,row.id,row,x.document.updateTime);return row;});
    }
  };
}

// reconstruccion/worker/core/cache.js
function createCache(env) {
  const kv = env.GLD_CACHE_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    throw new Error("Falta binding GLD_CACHE_KV.");
  }
  return {
    invalidatePendingEvents126:env.GLD_PUBLIC_CACHE?()=>pendingActor126(env,'pending-events-invalidate'):null,
    async get(key3) {
      const raw = await kv.get(key3);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    },
    async put(key3, value, options) {
      await kv.put(key3, JSON.stringify(value), options);
    },
    async del(key3) {
      if (typeof kv.delete === "function") await kv.delete(key3);
    }
  };
}

// reconstruccion/worker/core/http.js
function cors(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,Authorization,X-GLD-Adult-Token",
    "Access-Control-Expose-Headers":"X-GLD-Request-Id,X-GLD-Worker-Version,X-GLD-Read-Calls,X-GLD-Documents-Returned,X-GLD-Write-Calls,X-GLD-Delete-Calls,X-GLD-Source,X-GLD-Public-Blocked,X-GLD-Action,X-GLD-Operations,X-GLD-Cache-Checks,X-GLD-Session-Token,X-GLD-Session-Kind"
  };
}
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(), ...extraHeaders } });
}
function publicJson(data, status = 200) {
  return json(data, status, { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" });
}

// reconstruccion/worker/core/auth-admin.js
function text2(v) {
  return String(v ?? "").trim();
}
function b64(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((x) => binary += String.fromCharCode(x));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64decode(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(env, value) {
  const secret = text2(env.SERVER_SECRET);
  if (!secret) throw new Error("Falta SERVER_SECRET");
  const key3 = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key3, new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}
async function verifyAdmin(env, request2) {
  const auth = text2(request2.headers.get("Authorization"));
  if (!auth.toLowerCase().startsWith("bearer ")) return { ok: false, message: "Sesión de administrador requerida" };
  const parts = auth.slice(7).trim().split(".");
  if (parts.length !== 2) return { ok: false, message: "Sesión inválida" };
  const [body, sig] = parts;
  if (sig !== await hmac(env, body)) return { ok: false, message: "Sesión inválida" };
  let p = null;
  try {
    p = JSON.parse(b64decode(body));
  } catch (_) {
  }
  if (!p || !p.sid || (p.persistent !== true && (!p.exp || Date.now() > Number(p.exp)))) return { ok: false, message: "Sesión inválida o vencida" };
  const rol = text2(p.rol).toUpperCase();
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(rol)) return { ok: false, message: "Rol administrativo no habilitado" };
  const policy=await createCache(env).get("admin:access:v72:"+text2(p.sid));
  if(policy && (!policy.activo || !p.access_revision || p.access_revision!==policy.revision))return {ok:false,message:"Los permisos cambiaron. Volvé a iniciar sesión."};
  const state=await subscriberSessionState(env,p.sid);
  if(state.deleted || (p.sv !== undefined && Number(p.sv)!==Number(state.version||0))) return {ok:false,message:"Sesión cerrada. Volvé a ingresar."};
  if(p.persistent !== true) SESSION_RENEWALS_V87.set(request2,{kind:"admin",token:await issue2(env,{...p,sv:Number(state.version||0)})});
  return { ok: true, sid: text2(p.sid), rol, access_revision:p.access_revision||"", ciudades: adminCityIdsV71(p.ciudades), permisos:p.permisos||{} };
}

// reconstruccion/worker/modules/territory.js
var PUBLIC_KEY = "territorio:public:v1";
var ADMIN_KEY = "territorio:admin:v1";
var C = { paises: "paises", provincias: "provincias", ciudades: "ciudades" };
var text3 = (v) => String(v ?? "").trim();
function bool(v) {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "activo", "activa"].includes(text3(v).toLowerCase());
}
function active(row) {
  if (row.activa === void 0 && row.activo === void 0) return true;
  return bool(row.activa ?? row.activo);
}
function packet(v) {
  const x = v && typeof v === "object" ? v : {};
  return { version: 1, updated_at: text3(x.updated_at), paises: Array.isArray(x.paises) ? x.paises : [], provincias: Array.isArray(x.provincias) ? x.provincias : [], ciudades: Array.isArray(x.ciudades) ? x.ciudades : [] };
}
function upsert(rows, idField, item) {
  const id4 = text3(item[idField] || item.id);
  const out2 = [...rows || []];
  const i = out2.findIndex((x) => text3(x[idField] || x.id) === id4);
  if (i >= 0) out2[i] = item;
  else out2.push(item);
  return out2;
}
function remove(rows, idField, id4) {
  return (rows || []).filter((x) => text3(x[idField] || x.id) !== text3(id4));
}
function sortCities(rows) {
  return [...rows || []].sort((a, b) => text3(a.ciudad_visible || a.nombre || a.ciudad).localeCompare(text3(b.ciudad_visible || b.nombre || b.ciudad), "es", { sensitivity: "base" }));
}
function publicCity(row, admin) {
  const prov = (admin.provincias || []).find((x) => text3(x.provincia_id || x.id) === text3(row.provincia_id)) || {};
  const pais = (admin.paises || []).find((x) => text3(x.pais_id || x.id) === text3(row.pais_id || prov.pais_id)) || {};
  return {
    ciudad_id: text3(row.ciudad_id || row.id),
    ciudad_visible: text3(row.ciudad_visible || row.nombre || row.ciudad),
    provincia_id: text3(row.provincia_id),
    provincia_visible: text3(row.provincia_visible || row.provincia || prov.provincia_visible || prov.nombre || prov.provincia),
    pais_id: text3(row.pais_id || prov.pais_id),
    pais_visible: text3(row.pais_visible || row.pais || pais.pais_visible || pais.nombre || pais.pais),
    pais_codigo: text3(row.pais_codigo || row.codigo_pais || pais.pais_codigo || pais.codigo_pais || pais.codigo),
    activa: active(row)
  };
}
async function authOr401(env, request2) {
  const a = await verifyAdmin(env, request2);
  return a.ok ? a : json({ success: false, message: a.message }, 401);
}
async function territoryPublic({ cache }) {
  const p = await cache.get(PUBLIC_KEY);
  if (!p) return json({ success: false, message: "Catálogo territorial no inicializado" }, 503);
  return publicJson({ success: true, ...packet(p) });
}
async function territoryAdmin({ env, request: request2, cache }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  const p = await cache.get(ADMIN_KEY);
  if (!p) return json({ success: false, message: "Catálogo territorial no inicializado" }, 503);
  return json({ success: true, ...packet(p) });
}
async function saveCountry({ env, request: request2, db, cache, idFromPath = "" }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  let body = {};
  try {
    body = await request2.json();
  } catch (_) {
  }
  const item = body.item && typeof body.item === "object" ? body.item : body;
  const id4 = text3(idFromPath || item.pais_id || item.id), nombre = text3(item.pais_visible || item.nombre || item.pais);
  if (!id4 || !nombre) return json({ success: false, message: "Faltan pais_id o nombre" }, 400);
  const saved = await db.patch(C.paises, id4, { ...item, pais_id: id4, nombre, pais_visible: nombre, activo: item.activo !== void 0 ? bool(item.activo) : true, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() });
  const admin = packet(await cache.get(ADMIN_KEY)), pub = packet(await cache.get(PUBLIC_KEY)), now = (/* @__PURE__ */ new Date()).toISOString();
  const nextAdmin = { ...admin, updated_at: now, paises: upsert(admin.paises, "pais_id", saved) };
  let paises = remove(pub.paises, "pais_id", id4);
  if (active(saved)) paises = upsert(paises, "pais_id", saved);
  await Promise.all([cache.put(ADMIN_KEY, nextAdmin), cache.put(PUBLIC_KEY, { ...pub, updated_at: now, paises })]);
  return json({ success: true, pais: saved });
}
async function saveProvince({ env, request: request2, db, cache, idFromPath = "" }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  let body = {};
  try {
    body = await request2.json();
  } catch (_) {
  }
  const item = body.item && typeof body.item === "object" ? body.item : body;
  const id4 = text3(idFromPath || item.provincia_id || item.id), nombre = text3(item.provincia_visible || item.nombre || item.provincia), pais_id = text3(item.pais_id);
  const admin = packet(await cache.get(ADMIN_KEY));
  if (!id4 || !nombre || !pais_id) return json({ success: false, message: "Faltan provincia_id, nombre o pais_id" }, 400);
  if (!admin.paises.some((x) => text3(x.pais_id || x.id) === pais_id)) return json({ success: false, message: "pais_id inexistente" }, 400);
  const saved = await db.patch(C.provincias, id4, { ...item, provincia_id: id4, nombre, provincia_visible: nombre, pais_id, activo: item.activo !== void 0 ? bool(item.activo) : true, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() });
  const pub = packet(await cache.get(PUBLIC_KEY)), now = (/* @__PURE__ */ new Date()).toISOString();
  const nextAdmin = { ...admin, updated_at: now, provincias: upsert(admin.provincias, "provincia_id", saved) };
  let provincias = remove(pub.provincias, "provincia_id", id4);
  if (active(saved)) provincias = upsert(provincias, "provincia_id", saved);
  await Promise.all([cache.put(ADMIN_KEY, nextAdmin), cache.put(PUBLIC_KEY, { ...pub, updated_at: now, provincias })]);
  return json({ success: true, provincia: saved });
}
async function saveCity({ env, request: request2, db, cache, idFromPath = "" }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  let body = {};
  try {
    body = await request2.json();
  } catch (_) {
  }
  const item = body.item && typeof body.item === "object" ? body.item : body;
  const admin = packet(await cache.get(ADMIN_KEY));
  const id4 = text3(idFromPath || item.ciudad_id || item.id), nombre = text3(item.ciudad_visible || item.nombre || item.ciudad), pais_id = text3(item.pais_id), provincia_id = text3(item.provincia_id);
  if (!id4 || !nombre || !pais_id || !provincia_id) return json({ success: false, message: "Faltan datos obligatorios de ciudad" }, 400);
  const prov = admin.provincias.find((x) => text3(x.provincia_id || x.id) === provincia_id);
  if (!prov || text3(prov.pais_id) !== pais_id) return json({ success: false, message: "Provincia/país inválidos" }, 400);
  const saved = await db.patch(C.ciudades, id4, { ...item, ciudad_id: id4, ciudad_visible: nombre, pais_id, provincia_id, activa: item.activa !== void 0 ? bool(item.activa) : true, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() });
  const pub = packet(await cache.get(PUBLIC_KEY)), now = (/* @__PURE__ */ new Date()).toISOString();
  const nextAdmin = { ...admin, updated_at: now, ciudades: sortCities(upsert(admin.ciudades, "ciudad_id", saved)) };
  let ciudades = remove(pub.ciudades, "ciudad_id", id4);
  if (active(saved)) ciudades = upsert(ciudades, "ciudad_id", publicCity(saved, nextAdmin));
  await Promise.all([cache.put(ADMIN_KEY, nextAdmin), cache.put(PUBLIC_KEY, { ...pub, updated_at: now, ciudades: sortCities(ciudades) })]);
  return json({ success: true, ciudad: saved });
}
async function rebuildTerritory({ env, request: request2, db, cache }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(a.rol)) return json({ success: false, message: "Permiso insuficiente" }, 403);
  const [paises, provincias, ciudades] = await Promise.all([db.listCollection(C.paises), db.listCollection(C.provincias), db.listCollection(C.ciudades)]);
  const now = (/* @__PURE__ */ new Date()).toISOString(), admin = { version: 1, updated_at: now, paises, provincias, ciudades: sortCities(ciudades) };
  const pub = { version: 1, updated_at: now, paises: paises.filter(active), provincias: provincias.filter(active), ciudades: sortCities(ciudades.filter(active).map((x) => publicCity(x, admin))) };
  await Promise.all([cache.put(ADMIN_KEY, admin), cache.put(PUBLIC_KEY, pub)]);
  return json({ success: true, rebuilt: true, counts: { paises: paises.length, provincias: provincias.length, ciudades: ciudades.length } });
}

// reconstruccion/worker/core/guide-read-model.js
var text4 = (v) => String(v ?? "").trim();
var bool2 = (v) => {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "aprobado", "activo", "activa"].includes(text4(v).toLowerCase());
};
var ids = (v) => Array.isArray(v) ? v.map(text4).filter(Boolean) : text4(v).split(/[;,|\n]/).map(text4).filter(Boolean);
var guideCityKey = (cityId) => "guide:city:v1:" + text4(cityId);
function mapBy(rows, field) {
  const m = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const id4 = text4(r && r[field] || r && r.id);
    if (id4) m.set(id4, r);
  }
  return m;
}
function relObjects(values, map, idField) {
  return ids(values).map((id4) => {
    const x = map.get(id4) || {};
    return { [idField]: id4, nombre: text4(x.nombre), insignia: text4(x.insignia) };
  });
}
function buildGuideCard({ advertiser, admin, sedes, catalogs, territory, cityId }) {
  if (!advertiser) return null;
  if (admin && admin.aprobado !== void 0 && !bool2(admin.aprobado)) return null;
  const city = text4(cityId);
  const citySedes = (sedes || []).filter((s) => text4(s.ciudad_id) === city);
  if (!citySedes.length) return null;
  const segMap = mapBy(catalogs.segmentos, "segmento_id");
  const catMap = mapBy(catalogs.categorias, "categoria_id");
  const actMap = mapBy(catalogs.actividades_clave, "actividad_id");
  const actionMap = mapBy(catalogs.acciones, "accion_id");
  const nodeMap = mapBy(catalogs.nodos, "nodo_id");
  const segmentoId = text4(advertiser.segmento_id);
  const segmento = segMap.get(segmentoId) || {};
  const categoriaIds = ids(advertiser.categoria_ids || advertiser.categoria_id);
  const categorias = categoriaIds.map((id4) => catMap.get(id4)).filter(Boolean).map((x) => text4(x.nombre)).filter(Boolean);
  const cityMeta = (territory.ciudades || []).find((x) => text4(x.ciudad_id || x.id) === city) || {};
  const sedesPublicas = citySedes.map((s) => ({
    sede_id: text4(s.sede_id || s.id),
    nombre_sede: text4(s.nombre_sede),
    web:text4(s.web),
    direccion: text4(s.direccion),
    ciudad_id: city,
    ciudad: text4(s.ciudad || cityMeta.ciudad_visible),
    provincia_id: text4(s.provincia_id || cityMeta.provincia_id),
    provincia: text4(s.provincia || cityMeta.provincia_visible),
    pais_id: text4(s.pais_id || cityMeta.pais_id),
    pais: text4(s.pais || cityMeta.pais_visible),
    codigo_postal: text4(s.codigo_postal),
    lat: s.lat ?? "",
    lng: s.lng ?? "",
    maps: text4(s.maps),
    telefono: text4(s.telefono),
    telefono2: text4(s.telefono2),
    telefono3: text4(s.telefono3),
    telefono4: text4(s.telefono4),
    telefono5: text4(s.telefono5),
    whatsapp: text4(s.whatsapp),
    whatsapp2: text4(s.whatsapp2),
    whatsapp3: text4(s.whatsapp3),
    whatsapp4: text4(s.whatsapp4),
    whatsapp5: text4(s.whatsapp5),
    mail: text4(s.mail),
    mail2: text4(s.mail2),
    mail3: text4(s.mail3),
    instagram: text4(s.instagram),
    facebook: text4(s.facebook),
    youtube: text4(s.youtube),
    tiktok: text4(s.tiktok),
    x: text4(s.x),
    linkedin: text4(s.linkedin),
    estado: text4(s.estado),
    actividades: relObjects(s.actividad_ids, actMap, "actividad_id"),
    acciones: relObjects(s.accion_ids, actionMap, "accion_id"),
    nodos: relObjects(s.nodo_ids, nodeMap, "nodo_id"),
    img1: text4(s.img1),
    img2: text4(s.img2),
    img3: text4(s.img3),
    img4: text4(s.img4),
    img5: text4(s.img5),
    img6: text4(s.img6),
    img7: text4(s.img7),
    img8: text4(s.img8),
    img9: text4(s.img9),
    img10: text4(s.img10)
  }));
  return {
    id: text4(advertiser.id || advertiser.anunciante_id),
    nombre: text4(advertiser.nombre),
    redes_web_comunes: advertiser.redes_web_comunes||null,
    ...Object.fromEntries(["pet","eco","gayfriendly"].filter(k=>Object.hasOwn(advertiser,k)).map(k=>[k,advertiser[k]])),
    contenido_adulto:adultFlag(advertiser.contenido_adulto),revision_adulto:advertiser.revision_adulto||"NO_APLICA",estado_moderacion:advertiser.estado_moderacion||"PUBLICADO",
    nivel: text4(admin && admin.nivel),
    subnivel: text4(admin && admin.subnivel),
    verificado: bool2(admin && admin.verificado),
    gold: bool2(admin && admin.gold),
    segmento_id: segmentoId,
    segmento: text4(segmento.nombre),
    categoria_ids: categoriaIds,
    categorias,
    actividad: text4(advertiser.actividad),
    descripcion: text4(advertiser.descripcion),
    tags: text4(advertiser.tags),
    adicionales: text4(advertiser.adicionales),
    logo: text4(advertiser.logo),
    img1: text4(advertiser.img1),
    img2: text4(advertiser.img2),
    img3: text4(advertiser.img3),
    img4: text4(advertiser.img4),
    img5: text4(advertiser.img5),
    img6: text4(advertiser.img6),
    img7: text4(advertiser.img7),
    img8: text4(advertiser.img8),
    img9: text4(advertiser.img9),
    img10: text4(advertiser.img10),
    link: text4(advertiser.link),
    ciudad_id: city,
    ciudad: text4(cityMeta.ciudad_visible),
    provincia_id: text4(cityMeta.provincia_id),
    provincia: text4(cityMeta.provincia_visible),
    pais_id: text4(cityMeta.pais_id),
    pais: text4(cityMeta.pais_visible),
    sedes: sedesPublicas
  };
}
function sortCards(rows) {
  return [...rows].sort((a, b) => text4(a.nombre).localeCompare(text4(b.nombre), "es", { sensitivity: "base" }));
}
async function syncGuideAdvertiser({ db, cache, advertiserId, affectedCityIds = [] }) {
  const aid = text4(advertiserId);
  const [advertiser, admin, sedes, catalogs, territory] = await Promise.all([
    db.get("anunciantes", aid),
    db.get("anunciantes_administracion", aid),
    db.queryEqual("anunciantes_sedes", "anunciante_id", aid),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const currentCities = [...new Set((sedes || []).map((s) => text4(s.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(affectedCityIds || []).map(text4), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = guideCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    const rows = (packet2.anunciantes || []).filter((x) => text4(x.id) !== aid);
    const card = buildGuideCard({
      advertiser,
      admin,
      sedes,
      catalogs: catalogs || {},
      territory: territory || {},
      cityId
    });
    if (card) rows.push(card);
    await cache.put(key3, {
      version: 1,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      anunciantes: sortCards(rows)
    });
  }
  return { success: true, advertiser_id: aid, ciudades_actualizadas: targets };
}

const REDES_WEB_FIELDS=['instagram','facebook','youtube','tiktok','linkedin','x','web'];
function redesWebComunes(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Configuración de redes y web inválida.');
 return {habilitado:value.habilitado===true,...Object.fromEntries(REDES_WEB_FIELDS.map(k=>[k,String(value[k]??'').trim()]))};
}
function sedeConRedesComunes(sede,common){
 if(common?.habilitado!==true)return sede;
 return {...sede,...Object.fromEntries(REDES_WEB_FIELDS.map(k=>[k,String(common[k]??'').trim()]))};
}
function tarjetaConRedesComunes(card){
 const cfg=card.redes_web_comunes;
 return {...card,sedes:(card.sedes||[]).map(s=>sedeConRedesComunes(s,cfg))};
}

async function getGuideCity({ cache, cityId }) {
  const city = text4(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(guideCityKey(city));
  if (!packet2) return { success: true, ciudad_id: city, anunciantes: [], cold: true };
  return { success: true, ...packet2, anunciantes:(packet2.anunciantes||[]).map(tarjetaConRedesComunes) };
}
async function rebuildGuideAll({ db, cache }) {
  const [advertisers, admins, sedes, catalogs, territory] = await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const adminMap = mapBy(admins, "id");
  const sedesByAdv = /* @__PURE__ */ new Map();
  for (const s of sedes) {
    const aid = text4(s.anunciante_id);
    if (!sedesByAdv.has(aid)) sedesByAdv.set(aid, []);
    sedesByAdv.get(aid).push(s);
  }
  const byCity = /* @__PURE__ */ new Map();
  for (const adv of advertisers) {
    const aid = text4(adv.id || adv.anunciante_id);
    const advSedes = sedesByAdv.get(aid) || [];
    const cityIds = [...new Set(advSedes.map((s) => text4(s.ciudad_id)).filter(Boolean))];
    for (const cityId of cityIds) {
      const card = buildGuideCard({
        advertiser: adv,
        admin: adminMap.get(aid) || {},
        sedes: advSedes,
        catalogs: catalogs || {},
        territory: territory || {},
        cityId
      });
      if (!card) continue;
      if (!byCity.has(cityId)) byCity.set(cityId, []);
      byCity.get(cityId).push(card);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(
    ([cityId, cards]) => cache.put(guideCityKey(cityId), {
      version: 1,
      ciudad_id: cityId,
      updated_at: now,
      anunciantes: sortCards(cards)
    })
  ));
  return { success: true, ciudades: byCity.size, anunciantes: advertisers.length, updated_at: now };
}

// reconstruccion/worker/modules/guide.js
async function guidePublic({ url, cache }) {
  const cityId = String(url.searchParams.get("ciudad_id") || url.searchParams.get("ciudadId") || "").trim();
  const out2 = await getGuideCity({ cache, cityId });
  if (out2.status) return json(out2, out2.status);
  const rows = Array.isArray(out2.anunciantes) ? out2.anunciantes : [];
  if(url.searchParams.get('compact')==='1'){const {anunciantes,...meta}=out2;return publicJson({...meta,results:rows});}
  return publicJson({ ...out2, results: rows, data: rows });
}

// reconstruccion/worker/core/promos-read-model.js
var text5 = (v) => String(v ?? "").trim();
var bool3 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text5(v).toLowerCase());
var promoCityKey = (cityId) => "promos:city:v1:" + text5(cityId);
function isPaused(p) {
  return bool3(p && p.pausado);
}
function visible(p) {
  if (isPaused(p) || promoPendingV91(p) || ['RECHAZADA','RECHAZADO'].includes(String(p?.estado_moderacion||'').toUpperCase()) || (adultFlag(p?.contenido_adulto)&&p?.revision_adulto!=='APROBADO')) return false;
  const estado = text5(p && p.estado).toUpperCase();
  return !estado || !["INACTIVA", "INACTIVO", "BORRADOR", "RECHAZADA", "RECHAZADO"].includes(estado);
}
function publicPromo(p) {
  return {
    contenido_adulto: adultFlag(p.contenido_adulto),
    revision_adulto: text5(p.revision_adulto),
    estado_moderacion: text5(p.estado_moderacion),
    aprobado: visible(p),
    promo_id: text5(p.promo_id || p.id),
    anunciante_id: text5(p.anunciante_id || p.id_comercio),
    promo: text5(p.promo),
    categoria: text5(p.categoria),
    categoria_id: text5(p.categoria_id),
    logo_categoria: text5(p.logo_categoria),
    sede_id: text5(p.sede_id),
    ciudad_id: text5(p.ciudad_id),
    img: text5(p.img),
    desde: text5(p.desde),
    hasta: text5(p.hasta),
    otros: text5(p.otros),
    direccion: text5(p.direccion),
    maps: text5(p.maps),
    telefono: text5(p.telefono),
    whatsapp: text5(p.whatsapp),
    instagram: text5(p.instagram),
    facebook: text5(p.facebook),
    youtube: text5(p.youtube),
    tiktok: text5(p.tiktok),
    linkedin: text5(p.linkedin),
    x: text5(p.x)
  };
}
function sort(rows) {
  return [...rows].sort((a, b) => text5(a.promo).localeCompare(text5(b.promo), "es", { sensitivity: "base" }));
}
async function syncPromo({ cache, current = null, next = null }) {
  const id4 = text5(next && next.promo_id || current && current.promo_id || next && next.id || current && current.id);
  const cities = [...new Set([text5(current && current.ciudad_id), text5(next && next.ciudad_id)].filter(Boolean))];
  for (const cityId of cities) {
    const key3 = promoCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", promos: [] };
    let rows = (packet2.promos || []).filter((x) => text5(x.promo_id) !== id4);
    if (next && text5(next.ciudad_id) === cityId && visible(next)) rows.push(publicPromo(next));
    await cache.put(key3, { version: 1, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), promos: sort(rows) });
  }
  await syncAdminPromoV91(cache,current,next);
  return { success: true, ciudades_actualizadas: cities };
}
async function getPromosCity({ cache, cityId }) {
  const city = text5(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(promoCityKey(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, promos: [], cold: true };
}
async function rebuildPromosAll({ db, cache }) {
  const all = await db.listCollection("promos");
  const byCity = /* @__PURE__ */ new Map();
  for (const p of all) {
    if (!visible(p)) continue;
    const city = text5(p.ciudad_id);
    if (!city) continue;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(publicPromo(p));
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, promos]) => cache.put(promoCityKey(city), { version: 1, ciudad_id: city, updated_at: now, promos: sort(promos) })));
  return { success: true, ciudades: byCity.size, promos: all.length, updated_at: now };
}

// reconstruccion/worker/core/prepared-relations-v1.js
var text6 = (v) => String(v ?? "").trim();
var key = (type, id4) => "relations:prepared:v1:" + type + ":" + text6(id4);
var revision = (row) => text6(row?.actualizado || row?.actualizado_en || row?.creado);
async function getPreparedRelationsV1({ cache, type, id: id4, current, load }) {
  if(type==="event" && Number(current?.programacion_version)===2 && Array.isArray(current?.programacion))return current.programacion;
  if(type==="activity" && Number(current?.horarios_version)===2 && Array.isArray(current?.horarios))return current.horarios;
  if(Number(current?.relaciones_version)===2&&type==='publicity-media')return current.media||[];
  if(Number(current?.relaciones_version)===2&&type==='publicity-seg')return current.segmentacion||[];
  const packet2 = await cache.get(key(type, id4));
  if (packet2 && packet2.revision === revision(current) && packet2.data) return packet2.data;
  return load();
}
async function putPreparedRelationsV1({ cache, type, id: id4, next, data }) {
  if(type==='event'&&Number(next?.programacion_version)===2&&Array.isArray(next.programacion))return;
  if(type==='activity'&&Number(next?.horarios_version)===2&&Array.isArray(next.horarios))return;
  if(['publicity-media','publicity-seg'].includes(type)&&Number(next?.relaciones_version)===2)return;
  if(!next){if(await cache.get(key(type,id4)))await cache.del(key(type,id4));return;}
  await cache.put(key(type,id4),{revision:revision(next),data});
}

// reconstruccion/worker/core/events-read-model-v2.js
var text7 = (v) => String(v ?? "").trim();
var bool4 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text7(v).toLowerCase());
var eventsCityKey = (cityId) => "events:city:v2:" + text7(cityId);
function published(e) {
  if(e?.eliminado===true)return false;
  if (bool4(e && e.pausado)) return false;
  const estado = text7(e && e.estado).toUpperCase();
  const mod = text7(e && e.estado_moderacion).toUpperCase();
  if (["RECHAZADA", "RECHAZADO", "BORRADOR", "INACTIVA", "INACTIVO"].includes(estado)) return false;
  return ["APROBADO", "APROBADA", "PUBLICADO", "PUBLICADA"].includes(mod);
}
function cleanEvent(e, programacion = []) {
  const out2 = { ...e, programacion: [...programacion].sort(
    (a, b) => Number(a.orden || 0) - Number(b.orden || 0) || text7(a.fecha).localeCompare(text7(b.fecha)) || text7(a.hora_desde).localeCompare(text7(b.hora_desde))
  ) };
  if(text7(out2.nivel).toUpperCase()==='FREE')removeFreeEventLinks(out2);
  delete out2.__id;
  delete out2.moderado_por;
  delete out2.motivo_revision;
  return out2;
}
function sort2(rows) {
  return [...rows].sort((a, b) => {
    const da = text7(a.fecha_desde || a.fecha || a.desde), db = text7(b.fecha_desde || b.fecha || b.desde);
    return da.localeCompare(db) || text7(a.nombre_evento || a.nombre).localeCompare(text7(b.nombre_evento || b.nombre), "es", { sensitivity: "base" });
  });
}
var coverageKey = (id4) => "events:coverage:v1:" + text7(id4);
function eventCities(event, programacion = []) {
  if (!event) return [];
  if (programacion.length) return [...new Set(programacion.filter((p) => p.activo !== false).map((p) => text7(p.ciudad_id || event.ciudad_id)).filter(Boolean))];
  return [text7(event.ciudad_id)].filter(Boolean);
}
function cityEvent(event, programacion, city) {
  const local = programacion.filter((p) => p.activo !== false && text7(p.ciudad_id || event.ciudad_id) === city);
  const dates = local.map((p) => text7(p.fecha)).filter(Boolean).sort();
  return cleanEvent({
    ...event,
    ciudad_origen_id: text7(event.ciudad_id),
    ciudad_id: city,
    ...dates.length ? { fecha_desde: dates[0], fecha_hasta: dates.at(-1) } : {}
  }, local);
}
async function syncEventV2({ db, cache, current = null, next = null, previousProgramacion = [], programacion: provided = void 0 }) {
  const id4 = text7(next?.evento_id || current?.evento_id || next?.id || current?.id);
  const previous = await cache.get(coverageKey(id4));
  const programacion = provided ?? (next ? await getPreparedRelationsV1({
    cache,
    type: "event",
    id: id4,
    current: current || next,
    load: () => db.queryEqual("evento_programacion", "evento_id", id4, 500)
  }) : []);
  const nextCities = eventCities(next, programacion);
  const cities = [.../* @__PURE__ */ new Set([...previous?.ciudades || [], ...eventCities(current, previousProgramacion), ...nextCities])];
  for (const cityId of cities) {
    const key3 = eventsCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", events: [] };
    const rows = (packet2.events || []).filter((x) => text7(x.evento_id || x.id) !== id4);
    if (next && nextCities.includes(cityId) && published(next)) rows.push(cityEvent(next, programacion, cityId));
    await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), events: sort2(rows) });
  }
  await cache.put(coverageKey(id4), { ciudades: nextCities });
  await putPreparedRelationsV1({ cache, type: "event", id: id4, next, data: programacion });
  return { success: true, ciudades_actualizadas: cities };
}
async function getEventsCityV2({ cache, cityId }) {
  const city=text7(cityId);
  if(!city)return {success:false,message:'ciudad_id obligatorio',status:400};
  const [packet,virtual]=await Promise.all([cache.get(eventsCityKey(city)),city==='VIRTUAL'?Promise.resolve(null):cache.get(eventsCityKey('VIRTUAL'))]);
  const byId=new Map();
  for(const row of [...(packet?.events||packet?.eventos||[]),...(virtual?.events||virtual?.eventos||[])])byId.set(text7(row.evento_id||row.id),row);
  return {success:true,...packet,ciudad_id:city,events:sort2([...byId.values()]),cold:!packet&&!virtual};
}
async function rebuildEventsAllV2({ db, cache }) {
  const [events, programas] = await Promise.all([
    db.listCollection("eventos"),
    db.listCollection("evento_programacion")
  ]);
  const byEvent = /* @__PURE__ */ new Map();
  for (const p of programas) {
    const id4 = text7(p.evento_id);
    if (!id4) continue;
    if (!byEvent.has(id4)) byEvent.set(id4, []);
    byEvent.get(id4).push(p);
  }
  const byCity = /* @__PURE__ */ new Map();
  for (const e of events) {
    const id4 = text7(e.evento_id || e.id), programacion = Number(e.programacion_version)===2&&Array.isArray(e.programacion)?e.programacion:byEvent.get(id4)||[];
    const cities = eventCities(e, programacion);
    const previous = await cache.get(coverageKey(id4));
    for (const city of previous?.ciudades || []) if (!byCity.has(city)) byCity.set(city, []);
    await cache.put(coverageKey(id4), { ciudades: cities });
    await putPreparedRelationsV1({ cache, type: "event", id: id4, next: e, data: programacion });
    if (!published(e)) continue;
    for (const city of cities) {
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push(cityEvent(e, programacion, city));
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, rows]) => cache.put(eventsCityKey(city), {
    version: 2,
    ciudad_id: city,
    updated_at: now,
    events: sort2(rows)
  })));
  return { success: true, ciudades: byCity.size, eventos: events.length, updated_at: now };
}

// reconstruccion/worker/core/activities-read-model.js
var text8 = (v) => String(v ?? "").trim();
var bool5 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text8(v).toLowerCase());
var activityCityKey = (cityId) => "activities:city:v1:" + text8(cityId);
function isPublic(a) {
  if (!a || !bool5(a.activo) || !bool5(a.aprobado)) return false;
  const estado = text8(a.estado).toUpperCase();
  if (["PAUSADA", "PAUSADO", "INACTIVA", "INACTIVO", "BORRADOR", "ELIMINADA", "ELIMINADO"].includes(estado)) return false;
  const now = /* @__PURE__ */ new Date();
  const hoy = new Date(now.getTime() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
  if (text8(a.vigente_desde) && text8(a.vigente_desde) > hoy) return false;
  if (text8(a.vigente_hasta) && text8(a.vigente_hasta) < hoy) return false;
  return true;
}
function sort3(rows) {
  return [...rows].sort((a, b) => text8(a.nombre).localeCompare(text8(b.nombre), "es", { sensitivity: "base" }));
}
async function syncActivity({ db, cache, activityId, previousCities = [] }) {
  const id4 = text8(activityId);
  const activity = await db.get("actividades", id4);
  const horarios = activity ? await getPreparedRelationsV1({cache,type:"activity",id:id4,current:activity,load:()=>db.queryEqual("actividad_horarios","actividad_id",id4)}) : [];
  const currentCities = [...new Set(horarios.map((h) => text8(h.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text8), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = activityCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", actividades: [] };
    let rows = (packet2.actividades || []).filter((x) => text8(x.actividad_id || x.id) !== id4);
    if (activity && isPublic(activity)) {
      const hs = horarios.filter((h) => text8(h.ciudad_id) === cityId && (h.activo === void 0 || bool5(h.activo)));
      if (hs.length) rows.push({ ...activity, horarios: hs });
    }
    await cache.put(key3, { version: 1, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), actividades: sort3(rows) });
  }
  return { success: true, ciudades_actualizadas: targets };
}
async function getActivitiesCity({ cache, cityId }) {
  const city = text8(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(activityCityKey(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, actividades: [], cold: true };
}

// reconstruccion/worker/core/publicity-read-model.js
var text9 = (v) => String(v ?? "").trim();
var publicityCityKey = (cityId) => "publicity:city:v1:" + text9(cityId);
function isActive(p) {
  return text9(p && p.estado).toUpperCase() === "ACTIVA";
}
function sort4(rows) {
  return [...rows].sort((a, b) => text9(a.titulo || a.nombre_interno).localeCompare(text9(b.titulo || b.nombre_interno), "es", { sensitivity: "base" }));
}
async function syncPublicity({ db, cache, publicityId, previousCities = [] }) {
  const id4 = text9(publicityId);
  const doc = await db.get("publicidades", id4);
  const seg = doc ? await db.queryEqual("publicidad_segmentacion", "publicidad_id", id4) : [];
  const currentCities = [...new Set(seg.map((x) => text9(x.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text9), ...currentCities].filter(Boolean))];
  let media = [];
  if (doc) media = await db.queryEqual("publicidad_media", "publicidad_id", id4);
  for (const cityId of targets) {
    const key3 = publicityCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", publicidades: [] };
    let rows = (packet2.publicidades || []).filter((x) => text9(x.publicidad_id || x.id) !== id4);
    if (doc && isActive(doc) && currentCities.includes(cityId)) {
      rows.push({ ...doc, media, segmentacion: seg.filter((x) => text9(x.ciudad_id) === cityId) });
    }
    await cache.put(key3, { version: 1, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), publicidades: sort4(rows) });
  }
  return { success: true, ciudades_actualizadas: targets };
}
async function getPublicityCity({ cache, cityId }) {
  const city = text9(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(publicityCityKey(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, publicidades: [], cold: true };
}

// reconstruccion/worker/core/efemerides-read-model.js
var text10 = (v) => String(v ?? "").trim();
var bool6 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text10(v).toLowerCase());
var efemCityKey = (cityId) => "efemerides:city:v1:" + text10(cityId);
function matchesCity(e, city, territory) {
  const tipo = text10(e.tipo).toUpperCase();
  if (tipo === "GENERAL") return true;
  if (tipo === "LOCAL") return text10(e.ciudad_id) === city;
  if (tipo === "PROVINCIAL") {
    const c = (territory.ciudades || []).find((x) => text10(x.ciudad_id || x.id) === city) || {};
    return text10(e.provincia_id) === text10(c.provincia_id);
  }
  return false;
}
async function syncEfemeride({ db, cache, efemerideId, previous = null }) {
  const id4 = text10(efemerideId), next = await db.get("efemerides_bis", id4), territory = await cache.get("territorio:public:v1") || {};
  const targets = /* @__PURE__ */ new Set();
  for (const e of [previous, next].filter(Boolean)) {
    const tipo = text10(e.tipo).toUpperCase();
    if (tipo === "LOCAL" && text10(e.ciudad_id)) targets.add(text10(e.ciudad_id));
    if (tipo === "PROVINCIAL") {
      for (const c of territory.ciudades || []) if (text10(c.provincia_id) === text10(e.provincia_id)) targets.add(text10(c.ciudad_id || c.id));
    }
    if (tipo === "GENERAL") for (const c of territory.ciudades || []) targets.add(text10(c.ciudad_id || c.id));
  }
  for (const city of [...targets].filter(Boolean)) {
    const key3 = efemCityKey(city), packet2 = await cache.get(key3) || { version: 1, ciudad_id: city, updated_at: "", efemerides: [] };
    let rows = (packet2.efemerides || []).filter((x) => text10(x.efemeride_id || x.id) !== id4);
    if (next && (next.activo === void 0 || bool6(next.activo)) && matchesCity(next, city, territory)) rows.push(next);
    await cache.put(key3, { version: 1, ciudad_id: city, updated_at: (/* @__PURE__ */ new Date()).toISOString(), efemerides: rows });
  }
  return { success: true, ciudades_actualizadas: [...targets] };
}
async function getEfemCity({ cache, cityId }) {
  const city = text10(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const p = await cache.get(efemCityKey(city));
  return p ? { success: true, ...p } : { success: true, ciudad_id: city, efemerides: [], cold: true };
}

// reconstruccion/worker/modules/efemerides-public-v2.js
var text11 = (v) => String(v ?? "").trim();
function dayNumber(raw) {
  const s = text11(raw).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map = { DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };
  if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : -1;
}
function dateFrom(raw) {
  const s = text11(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return /* @__PURE__ */ new Date();
}
function matches(row, date) {
  const type = text11(row.tipo_fecha).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (type === "FIJA") {
    return Number(row.mes || 0) === date.getMonth() + 1 && Number(row.dia || 0) === date.getDate();
  }
  if (type === "MOVIL") {
    if (Number(row.mes || 0) !== date.getMonth() + 1) return false;
    if (dayNumber(row.dia_semana) !== date.getDay()) return false;
    const raw = text11(row.semana_mes).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (raw === "ULTIMA") {
      const next = new Date(date);
      next.setDate(next.getDate() + 7);
      return next.getMonth() !== date.getMonth();
    }
    const week = Number(raw || 0);
    return Number.isInteger(week) && week >= 1 && week <= 5 && Math.floor((date.getDate() - 1) / 7) + 1 === week;
  }
  return false;
}
async function efemeridesPublicV2({ cache, cityId, fecha = "" }) {
  const base2 = await getEfemCity({ cache, cityId });
  if (base2.status) return base2;
  const date = dateFrom(fecha);
  const key3 = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
  return {
    success: true,
    ciudad_id: text11(cityId),
    fecha: key3,
    efemerides: (base2.efemerides || []).filter((x) => matches(x, date))
  };
}

// reconstruccion/worker/core/farmacias-read-model.js
var text12 = (v) => String(v ?? "").trim();
var farmCityKey = (cityId) => "farmacias:city:v1:" + text12(cityId);
function sortTurnos(rows) {
  return [...rows].sort((a, b) => {
    const ad = text12(a.fecha_inicio) + " " + text12(a.hora_inicio);
    const bd = text12(b.fecha_inicio) + " " + text12(b.hora_inicio);
    return ad.localeCompare(bd);
  });
}
async function syncFarmCycle({ db, cache, cycleId, previousCity = "" }) {
  const id4 = text12(cycleId);
  const cycle = await db.get("farmacias_ciclos", id4);
  const nextCity = text12(cycle && cycle.ciudad_id);
  const targets = [...new Set([text12(previousCity), nextCity].filter(Boolean))];
  for (const city of targets) {
    const key3 = farmCityKey(city);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: city, updated_at: "", ciclos: [] };
    let rows = (packet2.ciclos || []).filter((x) => text12(x.ciclo_id || x.id) !== id4);
    if (cycle && nextCity === city) {
      const participantes = await db.queryEqual("farmacias_ciclo_sedes", "ciclo_id", id4);
      const sedeIds = [...new Set(participantes.map((x) => text12(x.sede_id)).filter(Boolean))];
      const sedes = [];
      for (const sid of sedeIds) {
        const s = await db.get("anunciantes_sedes", sid);
        if (s) sedes.push(s);
      }
      rows.push({ ...cycle, participantes, sedes });
    }
    await cache.put(key3, { version: 1, ciudad_id: city, updated_at: (/* @__PURE__ */ new Date()).toISOString(), ciclos: sortTurnos(rows) });
  }
  return { success: true, ciudades_actualizadas: targets };
}
async function getFarmCity({ cache, cityId }) {
  const city = text12(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const p = await cache.get(farmCityKey(city));
  return p ? { success: true, ...p } : { success: true, ciudad_id: city, ciclos: [], cold: true };
}

// reconstruccion/worker/routes/public-v4.js
var text13 = (v) => String(v ?? "").trim();
var out = (r) => r.status ? json(r, r.status) : publicJson(r);
async function routePublicV4({ path, request: request2, url, cache }) {
  if (path === "/territory/public" && request2.method === "GET") return territoryPublic({ cache });
  if (path === "/guide" && request2.method === "GET") return guidePublic({ url, cache });
  const city = text13(url.searchParams.get("ciudad_id"));
  if (path === "/promos" && request2.method === "GET") {
    return out(await getPromosCity({ cache, cityId: city }));
  }
  if (path === "/events-new" && request2.method === "GET") {
    const r = await getEventsCityV2({ cache, cityId: city });
    if (r.status) return json(r, r.status);
    return publicJson({ success: true, events: r.events || [], data: r.events || [], ...r });
  }
  if (path === "/actividades" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") return out(await getActivitiesCity({ cache, cityId: city }));
  }
  if (path === "/publicidad" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") return out(await getPublicityCity({ cache, cityId: city }));
  }
  if (path === "/efemerides" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (["efemerides", "publicas", "public"].includes(action)) {
      return out(await efemeridesPublicV2({
        cache,
        cityId: city,
        fecha: text13(url.searchParams.get("fecha"))
      }));
    }
  }
  if (path === "/farmacias" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (action === "turnos") return out(await getFarmCity({ cache, cityId: city }));
  }
  return null;
}

// reconstruccion/worker/core/catalogs.js
var KEYS = {
  commerce: "catalogs:commerce:v1",
  promos: "catalogs:promos:v1",
  eventos: "catalogs:eventos:v1",
  actividades: "catalogs:actividades:v1",
  publicidad: "catalogs:publicidad:v1",
  admin: "admin:catalogs:v2"
};
function active2(x) {
  if (x.activo === void 0 && x.activa === void 0) return true;
  const v = x.activo ?? x.activa;
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "activo", "activa"].includes(String(v || "").trim().toLowerCase());
}
var onlyActive = (rows) => (rows || []).filter(active2);
async function getCommerceCatalogs(cache) {
  return await cache.get(KEYS.commerce) || { segmentos: [], categorias: [], actividades_clave: [], acciones: [], nodos: [], funcionalidades: [], niveles_anunciante: [] };
}
async function getEventosCatalogs(cache) {
  return await cache.get(KEYS.eventos) || { categorias: [], lugares: [], partners: [] };
}
async function getActividadesCatalogs(cache) {
  return await cache.get(KEYS.actividades) || { categorias: [], lugares: [] };
}
async function getPublicidadCatalogs(/** @type {any} */ cache) {
  const [packetRaw,guide,events,activities,promos]=await Promise.all([cache.get(KEYS.publicidad),cache.get(KEYS.commerce),cache.get(KEYS.eventos),cache.get(KEYS.actividades),cache.get(KEYS.promos)]);
  const packet=packetRaw||{categorias:[],ubicaciones:[],prioridades:[]};
  const ubicaciones=(packet.ubicaciones||[]).filter(active3).map((/** @type {any} */ u)=>({...u,ubicacion_id:text(u.ubicacion_id||u.id),nombre_visible:text(u.nombre_visible||u.nombre||u.modulo||u.ubicacion_id)}));
  const sources={GUIA:guide,ANUNCIANTES:guide,COMERCIOS:guide,EVENTO:events,EVENTOS:events,ACTIVIDAD:activities,ACTIVIDADES:activities,PROMO:promos,PROMOS:promos,PROMOCIONES:promos};
  const native=new Map(),ready=new Set();
  for(const u of ubicaciones){
   const source=sources[text(u.modulo).toUpperCase()];
   if(!source||!Array.isArray(source.categorias))continue;
   ready.add(u.ubicacion_id);
   for(const c of source.categorias.filter(active3)){
    const id=text(c.categoria_id||c.id);if(!id)continue;
    const key=u.ubicacion_id+':'+id;
    native.set(key,{...c,categoria_id:id,ubicacion_id:u.ubicacion_id,categoria_key:key,categoria:text(c.categoria||c.nombre||c.nombre_visible||id),origen_catalogo:text(u.modulo).toUpperCase()});
   }
  }
  for(const c of (packet.categorias||[]).filter(active3)){
   const location=text(c.ubicacion_id),id=text(c.categoria_id||c.id),key=text(c.categoria_key)||location+':'+id;
   if(native.has(key))continue;
   // Preserve stored targeting keys for existing publications and contracts.
   native.set(key,{...c,categoria_id:id,ubicacion_id:location,categoria_key:key,categoria:text(c.categoria||c.nombre||id),categoria_heredada:ready.has(location)&&id!=='GENERAL'});
  }
  for(const u of ubicaciones){const key=u.ubicacion_id+':GENERAL';if(!native.has(key))native.set(key,{categoria_id:'GENERAL',ubicacion_id:u.ubicacion_id,categoria_key:key,categoria:'Campaña general',activo:true});}
  return {...packet,ubicaciones,categorias:[...native.values()]};
}

async function rebuildCatalogs({ db, cache }) {
  const [
    segmentos,
    categorias,
    actividades,
    acciones,
    nodos,
    funcionalidades,
    niveles,
    promosCategorias,
    eventosCategorias,
    lugares,
    actividadesCategorias,
    publicidadCategorias,
    publicidadUbicaciones,
    publicidadPrioridades,
    moderacion18
  ] = await Promise.all([
    db.listCollection("segmentos"),
    db.listCollection("categorias"),
    db.listCollection("actividades_clave"),
    db.listCollection("acciones"),
    db.listCollection("nodos"),
    db.listCollection("funcionalidades"),
    db.listCollection("niveles_anunciante"),
    db.listCollection("promos_categorias"),
    db.listCollection("eventos_categorias"),
    db.listCollection("lugares"),
    db.listCollection("actividades_categorias"),
    db.listCollection("publicidad_categorias"),
    db.listCollection("publicidad_ubicaciones"),
    db.listCollection("publicidad_prioridades"),
    db.listCollection("eventos_moderacion_palabras")
  ]);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    cache.put(KEYS.commerce, { updated_at: now, segmentos: onlyActive(segmentos), categorias: onlyActive(categorias), actividades_clave: onlyActive(actividades), acciones: onlyActive(acciones), nodos: onlyActive(nodos), funcionalidades: onlyActive(funcionalidades), niveles_anunciante: onlyActive(niveles) }),
    cache.put(KEYS.promos, { updated_at: now, categorias: onlyActive(promosCategorias) }),
    cache.put(KEYS.eventos, { updated_at: now, categorias: onlyActive(eventosCategorias), lugares: onlyActive(lugares), partners: [] }),
    cache.put(KEYS.actividades, { updated_at: now, categorias: onlyActive(actividadesCategorias), lugares: onlyActive(lugares) }),
    cache.put(KEYS.publicidad, { updated_at: now, categorias: onlyActive(publicidadCategorias), ubicaciones: onlyActive(publicidadUbicaciones), prioridades: onlyActive(publicidadPrioridades) }),
    cache.put(KEYS.admin, {
      version: 2,
      updated_at: now,
      segmentos,
      niveles_anunciante: niveles,
      funcionalidades,
      categorias,
      actividades_clave: actividades,
      acciones,
      nodos,
      eventos_categorias: eventosCategorias,
      actividades_categorias: actividadesCategorias,
      moderacion_18: moderacion18
    })
  ]);
  return { success: true, updated_at: now };
}

// reconstruccion/worker/modules/public-catalogs-v2.js
async function publicGuideCatalogsV2({ cache }) {
  const c = await getCommerceCatalogs(cache);
  const segmentos = Array.isArray(c.segmentos) ? c.segmentos : [];
  return {
    success: true,
    segmentos,
    segmentos_publicos: segmentos,
    categorias: Array.isArray(c.categorias) ? c.categorias : [],
    actividades_clave: Array.isArray(c.actividades_clave) ? c.actividades_clave : [],
    acciones: Array.isArray(c.acciones) ? c.acciones : [],
    nodos: Array.isArray(c.nodos) ? c.nodos : [],
    niveles_anunciante: Array.isArray(c.niveles_anunciante) ? c.niveles_anunciante : [],
    source: "kv"
  };
}

// reconstruccion/worker/routes/public-v5.js
async function routePublicV5(ctx) {
  const { path, request: request2, cache } = ctx;
  if (path === "/catalogs/public/guide" && request2.method === "GET") {
    return publicJson(await publicGuideCatalogsV2({ cache }));
  }
  return routePublicV4(ctx);
}

// reconstruccion/worker/modules/publicidad-public-v2.js
var text14 = (v) => String(v ?? "").trim();
var norm = (v) => text14(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
var bool7 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa", "aprobado", "aprobada"].includes(text14(v).toLowerCase());
function parseDate(v) {
  const s = text14(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}
function isWithinValidity(p, now = Date.now()) {
  const desde = parseDate(p && p.vigente_desde), hasta = parseDate(p && p.vigente_hasta);
  if (desde !== null && now < desde) return false;
  if (hasta !== null && now > hasta) return false;
  return true;
}
function isPublic2(p) {
  return text14(p && p.estado).toUpperCase() === "ACTIVA" && bool7(p && p.aprobado) && isWithinValidity(p);
}
function activeSeg(s) {
  return s && (s.activo === void 0 && s.activa === void 0 || bool7(s.activo ?? s.activa));
}
function activeMedia(m) {
  return m && (m.activo === void 0 && m.activa === void 0 || bool7(m.activo ?? m.activa));
}
async function publicidadPublicaV2({ cache, cityId, moduleName, categoryId = "" }) {
  const city = text14(cityId), mod = text14(moduleName).toUpperCase(), cat = text14(categoryId);
  if (!city || !mod) {
    return { success: false, message: "Faltan ciudad_id o modulo.", publicidades: [], status: 400 };
  }
  const [packet2, catalogs] = await Promise.all([
    getPublicityCity({ cache, cityId: city }),
    // Para publicar anuncios sólo hacen falta las ubicaciones propias de Publicidad.
    // No cargar los catálogos de Guía, Eventos, Actividades ni Promociones.
    cache.get(KEYS.publicidad).then(packet => ({
      ubicaciones: (packet?.ubicaciones || []).filter(active3)
    }))
  ]);
  if (packet2.status) return packet2;
  const ubicaciones = new Set(
    (catalogs.ubicaciones || []).filter((u) => norm(u.modulo) === norm(mod)).map((u) => text14(u.ubicacion_id || u.id)).filter(Boolean)
  );
  if (!ubicaciones.size) {
    return { success: true, ciudad_id: city, modulo: mod, categoria_id: cat, publicidades: [] };
  }
  const rows = (packet2.publicidades || []).filter(isPublic2).map((p) => {
    const seg = (Array.isArray(p.segmentacion) ? p.segmentacion : []).filter(activeSeg).filter((s) => text14(s.ciudad_id) === city).filter((s) => ubicaciones.has(text14(s.ubicacion_id))).filter((s) => !cat || text14(s.categoria_id) === cat);
    if (!seg.length) return null;
    const media = (Array.isArray(p.media) ? p.media : []).filter(activeMedia).sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
    return { ...p, media, segmentacion: seg };
  }).filter(Boolean);
  return {
    success: true,
    ciudad_id: city,
    modulo: mod,
    categoria_id: cat,
    publicidades: rows
  };
}

// reconstruccion/worker/routes/public-v6.js
var text15 = (v) => String(v ?? "").trim();
async function routePublicV6(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/publicidad" && request2.method === "GET") {
    const action = text15(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") {
      const out2 = await publicidadPublicaV2({
        cache,
        cityId: text15(url.searchParams.get("ciudad_id")),
        moduleName: text15(url.searchParams.get("modulo")),
        categoryId: text15(url.searchParams.get("categoria_id"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV5(ctx);
}

// reconstruccion/worker/core/activities-read-model-v2.js
var text16 = (v) => String(v ?? "").trim();
var bool8 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text16(v).toLowerCase());
var activityCityKeyV2 = (cityId) => "activities:city:v2:" + text16(cityId);
function isPublic3(a) {
  if (!a || !bool8(a.activo) || !bool8(a.aprobado)) return false;
  const estado = text16(a.estado).toUpperCase();
  if (["PAUSADA", "PAUSADO", "INACTIVA", "INACTIVO", "BORRADOR", "ELIMINADA", "ELIMINADO", "RECHAZADA", "RECHAZADO"].includes(estado)) return false;
  const hoy = new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
  if (text16(a.vigente_desde) && text16(a.vigente_desde) > hoy) return false;
  if (text16(a.vigente_hasta) && text16(a.vigente_hasta) < hoy) return false;
  return true;
}
function sort5(rows) {
  return [...rows].sort((a, b) => text16(a.nombre).localeCompare(text16(b.nombre), "es", { sensitivity: "base" }));
}
async function syncActivityPreparedV2({ cache, activityId, current = null, next = null, horarios = [], previousCities = [] }) {
  const id4 = text16(activityId || next && next.actividad_id || current && current.actividad_id);
  const currentCities = [...new Set((horarios || []).map((h) => text16(h.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text16), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = activityCityKeyV2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", actividades: [] };
    let rows = (packet2.actividades || []).filter((x) => text16(x.actividad_id || x.id) !== id4);
    if (next && isPublic3(next)) {
      const hs = (horarios || []).filter((h) => text16(h.ciudad_id) === cityId && (h.activo === void 0 || bool8(h.activo)));
      if (hs.length) rows.push({ ...next, horarios: hs });
    }
    await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), actividades: sort5(rows) });
  }
  await putPreparedRelationsV1({ cache, type: "activity", id: id4, next, data: horarios });
  return { success: true, ciudades_actualizadas: targets };
}
async function getActivitiesCityV2({ cache, cityId }) {
  const city=text16(cityId);if(!city)return {success:false,message:'ciudad_id obligatorio',status:400};
  const [packet,virtual]=await Promise.all([cache.get(activityCityKeyV2(city)),city==='VIRTUAL'?Promise.resolve(null):cache.get(activityCityKeyV2('VIRTUAL'))]);
  const byId=new Map();
  for(const row of [...(packet?.actividades||[]),...(virtual?.actividades||[])]){
    if(!isPublic3(row))continue;
    const id=text16(row.actividad_id||row.id),previous=byId.get(id);
    if(previous){const schedules=new Map();for(const h of [...previous.horarios||[],...row.horarios||[]])schedules.set(text16(h.actividad_horario_id||h.id)||JSON.stringify(h),h);byId.set(id,{...previous,...row,horarios:[...schedules.values()]});}
    else byId.set(id,row);
  }
  const publishers=new Map();
  const activities=await Promise.all([...byId.values()].map(async row=>{
    const aid=text16(row.anunciante_id||row.id_anunciante);if(!aid)return row;
    if(!publishers.has(aid))publishers.set(aid,Promise.all([cache.get('guide:advertiser:v2:'+aid),cache.get('panel:record:v53:anunciantes:'+encodeURIComponent(aid))]));
    const [guide,profile]=await publishers.get(aid);
    const source=guide?.template||guide?.cards?.[0]||profile?.data;
    return source?{...row,anunciante_nombre:text16(source.nombre||row.anunciante_nombre),logo_anunciante:text16(source.logo||source.logo_url||'')}:row;
  }));
  return {success:true,...packet,ciudad_id:city,actividades:sort5(activities),cold:!packet&&!virtual};
}
async function rebuildActivitiesAllV2({ db, cache }) {
  const [activities, schedules] = await Promise.all([
    db.listCollection("actividades"),
    db.listCollection("actividad_horarios")
  ]);
  const byAct = /* @__PURE__ */ new Map();
  for (const h of schedules) {
    const id4 = text16(h.actividad_id);
    if (!id4) continue;
    if (!byAct.has(id4)) byAct.set(id4, []);
    byAct.get(id4).push(h);
  }
  for(const a of activities)if(Number(a.horarios_version)===2&&Array.isArray(a.horarios))byAct.set(text16(a.actividad_id||a.id),a.horarios);
  const byCity = /* @__PURE__ */ new Map();
  for (const a of activities) {
    await putPreparedRelationsV1({ cache, type: "activity", id: text16(a.actividad_id || a.id), next: a, data: byAct.get(text16(a.actividad_id || a.id)) || [] });
    if (!isPublic3(a)) continue;
    const id4 = text16(a.actividad_id || a.id), groups = /* @__PURE__ */ new Map();
    for (const h of byAct.get(id4) || []) {
      if (h.activo !== void 0 && !bool8(h.activo)) continue;
      const city = text16(h.ciudad_id);
      if (!city) continue;
      if (!groups.has(city)) groups.set(city, []);
      groups.get(city).push(h);
    }
    for (const [city, hs] of groups) {
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push({ ...a, horarios: hs });
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, actividades]) => cache.put(activityCityKeyV2(city), {
    version: 2,
    ciudad_id: city,
    updated_at: now,
    actividades: sort5(actividades)
  })));
  return { success: true, ciudades: byCity.size, actividades: activities.length, updated_at: now };
}

// reconstruccion/worker/routes/public-v7.js
var text17 = (v) => String(v ?? "").trim();
async function routePublicV7(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/actividades" && request2.method === "GET") {
    const action = text17(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") {
      const out2 = await getActivitiesCityV2({
        cache,
        cityId: text17(url.searchParams.get("ciudad_id"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV6(ctx);
}

// reconstruccion/worker/core/publicity-read-model-v2.js
var text18 = (v) => String(v ?? "").trim();
var publicityCityKeyV2 = (cityId) => "publicity:city:v2:" + text18(cityId);
function isActive2(p) {
  return text18(p && p.estado).toUpperCase() === "ACTIVA";
}
function sort6(rows) {
  return [...rows].sort((a, b) => text18(a.titulo || a.nombre_interno).localeCompare(text18(b.titulo || b.nombre_interno), "es", { sensitivity: "base" }));
}
async function syncPublicityPreparedV2({
  cache,
  publicityId,
  current = null,
  next = null,
  segmentacion = [],
  media = [],
  previousCities = []
}) {
  const id4 = text18(publicityId || next && next.publicidad_id || current && current.publicidad_id);
  await cache.put("publicity:private:v101:"+encodeURIComponent(id4),next?{...next,media,segmentacion}:{publicidad_id:id4,eliminada:true});
  const currentCities = [...new Set((segmentacion || []).map((x) => text18(x.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text18), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = publicityCityKeyV2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", publicidades: [] };
    let rows = (packet2.publicidades || []).filter((x) => text18(x.publicidad_id || x.id) !== id4);
    if (next && isActive2(next) && currentCities.includes(cityId)) {
      rows.push({
        ...next,
        media: [...media || []],
        segmentacion: (segmentacion || []).filter((x) => text18(x.ciudad_id) === cityId)
      });
    }
    await cache.put(key3, {
      version: 2,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      publicidades: sort6(rows)
    });
  }
  await putPreparedRelationsV1({ cache, type: "publicity-media", id: id4, next, data: media });
  await putPreparedRelationsV1({ cache, type: "publicity-seg", id: id4, next, data: segmentacion });
  return { success: true, ciudades_actualizadas: targets };
}
async function getPublicityCityV2({ cache, cityId }) {
  const city = text18(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(publicityCityKeyV2(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, publicidades: [], cold: true };
}
async function rebuildPublicityAllV2({ db, cache }) {
  const [docs, seg, media] = await Promise.all([
    db.listCollection("publicidades"),
    db.listCollection("publicidad_segmentacion"),
    db.listCollection("publicidad_media")
  ]);
  const segBy = /* @__PURE__ */ new Map(), mediaBy = /* @__PURE__ */ new Map();
  for (const x of seg) {
    const id4 = text18(x.publicidad_id);
    if (!segBy.has(id4)) segBy.set(id4, []);
    segBy.get(id4).push(x);
  }
  for (const x of media) {
    const id4 = text18(x.publicidad_id);
    if (!mediaBy.has(id4)) mediaBy.set(id4, []);
    mediaBy.get(id4).push(x);
  }
  const byCity = /* @__PURE__ */ new Map();
  for (const d of docs) {
    const preparedId = text18(d.publicidad_id || d.id);
    await putPreparedRelationsV1({ cache, type: "publicity-media", id: preparedId, next: d, data: Number(d.relaciones_version)===2?d.media||[]:mediaBy.get(preparedId)||[] });
    await putPreparedRelationsV1({ cache, type: "publicity-seg", id: preparedId, next: d, data: Number(d.relaciones_version)===2?d.segmentacion||[]:segBy.get(preparedId)||[] });
    if (!isActive2(d)) continue;
    const id4 = text18(d.publicidad_id || d.id);
    for (const s of (Number(d.relaciones_version)===2?d.segmentacion||[]:segBy.get(id4)||[])) {
      const city = text18(s.ciudad_id);
      if (!city) continue;
      if (!byCity.has(city)) byCity.set(city, []);
      if (!byCity.get(city).some((x) => text18(x.publicidad_id || x.id) === id4)) {
        byCity.get(city).push({
          ...d,
          media: Number(d.relaciones_version)===2?d.media||[]:mediaBy.get(id4)||[],
          segmentacion: (Number(d.relaciones_version)===2?d.segmentacion||[]:segBy.get(id4)||[]).filter((x) => text18(x.ciudad_id) === city)
        });
      }
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, publicidades]) => cache.put(publicityCityKeyV2(city), {
    version: 2,
    ciudad_id: city,
    updated_at: now,
    publicidades: sort6(publicidades)
  })));
  return { success: true, ciudades: byCity.size, publicidades: docs.length, updated_at: now };
}

// reconstruccion/worker/modules/publicidad-public-v3.js
var text19 = (v) => String(v ?? "").trim();
var norm2 = (v) => text19(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
var bool9 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa", "aprobado", "aprobada"].includes(text19(v).toLowerCase());
function parseDate2(v) {
  const s = text19(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}
function valid(p, now = Date.now()) {
  const local=(v,end)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?parseDate2(v+(end?'T23:59:59.999-03:00':'T00:00:00-03:00')):parseDate2(v);
  const desde=local(p&&p.vigente_desde,false),hasta=local(p&&p.vigente_hasta,true);
  if (desde !== null && now < desde) return false;
  if (hasta !== null && now > hasta) return false;
  return true;
}
function isPublic4(p) {
  return text19(p && p.estado).toUpperCase() === "ACTIVA" && bool9(p && p.aprobado) && valid(p);
}
function activeSeg2(s) {
  return s && (s.activo === void 0 && s.activa === void 0 || bool9(s.activo ?? s.activa));
}
function activeMedia2(m) {
  return m && (m.activo === void 0 && m.activa === void 0 || bool9(m.activo ?? m.activa));
}
async function publicidadPublicaV3({ cache, cityId, moduleName, categoryId = "" }) {
  const city = text19(cityId), mod = text19(moduleName).toUpperCase(), cat = text19(categoryId);
  if (!city || !mod) return { success: false, message: "Faltan ciudad_id o modulo.", publicidades: [], status: 400 };
  const [packet2, catalogs] = await Promise.all([
    getPublicityCityV2({ cache, cityId: city }),
    getPublicidadCatalogs(cache)
  ]);
  if (packet2.status) return packet2;
  const ubicaciones = new Set(
    (catalogs.ubicaciones || []).filter((u) => norm2(u.modulo) === norm2(mod)).map((u) => text19(u.ubicacion_id || u.id)).filter(Boolean)
  );
  const contracts=new Map(),contractLimits=new Map();
  const rows = (await Promise.all((packet2.publicidades || []).filter(isPublic4).map(async (p) => {
    const aid=text19(p.anunciante_id);if(!contracts.has(aid))contracts.set(aid,cache.get("publicity:contract:v101:"+aid));
    const contract=await contracts.get(aid);
    contractLimits.set(aid,contract?.activas_max??Infinity);
    if(contract&&(!contract.habilitada||contract.activas_max<=0||!contract.ciudades_sin_limite&&!contract.ciudades_max||!contract.categorias_sin_limite&&!contract.categorias_max||!valid(contract)||p.formato==='IMAGEN'&&!contract.permite_imagen||p.formato==='CARRUSEL'&&!contract.permite_carrusel||p.formato==='SHORT'&&!contract.permite_short))return null;
    const seg = (Array.isArray(p.segmentacion) ? p.segmentacion : []).filter(activeSeg2).filter((s) => text19(s.ciudad_id) === city).filter((s) => ubicaciones.has(text19(s.ubicacion_id))).filter((s) => (!cat || text19(s.categoria_id) === cat||text19(s.categoria_id)==="GENERAL")&&(!contract?.ciudades_ids?.length||contract.ciudades_ids.includes(text19(s.ciudad_id)))&&(!contract?.ubicaciones_ids?.length||contract.ubicaciones_ids.includes(text19(s.ubicacion_id)))&&(!contract?.categorias_keys?.length||contract.categorias_keys.includes(text19(s.categoria_key)||text19(s.ubicacion_id)+":"+text19(s.categoria_id))));
    if (!seg.length) return null;
    const media = (Array.isArray(p.media) ? p.media : []).filter(activeMedia2).sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
    const first = media[0] || {};
    const tipo = text19(first.tipo_media || p.formato).toUpperCase();
    const url = text19(first.url);
    return {
      ...p,nivel:contract?.nivel??p.nivel,
      media,
      segmentacion: seg,
      ciudad_id: city,
      img: tipo === "IMAGEN" ? url : "",
      media_url: tipo === "IMAGEN" ? "" : url,
      cta:p.cta_tipo==='FICHA_ANUNCIANTE'?'https://anunciantes-guialocal.web.app/plataforma/anunciantes.html?ciudad_id='+encodeURIComponent(city)+'&anunciante_id='+encodeURIComponent(p.anunciante_id):pubInternalDestination106(p.cta_destino||p.cta),
      poster: text19(first.poster || p.poster)
    };
  }))).filter(Boolean);
  const counts=new Map();
  const capped=rows.filter(p=>{const aid=text19(p.anunciante_id),n=counts.get(aid)||0;if(n>=contractLimits.get(aid))return false;counts.set(aid,n+1);return true;});
  return { success: true, ciudad_id: city, modulo: mod, categoria_id: cat, publicidades:capped };
}

// reconstruccion/worker/routes/public-v9.js
var text20 = (v) => String(v ?? "").trim();
async function routePublicV9(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/publicidad" && request2.method === "GET") {
    const action = text20(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") {
      const out2 = await publicidadPublicaV3({
        cache,
        cityId: text20(url.searchParams.get("ciudad_id")),
        moduleName: text20(url.searchParams.get("modulo")),
        categoryId: text20(url.searchParams.get("categoria_id"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV7(ctx);
}

// reconstruccion/worker/core/efemerides-read-model-v2.js
var text21 = (v) => String(v ?? "").trim();
var bool10 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text21(v).toLowerCase());
var efemCityKeyV2 = (cityId) => "efemerides:city:v2:" + text21(cityId);
function matchesCity2(e, city, territory) {
  const tipo = text21(e && e.tipo).toUpperCase();
  if (tipo === "GENERAL") return true;
  if (tipo === "LOCAL") return text21(e.ciudad_id) === city;
  if (tipo === "PROVINCIAL") {
    const c = (territory.ciudades || []).find((x) => text21(x.ciudad_id || x.id) === city) || {};
    return text21(e.provincia_id) === text21(c.provincia_id);
  }
  return false;
}
function targetsFor(e, territory) {
  const out2 = /* @__PURE__ */ new Set();
  if (!e) return out2;
  const tipo = text21(e.tipo).toUpperCase();
  if (tipo === "LOCAL" && text21(e.ciudad_id)) out2.add(text21(e.ciudad_id));
  if (tipo === "PROVINCIAL") {
    for (const c of territory.ciudades || []) {
      if (text21(c.provincia_id) === text21(e.provincia_id)) out2.add(text21(c.ciudad_id || c.id));
    }
  }
  if (tipo === "GENERAL") {
    for (const c of territory.ciudades || []) out2.add(text21(c.ciudad_id || c.id));
  }
  return out2;
}
async function syncEfemeridePreparedV2({ cache, efemerideId, previous = null, next = null }) {
  const id4 = text21(efemerideId);
  const territory = await cache.get("territorio:public:v1") || {};
  const targets = /* @__PURE__ */ new Set([...targetsFor(previous, territory), ...targetsFor(next, territory)]);
  for (const city of [...targets].filter(Boolean)) {
    const key3 = efemCityKeyV2(city);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: city, updated_at: "", efemerides: [] };
    let rows = (packet2.efemerides || []).filter((x) => text21(x.efemeride_id || x.id) !== id4);
    if (next && (next.activo === void 0 || bool10(next.activo)) && matchesCity2(next, city, territory)) rows.push(next);
    await cache.put(key3, { version: 2, ciudad_id: city, updated_at: (/* @__PURE__ */ new Date()).toISOString(), efemerides: rows });
  }
  return { success: true, ciudades_actualizadas: [...targets] };
}
async function getEfemCityV2({ cache, cityId }) {
  const city = text21(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(efemCityKeyV2(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, efemerides: [], cold: true };
}
async function rebuildEfemeridesAllV3({ db, cache }) {
  const [rows, territory] = await Promise.all([
    db.listCollection("efemerides_bis"),
    cache.get("territorio:public:v1")
  ]);
  if (!territory) throw new Error("Territorio público no inicializado.");
  const active4 = rows.filter((x) => x.activo === void 0 || bool10(x.activo));
  const now = (/* @__PURE__ */ new Date()).toISOString(), writes = [];
  for (const c of territory.ciudades || []) {
    const city = text21(c.ciudad_id || c.id);
    if (!city) continue;
    writes.push(cache.put(efemCityKeyV2(city), {
      version: 2,
      ciudad_id: city,
      updated_at: now,
      efemerides: active4.filter((e) => matchesCity2(e, city, territory))
    }));
  }
  await Promise.all(writes);
  return { success: true, ciudades: writes.length, efemerides: rows.length, activas: active4.length, updated_at: now };
}

// reconstruccion/worker/modules/efemerides-public-v3.js
var text22 = (v) => String(v ?? "").trim();
function dayNumber2(raw) {
  const s = text22(raw).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map = { DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };
  if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : -1;
}
function dateFrom2(raw) {
  const s = text22(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return /* @__PURE__ */ new Date();
}
function matches2(row, date) {
  const type = text22(row.tipo_fecha).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (type === "FIJA") return Number(row.mes || 0) === date.getMonth() + 1 && Number(row.dia || 0) === date.getDate();
  if (type === "MOVIL") {
    if (Number(row.mes || 0) !== date.getMonth() + 1) return false;
    if (dayNumber2(row.dia_semana) !== date.getDay()) return false;
    const raw = text22(row.semana_mes).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (raw === "ULTIMA") {
      const next = new Date(date);
      next.setDate(next.getDate() + 7);
      return next.getMonth() !== date.getMonth();
    }
    const week = Number(raw || 0);
    return Number.isInteger(week) && week >= 1 && week <= 5 && Math.floor((date.getDate() - 1) / 7) + 1 === week;
  }
  return false;
}
async function efemeridesPublicV3({ cache, cityId, fecha = "" }) {
  const base2 = await getEfemCityV2({ cache, cityId });
  if (base2.status) return base2;
  const date = dateFrom2(fecha);
  const key3 = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  return {
    success: true,
    ciudad_id: text22(cityId),
    fecha: key3,
    efemerides: (base2.efemerides || []).filter((x) => matches2(x, date))
  };
}

// reconstruccion/worker/routes/public-v10.js
var text23 = (v) => String(v ?? "").trim();
async function routePublicV10(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/efemerides" && request2.method === "GET") {
    const action = text23(url.searchParams.get("action")).toLowerCase();
    if (["efemerides", "publicas", "public"].includes(action)) {
      const out2 = await efemeridesPublicV3({
        cache,
        cityId: text23(url.searchParams.get("ciudad_id")),
        fecha: text23(url.searchParams.get("fecha"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV9(ctx);
}

// reconstruccion/worker/core/farmacias-read-model-v2.js
const text24=v=>String(v??"").trim();
const farmCityKeyV2=cityId=>"farmacias:city:v2:"+text24(cityId);

async function prepareFarmSedes(cache,city,sedes,guide=null){
  guide=guide||(await cache.get("guide:city:v1:"+text24(city)))||{};
  const names=new Map();
  for(const card of guide.anunciantes||[])for(const sede of card.sedes||[]){
    if(text24(sede.ciudad_id||card.ciudad_id)!==text24(city))continue;
    const id=text24(sede.sede_id||sede.id);
    if(id)names.set(id,{nombre_ref:text24(card.nombre||sede.nombre_ref),nombre_sede:text24(sede.nombre_sede)});
  }
  const used=new Set((sedes||[]).map(row=>text24(row.sede_id||row.id)));
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([...names].filter(([id])=>used.has(id)).sort(([a],[b])=>a.localeCompare(b)))));
  const revision="52:"+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
  const useful=v=>text24(v)&&text24(v).toLowerCase()!=="farmacia";
  return{revision,sedes:(sedes||[]).map(row=>{
    const prepared=names.get(text24(row.sede_id||row.id));
    if(!prepared)return row;
    // El nombre de sucursal y el del anunciante son datos distintos.
    return{...row,nombre_ref:prepared.nombre_ref||text24(row.nombre_ref||row.nombre),
      nombre_sede:prepared.nombre_sede||(useful(row.nombre_sede)?text24(row.nombre_sede):"")};
  })};
}

function sortTurnos2(rows){
  return [...rows].sort((a,b)=>{
    const ad=text24(a.fecha_inicio)+" "+text24(a.hora_inicio);
    const bd=text24(b.fecha_inicio)+" "+text24(b.hora_inicio);
    return ad.localeCompare(bd);
  });
}

async function syncFarmCyclePreparedV2({
  cache,
  cycleId,
  current=null,
  next=null,
  participantes=[],
  sedes=[],
  previousCity=""
}){
  const id=text24(cycleId||next&&next.ciclo_id||current&&current.ciclo_id);
  const nextCity=text24(next&&next.ciudad_id);
  const targets=[...new Set([text24(previousCity),text24(current&&current.ciudad_id),nextCity].filter(Boolean))];

  const prepared=await prepareFarmSedes(cache,nextCity||text24(current&&current.ciudad_id),sedes);
  sedes=prepared.sedes;
  for(const city of targets){
    const key=farmCityKeyV2(city);
    const packet=(await cache.get(key))||{version:2,ciudad_id:city,updated_at:"",ciclos:[]};
    let rows=(packet.ciclos||[]).filter(x=>text24(x.ciclo_id||x.id)!==id);

    if(next&&nextCity===city&&next.activo!==false){
      rows.push({...next,participantes:[...(participantes||[])],sedes:[...(sedes||[])]});
    }

    const guide=(await cache.get("guide:city:v1:"+city))||{};
    const completeRows=await Promise.all(rows.map(async c=>({...c,sedes:(await prepareFarmSedes(cache,city,c.sedes,guide)).sedes})));
    await cache.put(key,{
      version:2,
      ciudad_id:city,
      updated_at:new Date().toISOString(),
      ciclos:sortTurnos2(completeRows),
      names_revision:(await prepareFarmSedes(cache,city,completeRows.flatMap(c=>c.sedes||[]),guide)).revision
    });
  }

  await putPreparedRelationsV1({cache,type:"farm",id,next,data:{participantes,sedes}});
  return{success:true,ciudades_actualizadas:targets};
}

async function getFarmCityV2({cache,cityId}){
  const city=text24(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const key=farmCityKeyV2(city),packet=await cache.get(key);
  if(!packet)return{success:true,ciudad_id:city,ciclos:[],cold:true};
  if(!(packet.ciclos||[]).length)return{success:true,...packet};
  const guide=(await cache.get("guide:city:v1:"+city))||{};
  const context=await prepareFarmSedes(cache,city,packet.ciclos.flatMap(c=>c.sedes||[]),guide);
  if(packet.names_revision===context.revision)return{success:true,...packet};
  // Actualizar únicamente la copia KV del ciclo existente. Nunca Firestore,
  // nunca cambiar fechas, orden o participantes, ni exigir recrear el ciclo.
  const ciclos=await Promise.all(packet.ciclos.map(async c=>({...c,sedes:(await prepareFarmSedes(cache,city,c.sedes,guide)).sedes})));
  const next={...packet,ciclos,names_revision:context.revision};
  try{await cache.put(key,next)}catch(_){} // KV puede propagar lentamente; la respuesta sigue completa.
  return{success:true,...next};
}

async function rebuildFarmAllV2({db,cache}){
  const [cycles,participants,sedes]=await Promise.all([
    db.listCollection("farmacias_ciclos"),
    db.listCollection("farmacias_ciclo_sedes"),
    db.listCollection("anunciantes_sedes")
  ]);

  const partBy=new Map();
  for(const p of participants){
    const id=text24(p.ciclo_id);
    if(!partBy.has(id))partBy.set(id,[]);
    partBy.get(id).push(p);
  }

  const sedeMap=new Map(sedes.map(s=>[text24(s.sede_id||s.id),s]));
  const byCity=new Map();

  for(const c of cycles){
    const preparedId=text24(c.ciclo_id||c.id),preparedParts=partBy.get(preparedId)||[];
    const prepared=await prepareFarmSedes(cache,text24(c.ciudad_id),preparedParts.map(p=>sedeMap.get(text24(p.sede_id))).filter(Boolean));
    await putPreparedRelationsV1({cache,type:"farm",id:preparedId,next:c,data:{
      participantes:preparedParts,sedes:prepared.sedes
    }});
    if(c.activo===false)continue;
    const city=text24(c.ciudad_id);
    if(!city)continue;
    const ps=partBy.get(text24(c.ciclo_id||c.id))||[];
    const ss=prepared.sedes;
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push({...c,participantes:ps,sedes:ss});
  }

  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(async ([city,ciclos])=>cache.put(farmCityKeyV2(city),{
    version:2,ciudad_id:city,updated_at:now,ciclos:sortTurnos2(ciclos),names_revision:(await prepareFarmSedes(cache,city,ciclos.flatMap(c=>c.sedes||[]))).revision
  })));

  return{success:true,ciudades:byCity.size,ciclos:cycles.length,updated_at:now};
}

// reconstruccion/worker/modules/farmacias-public-v3.js
var text25 = (v) => String(v ?? "").trim();
function parseLocalDateTime(dateStr, timeStr) {
  const d = text25(dateStr), t = text25(timeStr) || "00:00";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const h = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m || !h) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]), 0, 0);
}
function fmtDate(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtTime(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function requestedDay(dateStr) {
  const m = text25(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1e3);
  return { start, end };
}
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}
function sedeMap(cycle) {
  return new Map((cycle.sedes || []).map((s) => [text25(s.sede_id || s.id), s]));
}
function sortedParticipants(cycle) {
  return [...cycle.participantes || []].filter((p) => p && p.activo !== false && text25(p.sede_id)).sort((a, b) => Number(a.orden || 999999) - Number(b.orden || 999999));
}
function turnosForCycle(cycle, dateStr, now = Date.now()) {
  const parts = sortedParticipants(cycle);
  const n = parts.length;
  if (!n) return [];
  const simultaneous = Math.max(1, Math.min(n, Math.floor(Number(cycle.farmacias_por_turno || 1))));
  const durationHours = Math.max(1, Number(cycle.duracion_horas || 24));
  const durationMs = durationHours * 60 * 60 * 1e3;
  const cycleStart = parseLocalDateTime(cycle.fecha_inicio, cycle.hora_inicio);
  const day = requestedDay(dateStr);
  if (!cycleStart || !day) return [];
  const firstSlot = Math.floor((day.start.getTime() - cycleStart.getTime()) / durationMs) - 1;
  const lastSlot = Math.floor((day.end.getTime() - cycleStart.getTime()) / durationMs) + 1;
  const totalSteps = n / gcd(n, simultaneous);
  const sedes = sedeMap(cycle);
  const rows = [];
  for (let slot = Math.max(0, firstSlot); slot <= Math.max(0, lastSlot); slot++) {
    const start = new Date(cycleStart.getTime() + slot * durationMs);
    const end = new Date(start.getTime() + durationMs);
    if (end <= day.start || start >= day.end) continue;
    const step = slot % totalSteps;
    const index = step * simultaneous % n;
    for (let j = 0; j < simultaneous; j++) {
      const part = parts[(index + j) % n];
      const sede = sedes.get(text25(part.sede_id));
      if (!sede) continue;
      rows.push({
        ...sede,
        ciclo_id: text25(cycle.ciclo_id || cycle.id),
        sede_id: text25(sede.sede_id || sede.id),
        fecha_desde: fmtDate(start),
        hora_desde: fmtTime(start),
        fecha_hasta: fmtDate(end),
        hora_hasta: fmtTime(end),
        observaciones: text25(cycle.observaciones),
        en_turno_ahora: now >= start.getTime() && now < end.getTime()
      });
    }
  }
  return rows;
}
async function farmTurnosPublicV3({ cache, cityId, fecha = "" }) {
  const city = text25(cityId);
  const date = text25(fecha) || fmtDate(/* @__PURE__ */ new Date());
  const base2 = await getFarmCityV2({ cache, cityId: city });
  if (base2.status) return base2;
  const turnos = (base2.ciclos || []).filter((c) => c.activo !== false).flatMap((c) => turnosForCycle(c, date)).sort((a, b) => {
    const ka = text25(a.fecha_desde) + " " + text25(a.hora_desde) + " " + text25(a.nombre_sede);
    const kb = text25(b.fecha_desde) + " " + text25(b.hora_desde) + " " + text25(b.nombre_sede);
    return ka.localeCompare(kb, "es", { sensitivity: "base" });
  });
  return { success: true, ciudad_id: city, fecha: date, turnos };
}

// reconstruccion/worker/routes/public-v12.js
var text26 = (v) => String(v ?? "").trim();
async function routePublicV12(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/farmacias" && request2.method === "GET") {
    const action = text26(url.searchParams.get("action")).toLowerCase();
    if (action === "turnos") {
      const out2 = await farmTurnosPublicV3({
        cache,
        cityId: text26(url.searchParams.get("ciudad_id")),
        fecha: text26(url.searchParams.get("fecha"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV10(ctx);
}

// reconstruccion/worker/core/subscriber-session-state.js
var key2 = (sid) => "subscriber:session-state:v1:" + String(sid || "").trim();
async function subscriberSessionState(env, sid) {
  const kv = env.GLD_CACHE_KV;
  if (!kv) throw new Error("Falta binding GLD_CACHE_KV.");
  const raw = await kv.get(key2(sid));
  if (!raw) return { version: 0, deleted: false };
  return JSON.parse(raw);
}
async function revokeSubscriberSessions(env, sid, { deleted = false } = {}) {
  const current = await subscriberSessionState(env, sid);
  await env.GLD_CACHE_KV.put(key2(sid), JSON.stringify({
    version: Number(current.version || 0) + 1,
    deleted: deleted || current.deleted === true
  }));
}

// reconstruccion/worker/modules/suscriptores.js
var C2 = {
  suscriptores: "suscriptores",
  relaciones: "suscriptor_anunciante",
  anunciantes: "anunciantes",
  admin: "anunciantes_administracion"
};
var text27 = (v) => String(v ?? "").trim();
var norm3 = (v) => text27(v).toLowerCase();
function truthy(v) {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "yes", "x", "activo", "activa"].includes(norm3(v));
}
function publicSubscriber(s) {
  return {
    ...subscriberTerritoryV84(s),
    suscriptor_id: text27(s.suscriptor_id || s.id),
    nombre: text27(s.nombre),
    mail: text27(s.mail),
    whatsapp: text27(s.whatsapp),
    tipo_usuario: text27(s.tipo_usuario),
    ciudad_origen_id: text27(s.ciudad_origen_id),
    ciudad_predeterminada_id: text27(s.ciudad_predeterminada_id),
    activo: s.activo
  };
}
function b642(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  bytes.forEach((x) => bin += String.fromCharCode(x));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64decode2(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac2(env, value) {
  const secret = text27(env.SERVER_SECRET);
  if (!secret) throw new Error("Falta SERVER_SECRET");
  const key3 = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key3, new TextEncoder().encode(value));
  return b642(new Uint8Array(sig));
}
async function issueSession(env, payload) {
  const now = Date.now();
  const body = b642(JSON.stringify({
    ...payload,
    iat: now,
    exp: null,
    persistent: true,
    typ: "GLD_SUBSCRIBER"
  }));
  return body + "." + await hmac2(env, body);
}
async function verifySubscriberSession(env, request2) {
  const auth = text27(request2.headers.get("Authorization"));
  if (!auth.toLowerCase().startsWith("bearer ")) return { ok: false, message: "Sesión requerida" };
  const parts = auth.slice(7).trim().split(".");
  if (parts.length !== 2) return { ok: false, message: "Sesión inválida" };
  const [body, sig] = parts;
  if (sig !== await hmac2(env, body)) return { ok: false, message: "Sesión inválida" };
  let p = null;
  try {
    p = JSON.parse(b64decode2(body));
  } catch (_) {
  }
  if (!p || p.typ !== "GLD_SUBSCRIBER" || !p.sid || (p.persistent !== true && (!p.exp || Date.now() > Number(p.exp)))) {
    return { ok: false, message: "Sesión inválida o vencida" };
  }
  const state = await subscriberSessionState(env, p.sid);
  if (state.deleted || Number(p.sv || 0) !== Number(state.version || 0)) return { ok: false, message: "Sesión cerrada. Volvé a ingresar." };
  if(p.persistent !== true) SESSION_RENEWALS_V87.set(request2,{kind:"subscriber",token:await issueSession(env,p)});
  return { ok: true, ...p };
}
function relationPermissions(rel, admin) {
  const raw = text27(rel.permisos) || text27(admin && admin.funcionalidades);
  return raw.split(/[;,|\n]/).map((x) => text27(x).toUpperCase()).filter(Boolean);
}
async function subscriberLogin({ env, db, body }) {
  const mail = norm3(body.mail), clave = text27(body.clave);
  if (!mail || !clave) return { success: false, message: "Falta mail o clave" };
  const matches3 = await db.queryEqual(C2.suscriptores, "mail", mail, 5);
  const sus = matches3.find((x) => norm3(x.mail) === mail);
  if (!sus || text27(sus.clave) !== clave) return { success: false, message: "Mail o clave incorrectos" };
  if (sus.activo !== void 0 && sus.activo !== null && sus.activo !== "" && !truthy(sus.activo)) {
    return { success: false, message: "Suscriptor no activo" };
  }
  const sid = text27(sus.suscriptor_id || sus.id);
  const relations = (await db.queryEqual(C2.relaciones, "suscriptor_id", sid, 100)).filter((r) => text27(r.anunciante_id) && truthy(r.activo));
  const enriched = await Promise.all(relations.map(async (rel) => {
    const aid = text27(rel.anunciante_id);
    const [advertiser, admin] = await Promise.all([
      db.get(C2.anunciantes, aid),
      db.get(C2.admin, aid)
    ]);
    return {
      suscriptor_id: sid,
      anunciante_id: aid,
      anunciante_nombre: text27(rel.anunciante_nombre || advertiser && advertiser.nombre || admin && admin.nombre),
      rol: text27(rel.rol).toUpperCase(),
      permisos: relationPermissions(rel, admin).join(", "),
      administracion: admin || {},
      activo: true
    };
  }));
  const tokenPayload = {
    sid,
    auth: enriched.map((x) => ({
      anunciante_id: x.anunciante_id,
      rol: x.rol,
      permisos: x.permisos
    }))
  };
  const token2 = await issueSession(env, tokenPayload);
  return {
    success: true,
    suscriptor: publicSubscriber(sus),
    anunciantes: enriched,
    token: token2,
    expires_in_seconds: null,
    persistent: true,
    source: "firestore"
  };
}
async function subscriberSession({ env, request: request2 }) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { success: false, message: s.message, status: 401 };
  return {
    success: true,
    suscriptor_id: s.sid,
    autorizaciones: Array.isArray(s.auth) ? s.auth : [],
    expires_at: s.persistent === true ? null : s.exp,
    persistent: s.persistent === true
  };
}
function sessionAllows(session2, advertiserId, moduleName, { write = false } = {}) {
  if (!session2 || !session2.ok) return false;
  const aid = text27(advertiserId);
  const rel = (session2.auth || []).find((x) => text27(x.anunciante_id) === aid);
  if (!rel) return false;
  const role = text27(rel.rol).toUpperCase();
  if (!["PROPIETARIO", "ADMINISTRADOR", "MANAGER"].includes(role)) return false;
  if (write && moduleName === "modificar_datos" && role === "MANAGER") return false;
  if (moduleName === "modificar_datos") return role === "PROPIETARIO" || role === "ADMINISTRADOR";
  if (moduleName === "publicidad" && (role === "PROPIETARIO" || role === "ADMINISTRADOR")) return rel.activo !== false;
  const aliases = {
    promos: ["PROMOS"],
    eventos: ["EVENTOS"],
    eventos_free: ["EVENTOS_FREE", "EV_FREE", "EVFREE"],
    actividades: ["ACTIVIDADES"],
    publicidad: ["PUBLICIDAD"],
    turnos_farma: ["TURNOS_FARMA", "FARMACIAS", "FARMACIA"],
    efemerides: ["EFEMERIDES", "EF LOCAL", "EF GENERAL", "EF_LOCAL", "EF_GENERAL"]
  };
  const perms2 = new Set(text27(rel.permisos).split(/[;,|\n]/).map((x) => text27(x).toUpperCase()).filter(Boolean));
  return (aliases[moduleName] || []).some((x) => perms2.has(x));
}

// reconstruccion/worker/modules/commerce-v2.js
function text28(v) {
  return String(v ?? "").trim();
}
function ids2(v) {
  if (Array.isArray(v)) return [...new Set(v.map(text28).filter(Boolean))];
  return [...new Set(text28(v).split(/[;,|\n]/).map(text28).filter(Boolean))];
}
function newSedeId(advertiserId) {
  return "SED-" + text28(advertiserId) + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}
async function commercePanelData({ db, advertiserId, catalogs }) {
  const [datos, administracion, sedes] = await Promise.all([
    db.get("anunciantes", advertiserId),
    db.get("anunciantes_administracion", advertiserId),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId)
  ]);
  if (!datos) return { success: false, error: "anunciante_no_encontrado" };
  return {
    success: true,
    advertiser: {
      id: advertiserId,
      datos,
      administracion: administracion || {},
      sedes,
      segmentos: catalogs.segmentos || [],
      categorias: catalogs.categorias || [],
      actividades_clave: catalogs.actividades_clave || [],
      acciones: catalogs.acciones || [],
      nodos: catalogs.nodos || [],
      funcionalidades: catalogs.funcionalidades || [],
      niveles_anunciante: catalogs.niveles_anunciante || []
    }
  };
}
async function commerceSetDatos({ db, advertiserId, body }) {
  const reserved = /* @__PURE__ */ new Set(["action", "accion", "id", "__id", "comercio_id", "advertiserId", "advertiser_id"]);
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  for (const [k, v] of Object.entries(body || {})) {
    if (reserved.has(k)) continue;
    if (k === "categoria_id") patch.categoria_ids = ids2(v);
    else patch[k] = v;
  }
  const saved = await db.patch("anunciantes", advertiserId, patch, { mustExist: true });
  return { success: true, updated: true, id: advertiserId, advertiser: saved };
}
async function commerceSetSedes({ db, advertiserId, body }) {
  const incoming = Array.isArray(body && body.sedes) ? body.sedes : [];
  const saved = [];
  for (const raw of incoming) {
    const existingId = text28(raw && raw.sede_id);
    const id4 = existingId || newSedeId(advertiserId);
    if (existingId) {
      const current = await db.get("anunciantes_sedes", id4);
      if (!current || text28(current.anunciante_id) !== text28(advertiserId)) {
        throw new Error("La sede no pertenece al anunciante.");
      }
    }
    const patch = {
      ...raw || {},
      sede_id: id4,
      anunciante_id: advertiserId,
      actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
    };
    if ("actividad_ids" in patch) patch.actividad_ids = ids2(patch.actividad_ids);
    if ("accion_ids" in patch) patch.accion_ids = ids2(patch.accion_ids);
    if ("nodo_ids" in patch) patch.nodo_ids = ids2(patch.nodo_ids);
    delete patch.__id;
    await db.patch("anunciantes_sedes", id4, patch, { mustExist: !!existingId });
    saved.push(id4);
  }
  return { success: true, updated: true, id: advertiserId, sedes: saved };
}
async function commerceSetRelacionesSede({ db, advertiserId, body }) {
  const id4 = text28(body && body.sede_id);
  if (!id4) throw new Error("Falta sede_id.");
  const current = await db.get("anunciantes_sedes", id4);
  if (!current || text28(current.anunciante_id) !== text28(advertiserId)) {
    throw new Error("La sede no pertenece al anunciante.");
  }
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  if (body.actividad_ids !== void 0) patch.actividad_ids = ids2(body.actividad_ids);
  if (body.accion_ids !== void 0) patch.accion_ids = ids2(body.accion_ids);
  if (body.nodo_ids !== void 0) patch.nodo_ids = ids2(body.nodo_ids);
  await db.patch("anunciantes_sedes", id4, patch, { mustExist: true });
  return { success: true, updated: true, sede_id: id4 };
}
async function commerceDeleteSede({ db, advertiserId, body }) {
  const id4 = text28(body && body.sede_id);
  if (!id4) throw new Error("Falta sede_id.");
  const current = await db.get("anunciantes_sedes", id4);
  if (!current || text28(current.anunciante_id) !== text28(advertiserId)) {
    throw new Error("La sede no pertenece al anunciante.");
  }
  await db.delete("anunciantes_sedes", id4, { mustExist: true });
  return { success: true, deleted: true, sede_id: id4 };
}

// reconstruccion/worker/core/changed-fields-v1.js
function comparable(v) {
  if (Array.isArray(v)) return v.map(comparable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, comparable(v[k])]));
  return v;
}
function sameValueV1(a, b) {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}
function changedFieldsV1(current, next, { timestamps = ["actualizado", "actualizado_en"], touch = false, fields = null } = {}) {
  if (!current) return { ...next };
  const patch = {};
  for (const [k, v] of Object.entries(next)) {
    if (k === "id" || timestamps.includes(k) || v === void 0) continue;
    if (fields && !fields.includes(k)) continue;
    if (!sameValueV1(current[k], v)) patch[k] = v;
  }
  if (Object.keys(patch).length || touch) for (const k of timestamps) {
    if (next[k] !== void 0) patch[k] = next[k];
  }
  return patch;
}

// reconstruccion/worker/modules/promos-v2.js
var text29 = (v) => String(v ?? "").trim();
var bool11 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text29(v).toLowerCase());
var paused = (p) => bool11(p && p.pausado);
function categoryFrom(catalogs, value) {
  const needle = text29(value);
  const norm14 = (s) => text29(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (catalogs.categorias || []).find(
    (c) => text29(c.categoria_id || c.id) === needle || norm14(c.nombre || c.titulo || c.categoria || c.id) === norm14(needle)
  ) || null;
}
function cityExists(territory, cityId) {
  return (territory.ciudades || []).some((c) => text29(c.ciudad_id || c.id) === text29(cityId));
}
function promoId() {
  return "PRO-" + crypto.randomUUID();
}
async function promosPanelDataV2({ db, cache, advertiserId, cupoFromAdmin }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin, advertiser, sedes, promos, catalogs] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.get("anunciantes", advertiserId),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId,500),
    db.queryEqual("promos", "anunciante_id", advertiserId,500),
    cache.get("catalogs:promos:v1")
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  return {
    success: true,
    advertiser: advertiser || { id: advertiserId },
    sedes,
    categorias: catalogs && catalogs.categorias || [],
    promos,
    promos_cant: Number(cupoFromAdmin(admin) || 0),
    promos_guardadas_max: cupoGuardado(cupoFromAdmin(admin))
  };
}
async function validateContext({ db, cache, advertiserId, data }) {
  const [territory, catalogs] = await Promise.all([
    cache.get("territorio:public:v1"),
    cache.get("catalogs:promos:v1")
  ]);
  const cityId = text29(data.ciudad_id);
  if (!cityId || !territory || !cityExists(territory, cityId)) throw new Error("La ciudad indicada no existe o no está activa.");
  const cat = categoryFrom(catalogs || {}, data.categoria_id || data.categoria);
  if (!cat) throw new Error("La categoría indicada no existe.");
  const sedeId = text29(data.sede_id);
  if (sedeId) {
    const sedes = await db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId, 500);
    const sede = sedes.find(s => text30(s.sede_id || s.id) === sedeId);
    if (!sede || text29(sede.anunciante_id) !== text29(advertiserId)) throw new Error("La sede no pertenece al anunciante.");
    if (text29(sede.ciudad_id) !== cityId) throw new Error("La sede no pertenece a la ciudad indicada.");
  }
  return {
    cityId,
    categoria_id: text29(cat.categoria_id || cat.id),
    categoria: text29(cat.nombre || cat.titulo || cat.categoria),
    logo_categoria: text29(cat.logo)
  };
}
async function quota({ db, advertiserId, cupoFromAdmin, excludeId = "" }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin, promos] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.queryEqual("promos", "anunciante_id", advertiserId,500)
  ]);
  const max = Number(cupoFromAdmin(admin || {}) || 0);
  const active4 = promos.filter((p) => text29(p.promo_id || p.id) !== text29(excludeId) && !paused(p)).length;
  return { max, active: active4, total:promos.length, totalMax:cupoGuardado(max) };
}
async function promoCreateV2({ db, cache, advertiserId, body, cupoFromAdmin }) {
  const data = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  if(Object.hasOwn(data,'promo')&&String(data.promo??'').length>300)throw httpError('El texto de la promo admite hasta 300 caracteres.',400);
  if(Object.hasOwn(data,'otros')&&String(data.otros??'').length>120)throw httpError('La aclaración adicional admite hasta 120 caracteres.',400);
  if (text29(data.promo_id)) throw new Error("El alta de una promo no admite promo_id; usá editar para una promo existente.");
  const ctx = await validateContext({ db, cache, advertiserId, data });
  const q = await quota({ db, advertiserId, cupoFromAdmin });
  if (q.max <= 0 || q.active >= q.max) throw new Error("Alcanzaste el máximo de promos activas.");
  if(q.total>=q.totalMax)throw new Error("Alcanzaste el máximo de promociones guardadas.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    ...data,
    promo_id: promoId(),
    anunciante_id: advertiserId,
    id_comercio: advertiserId,
    ciudad_id: ctx.cityId,
    categoria_id: ctx.categoria_id,
    categoria: ctx.categoria,
    logo_categoria: ctx.logo_categoria,
    pausado: bool11(data.pausado),
    creado: text29(data.creado) || now,
    actualizado: now
  };
  const saved = await db.patch("promos", doc.promo_id, doc, {newDocument:true});
  await syncPromo({ cache, next: saved });
  return { success: true, promo: saved };
}
async function promoUpdateV2({ db, cache, advertiserId, body, cupoFromAdmin }) {
  const data = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  if(Object.hasOwn(data,'promo')&&String(data.promo??'').length>300)throw httpError('El texto de la promo admite hasta 300 caracteres.',400);
  if(Object.hasOwn(data,'otros')&&String(data.otros??'').length>120)throw httpError('La aclaración adicional admite hasta 120 caracteres.',400);
  const id4 = text29(data.promo_id);
  if (!id4) throw new Error("Falta promo_id.");
  const current = await db.get("promos", id4);
  if (!current || text29(current.anunciante_id || current.id_comercio) !== text29(advertiserId)) throw new Error("La promo no pertenece al anunciante.");
  const allowed = [
    "contenido_adulto",
    "promo",
    "categoria",
    "categoria_id",
    "sede_id",
    "ciudad_id",
    "img",
    "desde",
    "hasta",
    "otros",
    "instagram",
    "facebook",
    "youtube",
    "tiktok",
    "linkedin",
    "x",
    "direccion",
    "maps",
    "telefono",
    "telefono1",
    "telefono2",
    "telefono3",
    "telefono4",
    "whatsapp",
    "whatsapp2",
    "whatsapp3",
    "pausado"
  ];
  const next = { ...current };
  for (const k of allowed) if (Object.prototype.hasOwnProperty.call(data, k)) next[k] = data[k];
  const contextChanged = ["ciudad_id", "categoria_id", "categoria", "sede_id"].some((k) => Object.prototype.hasOwnProperty.call(data, k) && !sameValueV1(data[k], current[k]));
  if (contextChanged) {
    const contextData = { ...next };
    if (Object.prototype.hasOwnProperty.call(data, "categoria") && !Object.prototype.hasOwnProperty.call(data, "categoria_id")) delete contextData.categoria_id;
    const ctx = await validateContext({ db, cache, advertiserId, data: contextData });
    next.ciudad_id = ctx.cityId;
    next.categoria_id = ctx.categoria_id;
    next.categoria = ctx.categoria;
    next.logo_categoria = ctx.logo_categoria;
  }
  if (Object.prototype.hasOwnProperty.call(data, "pausado") && !bool11(data.pausado) && paused(current)) {
    const q = await quota({ db, advertiserId, cupoFromAdmin, excludeId: id4 });
    if (q.active >= q.max) throw new Error("Alcanzaste el máximo de promos activas.");
  }
  if (Object.prototype.hasOwnProperty.call(data, "pausado")) next.pausado = bool11(next.pausado);
  const patch = changedFieldsV1(current, next);
  if (!Object.keys(patch).length) return { success: true, updated: false, promo_id: id4, promo: current };
  patch.actualizado = (/* @__PURE__ */ new Date()).toISOString();
  const saved = await db.patch("promos", id4, patch, { mustExist: true });
  await syncPromo({ cache, current, next: saved });
  return { success: true, promo_id: id4, promo: saved };
}
async function promoDeleteV2({ db, cache, advertiserId, body }) {
  const data = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  const id4 = text29(data.promo_id);
  if (!id4) throw new Error("Falta promo_id.");
  const current = await db.get("promos", id4);
  if (!current || text29(current.anunciante_id || current.id_comercio) !== text29(advertiserId)) throw new Error("La promo no pertenece al anunciante.");
  await db.delete("promos", id4, { mustExist: true });
  await syncPromo({ cache, current, next: null });
  return { success: true, promo_id: id4 };
}

// reconstruccion/worker/modules/eventos.js
async function eventosPanelData({ db, advertiserId, catalogs, featureEnabled: featureEnabled3, cupo: cupo3, enrichPrograms }) {
  const [admin, advertiser, eventos, sedes] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.get("anunciantes", advertiserId),
    db.queryEqual("eventos", "anunciante_id", advertiserId),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId)
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  const vip = eventos.filter((e) => String(e.nivel || "").toUpperCase() !== "FREE");
  const free = eventos.filter((e) => String(e.nivel || "").toUpperCase() === "FREE");
  if (enrichPrograms) await enrichPrograms(vip);
  return {
    success: true,
    advertiser: advertiser || { id: advertiserId },
    funcionalidades: {
      eventos: !!featureEnabled3(admin, "EVENTOS"),
      eventos_free: !!featureEnabled3(admin, "EVENTOS_FREE")
    },
    eventos_cant: Number(cupo3(admin, "EVENTOS") || 0),
    eventos_free_cant: Number(cupo3(admin, "EVENTOS_FREE") || 0),
    eventos_guardadas_max:cupoGuardado(cupo3(admin,"EVENTOS")),
    eventos_free_guardadas_max:cupoGuardado(cupo3(admin,"EVENTOS_FREE")),
    categorias: catalogs.categorias || [],
    lugares: [...catalogs.lugares || [], ...sedes],
    partners: catalogs.partners || [],
    eventos: vip,
    eventos_free: free
  };
}

// reconstruccion/worker/modules/eventos-v3.js
var text30 = (v) => String(v ?? "").trim();
var bool12 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text30(v).toLowerCase());
var isFree = (e) => text30(e && e.nivel).toUpperCase() === "FREE";
var isVip = (e) => !isFree(e);
var norm4 = (v) => text30(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
function id(prefix) {
  return prefix + "-" + crypto.randomUUID();
}
function cityExists2(territory, cid) {
  return (territory && territory.ciudades || []).some((c) => text30(c.ciudad_id || c.id) === text30(cid));
}
async function validateLocation({ db, cache, advertiserId, row, fallbackCity = "", allowVirtualLinkless=false }) {
  const city = text30(row.ciudad_id || fallbackCity);
  const mode=text30(row.modalidad).toUpperCase();
  const tipo=text30(row.tipo_lugar).toUpperCase();
  const virtual=mode==='VIRTUAL'||tipo.includes('VIRTUAL')||tipo.includes('ONLINE');
  const mixed=['MIXTO','HIBRIDO','HÍBRIDO'].includes(mode);
  if((virtual||mixed)&&!allowVirtualLinkless){
    const link=text30(row.url_virtual||row.link_virtual||row.enlace_virtual||row.web||row.maps);
    let valid=false;try{valid=['https:','http:'].includes(new URL(link).protocol)}catch(_){}
    if(!valid)throw new Error('Ingresá un enlace virtual válido (https://...).');
  }
  if(city==='VIRTUAL'){
    if(!virtual||mixed)throw new Error('Un evento presencial o mixto necesita una ciudad física.');
    if(text30(row.sede_id||row.lugar_id||row.direccion))throw new Error('Un evento solamente virtual no admite sede ni dirección física.');
    return city;
  }
  if (!city) throw new Error("Falta ciudad.");
  const territory = await cache.get("territorio:public:v1");
  if (!territory || !cityExists2(territory, city)) throw new Error("La ciudad indicada no existe o no está activa.");
  const sedeId = text30(row.sede_id), lugarId = text30(row.lugar_id), lugarTexto = text30(row.lugar_texto || row.lugar), direccion = text30(row.direccion);
  if (virtual && !mixed) {
    if (!text30(row.url_virtual || row.link_virtual || row.enlace_virtual || row.web || row.maps)) throw new Error("El evento virtual necesita enlace o plataforma.");
    return city;
  }
  if (sedeId) {
    const sedes = await db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId, 500);
    const sede = sedes.find(s => text30(s.sede_id || s.id) === sedeId);
    if (!sede || text30(sede.anunciante_id) !== text30(advertiserId) || text30(sede.ciudad_id) !== city) throw new Error("La sede no pertenece al anunciante/ciudad.");
    return city;
  }
  if (lugarId) {
    const catalog = await getEventosCatalogs(cache);
    const lugar = (catalog.lugares || []).find(l => text30(l.lugar_id || l.id) === lugarId);
    if (!lugar || text30(lugar.ciudad_id) !== city) throw new Error("El lugar no pertenece a la ciudad.");
    return city;
  }
  if (!lugarTexto) throw new Error("Falta indicar el lugar del evento.");
  if (!direccion) throw new Error("El lugar necesita dirección física.");
  return city;
}
async function validateEvent({ db, cache, advertiserId, data, validateLocations = true, previousProgramacion = [], level="VIP" }) {
  if (!text30(data.nombre_evento)) throw new Error("Falta nombre del evento.");
  if (!text30(data.categoria || data.categoria_id)) throw new Error("Falta categoría.");
  if (!text30(data.ciudad_id)) throw new Error("Falta ciudad.");
  if (!text30(data.fecha_desde)) throw new Error("Falta fecha del evento.");
  if (!validateLocations) return;
  const programacion = Array.isArray(data.programacion) ? data.programacion : [];
  const programIds = programacion.map((p) => text30(p?.evento_programacion_id || p?.id)).filter(Boolean);
  if (new Set(programIds).size !== programIds.length) throw new Error("Instancia repetida en la programación.");
  if (programacion.length) {
    for (let i = 0; i < programacion.length; i++) {
      const row = programacion[i] || {};
      if (!text30(row.fecha)) throw new Error("Falta fecha en la instancia " + (i + 1) + ".");
      const previous = previousProgramacion.find((p) => text30(p.evento_programacion_id || p.id) === text30(row.evento_programacion_id || row.id));
      const placeKeys = ["ciudad_id", "modalidad", "tipo_lugar", "sede_id", "lugar_id", "lugar_texto", "lugar", "direccion", "maps", "url_virtual", "link_virtual", "enlace_virtual", "web"];
      if (previous && placeKeys.every((k) => text30(previous[k]) === text30(row[k]))) continue;
      await validateLocation({ db, cache, advertiserId, row:{modalidad:data.modalidad,url_virtual:data.url_virtual,...row}, fallbackCity: data.ciudad_id,allowVirtualLinkless:level==="FREE" });
    }
  } else {
    await validateLocation({ db, cache, advertiserId, row: data, fallbackCity: data.ciudad_id,allowVirtualLinkless:level==="FREE" });
  }
}
async function replaceProgramacion({ db, eventId, programacion, fallbackCity, previous = void 0, embedded = false }) {
  const old = previous ?? await db.queryEqual("evento_programacion", "evento_id", eventId, 500);
  const byId = new Map(old.map((p) => [text30(p.evento_programacion_id || p.id), p]));
  const kept = /* @__PURE__ */ new Set(), saved = [];
  let orden = 0, changed = false;
  for (const raw of Array.isArray(programacion) ? programacion : []) {
    const city = text30(raw.ciudad_id || fallbackCity);
    const requested = text30(raw.evento_programacion_id || raw.id);
    const current = byId.get(requested);
    const pid = current ? requested : id("evp");
    if (kept.has(pid)) throw new Error("Instancia repetida en la programación.");
    kept.add(pid);
    const { id: legacyId, evento_programacion_id: legacyProgramId, actualizado, ...fields } = raw;
    orden++;
    const patch = {
      ...fields,
      evento_programacion_id: pid,
      evento_id: eventId,
      ciudad_id: city,
      sede_id: text30(raw.sede_id),
      lugar_id: text30(raw.lugar_id),
      lugar_texto: text30(raw.lugar_texto || raw.lugar),
      direccion: text30(raw.direccion),
      maps: text30(raw.maps),
      fecha: text30(raw.fecha),
      hora_desde: text30(raw.hora_desde),
      hora_hasta: text30(raw.hora_hasta),
      activo: raw.activo === false ? false : true,
      orden: Number(raw.orden || orden)
    };
    if (current && Object.entries(patch).every(([k, v]) => JSON.stringify(current[k]) === JSON.stringify(v))) {
      saved.push(current);
      continue;
    }
    saved.push(embedded ? patch : await db.patch("evento_programacion", pid, changedFieldsV1(current, { ...patch, actualizado: (/* @__PURE__ */ new Date()).toISOString() }), { mustExist: !!current, newDocument: !current }));
    changed = true;
  }
  for (const [pid] of byId) if (!kept.has(pid)) {
    if(!embedded)await db.delete("evento_programacion", pid);
    changed = true;
  }
  Object.defineProperty(saved, "changed", { value: changed });
  return saved;
}
/** @param {any} options */
async function quota2({ db, advertiserId, max, free = false, exclude = "" }) {
  const own = await db.queryEqual("eventos", "anunciante_id", advertiserId, 500);
  const rows = own.filter((e) => !e.eliminado && (free ? isFree(e) : isVip(e)));
  return {
    total: rows.length,
    active: rows.filter((e) => text30(e.evento_id || e.id) !== text30(exclude) && !bool12(e.pausado)).length,
    max: Number(max || 0),
    totalMax: cupoGuardado(max)
  };
}
function freeDuplicateMatchesV75(rows,data){
 const city=text30(data.ciudad_id),name=norm4(data.nombre_evento),place=norm4(data.lugar||data.lugar_texto),date=text30(data.fecha_desde);
 return (rows||[]).filter(isFree).filter(e=>!e.eliminado).filter(e=>text30(e.ciudad_id)===city&&date&&text30(e.fecha_desde)===date&&((name&&norm4(e.nombre_evento)===name)||(place&&norm4(e.lugar||e.lugar_texto)===place))).slice(0,5);
}
async function eventDuplicateCheckV75({db,advertiserId,data}){
 const city=text30(data.ciudad_id);if(!city)return [];
 if(db.cachedPanelRows){
  const own=advertiserId?await db.cachedPanelRows('eventos','anunciante_id',advertiserId):null;
  const matches=freeDuplicateMatchesV75(own,data);
  if(matches.length){db.notePanelCacheCheck?.({collection:'eventos',field:'ciudad_id',cache:'duplicates',result:'hit',basis:'coincidencia_en_lista_del_anunciante'});return matches;}
 }
 const read=db.panelReadDb?db.panelReadDb():db;
 return freeDuplicateMatchesV75(await read.queryEqual('eventos','ciudad_id',city,500),data);
}
async function similarFree({db,advertiserId,data}){
 return eventDuplicateCheckV75({db,advertiserId,data});
}
function removeFreeEventLinks(row){
  if(!row||typeof row!=='object')return row;
  for(const field of ['url_virtual','url_inscripcion','link_virtual','enlace_virtual'])delete row[field];
  if(Array.isArray(row.programacion))row.programacion=row.programacion.map(p=>removeFreeEventLinks({...p}));
  return row;
}
/** @param {any} admin */
function freeEventAssignedQuota114(admin){
 const root=admin?.funcionalidades_config||{},keys=['EVENTOS_FREE','EV_FREE','EVFREE','EVENTOS FREE'];
 const cfg=root.EVENTOS_FREE||Object.entries(root).find(([key])=>keys.includes(String(key).trim().toUpperCase()))?.[1]||{};
 for(const v of [cfg.cantidad,cfg.cupo,cfg.max,cfg.maximo,admin?.eventos_free_cant]){if(v===undefined||v===null||v==='')continue;const n=Number(v);if(Number.isSafeInteger(n)&&n>=0)return n;}
 return 5;
}
/** @param {any} admin */
function freeEventPolicyV95(admin){
 const cfg=admin?.funcionalidades_config?.EVENTOS_FREE||{};
 return {sin_limites:cfg.sin_limites===true,altas_mensuales_max:freeEventAssignedQuota114(admin),dias_entre_ediciones:7};
}
/** @param {any} value */
function freeEventMonthV95(value=Date.now()){
 const date=new Date(value);return Number.isFinite(date.getTime())?new Date(date.getTime()-3*3600000).toISOString().slice(0,7):'';
}
/** @param {any[]} rows @param {string} month */
function freeEventMonthlyRowsV95(rows,month){
 return rows.filter(isFree).filter(e=>(e.cupo_mes||freeEventMonthV95(e.fecha_carga||e.creado))===month);
}
/** @param {any} row @param {any} policy */
function freeEventEditDateV95(row,policy){
 if(policy.sin_limites||!row?.ultima_edicion_free)return '';
 const time=Date.parse(row.ultima_edicion_free);return Number.isFinite(time)?new Date(time+7*86400000).toISOString():'';
}
/** @param {any} data */
function freeEventProtectedV95(data){
 const copy={...data};for(const k of ['cupo_mes','cupo_slot','ultima_edicion_free','eliminado','fecha_carga','creado','creado_en','fecha_aceptacion','declaracion_publicacion','moderado_por','moderado_en'])delete copy[k];return copy;
}
/** @param {any} options */
async function createEventV3({ db, cache, advertiserId, payload, max, advertiser, level = "VIP" }) {
  const data = level==="FREE"?freeEventProtectedV95(payload && typeof payload === "object" ? payload : {}):(payload && typeof payload === "object" ? payload : {});
  const free = level === "FREE";
  const policy=free?freeEventPolicyV95(await db.get("anunciantes_administracion",advertiserId)):null;
  const unlimited=!!policy?.sin_limites;
  if(free)removeFreeEventLinks(data);
  if (!unlimited && Number(max || 0) <= 0) throw new Error("El anunciante no tiene cupo de " + (free ? "Eventos Free" : "Eventos") + ".");
  await validateEvent({ db, cache, advertiserId, data, level });
  const q = await quota2({ db, advertiserId, max, free });
  if (!unlimited && q.max <= 0) throw new Error("El anunciante no tiene cupo de " + (free ? "Eventos Free" : "Eventos") + ".");
  if (!unlimited && q.active >= q.max) throw new Error("Alcanzaste el máximo de eventos activos.");
  if (!unlimited && q.total >= q.totalMax) throw new Error("Alcanzaste el máximo de eventos guardados.");
  if (free && !bool12(data.confirmar_similar)) {
    const dup = await similarFree({ db, advertiserId, data });
    if (dup.length) return { success: false, requires_confirmation: true, duplicados: dup };
  }
  const month=freeEventMonthV95();
  const own=free?await db.queryEqual("eventos","anunciante_id",advertiserId,500):[];
  const monthly=freeEventMonthlyRowsV95(own,month);
  const legacy=monthly.filter(e=>!e.cupo_slot);
  if(free&&!unlimited&&monthly.length>=policy.altas_mensuales_max)throw new Error("Alcanzaste el cupo de "+policy.altas_mensuales_max+" altas de Eventos Free de este mes. Borrar un evento no recupera el cupo.");
  const now = (/* @__PURE__ */ new Date()).toISOString(), eventId = id(free ? "free" : "vip");
  const doc = {
    ...data,
    ...adultFields(null,data),
    evento_id: eventId,
    anunciante_id: advertiserId,
    id_anunciante: advertiserId,
    nivel: free ? "FREE" : "VIP",
    pausado: false,
    acepta_responsabilidad: free ? bool12(data.acepta_responsabilidad) : true,
    fecha_aceptacion: now,
    fecha_carga: now,
    actualizado: now,
    organizador: text30(data.organizador || advertiser && advertiser.nombre),
    logo_organizador: text30(data.logo_organizador || advertiser && advertiser.logo)
  };
  delete doc.confirmar_similar;
  delete doc.programacion;
  const programacion = await replaceProgramacion({ db, eventId, programacion: data.programacion, fallbackCity: doc.ciudad_id, previous: [], embedded:true });
  doc.programacion=programacion;doc.programacion_version=2;
  let saved;
  if(free&&!unlimited){
    const prefix="free-m95-"+encodeURIComponent(advertiserId)+"-"+month+"-";
    const occupied=new Set(monthly.map(e=>Number(e.cupo_slot)).filter(Boolean));
    for(let slot=1;slot<=policy.altas_mensuales_max-legacy.length;slot++){
      if(occupied.has(slot))continue;
      const candidate=prefix+slot;
      try{
        doc.evento_id=candidate;doc.cupo_mes=month;doc.cupo_slot=slot;
        for(const row of programacion)row.evento_id=candidate;
        saved=await db.patch("eventos",candidate,doc,{newDocument:true,mustNotExist:true});break;
      }catch(error){if(!/ALREADY_EXISTS|FAILED_PRECONDITION|409|412/.test(String(error?.message)))throw error;}
    }
    if(!saved)throw new Error("Alcanzaste el cupo de "+policy.altas_mensuales_max+" altas de Eventos Free de este mes. Borrar un evento no recupera el cupo.");
  }else saved=await db.patch("eventos",eventId,doc,{newDocument:true,mustNotExist:true});
  await syncEventV2({ db, cache, next: saved, programacion });
  return {
    success: true,
    created: true,
    evento_id: saved.evento_id,
    estado_moderacion: saved.estado_moderacion,
    evento: { ...saved, programacion }
  };
}
/** @param {any} options */
async function updateEventV3({ db, cache, advertiserId, payload, level = "VIP" }) {
  const data = level==="FREE"?freeEventProtectedV95(payload && typeof payload === "object" ? payload : {}):(payload && typeof payload === "object" ? payload : {}), eventId = text30(data.evento_id);
  if (!eventId) throw new Error("Falta evento_id.");
  const current = await db.get("eventos", eventId);
  const wanted = level === "FREE" ? isFree(current) : isVip(current);
  if (!current || current.eliminado || text30(current.anunciante_id || current.id_anunciante) !== text30(advertiserId) || !wanted) throw new Error("El evento no pertenece al anunciante.");
  if(level==='FREE')removeFreeEventLinks(data);
  const next = { ...current };
  if(level==='FREE')removeFreeEventLinks(next);
  for (const [k, v] of Object.entries(data)) if (!["evento_id", "programacion", "programacion_version"].includes(k)) next[k] = v;
  const hasDataChanges = Object.keys(changedFieldsV1(current, next)).length > 0;
  Object.assign(next,adultFields(current,data));
  next.evento_id = eventId;
  next.anunciante_id = advertiserId;
  next.id_anunciante = advertiserId;
  next.nivel = level;
  next.actualizado = (/* @__PURE__ */ new Date()).toISOString();
  const hasProgramacion = Object.prototype.hasOwnProperty.call(data, "programacion");
  const locationChanged = ["ciudad_id", "modalidad", "sede_id", "lugar_id", "tipo_lugar", "lugar_texto", "lugar", "direccion", "maps", "url_virtual", "link_virtual", "enlace_virtual", "web"].some((k) => Object.prototype.hasOwnProperty.call(data, k) && !sameValueV1(data[k], current[k]));
  const previousProgramacion = await getPreparedRelationsV1({ cache, type: "event", id: eventId, current, load: () => db.queryEqual("evento_programacion", "evento_id", eventId, 500) });
  const validation = { ...next, programacion: Object.prototype.hasOwnProperty.call(data, "programacion") ? data.programacion : previousProgramacion };
  await validateEvent({ db, cache, advertiserId, data: validation, validateLocations: hasProgramacion || locationChanged, previousProgramacion,level });
  if (!hasDataChanges && !hasProgramacion) return {
    success: true,
    updated: false,
    evento_id: eventId,
    estado_moderacion: current.estado_moderacion,
    evento: { ...current, programacion: previousProgramacion }
  };
  let editVersion=null,policy=null;
  const scheduleChanged=hasProgramacion&&!sameValueV1(data.programacion,previousProgramacion);
  if(level==='FREE'&&(hasDataChanges||scheduleChanged)){
    policy=freeEventPolicyV95(await db.get("anunciantes_administracion",advertiserId));
    if(!policy.sin_limites){
      const cachedAvailable=freeEventEditDateV95(current,policy);
      if(cachedAvailable&&Date.parse(cachedAvailable)>Date.now())throw httpError("Podés volver a modificar este evento el "+new Date(cachedAvailable).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})+".",409);
      editVersion=await db.getVersioned("eventos",eventId);
      if(!editVersion.doc||editVersion.doc.eliminado)throw new Error("El evento ya no está disponible.");
      if(!sameValueV1(editVersion.doc,current))throw new Error("El evento cambió. Volvé a abrirlo antes de guardar.");
      const available=freeEventEditDateV95(editVersion.doc,policy);
      if(available&&Date.parse(available)>Date.now())throw httpError("Podés volver a modificar este evento el "+new Date(available).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})+".",409);
    }
  }
  let programacion = validation.programacion;
  if (Object.prototype.hasOwnProperty.call(data, "programacion")) {
    programacion = await replaceProgramacion({ db, eventId, programacion: data.programacion, fallbackCity: next.ciudad_id, previous: previousProgramacion, embedded:Number(current.programacion_version)===2 });
  }
  if (!hasDataChanges && !programacion.changed) return {
    success: true,
    updated: false,
    evento_id: eventId,
    estado_moderacion: current.estado_moderacion,
    evento: { ...current, programacion }
  };
  if(Number(current.programacion_version)===2)next.programacion=programacion;
  const fields = [...Object.keys(data).filter((k) => !["evento_id", "anunciante_id", "id_anunciante", "nivel", "programacion", "programacion_version", "id"].includes(k)), "estado_moderacion", "estado", ...(Number(current.programacion_version)===2?["programacion"]:[])];
  const patch = changedFieldsV1(current, next, { touch: !!programacion.changed, fields });
  if(level==='FREE'&&Object.keys(patch).length)patch.ultima_edicion_free=new Date().toISOString();
  const saved = Object.keys(patch).length ? await db.patch("eventos", eventId, patch, { mustExist: true,...(editVersion?.updateTime?{updateTime:editVersion.updateTime}:{}) }) : current;
  await syncEventV2({ db, cache, current, next: saved, previousProgramacion, programacion });
  return {
    success: true,
    updated: true,
    evento_id: eventId,
    estado_moderacion: saved.estado_moderacion,
    evento: { ...saved, programacion: Array.isArray(programacion) ? programacion : [] }
  };
}
/** @param {any} options */
async function pauseEventV3({ db, cache, advertiserId, payload, max, level = "VIP" }) {
  const eventId = text30(payload && payload.evento_id);
  if (!eventId) throw new Error("Falta evento_id.");
  const current = await db.get("eventos", eventId);
  const wanted = level === "FREE" ? isFree(current) : isVip(current);
  if (!current || current.eliminado || text30(current.anunciante_id || current.id_anunciante) !== text30(advertiserId) || !wanted) throw new Error("El evento no pertenece al anunciante.");
  const pause = bool12(payload && (payload.pause !== void 0 ? payload.pause : payload.pausado));
  if (!pause && bool12(current.pausado)) {
    const q = await quota2({ db, advertiserId, max: typeof max === "function" ? await max() : max, free: level === "FREE", exclude: eventId });
    if (level!=="FREE"||!freeEventPolicyV95(await db.get("anunciantes_administracion",advertiserId)).sin_limites)if (q.active >= q.max) throw new Error("Alcanzaste el máximo de eventos activos.");
  }
  const patch = changedFieldsV1(current, { pausado: pause, actualizado: (/* @__PURE__ */ new Date()).toISOString() });
  if (!Object.keys(patch).length) return { success: true, updated: false, evento_id: eventId, evento: current };
  const saved = await db.patch("eventos", eventId, patch, { mustExist: true });
  await syncEventV2({ db, cache, current, next: saved });
  return { success: true, evento_id: eventId, evento: saved };
}
/** @param {any} options */
async function deleteEventV3({ db, cache, advertiserId, payload, level = "VIP" }) {
  const eventId = text30(payload && payload.evento_id);
  if (!eventId) throw new Error("Falta evento_id.");
  const current = await db.get("eventos", eventId);
  const wanted = level === "FREE" ? isFree(current) : isVip(current);
  if (!current || current.eliminado || text30(current.anunciante_id || current.id_anunciante) !== text30(advertiserId) || !wanted) throw new Error("El evento no pertenece al anunciante.");
  const programas = await getPreparedRelationsV1({cache,type:'event',id:eventId,current,load:()=>db.queryEqual("evento_programacion", "evento_id", eventId, 500)});
  if(db.rememberPanelRows)db.rememberPanelRows('evento_programacion',programas);
  for (const p of Number(current.programacion_version)===2?[]:programas) {
    const pid = text30(p.evento_programacion_id || p.id);
    if (pid) await db.delete("evento_programacion", pid);
  }
  // Preserve only the monthly quota receipt, never the deleted public content.
  if(level==='FREE'&&(current.cupo_slot||freeEventMonthV95(current.fecha_carga||current.creado)===freeEventMonthV95())){
    const receipt=Object.fromEntries(Object.keys(current).filter(k=>k!=='id').map(k=>[k,null]));
    Object.assign(receipt,{evento_id:eventId,anunciante_id:current.anunciante_id,nivel:'FREE',cupo_mes:current.cupo_mes||freeEventMonthV95(current.fecha_carga||current.creado),cupo_slot:current.cupo_slot||null,fecha_carga:current.fecha_carga||current.creado,eliminado:true,estado:'ELIMINADO',pausado:true,programacion:[],programacion_version:2});
    await db.patch("eventos",eventId,receipt,{mustExist:true,quotaReceiptOnly:true});
  }else await db.delete("eventos", eventId, { mustExist: true });
  await syncEventV2({ db, cache, current, next: null, previousProgramacion: programas });
  return { success: true, deleted: true, evento_id: eventId };
}
async function duplicateVipV3({ db, cache, advertiserId, payload, max, advertiser }) {
  const sourceId = text30(payload && (payload.evento_id || payload.source_id));
  if (!sourceId) throw new Error("Falta evento_id.");
  const source = await db.get("eventos", sourceId);
  if (!source || text30(source.anunciante_id || source.id_anunciante) !== text30(advertiserId) || !isVip(source)) throw new Error("El evento no pertenece al anunciante.");
  const programacion = await getPreparedRelationsV1({cache,type:"event",id:sourceId,current:source,load:()=>db.queryEqual("evento_programacion","evento_id",sourceId,500)});
  const copy = { ...source, programacion, nombre_evento: text30(payload.nombre_evento || text30(source.nombre_evento) + " - copia") };
  for (const k of ["evento_id", "id", "fecha_carga", "actualizado", "estado_moderacion", "estado", "moderado_por", "moderado_en"]) delete copy[k];
  return createEventV3({ db, cache, advertiserId, payload: copy, max, advertiser, level: "VIP" });
}

// reconstruccion/worker/modules/actividades.js
async function actividadesPanelData({ db, cache, advertiserId, categorias, lugares, featureAllowed, cupoMax }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !featureAllowed(admin)) return { success: false, message: "No tenés habilitado el módulo Actividades." };
  const [actividades, sedes, advertiser] = await Promise.all([
    db.queryEqual("actividades", "anunciante_id", advertiserId,500),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId,500),
    db.get("anunciantes",advertiserId)
  ]);
  const conHorarios = await Promise.all(actividades.map(async (a) => ({
    ...a,
    ...(rejectedActivity(a)?{estado:"RECHAZADA",estado_moderacion:"RECHAZADO",aprobado:false}:{}),
    horarios: await getPreparedRelationsV1({cache,type:"activity",id:String(a.actividad_id||a.id||""),current:a,load:()=>db.queryEqual("actividad_horarios","actividad_id",String(a.actividad_id||a.id||""),500)})
  })));
  const max = Number(cupoMax(admin) || 0);
  const activas = conHorarios.filter((a) => a.activo !== false && String(a.estado || "").toUpperCase() !== "PAUSADA").length;
  return {
    success: true,
    advertiser:advertiser||{},
    permisos: { actividades: true, actividades_cant: max },
    cupo: { max, activas, total: conHorarios.length, totalMax: cupoGuardado(max) },
    lugares: lugares || [],
    sedes,
    categorias: categorias || [],
    actividades: conHorarios
  };
}

// reconstruccion/worker/modules/actividades-v2.js
var text31 = (v) => String(v ?? "").trim();
var bool13 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text31(v).toLowerCase());
function today() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1e3);
  return d.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = /* @__PURE__ */ new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}
function id2(prefix) {
  return prefix + "-" + crypto.randomUUID();
}
function quota3(admin) {
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config.ACTIVIDADES || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin.actividades_cant]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
function enabled(admin) {
  if (bool13(admin && admin.actividades)) return true;
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text31(admin && admin.funcionalidades).split(/[;,|\n]/);
  return raw.map((x) => text31(x).toUpperCase()).includes("ACTIVIDADES");
}
async function validateSchedule({ db, cache, advertiserId, h }) {
  const city = text31(h && h.ciudad_id);
  if (!city) throw new Error("Cada horario necesita ciudad.");
  const territory = await cache.get("territorio:public:v1");
  if (!territory || (territory.ciudades || []).every((c) => text31(c.ciudad_id || c.id) !== city)) throw new Error("Hay un horario con ciudad inexistente.");
  const type = text31(h.tipo_lugar).toUpperCase();
  const virtual = type.includes("VIRTUAL") || type.includes("ONLINE");
  if (virtual) {
    if (!text31(h.url_virtual || h.link_virtual || h.enlace_virtual || h.web || h.maps)) throw new Error("La actividad virtual necesita enlace o plataforma.");
    return;
  }
  if (text31(h.sede_id)) {
    const sede = await db.get("anunciantes_sedes", text31(h.sede_id));
    if (!sede || text31(sede.anunciante_id) !== text31(advertiserId) || text31(sede.ciudad_id) !== city) throw new Error("La sede no corresponde al anunciante/ciudad.");
    return;
  }
  if (!text31(h.lugar_texto) || !text31(h.direccion)) throw new Error("El lugar físico necesita nombre y dirección.");
}
async function activitySaveV2({ db, cache, advertiserId, body }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !enabled(admin)) throw new Error("No tenés habilitado el módulo Actividades.");
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : {};
  const own = await db.queryEqual("actividades", "anunciante_id", advertiserId);
  const max = quota3(admin), totalMax = cupoGuardado(max);
  let activityId = text31(payload.actividad_id), current = null;
  if (activityId) {
    current = await db.get("actividades", activityId);
    if (!current || text31(current.anunciante_id) !== text31(advertiserId)) throw new Error("Actividad no encontrada.");
  } else {
    const active4 = own.filter((a) => bool13(a.activo) && text31(a.estado).toUpperCase() !== "PAUSADA").length;
    if (max <= 0) throw new Error("actividades_sin_cupo");
    if (own.length >= totalMax) throw new Error("actividades_maximo_guardadas");
    if (active4 >= max) throw new Error("actividades_cupo_activo_completo");
    activityId = id2("ACT");
  }
  for (const h of Array.isArray(payload.horarios) ? payload.horarios : []) await validateSchedule({ db, cache, advertiserId, h });
  const oldSchedules = activityId ? await db.queryEqual("actividad_horarios", "actividad_id", activityId) : [];
  const oldCities = [...new Set(oldSchedules.map((h) => text31(h.ciudad_id)).filter(Boolean))];
  const hoy = today();
  const doc = {
    ...current || {},
    ...payload,
    ...adultFields(current,payload),
    actividad_id: activityId,
    anunciante_id: advertiserId,
    aprobado: current ? bool13(current.aprobado) : false,
    activo: current ? bool13(current.activo) : true,
    estado: current ? text31(current.estado || "ACTIVA") : "PENDIENTE",
    vigente_desde: current ? text31(current.vigente_desde || hoy) : hoy,
    vigente_hasta: current ? text31(current.vigente_hasta || addDays(hoy, 30)) : addDays(hoy, 30),
    creado: current ? text31(current.creado || (/* @__PURE__ */ new Date()).toISOString()) : (/* @__PURE__ */ new Date()).toISOString(),
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  };
  delete doc.horarios;
  if (!text31(doc.nombre)) throw new Error("Falta nombre de la actividad.");
  if (!text31(doc.categoria)) throw new Error("Falta categoría.");
  await db.patch("actividades", activityId, doc, { mustExist: !!current, newDocument: !current });
  if (Array.isArray(payload.horarios)) {
    for (const h of oldSchedules) {
      const hid = text31(h.actividad_horario_id || h.id);
      if (hid) await db.delete("actividad_horarios", hid);
    }
    for (const h of payload.horarios) {
      const hid = id2("AH");
      await db.patch("actividad_horarios", hid, {
        ...h,
        actividad_horario_id: hid,
        actividad_id: activityId,
        ciudad_id: text31(h.ciudad_id),
        activo: h.activo === void 0 ? true : bool13(h.activo),
        actualizado: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  await syncActivity({ db, cache, activityId, previousCities: oldCities });
  return { success: true, actividad_id: activityId };
}
async function activityActionV2({ db, cache, advertiserId, action, activityId }) {
  const current = await db.get("actividades", activityId);
  if (!current || text31(current.anunciante_id) !== text31(advertiserId)) throw new Error("Actividad no encontrada.");
  const hs = await db.queryEqual("actividad_horarios", "actividad_id", activityId);
  const cities = [...new Set(hs.map((h) => text31(h.ciudad_id)).filter(Boolean))];
  if (action === "eliminar") {
    for (const h of hs) {
      const hid = text31(h.actividad_horario_id || h.id);
      if (hid) await db.delete("actividad_horarios", hid);
    }
    await db.delete("actividades", activityId, { mustExist: true });
    await syncActivity({ db, cache, activityId, previousCities: cities });
    return { success: true };
  }
  const patch = { actualizado: (/* @__PURE__ */ new Date()).toISOString() };
  if (action === "pausar") {
    patch.activo = false;
    patch.estado = "PAUSADA";
  }
  if (action === "reanudar" || action === "renovar") {
    patch.activo = true;
    patch.estado = "ACTIVA";
    if (action === "renovar") {
      patch.vigente_desde = today();
      patch.vigente_hasta = addDays(today(), 30);
    }
  }
  await db.patch("actividades", activityId, patch, { mustExist: true });
  await syncActivity({ db, cache, activityId, previousCities: cities });
  return { success: true };
}

// reconstruccion/worker/modules/publicidad.js
async function publicidadPanelData({ db, advertiserId, catalogs, featureEnabled: featureEnabled3, configFromAdmin: configFromAdmin2, cambiosHoy, enrichMany }) {
  const [admin, publicidades] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.queryEqual("publicidades", "anunciante_id", advertiserId)
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  if (!featureEnabled3(admin)) return { success: false, message: "El anunciante no tiene PUBLICIDAD habilitada." };
  const config = configFromAdmin2(admin);
  if (enrichMany) await enrichMany(publicidades);
  const activas = publicidades.filter((p) => String(p.estado || "").toUpperCase() === "ACTIVA").length;
  return {
    success: true,
    config,
    cupo: { activas, activas_max: config.activas_max, guardadas: publicidades.length, guardadas_max: config.guardadas_max },
    cambios_activos: await cambiosHoy(advertiserId, config),
    categorias: catalogs.categorias || [],
    ubicaciones: catalogs.ubicaciones || [],
    prioridades: catalogs.prioridades || [],
    publicidades
  };
}

// reconstruccion/worker/modules/publicidad-v2.js
var {publicitySaveV2} = (() => {
const text=v=>String(v??"").trim();



function parseCategoriaKey(value){
  const raw=text(value);
  const idx=raw.indexOf(":");
  if(idx>0){
    return {
      categoria_key:raw,
      ubicacion_id:raw.slice(0,idx),
      categoria_id:raw.slice(idx+1)
    };
  }
  return {categoria_key:raw,ubicacion_id:"",categoria_id:raw};
}

async function publicitySaveV2({db,cache,advertiserId,body,config={prioridad_id:undefined}}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:{};
  const id=text(data.publicidad_id)||("PUB-"+crypto.randomUUID());
  const current=text(data.publicidad_id)?await db.get("publicidades",id):null;
  if(current&&text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");

  const previousSeg=current?await db.queryEqual("publicidad_segmentacion","publicidad_id",id):[];
  const previousCities=[...new Set(previousSeg.map(x=>text(x.ciudad_id)).filter(Boolean))];

  const now=new Date().toISOString();
  const doc={
    ...(current||{}),
    publicidad_id:id,
    anunciante_id:advertiserId,
    ...adultFields(current,data),
    nombre_interno:text(data.nombre_interno??current?.nombre_interno),
    titulo:text(data.titulo??current?.titulo),
    formato:text(data.formato??current?.formato).toUpperCase(),
    cta_texto:text(data.cta_texto??current?.cta_texto),
    cta_tipo:text(data.cta_tipo??current?.cta_tipo).toUpperCase(),
    cta_destino:text(data.cta_destino??current?.cta_destino),
    aprobado:current?current.aprobado:true,
    estado:current?text(current.estado):"INACTIVA",
    vigente_desde:current?text(current.vigente_desde):"",
    vigente_hasta:current?text(current.vigente_hasta):"",
    creado:current?text(current.creado):now,
    actualizado:now
  };
  if(!doc.titulo)throw new Error("Falta título de publicidad.");
  await db.patch("publicidades",id,doc,{mustExist:!!current,newDocument:!current});

  if(Array.isArray(data.media)){
    const old=await db.queryEqual("publicidad_media","publicidad_id",id);
    for(const x of old){
      const xid=text(x.media_id||x.id);
      if(xid)await db.delete("publicidad_media",xid);
    }
    let orden=0;
    for(const m of data.media.filter(x=>text(x&&x.url))){
      orden++;
      const mid="MED-"+crypto.randomUUID();
      await db.patch("publicidad_media",mid,{
        media_id:mid,
        publicidad_id:id,
        tipo_media:text(data.formato||doc.formato).toUpperCase(),
        url:text(m.url),
        poster:text(m.poster),
        orden,
        activo:true,
        actualizado:now
      },{newDocument:true});
    }
  }

  if(Array.isArray(data.ciudades)||Array.isArray(data.categorias)){
    const old=await db.queryEqual("publicidad_segmentacion","publicidad_id",id);
    for(const x of old){
      const xid=text(x.segmentacion_id||x.id);
      if(xid)await db.delete("publicidad_segmentacion",xid);
    }

    const cities=Array.isArray(data.ciudades)?[...new Set(data.ciudades.map(text).filter(Boolean))]:[];
    const cats=Array.isArray(data.categorias)?[...new Set(data.categorias.map(text).filter(Boolean))]:[];

    for(const city of cities){
      for(const raw of cats){
        const cat=parseCategoriaKey(raw);
        if(!cat.ubicacion_id||!cat.categoria_id)continue;

        const sid="SEG-"+crypto.randomUUID();
        await db.patch("publicidad_segmentacion",sid,{
          segmentacion_id:sid,
          publicidad_id:id,
          ciudad_id:city,
          ubicacion_id:cat.ubicacion_id,
          categoria_id:cat.categoria_id,
          categoria_key:cat.categoria_key,
          prioridad_id:text(config.prioridad_id).toUpperCase(),
          activo:true,
          creado:now,
          actualizado:now
        },{newDocument:true});
      }
    }
  }

  await syncPublicity({db,cache,publicityId:id,previousCities});
  return{success:true,publicidad_id:id,created:!current,updated:!!current};
}


return {publicitySaveV2};
})();

// reconstruccion/worker/modules/publicidad-v3.js
var text33 = (v) => String(v ?? "").trim();
function dateKeyArgentina() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1e3);
  return d.toISOString().slice(0, 10);
}
function configFromAdmin(admin) {return publicityContractV101(admin);}
async function publicityActiveChangeV3({ db, cache, advertiserId, ids: ids6 }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin) throw new Error("No existe la administración del anunciante.");
  const cfg = configFromAdmin(admin);
  const selected = [...new Set((Array.isArray(ids6) ? ids6 : []).map(text33).filter(Boolean))];
  if (cfg.activas_max <= 0) throw new Error("sin_cupo_publicidades_activas");
  if (selected.length > cfg.activas_max) throw new Error("supera_publicidades_activas_max");
  const own = await db.queryEqual("publicidades", "anunciante_id", advertiserId, 500);
  const ownIds = new Set(own.map((p) => text33(p.publicidad_id || p.id)).filter(Boolean));
  if (selected.some((id4) => !ownIds.has(id4))) throw new Error("publicidad_no_pertenece_al_anunciante");
  const current = own.filter((p) => text33(p.estado).toUpperCase() === "ACTIVA").map((p) => text33(p.publicidad_id || p.id)).sort();
  const next = [...selected].sort();
  if (JSON.stringify(current) === JSON.stringify(next)) return { success: true, sin_cambios: true };
  const fecha = dateKeyArgentina(), changeId = advertiserId + "_" + fecha;
  const change = await db.get("publicidad_cambios", changeId);
  const usados = Number(change && change.usados || 0);
  if (cfg.cambios_activos_por_dia_max <= 0 || usados >= cfg.cambios_activos_por_dia_max) {
    throw new Error("cambio_activos_diario_agotado");
  }
  const changed = [];
  for (const p of own) {
    const id4 = text33(p.publicidad_id || p.id);
    const should = selected.includes(id4);
    const is = text33(p.estado).toUpperCase() === "ACTIVA";
    if (is === should) continue;
    await db.patch("publicidades", id4, { estado: should ? "ACTIVA" : "INACTIVA", actualizado: (/* @__PURE__ */ new Date()).toISOString() }, { mustExist: true });
    changed.push(id4);
  }
  await db.patch("publicidad_cambios", changeId, {
    cambio_id: changeId,
    anunciante_id: advertiserId,
    fecha,
    usados: usados + 1,
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  });
  for (const id4 of changed) await syncPublicity({ db, cache, publicityId: id4 });
  return { success: true, sin_cambios: false, cambios: changed.length };
}
async function publicityDeleteSafeV3({ db, cache, advertiserId, publicityId }) {
  const id4 = text33(publicityId);
  if (!id4) throw new Error("Falta publicidad_id.");
  const current = await db.get("publicidades", id4);
  if (!current || text33(current.anunciante_id) !== text33(advertiserId)) throw new Error("La publicidad no pertenece al anunciante.");
  if (text33(current.estado).toUpperCase() === "ACTIVA") throw new Error("publicidad_activa_no_eliminable");
  const seg = await db.queryEqual("publicidad_segmentacion", "publicidad_id", id4, 500);
  const media = await db.queryEqual("publicidad_media", "publicidad_id", id4, 500);
  const cities = [...new Set(seg.map((x) => text33(x.ciudad_id)).filter(Boolean))];
  for (const x of seg) {
    const xid = text33(x.segmentacion_id || x.id);
    if (xid) await db.delete("publicidad_segmentacion", xid);
  }
  for (const x of media) {
    const xid = text33(x.media_id || x.id);
    if (xid) await db.delete("publicidad_media", xid);
  }
  await db.delete("publicidades", id4, { mustExist: true });
  await syncPublicity({ db, cache, publicityId: id4, previousCities: cities });
  return { success: true, deleted: true, publicidad_id: id4 };
}

// reconstruccion/worker/modules/efemerides.js
async function efemeridesPanelData({ db, permisos, advertiserId, canSee: canSee3 }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const p = await permisos(advertiserId);
  const jobs = [];
  if (p.efemerides_grl) jobs.push(db.queryEqual("efemerides_bis", "tipo", "GENERAL",500));
  if (p.efemerides_provincial) {
    if (p.todas_provincias) jobs.push(db.queryEqual("efemerides_bis", "tipo", "PROVINCIAL",500));
    else for (const id4 of p.provincias || []) jobs.push(db.queryEqual("efemerides_bis", "provincia_id", id4,500));
  }
  if (p.efemerides_local) {
    if (p.todas_ciudades) jobs.push(db.queryEqual("efemerides_bis", "tipo", "LOCAL",500));
    else for (const id4 of p.ciudades || []) jobs.push(db.queryEqual("efemerides_bis", "ciudad_id", id4,500));
  }
  const groups = await Promise.all(jobs);
  const uniq = /* @__PURE__ */ new Map();
  for (const row of groups.flat()) {
    const id4 = String(row.efemeride_id || row.id || "");
    if (id4) uniq.set(id4, row);
  }
  return { success: true, permisos: p, efemerides: [...uniq.values()].filter((x) => canSee3(x, p)) };
}

// reconstruccion/worker/modules/efemerides-v2.js
var text34 = (v) => String(v ?? "").trim();
var bool14 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text34(v).toLowerCase());
function sanitize(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const out2 = {
    efemeride_id: text34(p.efemeride_id || p.id),
    tipo: text34(p.tipo).toUpperCase(),
    provincia_id: text34(p.provincia_id),
    ciudad_id: text34(p.ciudad_id),
    tipo_fecha: text34(p.tipo_fecha).toUpperCase(),
    nombre: text34(p.nombre),
    descripcion: String(p.descripcion || ""),
    imagen: String(p.imagen || ""),
    activo: p.activo === void 0 ? true : bool14(p.activo),
    origen: text34(p.origen || "WORKER_FIRESTORE")
  };
  if (out2.tipo_fecha === "FIJA") {
    let mes = Number(p.mes || 0), dia = Number(p.dia || 0);
    if ((!mes || !dia) && p.fecha) {
      const m = String(p.fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        mes = Number(m[2]);
        dia = Number(m[3]);
      }
    }
    out2.mes = mes;
    out2.dia = dia;
  }
  if (out2.tipo_fecha === "MOVIL") {
    out2.mes = Number(p.mes || 0);
    out2.semana_mes = Number(p.semana_mes || 0);
    out2.dia_semana = text34(p.dia_semana).toUpperCase();
  }
  return out2;
}
function validate(d) {
  if (!d.tipo) return "Falta tipo";
  if (!d.tipo_fecha) return "Falta tipo_fecha";
  if (!d.nombre) return "Falta nombre";
  if (d.tipo === "LOCAL" && !d.ciudad_id) return "Falta ciudad_id";
  if (d.tipo === "PROVINCIAL" && !d.provincia_id) return "Falta provincia_id";
  if (d.tipo_fecha === "FIJA" && (!d.mes || !d.dia)) return "Faltan mes/dia";
  if (d.tipo_fecha === "MOVIL" && (!d.mes || !d.semana_mes || !d.dia_semana)) return "Faltan datos de fecha móvil";
  return "";
}
function canSee(row, p) {
  const tipo = text34(row.tipo).toUpperCase();
  if (tipo === "GENERAL") return !!p.efemerides_grl;
  if (tipo === "PROVINCIAL") return !!p.efemerides_provincial && (p.todas_provincias || p.provincias.includes(text34(row.provincia_id)));
  if (tipo === "LOCAL") return !!p.efemerides_local && (p.todas_ciudades || p.ciudades.includes(text34(row.ciudad_id)));
  return false;
}
async function efemSaveV2({ db, cache, advertiserId, body, permisos }) {
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  const reqId = text34(payload.efemeride_id || payload.id);
  const existing = reqId ? await db.get("efemerides_bis", reqId) : null;
  if (reqId && !existing) throw new Error("Efeméride no encontrada");
  const merged = existing ? { ...existing, ...payload, efemeride_id: reqId } : payload;
  const data = sanitize(merged), err = validate(data);
  if (err) throw new Error(err);
  if (!canSee(data, permisos)) throw new Error("No autorizado para esta efeméride");
  const id4 = reqId || data.efemeride_id || "EFE-" + crypto.randomUUID();
  data.efemeride_id = id4;
  data.actualizado_en = (/* @__PURE__ */ new Date()).toISOString();
  if (!existing) {
    data.creado_en = data.actualizado_en;
    data.creado_por = advertiserId;
  } else {
    if (existing.creado_en) data.creado_en = existing.creado_en;
    if (existing.creado_por) data.creado_por = existing.creado_por;
  }
  await db.patch("efemerides_bis", id4, data, { mustExist: !!existing });
  await syncEfemeride({ db, cache, efemerideId: id4, previous: existing });
  return { success: true, efemeride: await db.get("efemerides_bis", id4) };
}
async function efemToggleV2({ db, cache, id: id4, activo, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee(existing, permisos)) throw new Error("No autorizado");
  await db.patch("efemerides_bis", id4, { activo: !!activo, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() }, { mustExist: true });
  await syncEfemeride({ db, cache, efemerideId: id4, previous: existing });
  return { success: true };
}
async function efemDeleteV2({ db, cache, id: id4, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee(existing, permisos)) throw new Error("No autorizado");
  await db.delete("efemerides_bis", id4, { mustExist: true });
  await syncEfemeride({ db, cache, efemerideId: id4, previous: existing });
  return { success: true, deleted: true, efemeride_id: id4 };
}

// reconstruccion/worker/modules/farmacias.js
async function farmaciasPanelData({ db, advertiserId, featureAllowed }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !featureAllowed(admin)) return { success: false, message: "Farmacias de turno no habilitado." };
  const [sedes, ciclos, participantes] = await Promise.all([
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId),
    db.queryEqual("farmacias_ciclos", "anunciante_id", advertiserId),
    db.queryEqual("farmacias_participantes", "anunciante_id", advertiserId)
  ]);
  return { success: true, farmacias: sedes, ciclos, participantes };
}

// reconstruccion/worker/modules/farmacias-v2.js
var text35 = (v) => String(v ?? "").trim();
async function farmSaveCycleV2({ db, cache, advertiserId, body, allowedCityIds = [] }) {
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  let id4 = text35(payload.ciclo_id);
  const current = id4 ? await db.get("farmacias_ciclos", id4) : null;
  if (current && text35(current.anunciante_id) && text35(current.anunciante_id) !== text35(advertiserId)) {
    throw new Error("El ciclo no pertenece al anunciante.");
  }
  const merged = { ...current || {}, ...payload };
  const city = text35(merged.ciudad_id);
  if (!city) throw new Error("Falta ciudad.");
  if (allowedCityIds.length && !allowedCityIds.includes(city)) throw new Error("La ciudad no está habilitada para esta cuenta.");
  if (!text35(merged.fecha_inicio)) throw new Error("Falta fecha de inicio.");
  if (!text35(merged.hora_inicio)) throw new Error("Falta hora de inicio.");
  const dur = Math.max(1, Number(merged.duracion_horas || 24));
  const simult = Math.max(1, Math.floor(Number(merged.farmacias_por_turno || 1)));
  if (!id4) id4 = "FAR-" + crypto.randomUUID();
  let nuevos = null;
  if (Array.isArray(payload.participantes)) {
    nuevos = payload.participantes.map((p, i) => ({
      ciclo_id: id4,
      sede_id: text35(p.sede_id),
      orden: Number(p.orden || i + 1),
      activo: true,
      actualizado: (/* @__PURE__ */ new Date()).toISOString()
    })).filter((p) => p.sede_id);
    if (!nuevos.length) throw new Error("Seleccioná al menos una farmacia.");
    if (simult > nuevos.length) throw new Error("La cantidad simultánea supera las farmacias seleccionadas.");
    for (const p of nuevos) {
      const sede = await db.get("anunciantes_sedes", p.sede_id);
      if (!sede) throw new Error("Hay una farmacia/sede inexistente.");
      if (text35(sede.ciudad_id) !== city) throw new Error("Todas las farmacias deben pertenecer a la ciudad del ciclo.");
    }
  }
  const previousCity = text35(current && current.ciudad_id);
  await db.patch("farmacias_ciclos", id4, {
    ciclo_id: id4,
    anunciante_id: advertiserId,
    ciudad_id: city,
    fecha_inicio: text35(merged.fecha_inicio),
    hora_inicio: text35(merged.hora_inicio),
    duracion_horas: dur,
    farmacias_por_turno: simult,
    activo: merged.activo === void 0 ? true : !!merged.activo,
    observaciones: text35(merged.observaciones),
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: !!current, newDocument: !current });
  if (nuevos) {
    const existentes = await db.queryEqual("farmacias_ciclo_sedes", "ciclo_id", id4);
    const keep = new Set(nuevos.map((p) => id4 + "__" + p.sede_id));
    for (const r of existentes) {
      const rid = text35(r.id || id4 + "__" + text35(r.sede_id));
      if (rid && !keep.has(rid)) await db.delete("farmacias_ciclo_sedes", rid);
    }
    for (const p of nuevos) await db.patch("farmacias_ciclo_sedes", id4 + "__" + p.sede_id, p);
  }
  await syncFarmCycle({ db, cache, cycleId: id4, previousCity });
  return { success: true, ciclo_id: id4 };
}

// reconstruccion/worker/routes/panel-v3.js
var text36 = (v) => String(v ?? "").trim();
var truthy2 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text36(v).toLowerCase());
async function bodyOf(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf(url, b = {}) {
  return text36(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf(url, b = {}) {
  return text36(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
function featureEnabled(admin, name) {
  if(String(name||'').trim().toUpperCase()==='PUBLICIDAD')return featureEnabled2(admin,name);
  const key3 = text36(name).toUpperCase();
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text36(admin && admin.funcionalidades).split(/[;,|\n]/);
  const set = new Set(raw.map((x) => text36(x).toUpperCase()).filter(Boolean));
  return set.has(key3) || truthy2(admin && admin[key3.toLowerCase()]);
}
function cupo(admin, name) {
  if(String(name).toUpperCase()==='EVENTOS_FREE')return freeEventAssignedQuota114(admin);
  const key3 = text36(name).toUpperCase();
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config[key3] || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin[key3.toLowerCase() + "_cant"]]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
async function requirePanel(env, request2, aid, moduleName, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (aid && !sessionAllows(s, aid, moduleName, { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
function efemPermisos(admin){
  const a=admin||{},raw=Array.isArray(a.funcionalidades)?a.funcionalidades:text36(a.funcionalidades).split(/[;,|\n]/);
  const flags=new Set(raw.map(v=>text36(v).toUpperCase()));
  const root=a.funcionalidades_config||{},local=root.EFEMERIDES_LOCAL||{},prov=root.EFEMERIDES_PROVINCIAL||{};
  return {
    efemerides_grl:truthy2(a.efemerides_grl)||flags.has('EF GENERAL')||flags.has('EFEMERIDES_GENERAL')||flags.has('EFEMERIDES_GRL'),
    efemerides_provincial:truthy2(a.efemerides_provincial)||flags.has('EF PROVINCIAL')||flags.has('EFEMERIDES_PROVINCIAL'),
    efemerides_local:truthy2(a.efemerides_local)||flags.has('EF LOCAL')||flags.has('EFEMERIDES_LOCAL'),
    todas_provincias:truthy2(a.efemerides_todas_provincias)||truthy2(prov.todas_provincias),
    todas_ciudades:truthy2(a.efemerides_todas_ciudades)||truthy2(local.todas_ciudades),
    provincias:(Array.isArray(prov.provincias)?prov.provincias:Array.isArray(a.efemerides_provincias)?a.efemerides_provincias:[]).map(text36),
    ciudades:(Array.isArray(local.ciudades)?local.ciudades:Array.isArray(a.efemerides_ciudades)?a.efemerides_ciudades:[]).map(text36)
  };
}

async function routePanelV3({ path, request: request2, url, env, db, cache }) {
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body);
    if (action === "login") return json(await subscriberLogin({ env, db, body }));
    if (action === "session") {
      const out2 = await subscriberSession({ env, request: request2 });
      return json(out2, out2.status || 200);
    }
    return null;
  }
  if (path === "/commerce" && request2.method === "GET") {
    const action = actionOf(url), aid = aidOf(url);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel(env, request2, aid, "modificar_datos");
    if (auth.response) return auth.response;
    if (action === "permisos_panel") {
      const admin = await (db.panelAdministration ? db.panelAdministration(aid) : db.get("anunciantes_administracion", aid));
      return json({ success: !!admin, id: aid, administracion: admin || {} }, admin ? 200 : 404);
    }
    if (action === "anunciante") return json(await commercePanelData({ db, advertiserId: aid, catalogs: await getCommerceCatalogs(cache) }));
    return null;
  }
  if (path === "/commerce" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel(env, request2, aid, "modificar_datos", true);
    if (auth.response) return auth.response;
    if (action === "set_datos") {
      const out2 = await commerceSetDatos({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid });
      return json(out2);
    }
    if (action === "set_sedes") {
      const old = await db.queryEqual("anunciantes_sedes", "anunciante_id", aid);
      const oldCities = [...new Set(old.map((x) => text36(x.ciudad_id)).filter(Boolean))];
      const out2 = await commerceSetSedes({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid, affectedCityIds: oldCities });
      return json(out2);
    }
    if (action === "set_relaciones_sede") {
      const out2 = await commerceSetRelacionesSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid });
      return json(out2);
    }
    if (action === "delete_sede") {
      const out2 = await commerceDeleteSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid });
      return json(out2);
    }
    return null;
  }
  if (path === "/promos" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel(env, request2, aid, "promos", !["getpaneldata", "getpromos"].includes(action));
    if (auth.response) return auth.response;
    const cupoFromAdmin = (a) => cupo(a, "PROMOS");
    if (action === "getpaneldata") return json(await promosPanelDataV2({ db, cache, advertiserId: aid, cupoFromAdmin }));
    if (action === "createpromo") return json(await promoCreateV2({ db, cache, advertiserId: aid, body, cupoFromAdmin }));
    if (action === "updatepromo") return json(await promoUpdateV2({ db, cache, advertiserId: aid, body, cupoFromAdmin }));
    if (action === "deletepromo") return json(await promoDeleteV2({ db, cache, advertiserId: aid, body }));
    return null;
  }
  if (path === "/events-new" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const freeAction = action.includes("free");
    const moduleName = freeAction ? "eventos_free" : "eventos";
    const readActions = ["getpaneldata", "paneldata", "bootstrap", "geteventospanel", "getvipevents", "getfreeevents"];
    const auth = await requirePanel(env, request2, aid, moduleName, !readActions.includes(action));
    if (auth.response) return auth.response;
    const admin = await db.get("anunciantes_administracion", aid);
    if (["getpaneldata", "paneldata", "bootstrap", "geteventospanel"].includes(action)) {
      return json(await eventosPanelData({ db, advertiserId: aid, catalogs: await getEventosCatalogs(cache), featureEnabled, cupo, enrichPrograms: null }));
    }
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const advertiser = await db.get("anunciantes", aid);
    if (action === "createvipevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS"), advertiser, level: "VIP" }));
    if (action === "updatevipevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "pausevipevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS"), level: "VIP" }));
    if (action === "deletevipevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "duplicatevipevent" || action === "duplicate") return json(await duplicateVipV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS"), advertiser }));
    if (action === "createfreeevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS_FREE"), advertiser, level: "FREE" }));
    if (action === "updatefreeevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    if (action === "pausefreeevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS_FREE"), level: "FREE" }));
    if (action === "deletefreeevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    return null;
  }
  if (path === "/actividades" && request2.method === "GET" && actionOf(url) === "getpaneldata") {
    const aid = aidOf(url), auth = await requirePanel(env, request2, aid, "actividades");
    if (auth.response) return auth.response;
    const catalogs = await getActividadesCatalogs(cache);
    return json(await actividadesPanelData({
      db,
      cache,
      advertiserId: aid,
      categorias: catalogs.categorias,
      lugares: catalogs.lugares,
      featureAllowed: (a) => featureEnabled(a, "ACTIVIDADES"),
      cupoMax: (a) => cupo(a, "ACTIVIDADES")
    }));
  }
  if (path === "/actividades" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "actividades", true);
    if (auth.response) return auth.response;
    if (action === "guardar") return json(await activitySaveV2({ db, cache, advertiserId: aid, body }));
    if (["renovar", "pausar", "reanudar", "eliminar"].includes(action)) {
      return json(await activityActionV2({ db, cache, advertiserId: aid, action, activityId: text36(body.actividad_id) }));
    }
    return null;
  }
  if (path === "/publicidad" && request2.method === "GET" && actionOf(url) === "getpaneldata") {
    const aid = aidOf(url), auth = await requirePanel(env, request2, aid, "publicidad");
    if (auth.response) return auth.response;
    const catalogs = await getPublicidadCatalogs(cache);
    const admin = await db.get("anunciantes_administracion", aid);
    return json(await publicidadPanelData({
      db,
      advertiserId: aid,
      catalogs,
      featureEnabled: (a) => featureEnabled(a, "PUBLICIDAD"),
      configFromAdmin,
      cambiosHoy: async () => {
        const cfg = configFromAdmin(admin || {}), fecha = new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
        const c = await db.get("publicidad_cambios", aid + "_" + fecha);
        const usados = Number(c && c.usados || 0), max = Number(cfg.cambios_activos_por_dia_max || 0);
        return { usados, max, disponibles: max > 0 ? Math.max(0, max - usados) : 0 };
      },
      enrichMany: null
    }));
  }
  if (path === "/publicidad" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "publicidad", true);
    if (auth.response) return auth.response;
    if (action === "guardar") {
      const admin = await db.get("anunciantes_administracion", aid);
      return json(await publicitySaveV2({
        db,
        cache,
        advertiserId: aid,
        body,
        config: configFromAdmin(admin || {})
      }));
    }
    if (action === "actualizar_activos") return json(await publicityActiveChangeV3({ db, cache, advertiserId: aid, ids: body.publicidad_ids }));
    if (action === "eliminar") return json(await publicityDeleteSafeV3({ db, cache, advertiserId: aid, publicityId: text36(body.publicidad_id) }));
    return null;
  }
  if (path === "/efemerides" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "efemerides", action !== "getpaneldata");
    if (auth.response) return auth.response;
    const readAction=["getpaneldata","paneldata","bootstrap","listar","listar_admin","list"].includes(action);
    const readDb=readAction&&db.panelReadDb?db.panelReadDb():db;
    const admin = await readDb.get("anunciantes_administracion", aid), permisos = efemPermisos(admin || {});
    if (["getpaneldata", "paneldata", "bootstrap", "listar", "listar_admin", "list"].includes(action)) {
      return json(await efemeridesPanelData({ db, permisos: async () => permisos, advertiserId: aid, canSee: () => true }));
    }
    if (action === "guardar" || action === "save") return json(await efemSaveV2({ db, cache, advertiserId: aid, body, permisos }));
    if (action === "activar" || action === "desactivar") {
      const id4 = text36(body.efemeride_id || body.id || body.payload && (body.payload.efemeride_id || body.payload.id));
      return json(await efemToggleV2({ db, cache, id: id4, activo: action === "activar", permisos }));
    }
    if (action === "eliminar" || action === "delete") {
      const id4 = text36(body.efemeride_id || body.id || body.payload && (body.payload.efemeride_id || body.payload.id));
      return json(await efemDeleteV2({ db, cache, id: id4, permisos }));
    }
    return null;
  }
  if (path === "/farmacias" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "turnos_farma", action !== "getpaneldata");
    if (auth.response) return auth.response;
    if (action === "getpaneldata") {
      return json(await farmaciasPanelData({ db, advertiserId: aid, featureAllowed: (a) => featureEnabled(a, "TURNOS_FARMA") || truthy2(a && a.turnos_farma) }));
    }
    if (action === "guardar_ciclo") {
      const admin = await db.get("anunciantes_administracion", aid);
      const territory = await cache.get("territorio:public:v1") || {};
      const allowed = Array.isArray(admin && admin.farmacias_ciudades) && admin.farmacias_ciudades.length ? admin.farmacias_ciudades.map(text36) : (territory.ciudades || []).map((c) => text36(c.ciudad_id || c.id)).filter(Boolean);
      return json(await farmSaveCycleV2({ db, cache, advertiserId: aid, body, allowedCityIds: allowed }));
    }
    return null;
  }
  return null;
}

// reconstruccion/worker/modules/eventos-panel-v2.js
var text37 = (v) => String(v ?? "").trim();
var isFree2 = (e) => text37(e && e.nivel).toUpperCase() === "FREE";
async function eventsPanelDataV2({ db, cache, advertiserId, featureEnabled: featureEnabled3, cupo: cupo3 }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin, advertiser, events, sedes, catalogs] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.get("anunciantes", advertiserId),
    db.queryEqual("eventos", "anunciante_id", advertiserId, 500),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId, 500),
    cache.get("catalogs:eventos:v1")
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  const enriched = await Promise.all(events.filter(e=>!e.eliminado).map(async (e) => ({
    ...e,
    programacion: await getPreparedRelationsV1({cache,type:"event",id:text37(e.evento_id||e.id),current:e,load:()=>db.queryEqual("evento_programacion","evento_id",text37(e.evento_id||e.id),500)})
  })));
  return {
    success: true,
    advertiser: advertiser || { id: advertiserId },
    funcionalidades: {
      eventos: !!featureEnabled3(admin, "EVENTOS"),
      eventos_free: !!featureEnabled3(admin, "EVENTOS_FREE")
    },
    eventos_cant: Number(cupo3(admin, "EVENTOS") || 0),
    eventos_free_limites:{...freeEventPolicyV95(admin),mes:freeEventMonthV95(),usados:freeEventMonthlyRowsV95(events,freeEventMonthV95()).length},
    eventos_free_cant: Number(cupo3(admin, "EVENTOS_FREE") || 0),
    eventos_guardadas_max:cupoGuardado(cupo3(admin,"EVENTOS")),
    eventos_free_guardadas_max:cupoGuardado(cupo3(admin,"EVENTOS_FREE")),
    categorias: catalogs && catalogs.categorias || [],
    lugares: [...catalogs && catalogs.lugares || [], ...sedes],
    partners: catalogs && catalogs.partners || [],
    eventos: enriched.filter((e) => !isFree2(e)),
    eventos_free: enriched.filter(isFree2)
  };
}
async function checkFreeDuplicatesV2({db,advertiserId,payload}){
 return eventDuplicateCheckV75({db,advertiserId,data:payload&&typeof payload==='object'?payload:{}});
}

// reconstruccion/worker/modules/publicidad-panel-v2.js
var {publicidadPanelDataV2} = (() => {
/**
 * PUBLICIDAD PANEL V2
 * Catálogos desde KV. Hijos sólo de las publicidades del anunciante.
 */
const text=v=>String(v??"").trim();

async function publicidadPanelDataV2({db,cache,advertiserId,featureEnabled,configFromAdmin}){
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin,docs,catalogs]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("publicidades","anunciante_id",advertiserId,500),
    getPublicidadCatalogs(cache)
  ]);
  if(!admin)return{success:false,message:"No existe la administración del anunciante."};
  if(!featureEnabled(admin))return{success:false,message:"El anunciante no tiene PUBLICIDAD habilitada."};

  const publicidades=await Promise.all(docs.map(async p=>{
    const id=text(p.publicidad_id||p.id);
    const [media,segmentacion]=await Promise.all([
      getPreparedRelationsV1({cache,type:"publicity-media",id,current:p,load:()=>db.queryEqual("publicidad_media","publicidad_id",id,500)}),
      getPreparedRelationsV1({cache,type:"publicity-seg",id,current:p,load:()=>db.queryEqual("publicidad_segmentacion","publicidad_id",id,500)})
    ]);
    return{...p,media,segmentacion};
  }));

  const config=configFromAdmin(admin);
  const contractKey='publicity:contract:v101:'+advertiserId;
  // Las cuentas anteriores pueden no tener copia; llenar sólo si falta.
  // Gran Hermano actualiza la configuración; consultar no la reescribe.
  if(!await cache.get(contractKey)){
    try{await cache.put(contractKey,{...config,habilitada:featureEnabled(admin)});}
    catch(error){if(!/KV put\(\) limit exceeded for (?:the day|today)/i.test(String(error?.message||error)))throw error;}
  }
  const usage=publicityUsageV101(await cache.get('publicity:usage:v101:'+advertiserId),config);
  const activas=publicidades.filter(p=>text(p.estado).toUpperCase()==="ACTIVA").length;

  return{
    success:true,
    config,
    cupo:{
      activas,
      activas_max:Number(config.activas_max||0),
      guardadas:publicidades.length,
      guardadas_max:Number(config.guardadas_max||0)
    },
    cambios_activos:usage,
    categorias:(catalogs&&catalogs.categorias)||[],
    ubicaciones:(catalogs&&catalogs.ubicaciones)||[],
    prioridades:(catalogs&&catalogs.prioridades)||[],
    publicidades
  };
}
return {publicidadPanelDataV2};
})();

// reconstruccion/worker/modules/farmacias-panel-v3.js
var {farmaciasPanelDataV3} = (() => {
/**
 * FARMACIAS PANEL V3
 * Sin scans globales: ciclos se consultan por anunciante_id.
 */
const text=v=>String(v??"").trim();
const active=v=>!text(v)||["activa","activo","true","1","x"].includes(text(v).toLowerCase());
// Selección territorial desde la guía preparada: el administrador de turnos
// no es necesariamente propietario de las farmacias que participan.
async function pharmacyCatalog(cache,cityIds,cycles){
  const catalogs=(await cache.get("catalogs:commerce:v1"))||{};
  const pharmacyIds=new Set((catalogs.categorias||[]).filter(c=>
    [c.nombre,c.titulo,c.categoria].some(v=>text(v).toLowerCase().includes("farmacia"))
  ).map(c=>text(c.categoria_id||c.id)));
  const participantIds=new Set(cycles.flatMap(c=>(c.participantes||[]).map(p=>text(p.sede_id))));
  const result=new Map();
  await Promise.all(cityIds.map(async city=>{
    const packet=await cache.get("guide:city:v1:"+city);
    for(const card of packet?.anunciantes||[]){
      const categories=Array.isArray(card.categoria_ids)?card.categoria_ids:text(card.categoria_ids||card.categoria_id).split(/[;,|]+/);
      const byCategory=categories.some(id=>pharmacyIds.has(text(id)))||(card.categorias||[]).some(v=>text(v).toLowerCase().includes("farmacia"));
      for(const sede of card.sedes||[]){
        const id=text(sede.sede_id||sede.id);
        if(!id||text(sede.ciudad_id||card.ciudad_id)!==city||!active(sede.estado))continue;
        const byName=[card.nombre,sede.nombre_ref,sede.nombre_sede,sede.nombre].some(v=>text(v).toLowerCase().includes("farmacia"));
        if(!byName&&!byCategory&&!participantIds.has(id))continue;
        // Sólo información de contacto preparada para la vista pública.
        const row={...sede,sede_id:id,anunciante_id:text(card.id||card.anunciante_id),ciudad_id:city,nombre_ref:text(card.nombre||sede.nombre_ref),nombre_sede:text(sede.nombre_sede),estado:"ACTIVA"};
        for(const key of ["telefono","telefono2","telefono3","telefono4","telefono5","whatsapp","whatsapp2","whatsapp3","whatsapp4","whatsapp5","mail","instagram","facebook","logo"])row[key]=text(sede[key]||card[key]);
        result.set(id,row);
      }
    }
  }));
  return [...result.values()].sort((a,b)=>text(a.nombre_ref||a.nombre_sede).localeCompare(text(b.nombre_ref||b.nombre_sede),"es"));
}

async function farmaciasPanelDataV3({db,cache,advertiserId,featureAllowed,allowedCityIds=[]}){
  if(db.panelReadDb)db=db.panelReadDb();
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin||!featureAllowed(admin))return{success:false,message:"Farmacias de turno no habilitado."};

  const [ciclos,territorio]=await Promise.all([
    db.queryEqual("farmacias_ciclos","anunciante_id",advertiserId,500),
    cache.get("territorio:public:v1")
  ]);

  const cicloData=await Promise.all(ciclos.map(async c=>{
    const id=text(c.ciclo_id||c.id);
    const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500);
    return{...c,participantes};
  }));

  const ciudades=allowedCityIds.length
    ? ((territorio&&territorio.ciudades)||[]).filter(c=>allowedCityIds.includes(text(c.ciudad_id||c.id)))
    : ((territorio&&territorio.ciudades)||[]);

  const farmacias=await pharmacyCatalog(cache,ciudades.map(c=>text(c.ciudad_id||c.id)).filter(Boolean),cicloData);
  return{
    success:true,
    farmacias,
    ciclos:cicloData,
    participantes:cicloData.flatMap(c=>Array.isArray(c.participantes)?c.participantes:[]),
    ciudades
  };
}

return {farmaciasPanelDataV3};
})();

// reconstruccion/worker/routes/panel-v4.js
var text40 = (v) => String(v ?? "").trim();
var truthy3 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text40(v).toLowerCase());
async function bodyOf2(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf2(url, b = {}) {
  return text40(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf2(url, b = {}) {
  return text40(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
function farmFeatureEnabled(admin){
  // Mismos nombres históricos que habilitan la pestaña del panel.
  const normalize=v=>String(v??"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  const aliases=new Set(["TURNOSFARMA","FARMACIA","FARMACIAS","FARMACIASTURNO","FARMACIASDETURNO"]);
  const raw=Array.isArray(admin&&admin.funcionalidades)?admin.funcionalidades:String(admin?.funcionalidades??"").trim().split(/[;,|\n]/);
  if(raw.some(v=>aliases.has(normalize(v))))return true;
  return Object.entries(admin||{}).some(([key,value])=>aliases.has(normalize(key))&&(value===true||value===1||["true","1","si","sí","x","activo","activa"].includes(String(value??"").trim().toLowerCase())));
}
// Canonicalizar identificadores heredados en la entrada; las reglas usan PUBLICIDAD.
function canonicalFeatureId112(/** @type {any} */ value){let s=String(value??'').trim();try{s=decodeURIComponent(s);}catch{}s=s.toUpperCase();return s==='PUBLI'?'PUBLICIDAD':s;}
function featureEnabled2(admin, name) {
  const key3 = text40(name).toUpperCase();
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text40(admin && admin.funcionalidades).split(/[;,|\n]/);
  if(key3==='PUBLICIDAD')return raw.map(canonicalFeatureId112).includes('PUBLICIDAD')||truthy3(admin?.publicidad)||truthy3(admin?.publi);
  const set = new Set(raw.map((x) => text40(x).toUpperCase()).filter(Boolean));
  return set.has(key3) || truthy3(admin && admin[key3.toLowerCase()]);
}
function cupo2(admin, name) {
  if(String(name).toUpperCase()==='EVENTOS_FREE')return freeEventAssignedQuota114(admin);
  const key3 = text40(name).toUpperCase();
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config[key3] || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin[key3.toLowerCase() + "_cant"]]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
async function requirePanel2(env, request2, aid, moduleName, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (aid && !sessionAllows(s, aid, moduleName, { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
async function allowedFarmCities({ db, cache, aid }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const admin = await db.get("anunciantes_administracion", aid);
  const territory = await cache.get("territorio:public:v1") || {};
  const cfgRoot = admin && admin.funcionalidades_config && typeof admin.funcionalidades_config === "object" ? admin.funcionalidades_config : {};
  const cfg = cfgRoot.TURNOS_FARMA || cfgRoot.FARMACIAS || cfgRoot.turnos_farma || {};
  const all = truthy3(cfg.todas_ciudades) || text40(admin && admin.turnos_farma) === "*";
  const ids6 = Array.isArray(cfg.ciudades) ? cfg.ciudades.map(text40).filter(Boolean) : text40(admin && admin.turnos_farma).split(/[;,|]+/).map(text40).filter((v) => v && v !== "*");
  if (all || !ids6.length) {
    return (territory.ciudades || []).map((c) => text40(c.ciudad_id || c.id)).filter(Boolean);
  }
  return [...new Set(ids6)];
}
async function routePanelV4(ctx) {
  const { path, request: request2, url, env, cache } = ctx;
  let db = ctx.db;
  if (path === "/events-new" && request2.method === "POST") {
    const body = await bodyOf2(request2), action = actionOf2(url, body), aid = aidOf2(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const freeAction = action.includes("free");
    const moduleName = freeAction ? "eventos_free" : "eventos";
    const readActions = ["getpaneldata", "paneldata", "bootstrap", "geteventospanel", "getfreeeventspaneldata", "getvipevents", "getfreeevents", "checkfreeeventduplicates"];
    const auth = await requirePanel2(env, request2, aid, moduleName, !readActions.includes(action));
    if (auth.response) return auth.response;
    if (["getpaneldata", "paneldata", "bootstrap", "geteventospanel", "getfreeeventspaneldata"].includes(action)) {
      return json(await eventsPanelDataV2({ db, cache, advertiserId: aid, featureEnabled: featureEnabled2, cupo: cupo2 }));
    }
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    if (["createfreeevent", "updatefreeevent"].includes(action) && String(payload.descripcion ?? "").length > 200) return json({success:false,error:"descripcion_free_demasiado_larga",message:"La descripción admite hasta 200 caracteres."},400);
    if (action === "getvipevents" || action === "getfreeevents") {
      const panel = await eventsPanelDataV2({ db, cache, advertiserId: aid, featureEnabled: featureEnabled2, cupo: cupo2 });
      const rows = action === "getfreeevents" ? panel.eventos_free : panel.eventos;
      return json({ success: true, events: rows, eventos: rows, rows });
    }
    if (action === "checkfreeeventduplicates") {
      return json({ success: true, duplicados: await checkFreeDuplicatesV2({ db, advertiserId:aid, payload }) });
    }
    if (db.panelReadDb) { const reads = db.panelReadDb({advertiserId:aid}); db = {...db, get: reads.get, queryEqual: reads.queryEqual}; }
    const creates = ["createvipevent", "createfreeevent", "duplicatevipevent", "duplicate"].includes(action);
    const admin = creates ? await db.get("anunciantes_administracion", aid) : null;
    const advertiser = creates ? await db.get("anunciantes", aid) : null;
    if (action === "createvipevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo2(admin, "EVENTOS"), advertiser, level: "VIP" }));
    if (action === "updatevipevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "pausevipevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: async () => cupo2(await db.get("anunciantes_administracion", aid), "EVENTOS"), level: "VIP" }));
    if (action === "deletevipevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "duplicatevipevent" || action === "duplicate") return json(await duplicateVipV3({ db, cache, advertiserId: aid, payload, max: cupo2(admin, "EVENTOS"), advertiser }));
    if (action === "createfreeevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo2(admin, "EVENTOS_FREE"), advertiser, level: "FREE" }));
    if (action === "updatefreeevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    if (action === "pausefreeevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: async () => cupo2(await db.get("anunciantes_administracion", aid), "EVENTOS_FREE"), level: "FREE" }));
    if (action === "deletefreeevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    return null;
  }
  if (path === "/publicidad" && request2.method === "GET" && actionOf2(url) === "getpaneldata") {
    const aid = aidOf2(url);
    const auth = await requirePanel2(env, request2, aid, "publicidad");
    if (auth.response) return auth.response;
    return json(await publicidadPanelDataV2({
      db,
      cache,
      advertiserId: aid,
      featureEnabled: (a) => featureEnabled2(a, "PUBLICIDAD"),
      configFromAdmin
    }));
  }
  if (path === "/publicidad" && request2.method === "POST") {
    const body = await bodyOf2(request2), action = actionOf2(url, body), aid = aidOf2(url, body);
    const auth = await requirePanel2(env, request2, aid, "publicidad", true);
    if (auth.response) return auth.response;
    if (action === "guardar") return json(await publicitySaveV2({ db, cache, advertiserId: aid, body }));
    if (action === "actualizar_activos") return json(await publicityActiveChangeV3({ db, cache, advertiserId: aid, ids: body.publicidad_ids }));
    if (action === "eliminar") return json(await publicityDeleteSafeV3({ db, cache, advertiserId: aid, publicityId: text40(body.publicidad_id) }));
    return null;
  }
  if (path === "/farmacias" && request2.method === "POST") {
    const body = await bodyOf2(request2), action = actionOf2(url, body), aid = aidOf2(url, body);
    const auth = await requirePanel2(env, request2, aid, "turnos_farma", action !== "getpaneldata");
    if (auth.response) return auth.response;
    const allowed = await allowedFarmCities({ db, cache, aid });
    if (action === "getpaneldata") {
      return json(await farmaciasPanelDataV3({
        db,
        cache,
        advertiserId: aid,
        featureAllowed: farmFeatureEnabled,
        allowedCityIds: allowed
      }));
    }
    if (action === "guardar_ciclo") {
      return json(await farmSaveCycleV2({ db, cache, advertiserId: aid, body, allowedCityIds: allowed }));
    }
    return null;
  }
  return routePanelV3(ctx);
}

// reconstruccion/worker/core/guide-read-model-v2.js
var text41 = (v) => String(v ?? "").trim();
var bool15 = (v) => {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "aprobado", "activo", "activa"].includes(text41(v).toLowerCase());
};
var ids3 = (v) => Array.isArray(v) ? v.map(text41).filter(Boolean) : text41(v).split(/[;,|\n]/).map(text41).filter(Boolean);
var guideCityKey2 = (cityId) => "guide:city:v1:" + text41(cityId);
var guideAdvertiserKey = (aid) => "guide:advertiser:v2:" + text41(aid);
function mapBy2(rows, field) {
  const m = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const id4 = text41(r && r[field] || r && r.id);
    if (id4) m.set(id4, r);
  }
  return m;
}
function relObjects2(values, map, idField) {
  return ids3(values).map((id4) => {
    const x = map.get(id4) || {};
    return { [idField]: id4, nombre: text41(x.nombre), insignia: text41(x.insignia) };
  });
}
function sortCards2(rows) {
  return [...rows].sort((a, b) => text41(a.nombre).localeCompare(text41(b.nombre), "es", { sensitivity: "base" }));
}
function publicAllowed(card) {
  return card && card.aprobado !== false;
}
function upsertCard(rows, card) {
  const aid = text41(card && card.id);
  const out2 = (rows || []).filter((x) => text41(x.id) !== aid);
  if (publicAllowed(card)) out2.push(card);
  return sortCards2(out2);
}
function buildGuideCardBaseV2({ advertiser, admin, sedes, catalogs, territory, cityId }) {
  if (!advertiser) return null;
  const city = text41(cityId);
  const citySedes = (sedes || []).filter((s) => text41(s.ciudad_id) === city);
  if (!city) return null;
  const segMap = mapBy2(catalogs.segmentos, "segmento_id");
  const catMap = mapBy2(catalogs.categorias, "categoria_id");
  const actMap = mapBy2(catalogs.actividades_clave, "actividad_id");
  const actionMap = mapBy2(catalogs.acciones, "accion_id");
  const nodeMap = mapBy2(catalogs.nodos, "nodo_id");
  const segmentoId = text41(advertiser.segmento_id);
  const segmento = segMap.get(segmentoId) || {};
  const categoriaIds = ids3(advertiser.categoria_ids || advertiser.categoria_id);
  const categorias = categoriaIds.map((id4) => catMap.get(id4)).filter(Boolean).map((x) => text41(x.nombre)).filter(Boolean);
  const cityMeta = (territory.ciudades || []).find((x) => text41(x.ciudad_id || x.id) === city) || {};
  return {
    id: text41(advertiser.id || advertiser.anunciante_id),
    nombre: text41(advertiser.nombre),
    redes_web_comunes: advertiser.redes_web_comunes||null,
    ...Object.fromEntries(["pet","eco","gayfriendly"].filter(k=>Object.hasOwn(advertiser,k)).map(k=>[k,advertiser[k]])),
    contenido_adulto:adultFlag(advertiser.contenido_adulto),revision_adulto:advertiser.revision_adulto||"NO_APLICA",estado_moderacion:advertiser.estado_moderacion||"PUBLICADO",
    aprobado: admin && admin.aprobado !== void 0 ? bool15(admin.aprobado) : true,
    nivel: text41(admin && admin.nivel),
    subnivel: text41(admin && admin.subnivel),
    verificado: bool15(admin && admin.verificado),
    gold: bool15(admin && admin.gold),
    segmento_id: segmentoId,
    segmento: text41(segmento.nombre),
    categoria_ids: categoriaIds,
    categorias,
    actividad: text41(advertiser.actividad),
    descripcion: text41(advertiser.descripcion),
    tags: text41(advertiser.tags),
    adicionales: text41(advertiser.adicionales),
    logo: text41(advertiser.logo),
    img1: text41(advertiser.img1),
    img2: text41(advertiser.img2),
    img3: text41(advertiser.img3),
    img4: text41(advertiser.img4),
    img5: text41(advertiser.img5),
    img6: text41(advertiser.img6),
    img7: text41(advertiser.img7),
    img8: text41(advertiser.img8),
    img9: text41(advertiser.img9),
    img10: text41(advertiser.img10),
    link: text41(advertiser.link),
    ciudad_id: city,
    ciudad: text41(cityMeta.ciudad_visible),
    provincia_id: text41(cityMeta.provincia_id),
    provincia: text41(cityMeta.provincia_visible),
    pais_id: text41(cityMeta.pais_id),
    pais: text41(cityMeta.pais_visible),
    sedes: citySedes.map((s) => ({
      sede_id: text41(s.sede_id || s.id),
      nombre_sede: text41(s.nombre_sede),
      web:text41(s.web),
      direccion: text41(s.direccion),
      ciudad_id: city,
      ciudad: text41(s.ciudad || cityMeta.ciudad_visible),
      provincia_id: text41(s.provincia_id || cityMeta.provincia_id),
      provincia: text41(s.provincia || cityMeta.provincia_visible),
      pais_id: text41(s.pais_id || cityMeta.pais_id),
      pais: text41(s.pais || cityMeta.pais_visible),
      codigo_postal: text41(s.codigo_postal),
      lat: s.lat ?? "",
      lng: s.lng ?? "",
      maps: text41(s.maps),
      telefono: text41(s.telefono),
      telefono2: text41(s.telefono2),
      telefono3: text41(s.telefono3),
      telefono4: text41(s.telefono4),
      telefono5: text41(s.telefono5),
      whatsapp: text41(s.whatsapp),
      whatsapp2: text41(s.whatsapp2),
      whatsapp3: text41(s.whatsapp3),
      whatsapp4: text41(s.whatsapp4),
      whatsapp5: text41(s.whatsapp5),
      mail: text41(s.mail),
      mail2: text41(s.mail2),
      mail3: text41(s.mail3),
      instagram: text41(s.instagram),
      facebook: text41(s.facebook),
      youtube: text41(s.youtube),
      tiktok: text41(s.tiktok),
      x: text41(s.x),
      linkedin: text41(s.linkedin),
      estado: text41(s.estado),
      actividades: relObjects2(s.actividad_ids, actMap, "actividad_id"),
      acciones: relObjects2(s.accion_ids, actionMap, "accion_id"),
      nodos: relObjects2(s.nodo_ids, nodeMap, "nodo_id"),
      img1: text41(s.img1),
      img2: text41(s.img2),
      img3: text41(s.img3),
      img4: text41(s.img4),
      img5: text41(s.img5),
      img6: text41(s.img6),
      img7: text41(s.img7),
      img8: text41(s.img8),
      img9: text41(s.img9),
      img10: text41(s.img10)
    }))
  };
}
async function syncGuideAdvertiserV2({ db, cache, advertiserId, affectedCityIds = [] }) {
  const aid = text41(advertiserId);
  const [advertiser, admin, sedes, catalogs, territory, previousBase] = await Promise.all([
    db.get("anunciantes", aid),
    db.get("anunciantes_administracion", aid),
    db.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1"),
    cache.get(guideAdvertiserKey(aid))
  ]);
  const sedeCities = (sedes || []).map((s) => text41(s.ciudad_id)).filter(Boolean);
  const currentCities = [...new Set(sedeCities.length ? sedeCities : [text41(advertiser?.ciudad_id), ...previousBase?.ciudades || []].filter(Boolean))];
  const previousCities = Array.isArray(previousBase && previousBase.ciudades) ? previousBase.ciudades : [];
  const targets = [...new Set([...(affectedCityIds || []).map(text41), ...previousCities, ...currentCities].filter(Boolean))];
  const cards = [];
  if (advertiser) {
    for (const cityId of currentCities) {
      const card = buildGuideCardBaseV2({
        advertiser,
        admin: admin || {},
        sedes,
        catalogs: catalogs || {},
        territory: territory || {},
        cityId
      });
      if (card) cards.push(card);
    }
  }
  const cardMap = new Map(cards.map((c) => [text41(c.ciudad_id), c]));
  for (const cityId of targets) {
    const key3 = guideCityKey2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    const base2 = cardMap.get(cityId);
    let rows = (packet2.anunciantes || []).filter((x) => text41(x.id) !== aid);
    if (base2 && publicAllowed(base2)) rows.push(base2);
    await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), anunciantes: sortCards2(rows) });
  }
  await cache.put(guideAdvertiserKey(aid), {
    version: 2,
    anunciante_id: aid,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    ciudades: currentCities,
    template: cards[0] || previousBase?.template || previousBase?.cards?.[0],
    cards
  });
  return { success: true, advertiser_id: aid, ciudades_actualizadas: targets };
}
async function ensureGuideBaseFromPrivateInternal({db,cache,advertiserId}){
 const aid=String(advertiserId||'').trim(),key=guideAdvertiserKey(aid),existing=await cache.get(key);
 if(existing&&Array.isArray(existing.cards))return existing;
 const reader=db.panelReadDb?db.panelReadDb({advertiserId:aid}):db;
 const [advertiser,admin,sedes,catalogs,territory]=await Promise.all([reader.get('anunciantes',aid),db.panelAdministration?db.panelAdministration(aid):reader.get('anunciantes_administracion',aid),reader.queryEqual('anunciantes_sedes','anunciante_id',aid,500),cache.get('catalogs:commerce:v1'),cache.get('territorio:public:v1')]);
 if(!advertiser)return null;
 const ciudades=[...new Set((sedes||[]).map(row=>String(row.ciudad_id||'').trim()).filter(Boolean))];
 if(!ciudades.length){for(const city of [advertiser.ciudad_id,...(Array.isArray(advertiser.ciudad_ids)?advertiser.ciudad_ids:[])])if(city&&!ciudades.includes(String(city)))ciudades.push(String(city));}
 const cards=ciudades.map(cityId=>buildGuideCardBaseV2({advertiser,admin:admin||{},sedes:sedes||[],catalogs:catalogs||{},territory:territory||{},cityId})).filter(Boolean);
 const value={version:2,anunciante_id:aid,updated_at:new Date().toISOString(),ciudades,template:cards[0],cards};
 await cache.put(key,value);return value;
}
async function guideBaseForMutationInternal(cache,aid){
 const base=await cache.get(guideAdvertiserKey(aid));
 if(base&&Array.isArray(base.cards))return base;
 if(cache.ensureGuideBaseInternal)return cache.ensureGuideBaseInternal(aid);
 return base;
}

async function patchGuideAdminFieldsV2({ cache, advertiserId, patch }) {
  const aid = text41(advertiserId);
  const allowed = ["aprobado", "nivel", "subnivel", "verificado", "gold"];
  const relevant = {};
  for (const key3 of allowed) if (Object.prototype.hasOwnProperty.call(patch || {}, key3)) relevant[key3] = patch[key3];
  if (!Object.keys(relevant).length) return { success: true, changed: false, firestore_reads: 0 };
  const base2 = await guideBaseForMutationInternal(cache,aid);
  if (!base2 || !Array.isArray(base2.cards)) {
    return { success: true, changed: false, needs_full_sync: true, firestore_reads: 0 };
  }
  const nextCards = base2.cards.map((card) => {
    const out2 = { ...card };
    if ("aprobado" in relevant) out2.aprobado = !!relevant.aprobado;
    if ("nivel" in relevant) out2.nivel = text41(relevant.nivel);
    if ("subnivel" in relevant) out2.subnivel = text41(relevant.subnivel);
    if ("verificado" in relevant) out2.verificado = !!relevant.verificado;
    if ("gold" in relevant) out2.gold = !!relevant.gold;
    return out2;
  });
  for (const card of nextCards) {
    const cityId = text41(card.ciudad_id), key3 = guideCityKey2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    await cache.put(key3, {
      version: 2,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      anunciantes: upsertCard(packet2.anunciantes || [], card)
    });
  }
  await cache.put(guideAdvertiserKey(aid), {
    ...base2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    template: nextCards[0] || Object.assign({}, base2.template || {}, relevant),
    cards: nextCards
  });
  return { success: true, changed: true, ciudades: base2.ciudades || [], firestore_reads: 0 };
}
async function rebuildGuideAllV2({ db, cache }) {
  const [advertisers, admins, sedes, catalogs, territory] = await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const adminMap = new Map(admins.map((a) => [text41(a.id || a.anunciante_id), a]));
  const sedesBy = /* @__PURE__ */ new Map();
  for (const s of sedes) {
    const aid = text41(s.anunciante_id);
    if (!sedesBy.has(aid)) sedesBy.set(aid, []);
    sedesBy.get(aid).push(s);
  }
  const byCity = /* @__PURE__ */ new Map(), baseWrites = [];
  const previousBases127=new Map();
  for(let offset=0;offset<advertisers.length;offset+=16){
    await Promise.all(advertisers.slice(offset,offset+16).map(async adv=>{
      const aid=text41(adv.id||adv.anunciante_id);
      previousBases127.set(aid,await cache.get(guideAdvertiserKey(aid)));
    }));
  }
  for (const adv of advertisers) {
    const aid = text41(adv.id || adv.anunciante_id), advSedes = sedesBy.get(aid) || [];
    const previousBase = previousBases127.get(aid);
    const sedeCities = advSedes.map((s) => text41(s.ciudad_id)).filter(Boolean);
    const cities = [...new Set(sedeCities.length ? sedeCities : [text41(adv.ciudad_id), ...previousBase?.ciudades || []].filter(Boolean))];
    const cards = [];
    for (const cityId of cities) {
      const card = buildGuideCardBaseV2({
        advertiser: adv,
        admin: adminMap.get(aid) || {},
        sedes: advSedes,
        catalogs: catalogs || {},
        territory: territory || {},
        cityId
      });
      if (!card) continue;
      cards.push(card);
      if (publicAllowed(card)) {
        if (!byCity.has(cityId)) byCity.set(cityId, []);
        byCity.get(cityId).push(card);
      }
    }
    baseWrites.push(cache.put(guideAdvertiserKey(aid), {
      version: 2,
      anunciante_id: aid,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      ciudades: cities,
      template: cards[0] || previousBase?.template,
      cards
    }));
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    ...baseWrites,
    ...[...byCity.entries()].map(([cityId, cards]) => cache.put(guideCityKey2(cityId), {
      version: 2,
      ciudad_id: cityId,
      updated_at: now,
      anunciantes: sortCards2(cards)
    }))
  ]);
  return { success: true, ciudades: byCity.size, anunciantes: advertisers.length, updated_at: now };
}

// reconstruccion/worker/core/admin-indexes-v2.js
var text42 = (v) => String(v ?? "").trim();
var norm6 = (v) => text42(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
var ADMIN_ADVERTISERS_KEY = "admin:index:advertisers:v2";
var ADMIN_SUBSCRIBERS_KEY = "admin:index:subscribers:v2";
function sortByName(rows) {
  return [...rows].sort((a, b) => text42(a.nombre).localeCompare(text42(b.nombre), "es", { sensitivity: "base" }));
}
function advertiserRow({ advertiser, admin, sedes }) {
  const id4 = text42(advertiser && advertiser.id || admin && admin.id);
  const cities = [...new Set((sedes || []).map((s) => text42(s.ciudad_id)).filter(Boolean))];
  const nombre = text42(advertiser && advertiser.nombre || admin && admin.nombre);
  return {
    id: id4,
    nombre,
    nivel: text42(admin && admin.nivel),
    subnivel: text42(admin && admin.subnivel),
    aprobado: admin && admin.aprobado === true,
    verificado: admin && admin.verificado === true,
    gold: admin && admin.gold === true,
    segmento_id: text42(advertiser && advertiser.segmento_id),
    ciudad_ids: cities,
    search: norm6([id4, nombre, advertiser && advertiser.actividad, advertiser && advertiser.descripcion].filter(Boolean).join(" "))
  };
}
function subscriberRow(s) {
  const id4 = text42(s.suscriptor_id || s.id);
  const nombre = text42(s.nombre), mail = text42(s.mail), whatsapp = text42(s.whatsapp || s.telefono);
  return {
    ...subscriberTerritoryV84(s),
    suscriptor_id: id4,
    id: id4,
    nombre,
    mail,
    whatsapp,
    tipo_usuario: text42(s.tipo_usuario).toUpperCase(),
    ciudad_id: text42(s.ciudad_predeterminada_id || s.ciudad_origen_id || s.ciudad_id),
    activo: s.activo,
    search: norm6([id4, nombre, mail, whatsapp,s.residencia_declarada?.ciudad,s.residencia_declarada?.provincia,s.ciudad_natal].filter(Boolean).join(" "))
  };
}
function upsert2(rows, idField, item) {
  const id4 = text42(item[idField] || item.id);
  const out2 = (rows || []).filter((x) => text42(x[idField] || x.id) !== id4);
  out2.push(item);
  return sortByName(out2);
}
async function rebuildAdminIndexesV2({ db, cache }) {
  const [advertisers, admins, sedes, subscribers] = await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    db.listCollection("suscriptores")
  ]);
  const adminMap = new Map(admins.map((a) => [text42(a.id || a.anunciante_id), a]));
  const sedesBy = /* @__PURE__ */ new Map();
  for (const s of sedes) {
    const aid = text42(s.anunciante_id);
    if (!aid) continue;
    if (!sedesBy.has(aid)) sedesBy.set(aid, []);
    sedesBy.get(aid).push(s);
  }
  const advRows = advertisers.map((a) => {
    const aid = text42(a.id || a.anunciante_id);
    return advertiserRow({ advertiser: a, admin: adminMap.get(aid) || {}, sedes: sedesBy.get(aid) || [] });
  }).filter((x) => x.id);
  const subRows = subscribers.map(subscriberRow).filter((x) => x.suscriptor_id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    cache.put(ADMIN_ADVERTISERS_KEY, { version: 2, updated_at: now, results: sortByName(advRows) }),
    cache.put(ADMIN_SUBSCRIBERS_KEY, { version: 2, updated_at: now, results: sortByName(subRows) })
  ]);
  return { success: true, anunciantes: advRows.length, suscriptores: subRows.length, updated_at: now };
}
async function syncAdvertiserIndexV2({ db, cache, advertiserId }) {
  const aid = text42(advertiserId);
  const [advertiser, admin, sedes, packet2] = await Promise.all([
    db.get("anunciantes", aid),
    db.get("anunciantes_administracion", aid),
    db.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500),
    cache.get(ADMIN_ADVERTISERS_KEY)
  ]);
  if (!advertiser && !admin) return { success: true, removed: false, missing: true };
  const row = advertiserRow({ advertiser: advertiser || { id: aid }, admin: admin || {}, sedes });
  const base2 = packet2 && Array.isArray(packet2.results) ? packet2.results : [];
  await cache.put(ADMIN_ADVERTISERS_KEY, {
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: upsert2(base2, "id", row)
  });
  return { success: true, row };
}
async function patchAdvertiserIndexCommercialV2({ cache, advertiserId, patch }) {
  const aid = text42(advertiserId), packet2 = await cache.get(ADMIN_ADVERTISERS_KEY);
  if (!packet2 || !Array.isArray(packet2.results)) return { success: true, changed: false, needs_rebuild: true };
  const rows = [...packet2.results];
  const i = rows.findIndex((x) => text42(x.id) === aid);
  if (i < 0) return { success: true, changed: false, needs_rebuild: true };
  const row = { ...rows[i] };
  for (const key3 of ["nivel", "subnivel", "aprobado", "verificado", "gold"]) {
    if (Object.prototype.hasOwnProperty.call(patch || {}, key3)) row[key3] = patch[key3];
  }
  rows[i] = row;
  await cache.put(ADMIN_ADVERTISERS_KEY, {
    ...packet2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: sortByName(rows)
  });
  return { success: true, changed: true };
}
async function searchAdvertisersV2({ cache, q = "", cityId = "", limit = 100, offset = null }) {
  const packet2 = await cache.get(ADMIN_ADVERTISERS_KEY);
  const needle = norm6(q), city = text42(cityId);
  let rows = packet2 && Array.isArray(packet2.results) ? packet2.results : [];
  if (needle) rows = rows.filter((x) => text42(x.search).includes(needle));
  if (city) rows = rows.filter((x) => Array.isArray(x.ciudad_ids) && x.ciudad_ids.includes(city));
  if(offset!==null){const start=Math.max(0,Number(offset)||0);return {success:true,results:rows.slice(start,start+10),total:rows.length,next_offset:start+10<rows.length?start+10:null,source:'kv'};}
  return { success: true, results: city&&!needle?rows:rows.slice(0, Math.max(1, Math.min(250, Number(limit) || 100))), source: "kv" };
}
async function searchSubscribersV2({ cache, q = "", tipo = "", cityId = "", limit = 100, offset = null }) {
  const packet2 = await cache.get(ADMIN_SUBSCRIBERS_KEY);
  const needle = norm6(q), wanted = text42(tipo).toUpperCase();
  let rows = packet2 && Array.isArray(packet2.results) ? packet2.results : [];
  if (needle) rows = rows.filter((x) => text42(x.search).includes(needle));
  if(wanted&&!cityId)throw httpError("Elegí la ciudad para filtrar residentes o visitantes.",400);
  if(cityId)rows=rows.filter(x=>Object.hasOwn(x.vinculos_ciudades||{},cityId));
  if (wanted) rows = rows.filter((x) => text42(x.vinculos_ciudades?.[cityId]?.condicion).toUpperCase() === wanted);
  if(offset!==null){const start=Math.max(0,Number(offset)||0);return {success:true,results:rows.slice(start,start+10),total:rows.length,next_offset:start+10<rows.length?start+10:null,source:'kv'};}
  return { success: true, results: rows.slice(0, Math.max(1, Math.min(250, Number(limit) || 100))), source: "kv" };
}

function cupoGuardado(cupoAsignado){
  const n=Number(cupoAsignado);
  return Number.isSafeInteger(n)&&n>=0?n*2:0;
}
async function advertiserUsageV62(db,aid){
  if(!db.cachedPanelRows)return {};
  const collections=['promos','eventos','actividades','publicidades'];
  const lists=await Promise.all(collections.map(c=>db.cachedPanelRows(c,'anunciante_id',aid)));
  const summary=(rows,active)=>rows===null?{disponible:false}:{disponible:true,guardadas:rows.length,activas:rows.filter(active).length,pausadas:rows.filter(r=>bool12(r.pausado)||r.activo===false||String(r.estado||'').toUpperCase()==='PAUSADA').length,pendientes:rows.filter(r=>!r.revision_definitiva&&!rejectedActivity(r)&&([r.estado_moderacion,r.estado,r.revision_adulto].some(value=>['PENDIENTE','REVISION'].includes(String(value||'').toUpperCase()))||r.aprobado===false)).length};
  return {
    PROMOS:summary(lists[0],r=>!paused(r)),
    EVENTOS:summary(lists[1]===null?null:lists[1].filter(e=>isVip(e)&&!e.eliminado),r=>!bool12(r.pausado)),
    EVENTOS_FREE:summary(lists[1]===null?null:lists[1].filter(e=>isFree(e)&&!e.eliminado),r=>!bool12(r.pausado)),
    ACTIVIDADES:summary(lists[2],r=>r.activo!==false&&String(r.estado||'').toUpperCase()!=='PAUSADA'),
    PUBLICIDAD:summary(lists[3],r=>String(r.estado||'').toUpperCase()==='ACTIVA')
  };
}

async function wholeRevisionInternal(row){return fieldRevisionInternal(row||{},Object.keys(row||{}).filter(k=>k!=='_version'));}
async function fieldRevisionInternal(row,keys){
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const value=Object.fromEntries(keys.filter(k=>Object.hasOwn(row||{},k)).map(k=>[k,row[k]]));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(value))))),v=>v.toString(16).padStart(2,'0')).join('');
}
const PROFILE_REVISION_FIELDS_INTERNAL=['segmento_id','categoria_ids','pet','eco','gayfriendly','contenido_adulto'];
const SEDE_REVISION_FIELDS_INTERNAL=['actividad_ids','accion_ids','nodo_ids'];

async function commercialRevisionInternal(row){
 const keys=['nivel','subnivel','aprobado','verificado','gold','funcionalidades','funcionalidades_config'];
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const value=Object.fromEntries(keys.filter(k=>Object.hasOwn(row||{},k)).map(k=>[k,row[k]]));
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(value))));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}

async function advertiserDetailV2({ db, advertiserId }) {
  const aid = text42(advertiserId);
  const read=db.panelReadDb?db.panelReadDb({advertiserId:aid}):db;
  const [advertiser, admin, sedes, relations] = await Promise.all([
    read.get("anunciantes", aid),
    read.get("anunciantes_administracion", aid),
    read.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500),
    db.cachedAdvertiserRelations104?db.cachedAdvertiserRelations104(aid):db.queryEqual("suscriptor_anunciante", "anunciante_id", aid, 500)
  ]);
  if (!advertiser && !admin) return { success: false, message: "Anunciante no encontrado" };
  return { success: true, revision_comercial:await commercialRevisionInternal(admin||{}), revision_perfil:await fieldRevisionInternal(advertiser||{},PROFILE_REVISION_FIELDS_INTERNAL), revision_sedes:Object.fromEntries(await Promise.all(sedes.map(async row=>[String(row.sede_id||row.id),await fieldRevisionInternal(row,SEDE_REVISION_FIELDS_INTERNAL)]))), anunciante: advertiser || {}, administracion: admin || {}, sedes, relaciones: relations, uso_funcionalidades: await advertiserUsageV62(db,aid) };
}
async function subscriberDetailV2({ db, subscriberId }) {
  const sid=text42(subscriberId);
  const [subscriber,relations]=await Promise.all([
    db.cachedSubscriberProjection(sid),
    db.subscriberRelations(sid)
  ]);
  if(!subscriber)return {success:false,message:'Suscriptor no encontrado'};
  return {success:true,suscriptor:{...publicProfile(subscriber),email_verificado:subscriber.email_verificado,creado_en:subscriber.creado_en||subscriber.fecha_alta||'',actualizado_en:subscriber.actualizado_en||'',fecha_nacimiento_registrada_en:subscriber.fecha_nacimiento_registrada_en||''},relaciones:relations};
}

// reconstruccion/worker/routes/panel-v5.js
var text43 = (v) => String(v ?? "").trim();
async function bodyOf3(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf3(url, b = {}) {
  return text43(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf3(url, b = {}) {
  return text43(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function requirePanel3(env, request2, aid, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (!sessionAllows(s, aid, "modificar_datos", { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
async function routePanelV5(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/commerce" && request2.method === "GET") {
    const action = actionOf3(url), aid = aidOf3(url);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel3(env, request2, aid, false);
    if (auth.response) return auth.response;
    if (action === "permisos_panel") {
      const admin = await (db.panelAdministration ? db.panelAdministration(aid) : db.get("anunciantes_administracion", aid));
      return json({ success: !!admin, id: aid, administracion: admin || {} }, admin ? 200 : 404);
    }
    if (action === "anunciante") {
      return json(await commercePanelData({
        db,
        advertiserId: aid,
        catalogs: await getCommerceCatalogs(cache)
      }));
    }
    return null;
  }
  if (path === "/commerce" && request2.method === "POST") {
    const body = await bodyOf3(request2), action = actionOf3(url, body), aid = aidOf3(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel3(env, request2, aid, true);
    if (auth.response) return auth.response;
    if (action === "set_datos") {
      const out2 = await commerceSetDatos({ db, advertiserId: aid, body });
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
      return json(out2);
    }
    if (action === "set_sedes") {
      const previous = await db.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500);
      const previousCities = [...new Set(previous.map((x) => text43(x.ciudad_id)).filter(Boolean))];
      const out2 = await commerceSetSedes({ db, advertiserId: aid, body });
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid, affectedCityIds: previousCities }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
      return json(out2);
    }
    if (action === "set_relaciones_sede") {
      const out2 = await commerceSetRelacionesSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiserV2({ db, cache, advertiserId: aid });
      return json(out2);
    }
    if (action === "delete_sede") {
      const sedeId = text43(body.sede_id);
      const sede = sedeId ? await db.get("anunciantes_sedes", sedeId) : null;
      const previousCities = sede && text43(sede.ciudad_id) ? [text43(sede.ciudad_id)] : [];
      const out2 = await commerceDeleteSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiserV2({ db, cache, advertiserId: aid, affectedCityIds: previousCities });
      return json(out2);
    }
    return null;
  }
  return routePanelV4(ctx);
}

// reconstruccion/worker/modules/suscriptor-favoritos-v2.js
var {listFavoritesV2,addFavoriteV2,removeFavoriteV2} = (() => {
/**
 * FAVORITOS SUSCRIPTOR V2
 * Requiere sesión HMAC. Nunca acepta suscriptor_id ajeno al token.
 */

const text=v=>String(v??"").trim();
const allowedTypes=new Set(["ANUNCIANTE","EVENTO","PROMO","ACTIVIDAD","CIUDAD"]);

function typeOf(v){
  const t=text(v).toUpperCase();
  return allowedTypes.has(t)?t:"";
}
async function favoriteDocId(sid,type,ref){
  const raw=new TextEncoder().encode([sid,type,ref].join("|"));
  const hash=await crypto.subtle.digest("SHA-256",raw);
  const bytes=new Uint8Array(hash);
  return "FAV-"+[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,40);
}
async function sessionOrThrow(env,request){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)throw new Error(s.message||"Sesión inválida.");
  return s;
}

async function listFavoritesV2({env,request,db,type=""}){
  const s=await sessionOrThrow(env,request);
  const wanted=typeOf(type);
  if(type&&!wanted)throw new Error("Tipo de favorito inválido.");

  const rows=await (db.subscriberFavorites?db.subscriberFavorites(text(s.sid)):db.queryEqual("suscriptor_favoritos","suscriptor_id",text(s.sid),500));
  const favoritos=rows
    .filter(x=>x.activo===undefined||x.activo===true)
    .filter(x=>!wanted||text(x.tipo).toUpperCase()===wanted);

  return{success:true,favoritos};
}

async function addFavoriteV2({env,request,db,body}){
  const s=await sessionOrThrow(env,request);
  const sid=text(s.sid);
  const tipo=typeOf(body&&body.tipo);
  const ref=text(body&&body.referencia_id);
  if(!tipo)throw new Error("Tipo de favorito inválido.");
  if(!ref)throw new Error("Falta referencia_id.");

  const id=await favoriteDocId(sid,tipo,ref);
  const now=new Date().toISOString();
  const doc={
    favorito_id:id,
    suscriptor_id:sid,
    tipo,
    referencia_id:ref,
    nombre_ref:text(body&&body.nombre_ref),
    ciudad_id:text(body&&body.ciudad_id),
    fecha_alta:now,
    activo:true,
    actualizado:now
  };
  await db.patch("suscriptor_favoritos",id,doc);
  return{success:true,message:"Favorito guardado",favorito:doc};
}

async function removeFavoriteV2({env,request,db,body}){
  const s=await sessionOrThrow(env,request);
  const sid=text(s.sid);
  const tipo=typeOf(body&&body.tipo);
  const ref=text(body&&body.referencia_id);
  if(!tipo)throw new Error("Tipo de favorito inválido.");
  if(!ref)throw new Error("Falta referencia_id.");

  const id=await favoriteDocId(sid,tipo,ref);
  const current=await db.get("suscriptor_favoritos",id);
  if(!current)return{success:true,message:"El favorito ya no existe"};
  if(text(current.suscriptor_id)!==sid)throw new Error("Favorito inválido.");

  await db.delete("suscriptor_favoritos",id,{mustExist:true});
  return{success:true,message:"Favorito eliminado",favorito:current};
}
return {listFavoritesV2,addFavoriteV2,removeFavoriteV2};
})();

// reconstruccion/worker/routes/panel-v6.js
var text45 = (v) => String(v ?? "").trim();
async function bodyOf4(request2) {
  try {
    return await request2.clone().json();
  } catch (_) {
    return {};
  }
}
async function routePanelV6(ctx) {
  const { path, request: request2, url, env, db } = ctx;
  if (path === "/suscriptores" && request2.method === "GET") {
    const action = text45(url.searchParams.get("action")).toLowerCase();
    if (action === "favoritos") {
      return json(await listFavoritesV2({
        env,
        request: request2,
        db,
        type: text45(url.searchParams.get("tipo"))
      }));
    }
  }
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf4(request2);
    const action = text45(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "agregar_favorito") {
      return json(await addFavoriteV2({ env, request: request2, db, body }));
    }
    if (action === "quitar_favorito") {
      return json(await removeFavoriteV2({ env, request: request2, db, body }));
    }
  }
  return routePanelV5(ctx);
}

// reconstruccion/worker/modules/suscriptor-cuenta-v2.js
var text46 = (v) => String(v ?? "").trim();
var norm7 = (v) => text46(v).toLowerCase();
var truthy4 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(norm7(v));
async function session(env, request2) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) throw new Error(s.message || "Sesión inválida.");
  return s;
}
function publicProfile(s) {
  return {
    ...subscriberTerritoryV84(s),
    suscriptor_id: text46(s.suscriptor_id || s.id),
    nombre: text46(s.nombre),
    mail: text46(s.mail),
    whatsapp: text46(s.whatsapp),
    fecha_nacimiento: birthDateOnly_(s.fecha_nacimiento) || text46(s.fecha_nacimiento),
    fecha_nacimiento_politica: "COMPLETAR_UNA_VEZ",
    tipo_usuario: text46(s.tipo_usuario),
    ciudad_origen_id: text46(s.ciudad_origen_id),
    ciudad_predeterminada_id: text46(s.ciudad_predeterminada_id),
    activo: s.activo
  };
}
async function createSubscriberV2({ db, body }) {
  const mail = norm7(body && body.mail), clave = text46(body && body.clave), nombre = text46(body && body.nombre);
  if (!mail || !clave || !nombre) throw new Error("Faltan nombre, mail o clave.");
  const birth = text46(body.fecha_nacimiento);
  if(birth && (adultAge(birth)===null||adultAge(birth)>120))throw new Error('Ingresá una fecha de nacimiento válida.');
  const exists = await db.queryEqual("suscriptores", "mail", mail, 5);
  if (exists.some((x) => norm7(x.mail) === mail)) throw new Error("Ya existe una cuenta con ese mail.");
  const id4 = "SUS-" + crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    suscriptor_id: id4,
    nombre,
    mail,
    clave,
    whatsapp: text46(body.whatsapp),
    fecha_nacimiento: birth,
    tipo_usuario: text46(body.tipo_usuario || "RESIDENTE").toUpperCase(),
    ciudad_origen_id: text46(body.ciudad_origen_id),
    ciudad_predeterminada_id: text46(body.ciudad_predeterminada_id || body.ciudad_origen_id),
    activo: true,
    creado_en: now,
    actualizado_en: now
  };
  const saved = await db.patch("suscriptores", id4, doc);
  return { success: true, suscriptor: publicProfile(saved) };
}
async function getSubscriberProfileV2({ env, request: request2, db }) {
  const s = await session(env, request2);
  const doc = await db.cachedSubscriberProjection(text46(s.sid));
  if (!doc) throw new Error("Suscriptor no encontrado.");
  if (doc.activo !== void 0 && !truthy4(doc.activo)) throw new Error("Suscriptor no activo.");
  return { success: true, suscriptor: publicProfile(doc) };
}
async function updateSubscriberProfileV2({ env, request: request2, db, body }) {
  const s = await session(env, request2);
  let birthVersion = null, currentProfile = null;
  const birth = Object.hasOwn(body||{},'fecha_nacimiento') ? text46(body.fecha_nacimiento) : null;
  if(birth !== null){
    const age=adultAge(birth);
    if(age===null||age>120)throw new Error('Ingresá una fecha de nacimiento válida.');
    const current=await db.getVersioned('suscriptores',text46(s.sid));
    if(!current.doc||(current.doc.activo!==undefined&&!truthy4(current.doc.activo)))throw new Error('Suscriptor no activo.');
    currentProfile=current.doc;
    if(text46(current.doc.fecha_nacimiento)!==birth){
      if(text46(current.doc.fecha_nacimiento))throw new Error('La fecha registrada se corrige mediante Soporte.');
      if(!current.updateTime)throw new Error('No se pudo comprobar la cuenta. Volvé a intentarlo.');
      birthVersion=current.updateTime;
    }
  }
  currentProfile ||= await db.cachedSubscriberProjection(text46(s.sid));
  if(!currentProfile||(currentProfile.activo!==undefined&&!truthy4(currentProfile.activo)))throw new Error("Suscriptor no activo.");
  const allowed = ["nombre", "whatsapp", "tipo_usuario", "ciudad_origen_id"];
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  for (const key3 of allowed) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key3) && text46(body[key3])!==text46(currentProfile[key3])) patch[key3] = text46(body[key3]);
  }
  if(birthVersion){patch.fecha_nacimiento=birth;patch.fecha_nacimiento_registrada_en=new Date().toISOString();}
  if (Object.keys(patch).length === 1) return { success: true, updated: false, suscriptor:publicProfile(currentProfile) };
  const saved = await db.patch("suscriptores", text46(s.sid), patch, { mustExist: true, updateTime:birthVersion });
  return { success: true, suscriptor: publicProfile(saved) };
}
async function updateSubscriberCityV2({ env, request: request2, db, cache, body }) {
  const s = await session(env, request2);
  const city = text46(body && body.ciudad_id || body && body.ciudad_predeterminada_id);
  if (!city) throw new Error("Falta ciudad_id.");
  const territory = await cache.get("territorio:public:v1");
  if (!territory || (territory.ciudades || []).every((c) => text46(c.ciudad_id || c.id) !== city)) {
    throw new Error("La ciudad indicada no existe o no está activa.");
  }
  const saved = await db.patch("suscriptores", text46(s.sid), {
    ciudad_predeterminada_id: city,
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: true });
  return { success: true, suscriptor: publicProfile(saved) };
}
async function changeSubscriberPasswordV2({ env, request: request2, db, body }) {
  const s = await session(env, request2);
  const actual = text46(body && body.clave_actual || body && body.actual);
  const nueva = text46(body && body.clave_nueva || body && body.nueva_clave || body && body.clave);
  if (!actual || !nueva) throw new Error("Faltan clave actual o nueva clave.");
  if (nueva.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  const doc = await db.get("suscriptores", text46(s.sid));
  if (!doc) throw new Error("Suscriptor no encontrado.");
  if (text46(doc.clave) !== actual) throw new Error("La clave actual no coincide.");
  await db.patch("suscriptores", text46(s.sid), {
    clave: nueva,
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: true });
  await revokeSubscriberSessions(env, s.sid);
  return { success: true, message: "Clave actualizada. Volvé a ingresar." };
}
async function deleteSubscriberAccountV2({ env, request: request2, db }) {
  const s = await session(env, request2);
  const sid = text46(s.sid);
  const [relations, favorites] = await Promise.all([
    db.queryEqual("suscriptor_anunciante", "suscriptor_id", sid, 500),
    db.queryEqual("suscriptor_favoritos", "suscriptor_id", sid, 500)
  ]);
  for (const r of relations) {
    const id4 = text46(r.relacion_id || r.id);
    if (id4) await db.delete("suscriptor_anunciante", id4);
  }
  for (const f of favorites) {
    const id4 = text46(f.favorito_id || f.id);
    if (id4) await db.delete("suscriptor_favoritos", id4);
  }
  await db.delete("suscriptores", sid, { mustExist: true });
  return { success: true, deleted: true, suscriptor_id: sid };
}
async function recoveryBridgeV2({ env, body }) {
  const url = text46(env.SUSCRIPTORES_RECOVERY_URL);
  if (!url) throw new Error("Recuperación de contraseña no configurada.");
  const action = norm7(body && body.action || body && body.accion);
  if (!["solicitar_recuperacion", "restablecer_clave"].includes(action)) {
    throw new Error("Acción de recuperación inválida.");
  }
  const payload = {
    action,
    mail: text46(body && body.mail || body && body.email),
    codigo: text46(body && body.codigo || body && body.code),
    nueva_clave: text46(body && body.nueva_clave || body && body.clave_nueva || body && body.clave)
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) throw new Error("El servicio de recuperación no respondió correctamente.");
  return data;
}

// reconstruccion/worker/routes/panel-v7.js
var text47 = (v) => String(v ?? "").trim();
async function bodyOf5(request2) {
  try {
    return await request2.clone().json();
  } catch (_) {
    return {};
  }
}
async function routePanelV7(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/suscriptores" && request2.method === "GET") {
    const action = text47(url.searchParams.get("action")).toLowerCase();
    if (action === "perfil" || action === "suscriptor") {
      return json(await getSubscriberProfileV2({ env, request: request2, db }));
    }
  }
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf5(request2);
    const action = text47(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "crear") return json(await createSubscriberV2({ db, body }));
    if (action === "actualizar_perfil") return json(await updateSubscriberProfileV2({ env, request: request2, db, body }));
    if (action === "actualizar_ciudad") return json(await updateSubscriberCityV2({ env, request: request2, db, cache, body }));
    if (action === "cambiar_clave") return json(await changeSubscriberPasswordV2({ env, request: request2, db, body }));
    if (action === "eliminar_cuenta") return json(await deleteSubscriberAccountV2({ env, request: request2, db }));
    if (action === "solicitar_recuperacion" || action === "restablecer_clave") {
      return json(await recoveryBridgeV2({ env, body }));
    }
  }
  return routePanelV6(ctx);
}

// reconstruccion/worker/modules/suscriptor-login-v2.js
var subscriberLoginV2 = (() => {
/**
 * SUSCRIPTOR LOGIN V2
 * Login con verificación de correo + sesión HMAC autosuficiente.
 */
const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();
const truthy=v=>v===true||v===1||["true","1","si","sí","yes","x","activo","activa"].includes(norm(v));

function b64(input){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let bin="";bytes.forEach(x=>bin+=String.fromCharCode(x));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function hmac(env,value){
  const secret=text(env.SERVER_SECRET);
  if(!secret)throw new Error("Falta SERVER_SECRET");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}
async function issue(env,payload){
  const now=Date.now();
  const body=b64(JSON.stringify({...payload,iat:now,exp:null,persistent:true,typ:"GLD_SUBSCRIBER"}));
  return body+"."+await hmac(env,body);
}
function publicSubscriber(s){
  return {
    ...subscriberTerritoryV84(s),
    suscriptor_id:text(s.suscriptor_id||s.id),
    nombre:text(s.nombre),
    mail:text(s.mail),
    whatsapp:text(s.whatsapp),
    fecha_nacimiento:text(s.fecha_nacimiento),
    tipo_usuario:text(s.tipo_usuario),
    ciudad_origen_id:text(s.ciudad_origen_id),
    ciudad_predeterminada_id:text(s.ciudad_predeterminada_id),
    activo:s.activo,
    aceptacion_terminos_anunciante:s.aceptacion_terminos_anunciante||null
  };
}
function perms(rel,admin){
  const raw=text(rel&&rel.permisos)||text(admin&&admin.funcionalidades);
  return raw.split(/[;,|\n]/).map(x=>text(x).toUpperCase()).filter(Boolean).join(", ");
}

async function subscriberLoginV2({env,db,body}){
  const originalMail=text(body&&body.mail);
  const mail=norm(originalMail),clave=text(body&&body.clave);
  if(!mail||!clave)return{success:false,message:"Falta mail o clave"};

  const sus=await db.loginAccount(mail,clave,originalMail);
  if(!sus)return{success:false,message:"Mail o clave incorrectos"};
  if(sus.activo!==undefined&&sus.activo!==null&&sus.activo!==""&&!truthy(sus.activo)){
    return{success:false,message:"Suscriptor no activo"};
  }
  if(sus.email_verificado===false||norm(sus.email_verificado)==="false"){
    return{success:false,message:"Primero verificá tu correo electrónico.",requiere_verificacion:true,mail:text(sus.mail||mail)};
  }

  const sid=text(sus.suscriptor_id||sus.id);
  const state=await subscriberSessionState(env,sid);
  if(state.deleted)return{success:false,message:"Suscriptor no activo"};
  const relations=(await (db.loginRelations?db.loginRelations(sid):db.queryEqual("suscriptor_anunciante","suscriptor_id",sid,100)))
    .filter(r=>text(r.anunciante_id)&&truthy(r.activo));

  const enriched=await Promise.all(relations.map(async rel=>{
    const aid=text(rel.anunciante_id);
    const [advertiser,admin]=await Promise.all([
      text(rel.anunciante_nombre)?null:(db.loginAdvertiser?db.loginAdvertiser("anunciantes",aid):db.get("anunciantes",aid)),
      text(rel.permisos)?null:(db.loginAdvertiser?db.loginAdvertiser("anunciantes_administracion",aid):db.get("anunciantes_administracion",aid))
    ]);
    return {
      suscriptor_id:sid,
      anunciante_id:aid,
      anunciante_nombre:text(rel.anunciante_nombre||(advertiser&&advertiser.nombre)||(admin&&admin.nombre)),
      rol:text(rel.rol).toUpperCase(),
      permisos:perms(rel,admin),
      activo:true
    };
  }));

  const token=await issue(env,{
    sid,
    sv:Number(state.version||0),
    auth:enriched.map(x=>({
      anunciante_id:x.anunciante_id,
      anunciante_nombre:x.anunciante_nombre,
      rol:x.rol,
      permisos:x.permisos
    }))
  });

  return {
    success:true,
    suscriptor:publicSubscriber(sus),
    anunciantes:enriched,
    token,
    expires_in_seconds:null,
    persistent:true,
    source:"firestore"
  };
}
return subscriberLoginV2;
})();

// reconstruccion/worker/modules/suscriptor-registro-v3.js
var text49 = (v) => String(v ?? "").trim();
var norm9 = (v) => text49(v).toLowerCase();
function publicProfile2(s) {
  return {
    ...subscriberTerritoryV84(s),
    suscriptor_id: text49(s.suscriptor_id || s.id),
    nombre: text49(s.nombre),
    mail: text49(s.mail),
    whatsapp: text49(s.whatsapp),
    fecha_nacimiento: text49(s.fecha_nacimiento),
    tipo_usuario: text49(s.tipo_usuario),
    ciudad_origen_id: text49(s.ciudad_origen_id),
    ciudad_origen_otro: text49(s.ciudad_origen_otro),
    provincia_origen: text49(s.provincia_origen),
    ciudad_predeterminada_id: text49(s.ciudad_predeterminada_id),
    activo: s.activo,
    email_verificado: s.email_verificado
  };
}
async function createSubscriberV3({ db, cache, body }) {
  const mail = norm9(body && body.mail), clave = text49(body && body.clave), nombre = text49(body && body.nombre);
  if (!mail || !clave || !nombre) throw new Error("Faltan nombre, mail o clave.");
  if (clave.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  const birth = text49(body.fecha_nacimiento);
  if(birth && (adultAge(birth)===null||adultAge(birth)>120))throw new Error('Ingresá una fecha de nacimiento válida.');
  const territorial=await registrationTerritoryV84(cache,body);
  const exists = await db.queryEqual("suscriptores", "mail", mail, 5);
  if (exists.some((x) => norm9(x.mail) === mail)) throw new Error("Ya existe una cuenta con ese mail.");
  const id4 = "SUS-" + crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    suscriptor_id: id4,
    nombre,
    mail,
    clave,
    whatsapp: text49(body.whatsapp),
    fecha_nacimiento: text49(body.fecha_nacimiento),
    tipo_usuario: text49(body.tipo_usuario || "RESIDENTE").toUpperCase(),
    ciudad_origen_id: text49(body.ciudad_origen_id),
    ciudad_origen_otro: text49(body.ciudad_origen_otro),
    provincia_origen: text49(body.provincia_origen),
    ciudad_predeterminada_id: text49(body.ciudad_predeterminada_id),
    ...territorial,
    activo: true,
    email_verificado: false,
    email_verificado_fecha: "",
    fecha_alta: now,
    creado_en: now,
    actualizado_en: now,
    ultimo_acceso: ""
  };
  const saved = await db.patch("suscriptores", id4, doc);
  return { success: true, message: "Suscriptor creado", suscriptor: publicProfile2(saved) };
}

// reconstruccion/worker/core/subscriber-index-v2.js
var text50 = (v) => String(v ?? "").trim();
var norm10 = (v) => text50(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
function rowOf(s) {
  const id4 = text50(s && s.suscriptor_id || s && s.id);
  const nombre = text50(s && s.nombre), mail = text50(s && s.mail), whatsapp = text50(s && s.whatsapp);
  return {
    ...subscriberTerritoryV84(s),
    suscriptor_id: id4,
    id: id4,
    nombre,
    mail,
    whatsapp,
    tipo_usuario: text50(s && s.tipo_usuario).toUpperCase(),
    ciudad_id: text50(s && s.ciudad_predeterminada_id || s && s.ciudad_origen_id || s && s.ciudad_id),
    activo: s && s.activo,
    search: norm10([id4, nombre, mail, whatsapp,s.residencia_declarada?.ciudad,s.residencia_declarada?.provincia,s.ciudad_natal].filter(Boolean).join(" "))
  };
}
function sort7(rows) {
  return [...rows].sort((a, b) => text50(a.nombre).localeCompare(text50(b.nombre), "es", { sensitivity: "base" }));
}
async function upsertSubscriberIndexV2({ cache, subscriber }) {
  const row = rowOf(subscriber);
  if (!row.suscriptor_id) return { success: true, changed: false };
  const packet2 = await cache.get(ADMIN_SUBSCRIBERS_KEY) || { version: 2, results: [] };
  const rows = (packet2.results || []).filter((x) => text50(x.suscriptor_id || x.id) !== row.suscriptor_id);
  rows.push(row);
  await cache.put(ADMIN_SUBSCRIBERS_KEY, {
    ...packet2,
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: sort7(rows)
  });
  return { success: true, changed: true };
}
async function removeSubscriberIndexV2({ cache, subscriberId }) {
  const sid = text50(subscriberId);
  const packet2 = await cache.get(ADMIN_SUBSCRIBERS_KEY) || { version: 2, results: [] };
  const rows = (packet2.results || []).filter((x) => text50(x.suscriptor_id || x.id) !== sid);
  await cache.put(ADMIN_SUBSCRIBERS_KEY, {
    ...packet2,
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: sort7(rows)
  });
  return { success: true, changed: true };
}

// reconstruccion/worker/modules/suscriptor-mail-v2.js
var text51 = (v) => String(v ?? "").trim();
var norm11 = (v) => text51(v).toLowerCase();
async function subscriberMailBridgeV2({ env, db, cache, body }) {
  const url = text51(env.SUSCRIPTORES_RECOVERY_URL);
  if (!url) throw new Error("Servicio de correo de suscriptores no configurado.");
  const action = norm11(body && body.action || body && body.accion);
  const allowed = /* @__PURE__ */ new Set([
    "solicitar_recuperacion",
    "restablecer_clave",
    "solicitar_verificacion",
    "confirmar_verificacion"
  ]);
  if (!allowed.has(action)) throw new Error("Acción de correo inválida.");
  const payload = {
    action,
    mail: text51(body && body.mail || body && body.email),
    codigo: text51(body && body.codigo || body && body.code),
    clave_nueva: text51(body && body.clave_nueva || body && body.nueva_clave || body && body.clave)
  };
  payload.mail = norm11(payload.mail);
  if (!payload.mail || !/^\S+@\S+\.\S+$/.test(payload.mail)) throw new Error("Ingresá un mail válido.");
  const confirmation = ["restablecer_clave", "confirmar_verificacion"].includes(action);
  if (confirmation && !/^\d{6}$/.test(payload.codigo)) throw new Error("Ingresá el código de 6 números.");
  if (action === "restablecer_clave" && payload.clave_nueva.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  payload.nueva_clave = payload.clave_nueva;
  payload.serverSecret = text51(env.SERVER_SECRET);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15e3);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || typeof data.success !== "boolean") throw new Error("El servicio de correo no respondió correctamente.");
    if (!data.success || !confirmation) return data;
    const rows = await db.queryEqual("suscriptores", "mail", payload.mail, 5);
    const current = rows.find((s) => norm11(s.mail) === payload.mail);
    if (!current) throw new Error("Cuenta no encontrada al confirmar el código.");
    const sid = text51(current.suscriptor_id || current.id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const patch = action === "confirmar_verificacion" ? { email_verificado: true, email_verificado_fecha: now, actualizado_en: now } : { clave: payload.clave_nueva, actualizado_en: now };
    const changed = action === "confirmar_verificacion" ? current.email_verificado !== true : text51(current.clave) !== payload.clave_nueva;
    const saved = changed ? await db.patch("suscriptores", sid, patch, { mustExist: true }) : current;
    if (action === "restablecer_clave") await revokeSubscriberSessions(env, sid);
    await upsertSubscriberIndexV2({ cache, subscriber: saved });
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("El servicio de correo demoró demasiado. Volvé a intentar.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// reconstruccion/worker/routes/panel-v8.js
var text52 = (v) => String(v ?? "").trim();
async function bodyOf6(request2) {
  try {
    return await request2.clone().json();
  } catch (_) {
    return {};
  }
}
async function routePanelV8(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/suscriptores" && request2.method === "GET") {
    const action = text52(url.searchParams.get("action")).toLowerCase();
    if (action === "anunciantes_autorizados") {
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      return json({
        success: true,
        anunciantes: (Array.isArray(s.auth) ? s.auth : []).map((x) => ({
          anunciante_id: text52(x.anunciante_id),
          anunciante_nombre: text52(x.anunciante_nombre),
          rol: text52(x.rol),
          permisos: text52(x.permisos),
          activo: true
        })),
        source: "session"
      });
    }
  }
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf6(request2);
    const action = text52(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "login") {
      const out2 = await subscriberLoginV2({ env, db, body });
      return json(out2, out2.success ? 200 : 401);
    }
    if (action === "crear") {
      const out2 = await createSubscriberV3({ db, cache, body });
      if (out2.success && out2.suscriptor) {
        await upsertSubscriberIndexV2({ cache, subscriber: out2.suscriptor });
      }
      return json(out2);
    }
    if (action === "solicitar_recuperacion" || action === "restablecer_clave" || action === "solicitar_verificacion" || action === "confirmar_verificacion") {
      return json(await subscriberMailBridgeV2({ env, db, cache, body }));
    }
    if (action === "actualizar_perfil") {
      const out2 = await updateSubscriberProfileV2({ env, request: request2, db, body });
      if (out2.success && out2.suscriptor) {
        await upsertSubscriberIndexV2({ cache, subscriber: out2.suscriptor });
      }
      return json(out2);
    }
    if (action === "actualizar_ciudad") {
      const out2 = await updateSubscriberCityV2({ env, request: request2, db, cache, body });
      if (out2.success && out2.suscriptor) {
        await upsertSubscriberIndexV2({ cache, subscriber: out2.suscriptor });
      }
      return json(out2);
    }
    if (action === "eliminar_cuenta") {
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      const sid = text52(s.sid);
      const out2 = await deleteSubscriberAccountV2({ env, request: request2, db });
      if (out2.success) await removeSubscriberIndexV2({ cache, subscriberId: sid });
      return json(out2);
    }
  }
  return routePanelV7(ctx);
}

// reconstruccion/worker/modules/suscriptor-delete-v2.js
var text53 = (v) => String(v ?? "").trim();
async function deleteSubscriberAccountSecureV2({ env, request: request2, db, body }) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) throw new Error(s.message || "Sesión inválida.");
  const sid = text53(s.sid);
  const clave = text53(body && body.clave_actual);
  if (!clave) throw new Error("Ingresá tu contraseña actual.");
  const current = await db.get("suscriptores", sid);
  if (!current) throw new Error("Suscriptor no encontrado.");
  if (text53(current.clave) !== clave) throw new Error("La contraseña actual no coincide.");
  const [relations, favorites] = await Promise.all([
    db.queryEqual("suscriptor_anunciante", "suscriptor_id", sid, 500),
    db.queryEqual("suscriptor_favoritos", "suscriptor_id", sid, 500)
  ]);
  for (const r of relations) {
    const id4 = text53(r.relacion_id || r.id);
    if (id4) await db.delete("suscriptor_anunciante", id4);
  }
  for (const f of favorites) {
    const id4 = text53(f.favorito_id || f.id);
    if (id4) await db.delete("suscriptor_favoritos", id4);
  }
  await db.delete("suscriptores", sid, { mustExist: true });
  await revokeSubscriberSessions(env, sid, { deleted: true });
  return { success: true, deleted: true, suscriptor_id: sid };
}

// reconstruccion/worker/routes/panel-v9.js
var text54 = (v) => String(v ?? "").trim();
async function bodyOf7(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
async function routePanelV9(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/suscriptores" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf7(clone);
    const action = text54(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "eliminar_cuenta") {
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      const out2 = await deleteSubscriberAccountSecureV2({ env, request: request2, db, body });
      if (out2.success) {
        await removeSubscriberIndexV2({ cache, subscriberId: text54(s.sid) });
      }
      return json(out2);
    }
  }
  return routePanelV8(ctx);
}

// reconstruccion/worker/modules/commerce-v3.js
var {commercePanelDataV3,commerceSetDatosV3,commerceSetSedesV3,commerceDeleteSedeV3} = (() => {
function text(v){return String(v??"").trim();}
function ids(v){
  if(Array.isArray(v))return [...new Set(v.map(text).filter(Boolean))];
  return [...new Set(text(v).split(/[;,|\n]/).map(text).filter(Boolean))];
}
function newSedeId(advertiserId){
  return "SED-"+text(advertiserId)+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,10);
}
const DATA_ALLOWED=new Set([
  "contenido_adulto","redes_web_comunes","actividad","descripcion","tags","adicionales","logo","link","segmento_id","categoria_id","categoria_ids",
  "img1","img2","img3","img4","img5","img6","img7","img8","img9","img10"
]);
const SEDE_ALLOWED=new Set([
  "nombre_sede","web","direccion","lat","lng","maps",
  "telefono","telefono2","telefono3","telefono4","telefono5",
  "whatsapp","whatsapp2","whatsapp3","whatsapp4","whatsapp5",
  "mail","mail2","mail3","instagram","facebook","youtube","tiktok","linkedin","x",
  "img1","img2","img3","img4","img5","img6","img7","img8","img9","img10",
  "estado","ciudad_id","pais_id","provincia_id","codigo_postal","actividad_ids","accion_ids","nodo_ids"
]);

async function commercePanelDataV3({db,advertiserId,catalogs}){
  if(db.panelReadDb)db=db.panelReadDb();
  const [datos,administracion,sedes]=await Promise.all([
    db.get("anunciantes",advertiserId),
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId,500)
  ]);
  if(!datos)return{success:false,error:"anunciante_no_encontrado"};
  return{success:true,advertiser:{
    id:advertiserId,datos,revision_datos:await wholeRevisionInternal(datos),revision_sedes:Object.fromEntries(await Promise.all(sedes.map(async row=>[String(row.sede_id||row.id),await wholeRevisionInternal(row)]))),administracion:administracion||{},sedes,redes_web_comunes_disponible:true,
    segmentos:catalogs.segmentos||[],categorias:catalogs.categorias||[],
    actividades_clave:catalogs.actividades_clave||[],acciones:catalogs.acciones||[],
    nodos:catalogs.nodos||[],funcionalidades:catalogs.funcionalidades||[],
    niveles_anunciante:catalogs.niveles_anunciante||[]
  }};
}

async function validateCommerceFieldsV86({db,cache,advertiserId,patch}){
  const fields=Object.keys(patch).filter(k=>['descripcion','adicionales','tags'].includes(k)||/^img\d+$/.test(k));
  if(!fields.length)return;
  const [admin,catalogs]=await Promise.all([db.panelAdministration?db.panelAdministration(advertiserId):db.get('anunciantes_administracion',advertiserId),cache.get('catalogs:commerce:v1')]);
  const level=admin?.nivel, row=GLD_CLASSIFICATION_V86.findLevel(catalogs?.niveles_anunciante,level),rules=GLD_CLASSIFICATION_V86.rules(row,level);
  for(const key of fields){
    const value=String(patch[key]??'');
    if(/^img\d+$/.test(key)){if(value.trim()&&Number(key.slice(3))>rules.imagenes_max)throw Error('El nivel no permite modificar esa imagen.');}
    else if(value.length>rules[key+'_max'])throw Error('El campo '+key+' supera el límite del nivel ('+rules[key+'_max']+' caracteres).');
  }
}

async function commerceSetDatosV3({db,cache,advertiserId,body}){
  const patch={actualizado_en:new Date().toISOString()};
  for(const [k,v] of Object.entries(body||{})){
    if(!DATA_ALLOWED.has(k))continue;
    if(k==="categoria_id"||k==="categoria_ids")patch.categoria_ids=ids(v);
    else patch[k]=k==="redes_web_comunes"?redesWebComunes(v):v;
  }
  if(Object.keys(patch).length===1)return{success:true,updated:false,id:advertiserId,patch:{}};
  const reader=db.panelReadDb?db.panelReadDb():db;
  let existingAdult=await reader.get("anunciantes",advertiserId);
  if(existingAdult&&db.rememberPanelRows)db.rememberPanelRows("anunciantes",[existingAdult]);
  let delta=changedFieldsV1(existingAdult,patch);
  if(!Object.keys(delta).length)return{success:true,updated:false,id:advertiserId,patch:{}};
  await validateCommerceFieldsV86({db,cache,advertiserId,patch:delta});
  if(!/^[a-f0-9]{64}$/.test(String(body.revision_datos||'')))throw httpError('Volvé a abrir los datos del anuncio antes de guardar.',409);
  const version=await db.getVersioned('anunciantes',advertiserId);
  if(!version.doc||!version.updateTime||body.revision_datos!==await wholeRevisionInternal(version.doc))throw httpError('Los datos del anuncio cambiaron mientras los editabas. Volvé a abrirlos antes de guardar.',409);
  existingAdult=version.doc;delta=changedFieldsV1(existingAdult,patch);
  await validateCommerceFieldsV86({db,cache,advertiserId,patch:delta});
  for(const key of Object.keys(patch))delete patch[key];
  Object.assign(patch,delta,adultFields(existingAdult,delta));
  const saved=await db.patch("anunciantes",advertiserId,patch,{mustExist:true,updateTime:version.updateTime});
  return{success:true,updated:true,id:advertiserId,revision_datos:await wholeRevisionInternal(saved),patch:{...patch,estado_moderacion:saved.estado_moderacion,motivo_revision:saved.motivo_revision,declaracion_publicacion:saved.declaracion_publicacion},advertiser:saved};
}

async function commerceSetSedesV3({db,cache,advertiserId,body}){
  const incoming=Array.isArray(body&&body.sedes)?body.sedes:[];
  if(incoming.length>100)throw new Error('Demasiadas sedes en una operación.');
  const territory=incoming.length?await cache.get('territorio:public:v1'):null;
  const prepared=[],seen=new Set();
  // Validar toda la operación antes de escribir: una sede ajena no deja cambios parciales.
  for(const raw of incoming){
    const existingId=text(raw&&raw.sede_id);
    const id=existingId||newSedeId(advertiserId);
    if(seen.has(id))throw new Error('Sede repetida en la operación.');
    seen.add(id);
    const reader=db.panelReadDb?db.panelReadDb({advertiserId}):db;
    let current=existingId?await reader.get('anunciantes_sedes',id):null,version=null;
    if(existingId&&!/^[a-f0-9]{64}$/.test(String(raw.revision_sede||'')))throw httpError('Volvé a abrir la sede antes de guardar.',409);
    if(existingId&&(!current||text(current.anunciante_id)!==text(advertiserId)))throw new Error('La sede no pertenece al anunciante.');
    const patch={sede_id:id,anunciante_id:advertiserId};
    for(const [k,v] of Object.entries(raw||{})){
      if(SEDE_ALLOWED.has(k))patch[k]=['actividad_ids','accion_ids','nodo_ids'].includes(k)?ids(v):v;
    }
    const city=text(patch.ciudad_id??current?.ciudad_id);
    if(!city||!(territory&&territory.ciudades||[]).some(c=>text(c.ciudad_id||c.id)===city))throw new Error('Seleccioná una ciudad válida para la sede.');
    await validateCommerceFieldsV86({db,cache,advertiserId,patch:changedFieldsV1(current,patch)});
    if(current&&Object.entries(patch).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v))){prepared.push({id,patch,current,existingId,updateTime:null});continue;}
    if(existingId){
      version=await db.getVersioned('anunciantes_sedes',id);
      if(!version.doc||!version.updateTime||raw.revision_sede!==await wholeRevisionInternal(version.doc))throw httpError('Una sede cambió mientras la editabas. Volvé a abrir el anuncio antes de guardar.',409);
      current=version.doc;
    }
    prepared.push({id,patch,current,existingId,updateTime:version?.updateTime});
  }
  const saved=[],entries=[];
  for(const {id,patch,current,existingId,updateTime} of prepared){
    if(current&&Object.entries(patch).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v))){saved.push(current);continue;}
    if(current)for(const k of Object.keys(patch))if(JSON.stringify(current[k])===JSON.stringify(patch[k]))delete patch[k];
    patch.actualizado_en=new Date().toISOString();
    entries.push({collection:'anunciantes_sedes',id,before:current,patch,options:existingId?{updateTime}:{mustNotExist:true}});
  }
  const changed=entries.length?await db.commitPatches(entries):[];saved.push(...changed);
  return{success:true,updated:!!changed.length,id:advertiserId,sedes:saved,changed_sedes:changed,revision_sedes:Object.fromEntries(await Promise.all(saved.map(async row=>[String(row.sede_id||row.id),await wholeRevisionInternal(row)])))};

}

async function commerceDeleteSedeV3({db,advertiserId,body}){
  const id=text(body&&body.sede_id);
  if(!id)throw new Error("Falta sede_id.");
  const version=await db.getVersioned('anunciantes_sedes',id),current=version.doc;
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La sede no pertenece al anunciante.");
  if(!version.updateTime||!body.revision_sede||body.revision_sede!==await wholeRevisionInternal(current))throw httpError('La sede cambió desde que la abriste. Volvé a cargarla antes de eliminar.',409);
  await db.commitPatches([{collection:'anunciantes_sedes',id,before:current,remove:true,options:{updateTime:version.updateTime}}]);
  return{success:true,deleted:true,sede_id:id,previous:current};
}
return {commercePanelDataV3,commerceSetDatosV3,commerceSetSedesV3,commerceDeleteSedeV3};
})();

// reconstruccion/worker/core/commerce-cache-patch-v2.js
var text56 = (v) => String(v ?? "").trim();
var ids5 = (v) => Array.isArray(v) ? v.map(text56).filter(Boolean) : text56(v).split(/[;,|\n]/).map(text56).filter(Boolean);
function sortCards3(rows) {
  return [...rows].sort((a, b) => text56(a.nombre).localeCompare(text56(b.nombre), "es", { sensitivity: "base" }));
}
function mapBy3(rows, field) {
  const m = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const id4 = text56(r && r[field] || r && r.id);
    if (id4) m.set(id4, r);
  }
  return m;
}
function relObjects3(values, map, idField) {
  return ids5(values).map((id4) => {
    const x = map.get(id4) || {};
    return { [idField]: id4, nombre: text56(x.nombre), insignia: text56(x.insignia) };
  });
}
async function writeCityPacket(cache, cityId, aid, card) {
  const key3 = guideCityKey2(cityId);
  const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
  let rows = (packet2.anunciantes || []).filter((x) => text56(x.id) !== text56(aid));
  if (card && card.aprobado !== false) rows.push(card);
  await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), anunciantes: sortCards3(rows) });
}
function updateIndexRow(row, patch) {
  const out2 = { ...row };
  if ("nombre" in patch) out2.nombre = text56(patch.nombre);
  if ("segmento_id" in patch) out2.segmento_id = text56(patch.segmento_id);
  const searchable = ["nombre", "actividad", "descripcion"];
  if (searchable.some((k) => Object.prototype.hasOwnProperty.call(patch, k))) {
    const current = [out2.id, out2.nombre, patch.actividad ?? row.actividad, patch.descripcion ?? row.descripcion].filter(Boolean).join(" ");
    out2.search = text56(current).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  return out2;
}
async function patchAdminIndex(cache, aid, patch, cities) {
  const packet2 = await cache.get(ADMIN_ADVERTISERS_KEY);
  if (!packet2 || !Array.isArray(packet2.results)) return;
  const rows = [...packet2.results];
  const i = rows.findIndex((x) => text56(x.id) === text56(aid));
  if (i < 0) return;
  let row = updateIndexRow(rows[i], patch || {});
  if (Array.isArray(cities)) row.ciudad_ids = [...new Set(cities.map(text56).filter(Boolean))];
  rows[i] = row;
  await cache.put(ADMIN_ADVERTISERS_KEY, { ...packet2, updated_at: (/* @__PURE__ */ new Date()).toISOString(), results: sortCards3(rows) });
}
function sedePublic(raw, { territory, catalogs }) {
  const cityId = text56(raw.ciudad_id);
  const city = (territory.ciudades || []).find((c) => text56(c.ciudad_id || c.id) === cityId) || {};
  const actMap = mapBy3(catalogs.actividades_clave, "actividad_id");
  const accMap = mapBy3(catalogs.acciones, "accion_id");
  const nodeMap = mapBy3(catalogs.nodos, "nodo_id");
  return {
    sede_id: text56(raw.sede_id || raw.id),
    nombre_sede: text56(raw.nombre_sede),
    web:text56(raw.web),
    direccion: text56(raw.direccion),
    ciudad_id: cityId,
    ciudad: text56(raw.ciudad || city.ciudad_visible),
    provincia_id: text56(raw.provincia_id || city.provincia_id),
    provincia: text56(raw.provincia || city.provincia_visible),
    pais_id: text56(raw.pais_id || city.pais_id),
    pais: text56(raw.pais || city.pais_visible),
    codigo_postal: text56(raw.codigo_postal || city.codigo_postal),
    lat: raw.lat ?? "",
    lng: raw.lng ?? "",
    maps: text56(raw.maps),
    telefono: text56(raw.telefono),
    telefono2: text56(raw.telefono2),
    telefono3: text56(raw.telefono3),
    telefono4: text56(raw.telefono4),
    telefono5: text56(raw.telefono5),
    whatsapp: text56(raw.whatsapp),
    whatsapp2: text56(raw.whatsapp2),
    whatsapp3: text56(raw.whatsapp3),
    whatsapp4: text56(raw.whatsapp4),
    whatsapp5: text56(raw.whatsapp5),
    mail: text56(raw.mail),
    mail2: text56(raw.mail2),
    mail3: text56(raw.mail3),
    instagram: text56(raw.instagram),
    facebook: text56(raw.facebook),
    youtube: text56(raw.youtube),
    tiktok: text56(raw.tiktok),
    x: text56(raw.x),
    linkedin: text56(raw.linkedin),
    estado: text56(raw.estado),
    actividades: relObjects3(raw.actividad_ids, actMap, "actividad_id"),
    acciones: relObjects3(raw.accion_ids, accMap, "accion_id"),
    nodos: relObjects3(raw.nodo_ids, nodeMap, "nodo_id"),
    img1: text56(raw.img1),
    img2: text56(raw.img2),
    img3: text56(raw.img3),
    img4: text56(raw.img4),
    img5: text56(raw.img5),
    img6: text56(raw.img6),
    img7: text56(raw.img7),
    img8: text56(raw.img8),
    img9: text56(raw.img9),
    img10: text56(raw.img10)
  };
}
function applyCardData(card, patch, catalogs) {
  const out2 = { ...card };
  for(const k of ["contenido_adulto","revision_adulto","estado_moderacion"])if(Object.hasOwn(patch,k))out2[k]=patch[k];
  if(Object.hasOwn(patch,"redes_web_comunes"))out2.redes_web_comunes=redesWebComunes(patch.redes_web_comunes);
  const direct = ["nombre", "actividad", "descripcion", "tags", "adicionales", "logo", "link", "img1", "img2", "img3", "img4", "img5", "img6", "img7", "img8", "img9", "img10"];
  for (const k of direct) if (Object.prototype.hasOwnProperty.call(patch, k)) out2[k] = text56(patch[k]);
  for (const k of ["pet", "eco", "gayfriendly"]) if (Object.prototype.hasOwnProperty.call(patch, k)) out2[k] = patch[k];
  if (Object.prototype.hasOwnProperty.call(patch, "segmento_id")) {
    const sid = text56(patch.segmento_id);
    const x = (catalogs.segmentos || []).find((s) => text56(s.segmento_id || s.id) === sid) || {};
    out2.segmento_id = sid;
    out2.segmento = text56(x.nombre);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "categoria_ids") || Object.prototype.hasOwnProperty.call(patch, "categoria_id")) {
    const vals = ids5(patch.categoria_ids ?? patch.categoria_id);
    const map = mapBy3(catalogs.categorias, "categoria_id");
    out2.categoria_ids = vals;
    out2.categorias = vals.map((id4) => map.get(id4)).filter(Boolean).map((x) => text56(x.nombre)).filter(Boolean);
  }
  return out2;
}
async function patchGuideAdvertiserDataFromCacheV2({ cache, advertiserId, patch }) {
  const aid = text56(advertiserId);
  const [base2, catalogs] = await Promise.all([
    guideBaseForMutationInternal(cache,aid),
    cache.get("catalogs:commerce:v1")
  ]);
  if (!base2 || !Array.isArray(base2.cards)) return { success: true, needs_seed: true };
  const cards = base2.cards.map((c) => applyCardData(c, patch, catalogs || {}));
  const template = applyCardData(base2.template || base2.cards[0] || {}, patch, catalogs || {});
  for (const card of cards) await writeCityPacket(cache, text56(card.ciudad_id), aid, card);
  await cache.put(guideAdvertiserKey(aid), { ...base2, updated_at: (/* @__PURE__ */ new Date()).toISOString(), template, cards });
  await patchAdminIndex(cache, aid, patch, base2.ciudades || []);
  return { success: true, updated: true, firestore_reads: 0 };
}
async function patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId, savedSedes = [], deletedSedeId = "" }) {
  const aid = text56(advertiserId);
  const [base2, catalogs, territory] = await Promise.all([
    guideBaseForMutationInternal(cache,aid),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  if (!base2 || !Array.isArray(base2.cards)) return { success: true, needs_seed: true };
  const cards = new Map((base2.cards || []).map((c) => [text56(c.ciudad_id), { ...c, sedes: [...c.sedes || []] }]));
  const affected = /* @__PURE__ */ new Set();
  const removeSede = (id4) => {
    for (const [city, card] of cards) {
      const before = (card.sedes || []).length;
      card.sedes = (card.sedes || []).filter((s) => text56(s.sede_id) !== text56(id4));
      if (card.sedes.length !== before) affected.add(city);
    }
  };
  if (deletedSedeId) removeSede(deletedSedeId);
  for (const raw of savedSedes || []) {
    const sid = text56(raw.sede_id || raw.id);
    if (!sid) continue;
    removeSede(sid);
    const cityId = text56(raw.ciudad_id);
    if (!cityId) continue;
    let card = cards.get(cityId);
    if (!card) {
      const template = base2.template || [...cards.values()][0] || (base2.cards || [])[0];
      if (!template) continue;
      const city = (territory && territory.ciudades || []).find((c) => text56(c.ciudad_id || c.id) === cityId) || {};
      card = { ...template, ciudad_id: cityId, ciudad: text56(city.ciudad_visible), provincia_id: text56(city.provincia_id), provincia: text56(city.provincia_visible), pais_id: text56(city.pais_id), pais: text56(city.pais_visible), sedes: [] };
      cards.set(cityId, card);
    }
    card.sedes.push(sedePublic(raw, { territory: territory || {}, catalogs: catalogs || {} }));
    affected.add(cityId);
  }
  const hasSedes = [...cards.values()].some((c) => (c.sedes || []).length);
  for (const [city, card] of [...cards.entries()]) {
    if (hasSedes && !(card.sedes || []).length) {
      cards.delete(city);
      affected.add(city);
    }
  }
  for (const city of affected) {
    await writeCityPacket(cache, city, aid, cards.get(city) || null);
  }
  const nextCards = [...cards.values()];
  const ciudades = nextCards.map((c) => text56(c.ciudad_id)).filter(Boolean);
  await cache.put(guideAdvertiserKey(aid), { ...base2, updated_at: (/* @__PURE__ */ new Date()).toISOString(), template: base2.template || base2.cards[0], ciudades, cards: nextCards });
  await patchAdminIndex(cache, aid, {}, ciudades);
  return { success: true, updated: true, ciudades_actualizadas: [...affected], firestore_reads: 0 };
}

// reconstruccion/worker/routes/panel-v10.js
var text57 = (v) => String(v ?? "").trim();
async function bodyOf8(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf4(url, b = {}) {
  return text57(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf4(url, b = {}) {
  return text57(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function requirePanel4(env, request2, aid, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (!sessionAllows(s, aid, "modificar_datos", { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
async function routePanelV10(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/commerce" && request2.method === "GET") {
    const action = actionOf4(url), aid = aidOf4(url);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    if (action === "permisos_panel") {
      const session=await verifySubscriberSession(env,request2);
      if(!session.ok)return json({success:false,message:session.message},401);
      const relation=(session.auth||[]).find(row=>text57(row.anunciante_id)===aid);
      if(!relation||relation.activo===false||!['PROPIETARIO','ADMINISTRADOR','MANAGER'].includes(text57(relation.rol).toUpperCase()))return json({success:false,message:'No tenés permiso para este anunciante.'},403);
      const admin = await (db.panelAdministration ? db.panelAdministration(aid) : db.get("anunciantes_administracion", aid));
      return json({ success: !!admin, id: aid, administracion: admin || {} }, admin ? 200 : 404);
    }
    const auth = await requirePanel4(env, request2, aid, false);
    if (auth.response) return auth.response;
    if (action === "anunciante") {
      return json(await commercePanelDataV3({ db, advertiserId: aid, catalogs: await getCommerceCatalogs(cache) }));
    }
    return null;
  }
  if (path === "/commerce" && request2.method === "POST") {
    const body = await bodyOf8(request2), action = actionOf4(url, body), aid = aidOf4(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel4(env, request2, aid, true);
    if (auth.response) return auth.response;
    if (action === "set_datos") {
      const out2 = await commerceSetDatosV3({ db, cache, advertiserId: aid, body });
      if (out2.updated) {
        await patchGuideAdvertiserDataFromCacheV2({ cache, advertiserId: aid, patch: out2.patch || {} });
      }
      return json(out2);
    }
    if (action === "set_sedes") {
      const out2 = await commerceSetSedesV3({ db, cache, advertiserId: aid, body });
      if (out2.updated) {
        await patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId: aid, savedSedes: out2.changed_sedes || [] });
      }
      return json(out2);
    }
    if(action==='set_relaciones_sede'){
      const sede_id=String(body.sede_id||'').trim();if(!sede_id)throw Error('Falta sede_id.');
      const relations=Object.fromEntries(['actividad_ids','accion_ids','nodo_ids'].filter(k=>body[k]!==undefined).map(k=>[k,body[k]]));
      const result=await commerceSetSedesV3({db,cache,advertiserId:aid,body:{sedes:[{sede_id,...relations,revision_sede:body.revision_sede}]}});
      if(result.updated)await patchGuideAdvertiserSedesFromCacheV2({cache,advertiserId:aid,savedSedes:result.changed_sedes||[]});
      return json({success:true,updated:result.updated,sede_id,revision_sedes:result.revision_sedes});
    }
    if (action === "delete_sede") {
      const out2 = await commerceDeleteSedeV3({ db, advertiserId: aid, body });
      await patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId: aid, deletedSedeId: out2.sede_id });
      return json(out2);
    }
    return null;
  }
  return routePanelV9(ctx);
}

// reconstruccion/worker/modules/promos-panel-v3.js
var text58 = (v) => String(v ?? "").trim();
async function promoListOwnV3({ db, advertiserId }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const promos = await db.queryEqual("promos", "anunciante_id", text58(advertiserId), 500);
  return {
    success: true,
    promos,
    rows: promos,
    count: promos.length
  };
}

// reconstruccion/worker/routes/panel-v11.js
var text59 = (v) => String(v ?? "").trim();
async function bodyOf9(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf5(url, b = {}) {
  return text59(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf5(url, b = {}) {
  return text59(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function routePanelV11(ctx) {
  const { path, request: request2, url, env, db } = ctx;
  if (path === "/promos" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf9(clone);
    const action = actionOf5(url, body);
    if (action === "getpromos") {
      const aid = aidOf5(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "promos", { write: false })) {
        return json({ success: false, message: "No tenés permiso para ver Promos." }, 403);
      }
      return json(await promoListOwnV3({ db, advertiserId: aid }));
    }
  }
  return routePanelV10(ctx);
}

// reconstruccion/worker/core/child-rows-patch-v1.js
var {patchChildRowsV1} = (() => {
const text=v=>String(v??'').trim();
// Sólo reutiliza IDs que pertenecen al padre consultado; conserva filas sin cambios.
async function patchChildRowsV1({db,collection,idField,prefix,previous=[],desired=[],matchKey=undefined,embedded=false}){
  if(db.rememberPanelRows)db.rememberPanelRows(collection,previous);
  const byId=new Map(previous.map(r=>[text(r[idField]||r.id),r]));
  const used=new Set(),prepared=[];
  for(let i=0;i<desired.length;i++){
    const raw=desired[i],requested=text(raw[idField]);
    let current=requested?byId.get(requested):null;
    if(requested&&used.has(requested))throw new Error('Fila repetida en la operación.');
    if(!current&&matchKey)current=previous.find(r=>!used.has(text(r[idField]||r.id))&&matchKey(r)===matchKey(raw));
    if(!current&&!requested&&!matchKey)current=previous[i];
    const id=current?text(current[idField]||current.id):prefix+'-'+crypto.randomUUID();
    if(used.has(id))throw new Error('Fila repetida en la operación.');
    used.add(id);
    const {id:oldId,actualizado,creado,...fields}=raw;
    prepared.push({id,current,patch:{...fields,[idField]:id}});
  }
  const saved=[];let changed=false;
  for(const {id,current,patch}of prepared){
    if(current&&Object.entries(patch).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v))){saved.push(current);continue;}
    saved.push(embedded?patch:await db.patch(collection,id,changedFieldsV1(current,{...patch,actualizado:new Date().toISOString()}),{mustExist:!!current,newDocument:!current}));
    changed=true;
  }
  for(const [id]of byId)if(!used.has(id)){if(!embedded)await db.delete(collection,id);changed=true;}
  Object.defineProperty(saved,"changed",{value:changed});
  return saved;
}
return {patchChildRowsV1};
})();

// reconstruccion/worker/modules/actividades-v3.js
var text61 = (v) => String(v ?? "").trim();
var bool16 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text61(v).toLowerCase());
var id3 = (p) => p + "-" + crypto.randomUUID();
function today2() {
  return new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
}
function addDays2(iso, n) {
  const d = /* @__PURE__ */ new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}
function quota4(admin) {
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config.ACTIVIDADES || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin.actividades_cant]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
function enabled2(admin) {
  if (bool16(admin && admin.actividades)) return true;
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text61(admin && admin.funcionalidades).split(/[;,|\n]/);
  return raw.map((x) => text61(x).toUpperCase()).includes("ACTIVIDADES");
}
async function validateHorario({ db, cache, advertiserId, h }) {
  const city=text61(h&&h.ciudad_id),type=text61(h?.tipo_lugar).toUpperCase();
  const mode=text61(h?.modalidad||(type.includes('VIRTUAL')||type.includes('ONLINE')?'VIRTUAL':'PRESENCIAL')).toUpperCase();
  if(!['PRESENCIAL','VIRTUAL','MIXTO'].includes(mode))throw new Error('Elegí modalidad presencial, virtual o mixta.');
  if(mode!=='PRESENCIAL'){
    let valid=false;try{valid=['http:','https:'].includes(new URL(text61(h.url_virtual||h.link_virtual||h.enlace_virtual||h.web||h.maps)).protocol);}catch(_){}
    if(!valid)throw new Error('La actividad virtual o mixta necesita un enlace de acceso válido (https://...).');
  }
  if(city==='VIRTUAL'){
    if(mode!=='VIRTUAL')throw new Error('La actividad presencial o mixta necesita una ciudad física.');
    if(text61(h.sede_id||h.lugar_id||h.direccion))throw new Error('Una actividad solamente virtual no admite sede ni dirección física.');
    return;
  }
  if(!city)throw new Error('Cada horario presencial o mixto necesita ciudad.');
  const territory=await cache.get('territorio:public:v1');
  if(!territory||(territory.ciudades||[]).every(c=>text61(c.ciudad_id||c.id)!==city))throw new Error('Hay un horario con ciudad inexistente.');
  if(mode==='VIRTUAL')return;
  if(type.includes('VIRTUAL')||type.includes('ONLINE'))throw new Error('La modalidad mixta requiere un lugar físico además del enlace virtual.');
  if(text61(h.sede_id)){
    /** @type {any[]} */
    const rows=await db.queryEqual('anunciantes_sedes','anunciante_id',advertiserId,500);
    const sede=rows.find(row=>text61(row.sede_id||row.id)===text61(h.sede_id));
    if(!sede||text61(sede.anunciante_id)!==text61(advertiserId)||text61(sede.ciudad_id)!==city)throw new Error('La sede no corresponde al anunciante/ciudad.');
    return;
  }
  if(text61(h.lugar_id)){
    /** @type {{lugares?: any[]}} */
    const catalogs=await getActividadesCatalogs(cache);
    const lugar=(catalogs.lugares||[]).find(row=>text61(row.lugar_id||row.id)===text61(h.lugar_id));
    if(!lugar||text61(lugar.ciudad_id)!==city)throw new Error('El lugar no corresponde a la ciudad.');
    return;
  }
  if(!text61(h.lugar_texto)||!text61(h.direccion))throw new Error('El lugar físico necesita nombre y dirección.');
}
async function activitySaveV3({ db, cache, advertiserId, body }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !enabled2(admin)) throw new Error("No tenés habilitado el módulo Actividades.");
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : {};
  let activityId = text61(payload.actividad_id);
  let current = null;
  const max = quota4(admin), totalMax = cupoGuardado(max);
  if (activityId) {
    current = await db.get("actividades", activityId);
    if (!current || text61(current.anunciante_id) !== text61(advertiserId)) throw new Error("Actividad no encontrada.");
  } else {
    const own = await db.queryEqual("actividades", "anunciante_id", advertiserId, 500);
    const active4 = own.filter((a) => bool16(a.activo) && text61(a.estado).toUpperCase() !== "PAUSADA").length;
    if (max <= 0) throw new Error("actividades_sin_cupo");
    if (own.length >= totalMax) throw new Error("actividades_maximo_guardadas");
    if (active4 >= max) throw new Error("actividades_cupo_activo_completo");
    activityId = id3("ACT");
  }
  const embedded = !current || Number(current.horarios_version)===2;
  const oldSchedules = current ? await getPreparedRelationsV1({ cache, type: "activity", id: activityId, current, load: () => db.queryEqual("actividad_horarios", "actividad_id", activityId, 500) }) : [];
  const horarios = Array.isArray(payload.horarios) ? payload.horarios : [];
  const scheduleIds = horarios.map((h) => text61(h?.actividad_horario_id || h?.id)).filter(Boolean);
  if (new Set(scheduleIds).size !== scheduleIds.length) throw new Error("Horario repetido en la operación.");
  for (const [i, h] of horarios.entries()) {
    const requested = text61(h.actividad_horario_id || h.id);
    const previous = requested ? oldSchedules.find((p) => text61(p.actividad_horario_id || p.id) === requested) : oldSchedules[i];
    const placeKeys = ["ciudad_id", "modalidad", "tipo_lugar", "sede_id", "lugar_id", "lugar_texto", "direccion", "maps", "url_virtual", "link_virtual", "enlace_virtual", "web"];
    if (previous && placeKeys.every((k) => text61(previous[k]) === text61(h[k]))) continue;
    await validateHorario({ db, cache, advertiserId, h });
  }
  const advertiser=await db.get("anunciantes",advertiserId);
  const previousCities = [...new Set(oldSchedules.map((h) => text61(h.ciudad_id)).filter(Boolean))];
  const hoy = today2(), now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    ...current || {},
    ...payload,
    ...adultFields(current,payload),
    anunciante_nombre:text61(advertiser?.nombre||current?.anunciante_nombre),
    logo_anunciante:text61(advertiser?advertiser.logo||advertiser.logo_url:current?.logo_anunciante),
    actividad_id: activityId,
    anunciante_id: advertiserId,
    activo: current ? bool16(current.activo) : true,
    vigente_desde: current ? text61(current.vigente_desde || hoy) : hoy,
    vigente_hasta: current ? text61(current.vigente_hasta || addDays2(hoy, 30)) : addDays2(hoy, 30),
    creado: current ? text61(current.creado || now) : now,
    actualizado: now
  };
  delete doc.horarios;
  delete doc.horarios_version;
  if (!text61(doc.nombre)) throw new Error("Falta nombre de la actividad.");
  if (!text61(doc.categoria)) throw new Error("Falta categoría.");
  let savedHorarios = oldSchedules;
  if (Array.isArray(payload.horarios)) {
    savedHorarios = await patchChildRowsV1({
      db,
      embedded,
      collection: "actividad_horarios",
      idField: "actividad_horario_id",
      prefix: "AH",
      previous: oldSchedules,
      desired: horarios.map((h) => ({ ...h, actividad_id: activityId, ciudad_id: text61(h.ciudad_id), sede_id: text61(h.sede_id), lugar_id: text61(h.lugar_id), lugar_texto: text61(h.lugar_texto), direccion: text61(h.direccion), maps: text61(h.maps), activo: h.activo === void 0 ? true : bool16(h.activo) }))
    });
  }
  if(embedded){doc.horarios=savedHorarios;doc.horarios_version=2;}
  const fields = Object.keys(payload).filter((k) => !["id", "actividad_id", "anunciante_id", "horarios", "horarios_version", "aprobado", "activo", "estado", "vigente_desde", "vigente_hasta", "creado"].includes(k));
  fields.push("anunciante_nombre","logo_anunciante");
  if(embedded)fields.push("horarios","horarios_version");
  const patch = changedFieldsV1(current, doc, { touch: !!savedHorarios.changed, fields: current ? fields : null });
  const changed = Object.keys(patch).length > 0;
  const saved = changed ? await db.patch("actividades", activityId, patch, { mustExist: !!current, newDocument: !current }) : current;
  await syncActivityPreparedV2({
    cache,
    activityId,
    current,
    next: saved,
    horarios: savedHorarios,
    previousCities
  });
  return {
    success: true,
    actividad_id: activityId,
    actividad: { ...saved, horarios: savedHorarios },
    created: !current,
    updated: !!current && changed
  };
}
async function activityActionV3({ db, cache, advertiserId, action, activityId }) {
  if (!["eliminar", "pausar", "reanudar", "renovar"].includes(action)) throw new Error("Acción de actividad inválida.");
  const current = await db.get("actividades", activityId);
  if (!current || text61(current.anunciante_id) !== text61(advertiserId)) throw new Error("Actividad no encontrada.");
  if (action === "reanudar" || action === "renovar") {
    const admin = await db.get("anunciantes_administracion", advertiserId);
    if (!admin || !enabled2(admin)) throw new Error("No tenés habilitado el módulo Actividades.");
    const own = await db.queryEqual("actividades", "anunciante_id", advertiserId, 500);
    const active4 = own.filter((a) => text61(a.actividad_id || a.id) !== text61(activityId) && bool16(a.activo) && text61(a.estado).toUpperCase() !== "PAUSADA").length;
    const max = quota4(admin);
    if (max <= 0 || active4 >= max) throw new Error("actividades_cupo_activo_completo");
  }
  const hs = action === "eliminar" && Number(current.horarios_version)!==2 ? await db.queryEqual("actividad_horarios", "actividad_id", activityId, 500) : await getPreparedRelationsV1({ cache, type: "activity", id: activityId, current, load: () => db.queryEqual("actividad_horarios", "actividad_id", activityId, 500) });
  const cities = [...new Set(hs.map((h) => text61(h.ciudad_id)).filter(Boolean))];
  if (action === "eliminar") {
    for (const h of hs) {
      const hid = text61(h.actividad_horario_id || h.id);
      if (hid && Number(current.horarios_version)!==2) await db.delete("actividad_horarios", hid);
    }
    await db.delete("actividades", activityId, { mustExist: true });
    await syncActivityPreparedV2({ cache, activityId, current, next: null, horarios: [], previousCities: cities });
    return { success: true, deleted: true, actividad_id: activityId };
  }
  const patch = { actualizado: (/* @__PURE__ */ new Date()).toISOString() };
  if (action === "pausar") {
    patch.activo = false;
    patch.estado = "PAUSADA";
  }
  if (action === "reanudar" || action === "renovar") {
    patch.activo = true;
    patch.estado = "ACTIVA";
    if (action === "renovar") {
      patch.vigente_desde = today2();
      patch.vigente_hasta = addDays2(today2(), 30);
    }
  }
  const delta = changedFieldsV1(current, patch);
  if (!Object.keys(delta).length) return { success: true, updated: false, actividad_id: activityId, actividad: { ...current, horarios: hs } };
  const saved = await db.patch("actividades", activityId, delta, { mustExist: true });
  await syncActivityPreparedV2({
    cache,
    activityId,
    current,
    next: saved,
    horarios: hs,
    previousCities: cities
  });
  return {
    success: true,
    actividad_id: activityId,
    actividad: { ...saved, horarios: hs }
  };
}

// reconstruccion/worker/routes/panel-v12.js
var text62 = (v) => String(v ?? "").trim();
async function bodyOf10(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf6(url, b = {}) {
  return text62(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf6(url, b = {}) {
  return text62(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function routePanelV12(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/actividades" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf10(clone);
    const action = actionOf6(url, body);
    if (["guardar", "renovar", "pausar", "reanudar", "eliminar"].includes(action)) {
      const aid = aidOf6(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "actividades", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Actividades." }, 403);
      }
      const reads=db.panelReadDb?db.panelReadDb({advertiserId:aid}):db;
      const preparedDb={...db,get:reads.get,queryEqual:reads.queryEqual};
      if (action === "guardar") {
        return json(await activitySaveV3({ db:preparedDb, cache, advertiserId: aid, body }));
      }
      return json(await activityActionV3({
        db:preparedDb,
        cache,
        advertiserId: aid,
        action,
        activityId: text62(body.actividad_id || body.id || body.payload && (body.payload.actividad_id || body.payload.id))
      }));
    }
  }
  return routePanelV11(ctx);
}

// reconstruccion/worker/modules/publicidad-v4.js
var {publicitySaveV4,publicityActiveChangeV4,publicityDeleteSafeV4} = (() => {

async function publicitySaveV4({db,cache,advertiserId,body,config={}}){return publicitySaveMonthlyV101({db,cache,advertiserId,body,config});}

async function publicityActiveChangeV4({db,cache,advertiserId,ids}){return publicityActiveMonthlyV101({db,cache,advertiserId,ids});}

async function publicityDeleteSafeV4({db,cache,advertiserId,publicityId}){return publicityDeleteMonthlyV101({db,cache,advertiserId,publicityId});}

return {publicitySaveV4,publicityActiveChangeV4,publicityDeleteSafeV4};
})();

// reconstruccion/worker/routes/panel-v13.js
var text64 = (v) => String(v ?? "").trim();
async function bodyOf11(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf7(url, b = {}) {
  return text64(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf7(url, b = {}) {
  return text64(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function routePanelV13(ctx) {
  const { path, request: request2, url, env, cache } = ctx;
  let db=ctx.db;
  if (path === "/publicidad" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf11(clone);
    const action = actionOf7(url, body);
    if (["guardar", "actualizar_activos", "eliminar"].includes(action)) {
      const aid = aidOf7(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "publicidad", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Publicidad." }, 403);
      }
      const reads=db.panelReadDb?db.panelReadDb({advertiserId:aid}):db;
      db={...db,get:reads.get,queryEqual:reads.queryEqual};
      const currentAdmin=await db.get('anunciantes_administracion',aid);
      if(!featureEnabled2(currentAdmin,'PUBLICIDAD')&&action!=='eliminar'){
       const active=(await db.queryEqual('publicidades','anunciante_id',aid,500)).filter(p=>p.estado==='ACTIVA').map(p=>text(p.publicidad_id||p.id));
       if(action!=='actualizar_activos'||(body.publicidad_ids||[]).some(id=>!active.includes(id)))return json({success:false,message:'Publicidad no está habilitada para este anunciante.'},403);
      }
      if (action === "guardar") {
        const admin = await db.get("anunciantes_administracion", aid);
        const cfg = configFromAdmin(admin || {});
        return json(await publicitySaveV4({
          db,
          cache,
          advertiserId: aid,
          body,
          config: cfg
        }));
      }
      if (action === "actualizar_activos") {
        return json(await publicityActiveChangeV4({
          db,
          cache,
          advertiserId: aid,
          ids: Array.isArray(body.publicidad_ids) ? body.publicidad_ids : []
        }));
      }
      if (action === "eliminar") {
        return json(await publicityDeleteSafeV4({
          db,
          cache,
          advertiserId: aid,
          publicityId: text64(body.publicidad_id)
        }));
      }
    }
  }
  return routePanelV12(ctx);
}

// reconstruccion/worker/modules/efemerides-v3.js
var text65 = (v) => String(v ?? "").trim();
var bool17 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text65(v).toLowerCase());
var norm12 = (v) => text65(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function sanitize2(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const out2 = {
    efemeride_id: text65(p.efemeride_id || p.id),
    tipo: text65(p.tipo).toUpperCase(),
    provincia_id: text65(p.provincia_id),
    ciudad_id: text65(p.ciudad_id),
    tipo_fecha: norm12(p.tipo_fecha),
    nombre: text65(p.nombre),
    descripcion: String(p.descripcion || ""),
    imagen: String(p.imagen || ""),
    activo: p.activo === void 0 ? true : bool17(p.activo),
    origen: text65(p.origen || "WORKER_FIRESTORE")
  };
  if (out2.tipo_fecha === "FIJA") {
    let mes = Number(p.mes || 0), dia = Number(p.dia || 0);
    if ((!mes || !dia) && p.fecha) {
      const m = String(p.fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        mes = Number(m[2]);
        dia = Number(m[3]);
      }
    }
    out2.mes = mes;
    out2.dia = dia;
  }
  if (out2.tipo_fecha === "MOVIL") {
    out2.mes = Number(p.mes || 0);
    out2.semana_mes = norm12(p.semana_mes) === "ULTIMA" ? "ULTIMA" : Number(p.semana_mes || 0);
    out2.dia_semana = norm12(p.dia_semana);
  }
  return out2;
}
function validate2(d) {
  if (!d.tipo) return "Falta tipo";
  if (!d.tipo_fecha) return "Falta tipo_fecha";
  if (!["GENERAL", "PROVINCIAL", "LOCAL"].includes(d.tipo)) return "Tipo de efeméride inválido";
  if (!["FIJA", "MOVIL"].includes(d.tipo_fecha)) return "Tipo de fecha inválido";
  if (!d.nombre) return "Falta nombre";
  if (d.tipo === "LOCAL" && !d.ciudad_id) return "Falta ciudad_id";
  if (d.tipo === "PROVINCIAL" && !d.provincia_id) return "Falta provincia_id";
  if (d.tipo_fecha === "FIJA" && (!d.mes || !d.dia)) return "Faltan mes/dia";
  if (d.tipo_fecha === "MOVIL" && (!d.mes || !d.semana_mes || !d.dia_semana)) return "Faltan datos de fecha móvil";
  if (!Number.isInteger(d.mes) || d.mes < 1 || d.mes > 12) return "Mes inválido";
  if (d.tipo_fecha === "FIJA") {
    const max = new Date(Date.UTC(2e3, d.mes, 0)).getUTCDate();
    if (!Number.isInteger(d.dia) || d.dia < 1 || d.dia > max) return "Día inválido";
  }
  if (d.tipo_fecha === "MOVIL") {
    if (d.semana_mes !== "ULTIMA" && (!Number.isInteger(d.semana_mes) || d.semana_mes < 1 || d.semana_mes > 5)) return "Semana inválida";
    if (!["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "0", "1", "2", "3", "4", "5", "6"].includes(d.dia_semana)) return "Día de semana inválido";
  }
  return "";
}
function canSee2(row, p) {
  const tipo = text65(row.tipo).toUpperCase();
  if (tipo === "GENERAL") return !!p.efemerides_grl;
  if (tipo === "PROVINCIAL") return !!p.efemerides_provincial && (p.todas_provincias || p.provincias.includes(text65(row.provincia_id)));
  if (tipo === "LOCAL") return !!p.efemerides_local && (p.todas_ciudades || p.ciudades.includes(text65(row.ciudad_id)));
  return false;
}
async function efemSaveV3({ db, cache, advertiserId, body, permisos }) {
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  const reqId = text65(payload.efemeride_id || payload.id);
  const existing = reqId ? await db.get("efemerides_bis", reqId) : null;
  if (reqId && !existing) throw new Error("Efeméride no encontrada");
  if (existing && !canSee2(existing, permisos)) throw new Error("No autorizado para esta efeméride");
  const merged = existing ? { ...existing, ...payload, efemeride_id: reqId } : payload;
  const data = sanitize2(merged), err = validate2(data);
  if (err) throw new Error(err);
  if (!canSee2(data, permisos)) throw new Error("No autorizado para esta efeméride");
  const id4 = reqId || "EFE-" + crypto.randomUUID();
  data.efemeride_id = id4;
  data.actualizado_en = (/* @__PURE__ */ new Date()).toISOString();
  if (!existing) {
    data.creado_en = data.actualizado_en;
    data.creado_por = advertiserId;
  } else {
    if (existing.creado_en) data.creado_en = existing.creado_en;
    if (existing.creado_por) data.creado_por = existing.creado_por;
  }
  const fields = Object.keys(payload).filter((k) => !["id", "efemeride_id", "creado_en", "creado_por"].includes(k));
  if (Object.prototype.hasOwnProperty.call(payload, "fecha")) fields.push("mes", "dia");
  const patch = changedFieldsV1(existing, data, { fields: existing ? fields : null });
  const saved = Object.keys(patch).length ? await db.patch("efemerides_bis", id4, patch, { mustExist: !!existing, newDocument: !existing }) : existing;
  await syncEfemeridePreparedV2({ cache, efemerideId: id4, previous: existing, next: saved });
  return { success: true, efemeride: saved };
}
async function efemToggleV3({ db, cache, id: id4, activo, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee2(existing, permisos)) throw new Error("No autorizado");
  const patch = changedFieldsV1(existing, {
    activo: !!activo,
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!Object.keys(patch).length) return { success: true, updated: false, efemeride: existing };
  const saved = await db.patch("efemerides_bis", id4, patch, { mustExist: true });
  await syncEfemeridePreparedV2({ cache, efemerideId: id4, previous: existing, next: saved });
  return { success: true, efemeride: saved };
}
async function efemDeleteV3({ db, cache, id: id4, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee2(existing, permisos)) throw new Error("No autorizado");
  await db.delete("efemerides_bis", id4, { mustExist: true });
  await syncEfemeridePreparedV2({ cache, efemerideId: id4, previous: existing, next: null });
  return { success: true, deleted: true, efemeride_id: id4 };
}

// reconstruccion/worker/routes/panel-v14.js
var text66 = (v) => String(v ?? "").trim();
var truthy6 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text66(v).toLowerCase());
async function bodyOf12(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf8(url, b = {}) {
  return text66(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf8(url, b = {}) {
  return text66(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
function efemPermisos2(admin){
  const a=admin||{},raw=Array.isArray(a.funcionalidades)?a.funcionalidades:text66(a.funcionalidades).split(/[;,|\n]/);
  const flags=new Set(raw.map(v=>text66(v).toUpperCase()));
  const root=a.funcionalidades_config||{},local=root.EFEMERIDES_LOCAL||{},prov=root.EFEMERIDES_PROVINCIAL||{};
  return {
    efemerides_grl:truthy6(a.efemerides_grl)||flags.has('EF GENERAL')||flags.has('EFEMERIDES_GENERAL')||flags.has('EFEMERIDES_GRL'),
    efemerides_provincial:truthy6(a.efemerides_provincial)||flags.has('EF PROVINCIAL')||flags.has('EFEMERIDES_PROVINCIAL'),
    efemerides_local:truthy6(a.efemerides_local)||flags.has('EF LOCAL')||flags.has('EFEMERIDES_LOCAL'),
    todas_provincias:truthy6(a.efemerides_todas_provincias)||truthy6(prov.todas_provincias),
    todas_ciudades:truthy6(a.efemerides_todas_ciudades)||truthy6(local.todas_ciudades),
    provincias:(Array.isArray(prov.provincias)?prov.provincias:Array.isArray(a.efemerides_provincias)?a.efemerides_provincias:[]).map(text66),
    ciudades:(Array.isArray(local.ciudades)?local.ciudades:Array.isArray(a.efemerides_ciudades)?a.efemerides_ciudades:[]).map(text66)
  };
}

async function routePanelV14(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/efemerides" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf12(clone);
    const action = actionOf8(url, body);
    if (["guardar", "save", "activar", "desactivar", "eliminar", "delete"].includes(action)) {
      const aid = aidOf8(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "efemerides", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Efemérides." }, 403);
      }
      const admin = await db.get("anunciantes_administracion", aid);
      const permisos = efemPermisos2(admin || {});
      if (action === "guardar" || action === "save") {
        return json(await efemSaveV3({ db, cache, advertiserId: aid, body, permisos }));
      }
      const id4 = text66(body.efemeride_id || body.id || body.payload && (body.payload.efemeride_id || body.payload.id));
      if (action === "activar" || action === "desactivar") {
        return json(await efemToggleV3({ db, cache, id: id4, activo: action === "activar", permisos }));
      }
      return json(await efemDeleteV3({ db, cache, id: id4, permisos }));
    }
  }
  return routePanelV13(ctx);
}

// reconstruccion/worker/modules/farmacias-v3.js
var {farmSaveCycleV3} = (() => {

const text=v=>String(v??"").trim();

async function farmSaveCycleV3({db,cache,advertiserId,body,allowedCityIds=[]}){
  const payload=body&&body.payload&&typeof body.payload==="object"?body.payload:body||{};
  let id=text(payload.ciclo_id);
  const current=id?await db.get("farmacias_ciclos",id):null;
  if(id&&!current)throw new Error("Ciclo no encontrado.");

  if(current&&text(current.anunciante_id)&&text(current.anunciante_id)!==text(advertiserId)){
    throw new Error("El ciclo no pertenece al anunciante.");
  }

  const merged={...(current||{}),...payload};
  const city=text(merged.ciudad_id);
  if(!city)throw new Error("Falta ciudad.");
  if(allowedCityIds.length&&!allowedCityIds.includes(city))throw new Error("La ciudad no está habilitada para esta cuenta.");
  if(!text(merged.fecha_inicio))throw new Error("Falta fecha de inicio.");
  if(!text(merged.hora_inicio))throw new Error("Falta hora de inicio.");

  const dur=Math.max(1,Number(merged.duracion_horas||24));
  const simult=Math.max(1,Math.floor(Number(merged.farmacias_por_turno||1)));
  if(!id)id="FAR-"+crypto.randomUUID();

  const previousCity=text(current&&current.ciudad_id);
  const hasParts=Array.isArray(payload.participantes);
  const load=async()=>{
    const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500);
    const sedes=[];
    for(const sid of [...new Set(participantes.map(p=>text(p.sede_id)).filter(Boolean))]){
      const sede=await db.get("anunciantes_sedes",sid);if(sede)sedes.push(sede);
    }
    return{participantes,sedes};
  };
  const prepared=current&&!hasParts?await getPreparedRelationsV1({cache,type:"farm",id,current,load}):null;
  let participantes=current?(hasParts?await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500):prepared.participantes):[];
  let sedes=prepared?.sedes||[],participantsChanged=false;

  if(Array.isArray(payload.participantes)){
    const nuevos=payload.participantes.map((p,i)=>({
      ciclo_id:id,
      sede_id:text(p.sede_id),
      orden:Number(p.orden||i+1),
      activo:true,
      actualizado:new Date().toISOString()
    })).filter(p=>p.sede_id);

    if(!nuevos.length)throw new Error("Seleccioná al menos una farmacia.");
    if(new Set(nuevos.map(p=>p.sede_id)).size!==nuevos.length)throw new Error("Farmacia repetida en el ciclo.");
    if(simult>nuevos.length)throw new Error("La cantidad simultánea supera las farmacias seleccionadas.");

    sedes=[];
    for(const p of nuevos){
      const sede=await db.get("anunciantes_sedes",p.sede_id);
      if(!sede)throw new Error("Hay una farmacia/sede inexistente.");
      if(text(sede.ciudad_id)!==city)throw new Error("Todas las farmacias deben pertenecer a la ciudad del ciclo.");
      sedes.push(sede);
    }

    const existentes=participantes;
    const keep=new Set(nuevos.map(p=>id+"__"+p.sede_id));

    for(const r of existentes){
      const rid=text(r.id||(id+"__"+text(r.sede_id)));
      if(rid&&!keep.has(rid)){await db.delete("farmacias_ciclo_sedes",rid);participantsChanged=true;}
    }

    participantes=[];
    for(const p of nuevos){
      const previous=existentes.find(r=>text(r.sede_id)===p.sede_id);
      const patch=changedFieldsV1(previous,p);
      const saved=Object.keys(patch).length?await db.patch("farmacias_ciclo_sedes",id+"__"+p.sede_id,patch,{mustExist:!!previous,newDocument:!previous}):previous;
      if(Object.keys(patch).length)participantsChanged=true;
      participantes.push(saved);
    }
  }else{
    if(!sameValueV1(current?.ciudad_id,city)){
      sedes=[];
      for(const sid of [...new Set(participantes.map(p=>text(p.sede_id)).filter(Boolean))]){
        const sede=await db.get("anunciantes_sedes",sid);
        if(!sede||text(sede.ciudad_id)!==city)throw new Error("Todas las farmacias deben pertenecer a la ciudad del ciclo.");
        sedes.push(sede);
      }
    }
    if(simult>participantes.length)throw new Error("La cantidad simultánea supera las farmacias seleccionadas.");
  }

  const doc={
    ciclo_id:id,
    anunciante_id:advertiserId,
    ciudad_id:city,
    fecha_inicio:text(merged.fecha_inicio),
    hora_inicio:text(merged.hora_inicio),
    duracion_horas:dur,
    farmacias_por_turno:simult,
    activo:merged.activo===undefined?true:!!merged.activo,
    observaciones:text(merged.observaciones),
    actualizado:new Date().toISOString()
  };
  const fields=Object.keys(payload).filter(k=>!["id","ciclo_id","anunciante_id","participantes"].includes(k));
  if(!current&&db.prepareNewPanelList)await db.prepareNewPanelList('farmacias_ciclo_sedes','ciclo_id',id);
  const patch=changedFieldsV1(current,doc,{touch:participantsChanged,fields:current?fields:null});
  const saved=Object.keys(patch).length?await db.patch("farmacias_ciclos",id,patch,{mustExist:!!current,newDocument:!current}):current;

  await syncFarmCyclePreparedV2({
    cache,
    cycleId:id,
    current,
    next:saved,
    participantes,
    sedes,
    previousCity
  });

  return{
    success:true,
    ciclo_id:id,
    ciclo:{...saved,participantes,sedes}
  };
}
return {farmSaveCycleV3};
})();

// reconstruccion/worker/routes/panel-v15.js
var text68 = (v) => String(v ?? "").trim();
async function bodyOf13(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf9(url, b = {}) {
  return text68(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf9(url, b = {}) {
  return text68(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
var truthy7 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text68(v).toLowerCase());
async function allowedFarmCities2({ db, cache, aid }) {
  const admin = await db.get("anunciantes_administracion", aid);
  if (!admin) return [];
  const root = admin.funcionalidades_config && typeof admin.funcionalidades_config === "object" ? admin.funcionalidades_config : {};
  const cfg = root.TURNOS_FARMA || root.FARMACIAS || root.turnos_farma || {};
  const all = truthy7(cfg.todas_ciudades) || text68(admin.turnos_farma) === "*";
  if (all) {
    const territory = await cache.get("territorio:public:v1");
    return (territory && territory.ciudades || []).map((c) => text68(c.ciudad_id || c.id)).filter(Boolean);
  }
  const arr = Array.isArray(cfg.ciudades) ? cfg.ciudades : Array.isArray(admin.farmacias_ciudades) ? admin.farmacias_ciudades : text68(admin.turnos_farma).split(/[;,|]+/).map(text68).filter((v) => v && v !== "*");
  return [...new Set(arr.map(text68).filter(Boolean))];
}
async function routePanelV15(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/farmacias" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf13(clone);
    const action = actionOf9(url, body);
    if (action === "guardar_ciclo") {
      const aid = aidOf9(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "turnos_farma", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Farmacias de turno." }, 403);
      }
      return json(await farmSaveCycleV3({
        db,
        cache,
        advertiserId: aid,
        body,
        allowedCityIds: await allowedFarmCities2({ db, cache, aid })
      }));
    }
  }
  return routePanelV14(ctx);
}

// reconstruccion/worker/modules/moderacion-eventos-v2.js
var text69 = (v) => String(v ?? "").trim();
async function pendingEventsV2({ db, limit = 100 }) {
  const rows = await db.queryEqual("eventos", "estado_moderacion", "PENDIENTE", limit);
  return {
    success: true,
    tipo: "EVENTO",
    pendientes: rows.map((e) => ({
      tipo: "EVENTO",
      id: text69(e.evento_id || e.id),
      evento_id: text69(e.evento_id || e.id),
      anunciante_id: text69(e.anunciante_id || e.id_anunciante),
      nombre: text69(e.nombre_evento || e.nombre),
      ciudad_id: text69(e.ciudad_id),
      nivel: text69(e.nivel),
      fecha_desde: text69(e.fecha_desde),
      fecha_hasta: text69(e.fecha_hasta),
      estado_moderacion: text69(e.estado_moderacion)
    }))
  };
}
async function resolveEventModerationV2({ db, cache, eventId, decision, moderatorId, auth }) {
  const id4 = text69(eventId), dec = text69(decision).toUpperCase();
  if (!id4) throw new Error("Falta evento_id.");
  if (!["APROBAR", "RECHAZAR"].includes(dec)) throw new Error("Decisión inválida.");
  const current = await db.get("eventos", id4);
  if (!current) throw new Error("Evento no encontrado.");
  let checkedProgramacion;
  if (auth && auth.rol === "ADMIN_LOCAL") {
    assertAdminCityV71(auth,current);
    checkedProgramacion = await getPreparedRelationsV1({cache,type:"event",id:id4,current,load:()=>db.queryEqual("evento_programacion","evento_id",id4,500)});
    for (const parte of checkedProgramacion) assertAdminCityV71(auth,{...parte,ciudad_id:parte.ciudad_id||current.ciudad_id});
  }
  const approved = dec === "APROBAR";
  const saved = await db.patch("eventos", id4, {
    estado_moderacion: approved ? "APROBADO" : "RECHAZADO",
    estado: approved ? "ACTIVO" : "RECHAZADO",
    moderado_por: text69(moderatorId),
    moderado_en: (/* @__PURE__ */ new Date()).toISOString(),
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: true });
  await syncEventV2({ db, cache, current, next: saved, programacion: checkedProgramacion });
  return { success: true, tipo: "EVENTO", id: id4, decision: dec, estado_moderacion: saved.estado_moderacion };
}

// reconstruccion/worker/routes/admin-v3.js
var text70 = (v) => String(v ?? "").trim();
async function requireAdmin(env, request2) {
  const a = await verifyAdmin(env, request2);
  return a.ok ? a : null;
}
async function routeAdminV3({ path, request: request2, env, db, cache }) {
  if (!path.startsWith("/superadmin/")) return null;
  if (path === "/superadmin/territory" && request2.method === "GET") return territoryAdmin({ env, request: request2, cache });
  if (path === "/superadmin/territory/rebuild-cache" && request2.method === "POST") return rebuildTerritory({ env, request: request2, db, cache });
  if (path === "/superadmin/countries/create" && request2.method === "POST") return saveCountry({ env, request: request2, db, cache });
  if (path === "/superadmin/provinces/create" && request2.method === "POST") return saveProvince({ env, request: request2, db, cache });
  if (path === "/superadmin/cities/create" && request2.method === "POST") return saveCity({ env, request: request2, db, cache });
  let m = path.match(/^\/superadmin\/countries\/([^/]+)$/);
  if (m && request2.method === "PATCH") return saveCountry({ env, request: request2, db, cache, idFromPath: decodeURIComponent(m[1]) });
  m = path.match(/^\/superadmin\/provinces\/([^/]+)$/);
  if (m && request2.method === "PATCH") return saveProvince({ env, request: request2, db, cache, idFromPath: decodeURIComponent(m[1]) });
  m = path.match(/^\/superadmin\/cities\/([^/]+)$/);
  if (m && request2.method === "PATCH") return saveCity({ env, request: request2, db, cache, idFromPath: decodeURIComponent(m[1]) });
  const a = await requireAdmin(env, request2);
  if (!a) return json({ success: false, message: "Sesión de administrador requerida." }, 401);
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(a.rol)) {
    return json({ success: false, message: "Permiso insuficiente." }, 403);
  }
  if (path === "/superadmin/catalogs/rebuild-cache" && request2.method === "POST") return json(await rebuildCatalogs({ db, cache }));
  if (path === "/superadmin/guide/rebuild-cache" && request2.method === "POST") return json(await rebuildGuideAll({ db, cache }));
  if (path === "/superadmin/promos/rebuild-cache" && request2.method === "POST") return json(await rebuildPromosAll({ db, cache }));
  if (path === "/superadmin/events/rebuild-cache" && request2.method === "POST") return json(await rebuildEventsAllV2({ db, cache }));
  if (path === "/superadmin/activities/rebuild-cache" && request2.method === "POST") return json(await rebuildActivitiesAllV2({ db, cache }));
  if (path === "/superadmin/publicity/rebuild-cache" && request2.method === "POST") return json(await rebuildPublicityAllV2({ db, cache }));
  if (path === "/superadmin/pharmacies/rebuild-cache" && request2.method === "POST") return json(await rebuildFarmAllV2({ db, cache }));
  if (path === "/superadmin/moderation/events/pending" && request2.method === "GET") {
    return json(env.GLD_PUBLIC_CACHE?await pendingActor126(env,'pending-events-read'):await pendingEventsV2({db,limit:100}));
  }
  if (path === "/superadmin/moderation/events/resolve" && request2.method === "POST") {
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await resolveEventModerationV2({
      db,
      cache,
      eventId: text70(body.evento_id || body.id),
      decision: text70(body.decision || body.accion),
      moderatorId: a.sid,
      auth: a
    }));
  }
  return null;
}

// reconstruccion/worker/core/guide-patch-v2.js
var text71 = (v) => String(v ?? "").trim();
function sortCards4(rows) {
  return [...rows].sort((a, b) => text71(a.nombre).localeCompare(text71(b.nombre), "es", { sensitivity: "base" }));
}
function upsert3(rows, card) {
  const aid = text71(card.id);
  const out2 = (rows || []).filter((x) => text71(x.id) !== aid);
  if (card.aprobado !== false) out2.push(card);
  return sortCards4(out2);
}
async function patchGuideSegmentV2({ cache, advertiserId, segmentoId }) {
  const aid = text71(advertiserId), sid = text71(segmentoId);
  const [base2, catalogs] = await Promise.all([
    guideBaseForMutationInternal(cache,aid),
    cache.get("catalogs:commerce:v1")
  ]);
  if (!base2 || !Array.isArray(base2.cards)) {
    return { success: true, changed: false, needs_full_sync: true, firestore_reads: 0 };
  }
  const segment = (catalogs && catalogs.segmentos || []).find((s) => text71(s.segmento_id || s.id) === sid) || {};
  const nextCards = base2.cards.map((card) => ({
    ...card,
    segmento_id: sid,
    segmento: text71(segment.nombre)
  }));
  for (const card of nextCards) {
    const cityId = text71(card.ciudad_id);
    const packet2 = await cache.get(guideCityKey2(cityId)) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    await cache.put(guideCityKey2(cityId), {
      version: 2,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      anunciantes: upsert3(packet2.anunciantes || [], card)
    });
  }
  await cache.put(guideAdvertiserKey(aid), {
    ...base2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    cards: nextCards
  });
  return { success: true, changed: true, ciudades: base2.ciudades || [], firestore_reads: 0 };
}

// reconstruccion/worker/modules/superadmin-anunciantes-v2.js
var text72 = (v) => String(v ?? "").trim();
function isTopAdmin(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text72(auth && auth.rol).toUpperCase());
}
async function updateAdvertiserCommercialV2({ db, cache, auth, advertiserId, payload }) {
  if (!isTopAdmin(auth)) throw new Error("No tenés permiso para modificar la configuración comercial.");
  const aid = text72(advertiserId || payload && payload.anunciante_id || payload && payload.id);
  if (!aid) throw new Error("Falta anunciante_id.");
  if(!/^[a-f0-9]{64}$/.test(String(payload.revision_comercial||'')))throw httpError('Volvé a abrir la ficha antes de guardar la configuración.',409);
  const commercialSource=await db.getVersioned('anunciantes_administracion',aid);
  if(!commercialSource.doc||!commercialSource.updateTime||payload.revision_comercial!==await commercialRevisionInternal(commercialSource.doc))throw httpError('La configuración cambió mientras la editabas. Volvé a abrir la ficha para conservar los cambios de ambas personas.',409);
  let nextCommercialRevision=payload.revision_comercial;
  const adminPatch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString(), actualizado_por: text72(auth.sid) };
  let adminTouched = false;
  if (Object.prototype.hasOwnProperty.call(payload, "nivel")) {
    const nivel = text72(payload.nivel);
    const catalog=await getCommerceCatalogs(cache);
    const levels=(catalog.niveles_anunciante||[]).filter(x=>x.activo!==false);
    const allowed=levels.length?levels.flatMap(x=>[x.numero,x.nivel_id,x.id].filter(v=>v!==undefined).map(String)):['0','3','4','5','6'];
    if(!allowed.includes(nivel))throw Error('Elegí un nivel habilitado en la configuración de Gran Hermano.');
    adminPatch.nivel = nivel;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "subnivel")) {
    adminPatch.subnivel = text72(payload.subnivel);
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "aprobado")) {
    adminPatch.aprobado = !!payload.aprobado;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "verificado")) {
    adminPatch.verificado = !!payload.verificado;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "gold")) {
    adminPatch.gold = !!payload.gold;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "funcionalidades")) {
    adminPatch.funcionalidades = Array.isArray(payload.funcionalidades) ? payload.funcionalidades.map(text72).filter(Boolean) : text72(payload.funcionalidades).split(/[;,|\n]/).map(text72).filter(Boolean);
    adminPatch.funcionalidades = [...new Set(adminPatch.funcionalidades.map(canonicalFeatureId112))];
    adminPatch.publi = false;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "funcionalidades_config")) {
    if (!payload.funcionalidades_config || typeof payload.funcionalidades_config !== "object" || Array.isArray(payload.funcionalidades_config)) {
      throw new Error("La configuración de funcionalidades no es válida.");
    }
    adminPatch.funcionalidades_config = structuredClone(payload.funcionalidades_config);
    if(adminPatch.funcionalidades_config.PUBLI){adminPatch.funcionalidades_config.PUBLICIDAD??=adminPatch.funcionalidades_config.PUBLI;delete adminPatch.funcionalidades_config.PUBLI;}
    for(const key of ["PROMOS","PROMOCIONES","EVENTOS","EVENTOS_VIP","EVENTOS_FREE","ACTIVIDADES","PUBLICIDAD","PUBLI"]){
      const cfg=adminPatch.funcionalidades_config[key];if(!cfg||typeof cfg!=="object")continue;
      delete cfg.guardadas_max;delete cfg.max_guardadas;delete cfg.guardadas;
    }
    adminTouched = true;
  }
  if(adminPatch.funcionalidades_config){
    const numeric=new Set(['cantidad','cupo','max','maximo','activas_max','cambios_activos_por_dia_max']);
    for(const [name,cfg]of Object.entries(adminPatch.funcionalidades_config)){
      if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))throw Error('Configuración inválida para '+name+'.');
      for(const [key,value]of Object.entries(cfg))if(numeric.has(key)&&(!Number.isSafeInteger(value)||value<0))throw Error('El límite '+name+' debe ser un número entero mayor o igual a cero.');
    }
    const adContract=adminPatch.funcionalidades_config.PUBLICIDAD;
    if(adContract){
      for(const k of ['ciudades_sin_limite','categorias_sin_limite'])if(Object.hasOwn(adContract,k)&&typeof adContract[k]!=='boolean')throw httpError('Revisá los límites de cobertura de Publicidad.',400);
      for(const k of ['activas_max','ciudades_max','categorias_max'])if(Object.hasOwn(adContract,k)&&(!Number.isSafeInteger(Number(adContract[k]))||Number(adContract[k])<0))throw httpError('Los cupos de Publicidad deben ser enteros mayores o iguales a cero.',400);
      for(const k of ['ciudades_ids','ubicaciones_ids','categorias_keys'])if(Object.hasOwn(adContract,k)&&(!Array.isArray(adContract[k])||adContract[k].some(v=>typeof v!=='string')))throw httpError('Revisá la cobertura contratada de Publicidad.',400);
      for(const k of ['vigente_desde','vigente_hasta'])if(adContract[k]&&birthDateOnly_(adContract[k])!==adContract[k])throw httpError('Revisá las fechas de contratación de Publicidad.',400);
      if(adContract.vigente_desde&&adContract.vigente_hasta&&adContract.vigente_desde>adContract.vigente_hasta)throw httpError('El fin de la contratación debe ser posterior al inicio.',400);
    }
    const root=adminPatch.funcionalidades_config;
    if(root.EVENTOS_FREE&&Object.hasOwn(root.EVENTOS_FREE,"sin_limites")&&typeof root.EVENTOS_FREE.sin_limites!=="boolean")throw new Error("La excepción de Eventos Free debe ser una opción válida.");
    if(root.TURNOS_FARMA){adminPatch.turnos_farma=root.TURNOS_FARMA.todas_ciudades?'*':(root.TURNOS_FARMA.ciudades||[]).join(',');adminPatch.farmacias_ciudades=root.TURNOS_FARMA.ciudades||[];}
    if(root.EFEMERIDES_LOCAL){adminPatch.efemerides_todas_ciudades=!!root.EFEMERIDES_LOCAL.todas_ciudades;adminPatch.efemerides_ciudades=root.EFEMERIDES_LOCAL.ciudades||[];}
    if(root.EFEMERIDES_PROVINCIAL){adminPatch.efemerides_todas_provincias=!!root.EFEMERIDES_PROVINCIAL.todas_provincias;adminPatch.efemerides_provincias=root.EFEMERIDES_PROVINCIAL.provincias||[];}
  }
  if(adminPatch.funcionalidades){
    const active=new Set(adminPatch.funcionalidades.map(x=>String(x).toUpperCase()));
    const groups={PROMOS:['PROMOS','PROMOCIONES'],EVENTOS:['EVENTOS','EVENTOS_VIP','EVENTOS VIP'],EVENTOS_FREE:['EVENTOS_FREE','EV_FREE','EVFREE','EVENTOS FREE'],ACTIVIDADES:['ACTIVIDADES'],PUBLICIDAD:['PUBLICIDAD'],TURNOS_FARMA:['TURNOS_FARMA','FARMACIAS','TURNOS FARMA'],EFEMERIDES_GRL:['EFEMERIDES_GRL','EFEMERIDES_GENERAL','EF GENERAL'],EFEMERIDES_PROVINCIAL:['EFEMERIDES_PROVINCIAL','EF PROVINCIAL'],EFEMERIDES_LOCAL:['EFEMERIDES_LOCAL','EF LOCAL']};
    for(const [name,aliases]of Object.entries(groups)){
      const enabled=aliases.some(x=>active.has(x));
      for(const alias of aliases)if(alias!=='TURNOS_FARMA')adminPatch[alias.toLowerCase()]=enabled;
      if(name==='TURNOS_FARMA'&&!enabled)adminPatch.turnos_farma='';
    }
  }
  let firestoreWrites = 0;
  if (adminTouched) {
    const savedAdmin=await db.patch("anunciantes_administracion", aid, adminPatch, { mustExist: true,updateTime:commercialSource.updateTime });
    nextCommercialRevision=await commercialRevisionInternal(savedAdmin);
    const contractBefore132={...publicityContractV101(commercialSource.doc),habilitada:featureEnabled2(commercialSource.doc,"PUBLICIDAD")};
    const contractAfter132={...publicityContractV101(savedAdmin),habilitada:featureEnabled2(savedAdmin,"PUBLICIDAD")};
    if(!sameCacheData129(contractBefore132,contractAfter132))await cache.put("publicity:contract:v101:"+aid,contractAfter132);
    firestoreWrites++;
    await Promise.all([
      patchGuideAdminFieldsV2({ cache, advertiserId: aid, patch: adminPatch }),
      patchAdvertiserIndexCommercialV2({ cache, advertiserId: aid, patch: adminPatch })
    ]);
  }
  let segmentoId = null;
  if (Object.prototype.hasOwnProperty.call(payload, "segmento_id")) {
    segmentoId = text72(payload.segmento_id);
    await db.patch("anunciantes", aid, { segmento_id: segmentoId, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() }, { mustExist: true });
    firestoreWrites++;
    await patchGuideSegmentV2({ cache, advertiserId: aid, segmentoId });
  }
  return {
    success: true,
    updated: true,
    anunciante_id: aid,
    revision_comercial:nextCommercialRevision,
    administracion_patch: adminTouched ? adminPatch : {},
    segmento_id: segmentoId,
    firestore_writes: firestoreWrites,
    firestore_reads: 0
  };
}

// reconstruccion/worker/routes/admin-v4.js
var text73 = (v) => String(v ?? "").trim();
async function routeAdminV4(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  let m = path.match(/^\/superadmin\/advertisers\/([^/]+)\/commercial$/);
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await updateAdvertiserCommercialV2({
      db,
      cache,
      auth,
      advertiserId: decodeURIComponent(m[1]),
      payload: body && body.payload && typeof body.payload === "object" ? body.payload : body
    }));
  }
  if (path === "/superadmin/guide/rebuild-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text73(auth.rol).toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildGuideAllV2({ db, cache }));
  }
  return routeAdminV3(ctx);
}

// reconstruccion/worker/modules/superadmin-anunciantes-profile-v2.js
var text74 = (v) => String(v ?? "").trim();
function isTopAdmin2(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text74(auth && auth.rol).toUpperCase());
}
async function updateAdvertiserProfileV2({ db, cache, auth, advertiserId, payload }) {
  if (!isTopAdmin2(auth)) throw new Error("No tenés permiso para modificar los datos del anunciante.");
  const aid = text74(advertiserId);
  if (!aid) throw new Error("Falta anunciante_id.");
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  let touched = false;
  if (Object.prototype.hasOwnProperty.call(payload, "segmento_id")) {
    patch.segmento_id = text74(payload.segmento_id);
    touched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "categoria_ids")) {
    patch.categoria_ids = Array.isArray(payload.categoria_ids) ? payload.categoria_ids.map(text74).filter(Boolean) : [];
    touched = true;
  }
  for (const key3 of ["pet", "eco", "gayfriendly"]) {
    if (Object.prototype.hasOwnProperty.call(payload, key3)) {
      patch[key3] = !!payload[key3];
      touched = true;
    }
  }
  if(Object.hasOwn(payload,"contenido_adulto")){Object.assign(patch,adultFields({},payload));touched=true;}
  if (!touched) return { success: true, updated: false, anunciante_id: aid };
  if(!/^[a-f0-9]{64}$/.test(String(payload.revision_perfil||'')))throw httpError('Volvé a abrir la ficha antes de guardar sus datos.',409);
  const version=await db.getVersioned('anunciantes',aid);
  if(!version.doc||!version.updateTime||payload.revision_perfil!==await fieldRevisionInternal(version.doc,PROFILE_REVISION_FIELDS_INTERNAL))throw httpError('Los datos cambiaron mientras los editabas. Volvé a abrir la ficha para conservar ambos cambios.',409);
  const savedProfile=await db.patch("anunciantes", aid, patch, { mustExist: true,updateTime:version.updateTime });
  await patchGuideAdvertiserDataFromCacheV2({ cache, advertiserId: aid, patch });
  return {
    success: true,
    updated: true,
    anunciante_id: aid,
    revision_perfil:await fieldRevisionInternal(savedProfile,PROFILE_REVISION_FIELDS_INTERNAL),
    firestore_writes: 1
  };
}
async function updateAdvertiserSedeRelationsV2({ db, cache, auth, advertiserId, sedes }) {
  if (!isTopAdmin2(auth)) throw new Error("No tenés permiso para modificar las sedes.");
  const aid = text74(advertiserId);
  if (!aid) throw new Error("Falta anunciante_id.");
  const rows = Array.isArray(sedes) ? sedes : [];
  let writes = 0;
  const prepared = [], seen = /* @__PURE__ */ new Set(), savedSedes = [];
  for (const raw of rows) {
    const sid = text74(raw && raw.sede_id);
    if (!sid) continue;
    if (seen.has(sid)) throw new Error("Sede repetida en la operación.");
    seen.add(sid);
    if(!/^[a-f0-9]{64}$/.test(String(raw.revision_sede||'')))throw httpError('Volvé a abrir la ficha antes de guardar sus sedes.',409);
    const version=await db.getVersioned('anunciantes_sedes',sid),current=version.doc;
    if(!version.updateTime||raw.revision_sede!==await fieldRevisionInternal(current||{},SEDE_REVISION_FIELDS_INTERNAL))throw httpError('Una sede cambió mientras la editabas. Volvé a abrir la ficha antes de guardar.',409);
    if (!current || text74(current.anunciante_id) !== aid) {
      throw new Error("La sede " + sid + " no pertenece al anunciante.");
    }
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(raw, "actividad_ids")) {
      patch.actividad_ids = Array.isArray(raw.actividad_ids) ? raw.actividad_ids.map(text74).filter(Boolean) : [];
    }
    if (Object.prototype.hasOwnProperty.call(raw, "accion_ids")) {
      patch.accion_ids = Array.isArray(raw.accion_ids) ? raw.accion_ids.map(text74).filter(Boolean) : [];
    }
    if (Object.prototype.hasOwnProperty.call(raw, "nodo_ids")) {
      patch.nodo_ids = Array.isArray(raw.nodo_ids) ? raw.nodo_ids.map(text74).filter(Boolean) : [];
    }
    for (const key3 of Object.keys(patch)) {
      if (JSON.stringify(patch[key3]) === JSON.stringify(current[key3])) delete patch[key3];
    }
    prepared.push({ sid, patch,current,updateTime:version.updateTime });
  }
  const entries=prepared.filter(x=>Object.keys(x.patch).length).map(x=>({collection:'anunciantes_sedes',id:x.sid,before:x.current,patch:{...x.patch,actualizado_en:new Date().toISOString()},options:{updateTime:x.updateTime}}));
  if(entries.length){savedSedes.push(...await db.commitPatches(entries));writes=entries.length;}
  if (writes) await patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId: aid, savedSedes });
  return { success: true, updated: !!writes, revision_sedes:Object.fromEntries(await Promise.all(savedSedes.map(async row=>[String(row.sede_id||row.id),await fieldRevisionInternal(row,SEDE_REVISION_FIELDS_INTERNAL)]))), sedes_actualizadas: writes, firestore_writes: writes };
}

// reconstruccion/worker/routes/admin-v5.js
async function routeAdminV5(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  let m = path.match(/^\/superadmin\/advertisers\/([^/]+)\/profile$/);
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await updateAdvertiserProfileV2({
      db,
      cache,
      auth,
      advertiserId: decodeURIComponent(m[1]),
      payload: body && body.payload && typeof body.payload === "object" ? body.payload : body
    }));
  }
  m = path.match(/^\/superadmin\/advertisers\/([^/]+)\/sedes\/relations$/);
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await updateAdvertiserSedeRelationsV2({
      db,
      cache,
      auth,
      advertiserId: decodeURIComponent(m[1]),
      sedes: Array.isArray(body.sedes) ? body.sedes : []
    }));
  }
  return routeAdminV4(ctx);
}

// reconstruccion/worker/modules/moderacion-general-v2.js
var text75 = (v) => String(v ?? "").trim();
function isRejectedActivity(a) {
  return ["RECHAZADA", "RECHAZADO", "ELIMINADA", "ELIMINADO"].includes(text75(a && a.estado).toUpperCase());
}
async function pendingAllV2({ db }) {
  const [evPend, evRev, activities, requests] = await Promise.all([
    db.queryEqual("eventos", "estado_moderacion", "PENDIENTE", 200),
    db.queryEqual("eventos", "estado_moderacion", "REVISION", 200),
    db.queryEqual("actividades", "aprobado", false, 200),
    db.queryEqual("solicitudes_anunciante", "estado", "PENDIENTE", 200)
  ]);
  const eventos = [...evPend, ...evRev].filter(e=>!rejectedActivity(e)).map((e) => ({
    tipo: "EVENTO",
    id: text75(e.evento_id || e.id),
    evento_id: text75(e.evento_id || e.id),
    nombre: text75(e.nombre_evento || e.nombre),
    ciudad_id: text75(e.ciudad_id),
    anunciante_id: text75(e.anunciante_id || e.id_anunciante),
    nivel: text75(e.nivel),
    estado: text75(e.estado_moderacion || "PENDIENTE"),
    fecha: text75(e.fecha_desde || e.fecha_carga),
    motivo: text75(e.motivo_revision)
  }));
  const actividades = activities.filter((a) => !isRejectedActivity(a)).map((a) => ({
    tipo: "ACTIVIDAD",
    id: text75(a.actividad_id || a.id),
    actividad_id: text75(a.actividad_id || a.id),
    nombre: text75(a.nombre),
    ciudad_id: text75(a.ciudad_id),
    anunciante_id: text75(a.anunciante_id),
    estado: text75(a.estado || "PENDIENTE"),
    fecha: text75(a.creado || a.actualizado)
  }));
  const anunciantes = requests.map((x) => ({
    tipo: "ANUNCIANTE",
    id: text75(x.solicitud_id || x.id),
    solicitud_id: text75(x.solicitud_id || x.id),
    modo: text75(x.modo).toUpperCase(),
    nombre: text75(x.nombre),
    ciudad_id: text75(x.ciudad_id),
    anunciante_id: text75(x.anunciante_id),
    suscriptor_id: text75(x.suscriptor_id),
    estado: "PENDIENTE",
    fecha: text75(x.creado_en),
    detalle: x.detalle || {}
  }));
  return {
    success: true,
    cantidades: {
      eventos: eventos.length,
      actividades: actividades.length,
      anunciantes: anunciantes.length,
      total: eventos.length + actividades.length + anunciantes.length
    },
    eventos,
    actividades,
    anunciantes
  };
}
function newAdvertiserId() {
  return "ADV-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}
async function resolvePendingV2({ db, cache, auth, tipo, id: id4, decision, nivel = "" }) {
  const kind = text75(tipo).toUpperCase();
  const itemId = text75(id4);
  const dec = text75(decision).toUpperCase();
  if (!itemId || !["APROBAR", "RECHAZAR"].includes(dec)) throw new Error("Falta indicar contenido o decisión.");
  if (kind === "EVENTO") {
    return resolveEventModerationV2({
      db,
      cache,
      eventId: itemId,
      decision: dec,
      moderatorId: auth.sid,
      auth
    });
  }
  if (kind === "ACTIVIDAD") {
    const current = await db.get("actividades", itemId);
    if (!current) throw new Error("Actividad no encontrada.");
    const saved = await db.patch("actividades", itemId, {
      aprobado: dec === "APROBAR",
      estado: dec === "APROBAR" ? "ACTIVA" : "RECHAZADA",
      moderado_por: text75(auth.sid),
      moderado_en: (/* @__PURE__ */ new Date()).toISOString(),
      actualizado: (/* @__PURE__ */ new Date()).toISOString()
    }, { mustExist: true });
    await syncActivity({ db, cache, activityId: itemId, previousCities: [] });
    return { success: true, tipo: kind, id: itemId, decision: dec, estado: saved.estado };
  }
  if (kind === "ANUNCIANTE") {
    const req = await db.get("solicitudes_anunciante", itemId);
    if (!req) throw new Error("Solicitud de anunciante no encontrada.");
    if (text75(req.estado).toUpperCase() !== "PENDIENTE") throw new Error("La solicitud ya fue resuelta.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const sid = text75(req.suscriptor_id), modo = text75(req.modo).toUpperCase();
    if (dec === "RECHAZAR") {
      await db.patch("solicitudes_anunciante", itemId, {
        estado: "RECHAZADA",
        moderado_por: text75(auth.sid),
        moderado_en: now,
        actualizado_en: now
      }, { mustExist: true });
      return { success: true, tipo: kind, id: itemId, decision: dec };
    }
    let aid = text75(req.anunciante_id);
    if (modo === "CREAR") {
      const level = text75(nivel);
      if (!level) throw new Error("Seleccioná el nivel del nuevo anunciante.");
      aid = newAdvertiserId();
      const detail = req.detalle || {};
      const city = text75(req.ciudad_id);
      await db.patch("anunciantes", aid, {
        id: aid,
        nombre: text75(req.nombre),
        actividad: text75(detail.actividad),
        descripcion: text75(detail.descripcion),
        whatsapp: text75(detail.whatsapp),
        mail: text75(detail.mail),
        web: text75(detail.web),
        creado_en: now,
        actualizado_en: now
      });
      await db.patch("anunciantes_administracion", aid, {
        id: aid,
        aprobado: true,
        nivel: level,
        subnivel: "0",
        verificado: false,
        gold: false,
        funcionalidades: [],
        creado_en: now,
        actualizado_en: now
      });
      if (city) {
        const sedeId = "SED-" + aid + "-MAIN";
        await db.patch("anunciantes_sedes", sedeId, {
          sede_id: sedeId,
          anunciante_id: aid,
          ciudad_id: city,
          nombre_sede: "Principal",
          direccion: text75(detail.direccion),
          whatsapp: text75(detail.whatsapp),
          mail: text75(detail.mail),
          web: text75(detail.web),
          activo: true,
          creado_en: now,
          actualizado_en: now
        });
      }
    } else if (modo === "RECLAMAR") {
      if (!aid || !await db.get("anunciantes", aid)) throw new Error("El anunciante reclamado ya no existe.");
    } else {
      throw new Error("Tipo de solicitud inválido.");
    }
    const relId = sid + "__" + aid;
    await db.patch("suscriptor_anunciante", relId, {
      relacion_id: relId,
      suscriptor_id: sid,
      anunciante_id: aid,
      rol: "PROPIETARIO",
      activo: true,
      fecha_alta: now,
      actualizado: now
    });
    await db.patch("solicitudes_anunciante", itemId, {
      estado: "APROBADA",
      anunciante_id: aid,
      moderado_por: text75(auth.sid),
      moderado_en: now,
      actualizado_en: now
    }, { mustExist: true });
    if (modo === "CREAR") {
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
    }
    return { success: true, tipo: kind, id: itemId, decision: dec, anunciante_id: aid, suscriptor_id: sid };
  }
  throw new Error("Tipo de contenido no reconocido.");
}

// reconstruccion/worker/routes/admin-v6.js
var text76 = (v) => String(v ?? "").trim();
function canModerate(auth) {
  const role = text76(auth && auth.rol).toUpperCase();
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(role);
}
async function routeAdminV6(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/efemerides/rebuild-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text76(auth.rol).toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildEfemeridesAllV3({ db, cache }));
  }
  if (path === "/superadmin/moderation/pending" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    return json(await pendingAllV2({ db }));
  }
  if (path === "/superadmin/moderation/resolve" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await resolvePendingV2({
      db,
      cache,
      auth,
      tipo: text76(body.tipo),
      id: text76(body.id || body.evento_id || body.actividad_id || body.solicitud_id),
      decision: text76(body.decision),
      nivel: text76(body.nivel)
    }));
  }
  return routeAdminV5(ctx);
}

// reconstruccion/worker/maintenance/rebuild-all-v2.js
async function rebuildAllReadModelsV2({ env, request: request2, db, cache }) {
  const sourceDb116=db,snapshots116=new Map();
  db={...db,async listCollection(/** @type {string} */ collection,/** @type {any[]} */ ...args){const rows=await sourceDb116.listCollection(collection,...args);snapshots116.set(collection,rows);return rows;}};
  const started = (/* @__PURE__ */ new Date()).toISOString();
  const territoryResponse = await rebuildTerritory({ env, request: request2, db, cache });
  const territory = await territoryResponse.clone().json().catch(() => ({ success: false }));
  if (!territoryResponse.ok || territory.success !== true) {
    throw new Error(territory.message || "No se pudo reconstruir Territorio.");
  }
  const catalogs = await rebuildCatalogs({ db, cache });
  const guideReady = rebuildGuideAllV2({ db, cache });
  const [
    guide,
    promos,
    events,
    activities,
    publicity,
    efemerides,
    pharmacies,
    adminIndexes
  ] = await Promise.all([
    guideReady,
    rebuildPromosAll({ db, cache }),
    rebuildEventsAllV2({ db, cache }),
    rebuildActivitiesAllV2({ db, cache }),
    rebuildPublicityAllV2({ db, cache }),
    rebuildEfemeridesAllV3({ db, cache }),
    guideReady.then(() => rebuildFarmAllV2({ db, cache })),
    rebuildAdminIndexesV2({ db, cache })
  ]);
  const paneles_privados=await startPanelPreparation116(cache,snapshots116);
  return {
    paneles_privados,
    success: true,
    started_at: started,
    finished_at: (/* @__PURE__ */ new Date()).toISOString(),
    territory,
    catalogs,
    guide,
    promos,
    events,
    activities,
    publicity,
    efemerides,
    pharmacies,
    adminIndexes
  };
}

const panelPreparationCollections116=['anunciantes','anunciantes_administracion','anunciantes_sedes','eventos','actividades','promos','publicidades','farmacias_ciclos','evento_programacion','actividad_horarios','publicidad_media','publicidad_segmentacion','farmacias_ciclo_sedes'];
async function startPanelPreparation116(/** @type {any} */ cache,/** @type {Map<string,any[]>} */ snapshots){
 const id=crypto.randomUUID(),entries=panelPreparationCollections116.filter(c=>snapshots.has(c)).map(c=>[c,snapshots.get(c)]);
 if(entries.some(([,rows])=>JSON.stringify(rows).length>2000000))throw httpError('La preparación supera el tamaño de este lote. No se reemplazó ninguna copia existente.',409);
 for(const [c,rows]of entries)await cache.put('panel:prepare:v116:'+id+':'+c,rows,{expirationTtl:86400});
 const state={id,creado_en:Date.now(),collections:entries.map(([c])=>c),cursor:0,completo:false,preparadas:0,existentes:0,omitidas:0,procesados:0,anunciantes:new Set([...(snapshots.get('anunciantes')||[]),...(snapshots.get('anunciantes_administracion')||[])].map(r=>String(r.id||r.anunciante_id))).size};
 await cache.put('panel:prepare:v116:state',state);return state;
}
async function routePanelPreparation116(/** @type {any} */ ctx){
 const {path,request,env,db,cache}=ctx;if(path!=='/superadmin/panel-cache/prepare')return null;
 const auth=await verifyAdmin(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);if(!isTopAdmin(auth))return json({success:false,message:'La preparación general corresponde a Gran Hermano.'},403);
 if(!['GET','POST'].includes(request.method))return json({success:false,message:'Método inválido.'},405);
 let state=await cache.get('panel:prepare:v116:state');if(request.method==='GET')return json({success:true,estado:state});
 const body=await request.json().catch(()=>({}));
 if(body.action==='iniciar'){
  if(state&&(state.completo||Date.now()-Number(state.creado_en||0)<23*3600000))return json({success:true,estado:state});
  const snapshots=new Map();for(const c of panelPreparationCollections116)snapshots.set(c,await db.listCollection(c));
  state=await startPanelPreparation116(cache,snapshots);return json({success:true,estado:state});
 }
 if(!state)return json({success:false,message:'Primero iniciá la preparación general.'},409);
 if(state.completo)return json({success:true,estado:state});
 const snapshots=new Map();for(const c of state.collections){const rows=await cache.get('panel:prepare:v116:'+state.id+':'+c);if(!Array.isArray(rows))throw httpError('La preparación quedó incompleta. Volvé a iniciarla.',409);snapshots.set(c,rows);}
 const batch=await db.primePanelSnapshots116(snapshots,state.cursor);state={...state,cursor:batch.next_cursor??batch.procesados,completo:batch.completo,procesados:batch.procesados,preparadas:state.preparadas+batch.preparadas,existentes:state.existentes+batch.existentes,omitidas:state.omitidas+batch.omitidas};
 await cache.put('panel:prepare:v116:state',state);return json({success:true,estado:state});
}

// reconstruccion/worker/routes/admin-v7.js
var text77 = (v) => String(v ?? "").trim();
async function routeAdminV7(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/rebuild-all-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text77(auth.rol).toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildAllReadModelsV2({ env, request: request2, db, cache }));
  }
  return routeAdminV6(ctx);
}

// reconstruccion/worker/modules/superadmin-directorio-v2.js
var text78 = (v) => String(v ?? "").trim();
async function adminSearchAdvertisersV2({ cache, url }) {
  return searchAdvertisersV2({
    cache,
    q: text78(url.searchParams.get("q")),
    cityId: text78(url.searchParams.get("ciudad_id")),
    limit: Number(url.searchParams.get("limit") || 100),
    offset:url.searchParams.has("offset")?Number(url.searchParams.get("offset")):null
  });
}
async function adminSearchSubscribersV2({ cache, url }) {
  return searchSubscribersV2({
    cache,
    q: text78(url.searchParams.get("q")),
    tipo: text78(url.searchParams.get("tipo")),
    cityId: text78(url.searchParams.get("ciudad_id")),
    limit: Number(url.searchParams.get("limit") || 100),
    offset:url.searchParams.has("offset")?Number(url.searchParams.get("offset")):null
  });
}
async function adminAdvertiserDetailV2({ db, id: id4 }) {
  return advertiserDetailV2({ db, advertiserId: id4 });
}
async function adminSubscriberDetailV2({ db, id: id4 }) {
  return subscriberDetailV2({ db, subscriberId: id4 });
}

// reconstruccion/worker/routes/admin-v8.js
async function routeAdminV8(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/superadmin/advertisers/search" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminSearchAdvertisersV2({ cache, url }));
  }
  let m = path.match(/^\/superadmin\/advertisers\/([^/]+)$/);
  if (m && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminAdvertiserDetailV2({ db, id: decodeURIComponent(m[1]) }));
  }
  if (path === "/superadmin/subscribers/search" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminSearchSubscribersV2({ cache, url }));
  }
  m = path.match(/^\/superadmin\/subscribers\/([^/]+)$/);
  if (m && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminSubscriberDetailV2({ db, id: decodeURIComponent(m[1]) }));
  }
  if (path === "/superadmin/directories/rebuild-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(String(auth.rol || "").trim().toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildAdminIndexesV2({ db, cache }));
  }
  return routeAdminV7(ctx);
}

// reconstruccion/worker/modules/superadmin-catalogos-v2.js
var ADMIN_KEY2 = "admin:catalogs:v2";
var text79 = (v) => String(v ?? "").trim();
var defs = {
  publicidad_ubicaciones:{collection:"publicidad_ubicaciones",idField:"ubicacion_id",moduleKey:KEYS.publicidad,moduleField:"ubicaciones"},
  publicidad_categorias:{collection:"publicidad_categorias",idField:"categoria_key",moduleKey:KEYS.publicidad,moduleField:"categorias"},
  segmentos: { collection: "segmentos", idField: "segmento_id", moduleKey: KEYS.commerce, moduleField: "segmentos" },
  niveles_anunciante: { collection: "niveles_anunciante", idField: "nivel_id", moduleKey: KEYS.commerce, moduleField: "niveles_anunciante" },
  funcionalidades: { collection: "funcionalidades", idField: "funcionalidad_id", moduleKey: KEYS.commerce, moduleField: "funcionalidades" },
  categorias: { collection: "categorias", idField: "categoria_id", moduleKey: KEYS.commerce, moduleField: "categorias" },
  actividades_clave: { collection: "actividades_clave", idField: "actividad_id", moduleKey: KEYS.commerce, moduleField: "actividades_clave" },
  acciones: { collection: "acciones", idField: "accion_id", moduleKey: KEYS.commerce, moduleField: "acciones" },
  nodos: { collection: "nodos", idField: "nodo_id", moduleKey: KEYS.commerce, moduleField: "nodos" },
  eventos_categorias: { collection: "eventos_categorias", idField: "categoria_id", moduleKey: KEYS.eventos, moduleField: "categorias" },
  actividades_categorias: { collection: "actividades_categorias", idField: "categoria_id", moduleKey: KEYS.actividades, moduleField: "categorias" },
  moderacion_18: { collection: "eventos_moderacion_palabras", idField: "regla_id", moduleKey: "", moduleField: "" }
};
function active3(x) {
  if (x.activo === void 0 && x.activa === void 0) return true;
  const v = x.activo ?? x.activa;
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text79(v).toLowerCase());
}
function upsert4(rows, idField, item) {
  const id4 = text79(item[idField] || item.id);
  const out2 = (rows || []).filter((x) => text79(x[idField] || x.id) !== id4);
  out2.push(item);
  return out2;
}
function sortRows(rows) {
  return [...rows || []].sort((a, b) => {
    const ao = Number(a.orden ?? a.prioridad ?? a.numero ?? 999999);
    const bo = Number(b.orden ?? b.prioridad ?? b.numero ?? 999999);
    if (ao !== bo) return ao - bo;
    return text79(a.nombre).localeCompare(text79(b.nombre), "es", { sensitivity: "base" });
  });
}
async function listAdminCatalogV2({ cache, tipo, cityId = "" }) {
  const t = text79(tipo).toLowerCase(), def = defs[t];
  if(t==='publicidad_ubicaciones'||t==='publicidad_categorias'){const p=await getPublicidadCatalogs(cache);return {success:true,tipo:t,results:t==='publicidad_ubicaciones'?p.ubicaciones:p.categorias,source:'kv'};}
  if (!def) return { success: false, message: "Catálogo no reconocido." };
  const packet2 = await cache.get(ADMIN_KEY2) || {};
  const modulePacket=def.moduleKey?await cache.get(def.moduleKey):null;
  const moduleRows=Array.isArray(modulePacket?.[def.moduleField])?modulePacket[def.moduleField]:[];
  const adminRows=Array.isArray(packet2[t])?packet2[t]:[];
  const byId=new Map();
  for(const x of [...moduleRows,...adminRows]){const id=text79(x[def.idField]||x.id);if(id)byId.set(id,{...byId.get(id),...x});}
  let rows=[...byId.values()];
  if (t === "nodos" && text79(cityId)) {
    rows = rows.filter((x) => text79(x.ciudad_id) === text79(cityId));
  }
  return { success: true, tipo: t, results: sortRows(rows), source: "kv" };
}
async function saveAdminCatalogV2({ db, cache, tipo, item, cityId = "" }) {
  const t = text79(tipo).toLowerCase(), def = defs[t];
  if (!def) throw new Error("Catálogo no reconocido.");
  if (!item || typeof item !== "object") throw new Error("Item inválido.");
  const id4 = text79(item[def.idField] || item.id);
  if (!id4) throw new Error("Falta " + def.idField + ".");
  const payload = { ...item, [def.idField]: id4, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  if (t === "nodos" && cityId && !text79(payload.ciudad_id)) payload.ciudad_id = text79(cityId);
  const admin = await cache.get(ADMIN_KEY2) || { version: 2 };
  const current = (admin[t] || []).find((x) => text79(x[def.idField] || x.id) === id4);
  if(t==='niveles_anunciante')for(const key of ['numero','descripcion_max','adicionales_max','tags_max','imagenes_max']){
    if(!Object.hasOwn(item,key)||JSON.stringify(item[key])===JSON.stringify(current?.[key]))continue;
    const value=item[key];
    if(value===null&&key!=='numero')continue;
    if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(key==='numero'?1:0)||(key==='imagenes_max'&&value>5))throw Error('Valor inválido en '+key+'.');
  }
  const patch = changedFieldsV1(current, payload);
  if (!Object.keys(patch).length) return { success: true, updated: false, tipo: t, item: current, firestore_writes: 0, firestore_reads: 0 };
  const saved = await db.patch(def.collection, id4, patch, { mustExist: !!current, newDocument: !current });
  const adminRows = upsert4(Array.isArray(admin[t]) ? admin[t] : [], def.idField, saved);
  await cache.put(ADMIN_KEY2, {
    ...admin,
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    [t]: adminRows
  });
  if (def.moduleKey && def.moduleField) {
    const modulePacket = await cache.get(def.moduleKey) || {};
    let rows = (Array.isArray(modulePacket[def.moduleField]) ? modulePacket[def.moduleField] : []).filter((x) => text79(x[def.idField] || x.id) !== id4);
    if (active3(saved)) rows.push(saved);
    await cache.put(def.moduleKey, {
      ...modulePacket,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      [def.moduleField]: sortRows(rows)
    });
  }
  return {
    success: true,
    tipo: t,
    item: saved,
    firestore_writes: 1,
    firestore_reads: 0
  };
}

// reconstruccion/worker/routes/admin-v9.js
var text80 = (v) => String(v ?? "").trim();
function canManageCatalogs(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text80(auth && auth.rol).toUpperCase());
}
async function routeAdminV9(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  let m = path.match(/^\/superadmin\/catalogs\/([^/]+)$/);
  if(m&&!defs[decodeURIComponent(m[1])])return routeAdminV8(ctx);
  if (m && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await listAdminCatalogV2({
      cache,
      tipo: decodeURIComponent(m[1]),
      cityId: text80(url.searchParams.get("ciudad_id"))
    }));
  }
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canManageCatalogs(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await saveAdminCatalogV2({
      db,
      cache,
      tipo: decodeURIComponent(m[1]),
      item: body && body.item && typeof body.item === "object" ? body.item : body,
      cityId: text80(body.ciudad_id || url.searchParams.get("ciudad_id"))
    }));
  }
  return routeAdminV8(ctx);
}

// reconstruccion/worker/modules/superadmin-session-v2.js
var text81 = (v) => String(v ?? "").trim();
var norm13 = (v) => text81(v).toLowerCase();
function b644(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((x) => binary += String.fromCharCode(x));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function hmac4(env, value) {
  const secret = text81(env.SERVER_SECRET);
  if (!secret) throw new Error("Falta SERVER_SECRET");
  const key3 = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key3, new TextEncoder().encode(value));
  return b644(new Uint8Array(sig));
}
async function issue2(env, payload) {
  const body = b644(JSON.stringify({
    ...payload,
    iat: Date.now(),
    exp: null,
    persistent: true
  }));
  return body + "." + await hmac4(env, body);
}
function truthy8(v) {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "yes", "x", "activo", "activa"].includes(norm13(v));
}
async function superadminLoginV2({ env, db, body }) {
  const original = text81(body && body.mail);
  const mail = norm13(original);
  const clave = text81(body && body.clave);
  if (!mail || !clave) return { success: false, message: "Falta mail o clave" };
  const sus = await db.loginAccount(mail,clave,original);
  if (!sus) return { success: false, message: "Mail o clave incorrectos" };
  if (sus.activo !== "" && sus.activo !== null && sus.activo !== void 0 && !truthy8(sus.activo)) {
    return { success: false, message: "Suscriptor no activo" };
  }
  const sid = text81(sus.suscriptor_id || sus.id);
  if (!sid) return { success: false, message: "Suscriptor sin ID válido" };
  const admin = await db.loginAdmin(sid);
  if (!admin) return { success: false, message: "Esta cuenta no tiene acceso a este panel" };
  if (!truthy8(admin.activo)) {
    return { success: false, message: "Administrador no activo" };
  }
  const role = text81(admin.rol || "SUPERADMIN").toUpperCase();
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(role)) {
    return { success: false, message: "Esta cuenta no está habilitada para Gran Hermano" };
  }
  const nombre = text81(sus.nombre || admin.nombre);
  const ciudades = adminCityIdsV71(admin.ciudades);
  if (role === "ADMIN_LOCAL" && !ciudades.length) return {success:false,message:"El administrador local no tiene una ciudad asignada."};
  const sessionState=await subscriberSessionState(env,sid);
  if(sessionState.deleted)return {success:false,message:"Suscriptor no activo"};
  const token2 = await issue2(env, { sid, sv:Number(sessionState.version||0), rol: role, nombre, mail: text81(sus.mail), ciudades, permisos:admin.permisos||{}, access_revision:admin.access_revision||"" });
  return {
    success: true,
    token: token2,
    admin: {
      id: sid,
      suscriptor_id: sid,
      nombre,
      mail: text81(sus.mail),
      rol: role,
      activo: true,
      ciudades: Array.isArray(admin.ciudades) ? admin.ciudades : [],
      permisos: admin.permisos && typeof admin.permisos === "object" ? admin.permisos : {}
    },
    expires_in_seconds: null,
    persistent: true
  };
}

// reconstruccion/worker/modules/superadmin-dashboard-v2.js
async function superadminDashboardV2({ cache }) {
  const [adv, sub, territory] = await Promise.all([
    cache.get(ADMIN_ADVERTISERS_KEY),
    cache.get(ADMIN_SUBSCRIBERS_KEY),
    cache.get("territorio:admin:v1")
  ]);
  return {
    success: true,
    resumen: {
      suscriptores: sub && Array.isArray(sub.results) ? sub.results.length : 0,
      anunciantes: adv && Array.isArray(adv.results) ? adv.results.length : 0,
      ciudades: territory && Array.isArray(territory.ciudades) ? territory.ciudades.length : 0
    },
    source: "kv"
  };
}

// reconstruccion/worker/routes/admin-v10.js
async function routeAdminV10(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/session/login" && request2.method === "POST") {
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    const out2 = await superadminLoginV2({ env, db, body });
    return json(out2, out2.success ? 200 : 401);
  }
  if (path === "/superadmin/dashboard" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    const dashboard=await superadminDashboardV2({cache});
    if(isTopAdmin2(auth))dashboard.cumpleanos=await birthdaySummaryV83(env,cache);
    return json(dashboard);
  }
  return routeAdminV9(ctx);
}

// reconstruccion/worker/modules/moderacion-general-v3.js
var text82 = (v) => String(v ?? "").trim();
/** @param {any} a */
function rejectedActivity(a) {
  return [a?.estado,a?.estado_moderacion,a?.revision_adulto].some(value=>["RECHAZADA","RECHAZADO","ELIMINADA","ELIMINADO"].includes(text82(value).toUpperCase()));
}
async function pendingAllV3({ db }) {
  if(db.panelReadDb) db=db.panelReadDb();
  const [evPend, evRev, activities, requests] = await Promise.all([
    db.queryEqual("eventos", "estado_moderacion", "PENDIENTE", 500),
    db.queryEqual("eventos", "estado_moderacion", "REVISION", 500),
    db.queryEqual("actividades", "aprobado", false, 500),
    db.queryEqual("solicitudes_anunciante", "estado", "PENDIENTE", 500)
  ]);
  const eventos = [...evPend, ...evRev].map((e) => ({
    ...e,
    tipo: "EVENTO",
    id: text82(e.evento_id || e.id),
    evento_id: text82(e.evento_id || e.id),
    nombre: text82(e.nombre_evento || e.nombre),
    ciudad_id: text82(e.ciudad_id),
    anunciante_id: text82(e.anunciante_id || e.id_anunciante),
    nivel: text82(e.nivel),
    estado: text82(e.estado_moderacion || "PENDIENTE"),
    fecha: text82(e.fecha_desde || e.fecha_carga),
    motivo: text82(e.motivo_revision)
  }));
  const actividades = activities.filter((a) => !rejectedActivity(a)).map((a) => ({
    ...a,
    tipo: "ACTIVIDAD",
    id: text82(a.actividad_id || a.id),
    actividad_id: text82(a.actividad_id || a.id),
    nombre: text82(a.nombre),
    ciudad_id: text82(a.ciudad_id),
    anunciante_id: text82(a.anunciante_id),
    estado: text82(a.estado || "PENDIENTE"),
    fecha: text82(a.creado || a.actualizado)
  }));
  const anunciantes = requests.map((x) => ({
    ...x,
    tipo: "ANUNCIANTE",
    id: text82(x.solicitud_id || x.id),
    solicitud_id: text82(x.solicitud_id || x.id),
    modo: text82(x.modo).toUpperCase(),
    nombre: text82(x.nombre),
    ciudad_id: text82(x.ciudad_id),
    anunciante_id: text82(x.anunciante_id),
    suscriptor_id: text82(x.suscriptor_id),
    estado: "PENDIENTE",
    fecha: text82(x.creado_en),
    detalle: x.detalle || {}
  }));
  return {
    success: true,
    cantidades: {
      eventos: eventos.length,
      actividades: actividades.length,
      anunciantes: anunciantes.length,
      total: eventos.length + actividades.length + anunciantes.length
    },
    eventos,
    actividades,
    anunciantes
  };
}
function newAdvertiserId2() {
  return "ADV-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}
async function resolvePendingV3({ db, cache, auth, tipo, id: id4, decision, nivel = "" }) {
  const kind = text82(tipo).toUpperCase();
  assertModeratorV72(auth,kind);
  const itemId = text82(id4);
  const dec = text82(decision).toUpperCase();
  if (!itemId || !["APROBAR", "RECHAZAR"].includes(dec)) throw new Error("Falta indicar contenido o decisión.");
  if (kind === "EVENTO") {
    return resolveEventModerationV2({
      db,
      cache,
      eventId: itemId,
      decision: dec,
      moderatorId: auth.sid,
      auth
    });
  }
  if (kind === "ACTIVIDAD") {
    const current = await db.get("actividades", itemId);
    if (!current) throw new Error("Actividad no encontrada.");
    assertAdminCityV71(auth,current);
    const horarios = await getPreparedRelationsV1({
      cache,
      type: "activity",
      id: itemId,
      current,
      load: () => db.queryEqual("actividad_horarios", "actividad_id", itemId, 500)
    });
    for (const horario of horarios) assertAdminCityV71(auth,{...horario,ciudad_id:horario.ciudad_id||current.ciudad_id});
    const previousCities = [...new Set(horarios.map((h) => text82(h.ciudad_id)).filter(Boolean))];
    const saved = await db.patch("actividades", itemId, {
      estado_moderacion:dec === "APROBAR"?"APROBADO":"RECHAZADO",
      aprobado: dec === "APROBAR",
      estado: dec === "APROBAR" ? "ACTIVA" : "RECHAZADA",
      moderado_por: text82(auth.sid),
      moderado_en: (/* @__PURE__ */ new Date()).toISOString(),
      actualizado: (/* @__PURE__ */ new Date()).toISOString()
    }, { mustExist: true });
    await syncActivityPreparedV2({
      cache,
      activityId: itemId,
      current,
      next: saved,
      horarios,
      previousCities
    });
    return {
      success: true,
      tipo: kind,
      id: itemId,
      decision: dec,
      estado: saved.estado,
      actividad: { ...saved, horarios }
    };
  }
  if (kind === "ANUNCIANTE") {
    const req = await db.get("solicitudes_anunciante", itemId);
    if (!req) throw new Error("Solicitud de anunciante no encontrada.");
    assertAdminCityV71(auth,req);
    if (text82(req.estado).toUpperCase() !== "PENDIENTE") throw new Error("La solicitud ya fue resuelta.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const sid = text82(req.suscriptor_id), modo = text82(req.modo).toUpperCase();
    if(auth.rol==="ADMIN_LOCAL" && modo==="RECLAMAR"){
      const index=await cache.get(ADMIN_ADVERTISERS_KEY)||{};
      const advertiser=(index.results||[]).find(a=>String(a.id||a.anunciante_id||"")===String(req.anunciante_id||""));
      const cities=adminCityIdsV71(advertiser?.ciudad_ids);
      if(!cities.length){throw httpError("La ciudad del anunciante no está comprobada. Este reclamo requiere un superadministrador.",403);}
      for(const ciudad_id of cities)assertAdminCityV71(auth,{ciudad_id});
    }
    if (dec === "RECHAZAR") {
      const savedReq2 = await db.patch("solicitudes_anunciante", itemId, {
        estado: "RECHAZADA",
        moderado_por: text82(auth.sid),
        moderado_en: now,
        actualizado_en: now
      }, { mustExist: true });
      return { success: true, tipo: kind, id: itemId, decision: dec, solicitud: savedReq2 };
    }
    let aid = text82(req.anunciante_id);
    if (modo === "CREAR") {
      const level = text82(nivel);
      if (!level) throw new Error("Seleccioná el nivel del nuevo anunciante.");
      aid = newAdvertiserId2();
      const detail = req.detalle || {};
      const city = text82(req.ciudad_id);
      await db.patch("anunciantes", aid, {
        id: aid,
        nombre: text82(req.nombre),
        actividad: text82(detail.actividad),
        descripcion: text82(detail.descripcion),
        whatsapp: text82(detail.whatsapp),
        mail: text82(detail.mail),
        web: text82(detail.web),
        creado_en: now,
        actualizado_en: now
      });
      await db.patch("anunciantes_administracion", aid, {
        id: aid,
        aprobado: true,
        nivel: level,
        subnivel: "0",
        verificado: false,
        gold: false,
        funcionalidades: [],
        creado_en: now,
        actualizado_en: now
      });
      if (city) {
        const sedeId = "SED-" + aid + "-MAIN";
        await db.patch("anunciantes_sedes", sedeId, {
          sede_id: sedeId,
          anunciante_id: aid,
          ciudad_id: city,
          nombre_sede: "Principal",
          direccion: text82(detail.direccion),
          whatsapp: text82(detail.whatsapp),
          mail: text82(detail.mail),
          web: text82(detail.web),
          activo: true,
          creado_en: now,
          actualizado_en: now
        });
      }
    } else if (modo === "RECLAMAR") {
      if (!aid || !await db.get("anunciantes", aid)) throw new Error("El anunciante reclamado ya no existe.");
    } else {
      throw new Error("Tipo de solicitud inválido.");
    }
    const relId = sid + "__" + aid;
    await db.patch("suscriptor_anunciante", relId, {
      relacion_id: relId,
      suscriptor_id: sid,
      anunciante_id: aid,
      rol: "PROPIETARIO",
      activo: true,
      fecha_alta: now,
      actualizado: now
    });
    const savedReq = await db.patch("solicitudes_anunciante", itemId, {
      estado: "APROBADA",
      anunciante_id: aid,
      moderado_por: text82(auth.sid),
      moderado_en: now,
      actualizado_en: now
    }, { mustExist: true });
    if (modo === "CREAR") {
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
    }
    return {
      success: true,
      tipo: kind,
      id: itemId,
      decision: dec,
      anunciante_id: aid,
      suscriptor_id: sid,
      solicitud: savedReq
    };
  }
  throw new Error("Tipo de contenido no reconocido.");
}

function adminCityIdsV71(value) {
  return Array.isArray(value)?[...new Set(value.filter(x=>typeof x==="string").map(x=>x.trim()).filter(Boolean))]:[];
}
function moderatorAllowsV72(auth,kind) {
  if(auth.rol!=="ADMIN_LOCAL")return true;
  const perms=auth.permisos&&auth.permisos.moderacion;
  return perms ? perms[kind]===true : true;
}
function assertModeratorV72(auth,kind){
  if(!moderatorAllowsV72(auth,kind)){throw httpError("No tenés permiso para moderar este tipo de publicación.",403);}
}
function adminCanCityV71(auth,item) {
  if(auth.rol!=="ADMIN_LOCAL")return true;
  const city=String(item&&item.ciudad_id||"").trim();
  return !!city && adminCityIdsV71(auth.ciudades).includes(city);
}
function assertAdminCityV71(auth,item) {
  if(!adminCanCityV71(auth,item)){
    throw httpError("No tenés permiso para moderar contenido de esta ciudad. Revisá tus ciudades asignadas y volvé a iniciar sesión.",403);
  }
}
function filterAdminPendingV71(result,auth) {
  if(auth.rol!=="ADMIN_LOCAL")return result;
  if(!adminCityIdsV71(auth.ciudades).length)assertAdminCityV71(auth,null);
  const out={...result};
  for(const key of ["eventos","actividades","anunciantes"])out[key]=result[key].filter(item=>adminCanCityV71(auth,item)&&moderatorAllowsV72(auth,({eventos:"EVENTO",actividades:"ACTIVIDAD",anunciantes:"ANUNCIANTE"})[key]));
  out.cantidades={eventos:out.eventos.length,actividades:out.actividades.length,anunciantes:out.anunciantes.length,total:out.eventos.length+out.actividades.length+out.anunciantes.length};
  return out;
}

// reconstruccion/worker/routes/admin-v11.js
var text83 = (v) => String(v ?? "").trim();
function canModerate2(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(text83(auth && auth.rol).toUpperCase());
}
async function routeAdminV11(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/moderation/pending" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate2(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    return json(filterAdminPendingV71(await pendingAllV3({ db }),auth));
  }
  if (path === "/superadmin/moderation/resolve" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate2(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await resolvePendingV3({
      db,
      cache,
      auth,
      tipo: text83(body.tipo),
      id: text83(body.id || body.evento_id || body.actividad_id || body.solicitud_id),
      decision: text83(body.decision),
      nivel: text83(body.nivel)
    }));
  }
  return routeAdminV10(ctx);
}

// reconstruccion/worker/core/db-observation-v41.js
function observeDbV41(db, report) {
  const observed = {};
  for (const operation of Object.keys(db)) {
    observed[operation] = async (...args) => {
      const collection = String(args[0] || "");
      const field=operation==="queryEqual"?String(args[1]||""):"";
      const reportedOperation=operation==="getVersioned"?"get":operation==="listPage102"?"listCollection":operation;
      const key3 = reportedOperation + ":" + collection + (field?":"+field:"");
      const stat = report.operations[key3] || (report.operations[key3] = { operation:reportedOperation, collection, field, calls: 0, documents_returned: 0, failures: 0 });
      stat.calls++;
      try {
        const result = await db[operation](...args);
        if(operation==="listPage102")stat.documents_returned+=result.rows.length;
        else if (operation === "getVersioned") stat.documents_returned += result.doc ? 1 : 0;
        else if (operation === "get" || operation === "queryEqual" || operation === "listCollection") {
          stat.documents_returned += Array.isArray(result) ? result.length : result ? 1 : 0;
        }
        return result;
      } catch (error) {
        stat.failures++;
        throw error;
      }
    };
  }
  if(db.commitPatches)observed.commitPatches=async entries=>{
   const stats=entries.map(e=>{const operation=e.remove?'delete':'patch',key=operation+':'+e.collection;const stat=report.operations[key]||(report.operations[key]={operation,collection:e.collection,field:'',calls:0,documents_returned:0,failures:0});return stat;});
   try{const result=await db.commitPatches(entries);for(const stat of stats)stat.calls++;return result;}catch(error){for(const stat of stats)stat.failures++;throw error;}
  };
  return observed;
}
function observationPathV41(path) {
  return String(path).replace(/(\/diagnostics\/shared\/)[^/]+/g, "$1:token").replace(/(\/advertisers\/)(?!search(?:\/|$))[^/]+/g, "$1:id").replace(/(\/subscribers\/)(?!search(?:\/|$))[^/]+/g, "$1:id");
}
async function observationActionV43(request2, url) {
  let action = url.searchParams.get("action") || "";
  if (request2.method === "POST") {
    try {
      const body = await request2.clone().json();
      action = body?.action || body?.accion || action;
    } catch (_) {
    }
  }
  const allowed = /* @__PURE__ */ new Set([
    "actualizar_activos","eliminar","pausar","reanudar","renovar","getfreeeventspaneldata","getpaneldata","createfreeevent","updatefreeevent","createvipevent","updatevipevent","checkfreeeventduplicates","pausefreeevent","deletefreeevent","pausevipevent","deletevipevent","guardar","set_datos","set_sedes",
    "ubicaciones",
    "locations",
    "bootstrap",
    "publicas",
    "turnos",
    "efemerides",
    "login",
    "session",
    "favoritos",
    "anunciantes_autorizados",
    "perfil",
    "suscriptor",
    "crear",
    "actualizar_perfil",
    "actualizar_ciudad",
    "cambiar_clave",
    "eliminar_cuenta",
    "agregar_favorito",
    "quitar_favorito",
    "solicitar_recuperacion",
    "restablecer_clave",
    "solicitar_verificacion",
    "confirmar_verificacion"
  ]);
  const value = String(action).trim().toLowerCase();
  return allowed.has(value) ? value : "";
}
function finishObservationV42(report) {
  const totals = { read_calls: 0, documents_returned: 0, write_calls: 0, delete_calls: 0, failures: 0 };
  for (const stat of Object.values(report.operations)) {
    if (["get", "queryEqual", "listCollection"].includes(stat.operation)) totals.read_calls += stat.calls;
    if (stat.operation === "patch") totals.write_calls += stat.calls;
    if (stat.operation === "delete") totals.delete_calls += stat.calls;
    totals.documents_returned += stat.documents_returned;
    totals.failures += stat.failures;
  }
  report.totals = totals;
  report.message = `GLD ${report.method} ${report.path}${report.action ? " action=" + report.action : ""} | HTTP ${report.status} | consultas ${totals.read_calls}, documentos ${totals.documents_returned}, escrituras ${totals.write_calls}, eliminaciones ${totals.delete_calls}, fallos ${totals.failures}`;
  return report;
}

function publicDbGuardV44(report){
  return Object.fromEntries(['get','queryEqual','listCollection','patch','delete'].map(operation=>[
    operation, async()=>{
      report.public_blocked=(report.public_blocked||0)+1;
      throw new Error('Acceso a Firestore bloqueado en una ruta pública: '+operation);
    }
  ]));
}


// reconstruccion/worker/core/private-cache-v46.js
var withPrivateCacheV46 = (() => {
/** Caché privada del login y favoritos, mantenida por mutaciones. No guarda contraseñas ni sustituye la autenticación. */
const text=v=>String(v??'').trim();
const relationKey=sid=>'login:relations:v45:'+text(sid);
const recordKey=(collection,id)=>'login:record:v45:'+collection+':'+text(id);
const panelAdminKey=id=>'panel:administration:v47:'+text(id);
const favoriteKey=sid=>'subscriber:favorites:v46:'+text(sid);
const advertiserCollections=new Set(['anunciantes','anunciantes_administracion']);
// Login caches expose only nombre and funcionalidades; unrelated ficha edits do not invalidate them.
const loginFieldsChanged132=(patch,before)=>['nombre','funcionalidades'].some(key=>Object.hasOwn(patch||{},key)&&(!before||!sameCacheData129(before[key],patch[key])));

function withPrivateCacheV46(db,env){
  const kv=env.GLD_CACHE_KV;
  const owners=new Map(),advertiserOwners104=new Map(),administrationAfter104=new Map();
  const dirty=new Set();
  const favoriteChanges=new Map();
  const deletedSubscribers=new Set();
  const favoriteDelta=(sid,id)=>favoriteKey(sid)+':delta:'+text(id);
  async function putRequired(key,value){
    try{await kv.put(key,value)}catch(first){await new Promise(resolve=>setTimeout(resolve,1100));await kv.put(key,value)}
  }
  function remember(collection,rows){
    if(['suscriptor_anunciante','suscriptor_favoritos'].includes(collection))for(const row of rows||[]){
      const id=text(row.id||row.suscriptor_anunciante_id||row.favorito_id),sid=text(row.suscriptor_id);
      if(id&&sid)owners.set(collection+'/'+id,sid);
      if(collection==='suscriptor_anunciante'&&id)advertiserOwners104.set(collection+'/'+id,text(row.anunciante_id));
    }
    return rows;
  }
  async function revision(key){
    if(!kv||typeof kv.get!=='function')return 'initial';
    return text(await kv.get(key+':revision',{cacheTtl:30}))||'initial';
  }
  async function read(key){
    const rev=await revision(key);
    if(!kv||typeof kv.get!=='function')return {packet:null,rev};
    const raw=await kv.get(key+':'+rev,{cacheTtl:30});
    if(!raw)return {packet:null,rev};
    try{const packet=JSON.parse(raw);
      if(packet&&packet.version===46)return {packet,rev};
      if(packet&&packet.version===45&&Number(packet.expires_at)>Date.now()){await save(key,packet.data,rev);return {packet,rev};}
      return {packet:null,rev};
    }catch(_){return {packet:null,rev}}
  }
  async function save(key,data,rev,meta={}){
    // Llenado opcional. Una falla deja la caché fría, sin romper el login.
    if(!kv||typeof kv.put!=='function'||dirty.has(key))return;
    try{await kv.put(key+':'+rev,JSON.stringify({version:46,data,...meta}))}catch(_){}
  }
  async function relationRows(sid,limit){
    const key=relationKey(sid),{packet:hit,rev}=await read(key),storedLimit=Number(hit?.relation_limit||100);
    if(hit&&Array.isArray(hit.data)&&!dirty.has(key)&&(storedLimit>=limit||hit.data.length<storedLimit))return remember('suscriptor_anunciante',hit.data.slice(0,limit));
    const rows=remember('suscriptor_anunciante',await db.queryEqual('suscriptor_anunciante','suscriptor_id',sid,limit));
    const safe=rows.map(r=>({id:text(r.id||r.suscriptor_anunciante_id),suscriptor_id:text(r.suscriptor_id),anunciante_id:text(r.anunciante_id),anunciante_nombre:text(r.anunciante_nombre),rol:text(r.rol),permisos:text(r.permisos),activo:r.activo}));
    await save(key,safe,rev,{relation_limit:limit});return safe;
  }
  async function invalidate(key){
    const rev=await revision(key);
    if(kv&&typeof kv.delete==='function')await kv.delete(key+':'+rev);
    else if(kv&&(await read(key)).packet)throw Error('KV debe permitir invalidar la caché privada.');
    dirty.add(key);
  }
  async function flush(){
    // Cada favorito tiene su propia entrada: dos cambios de favoritos distintos
    // nunca sustituyen la lista del otro. Las bajas se conservan como tombstones.
    const updatedSubscribers=new Set();
    for(const [key,change] of favoriteChanges){
      try{if(kv&&kv.put)await putRequired(key,JSON.stringify(change));}
      catch(error){if(kv&&kv.delete)await kv.delete(key);await invalidate(favoriteKey(change.sid));throw error;}
      updatedSubscribers.add(change.sid);
      favoriteChanges.delete(key);
    }
    for(const sid of updatedSubscribers)if(kv&&kv.put){try{await putRequired(favoriteKey(sid)+':changes',JSON.stringify({revision:crypto.randomUUID(),updated_at:Date.now()}));}catch(error){await invalidate(favoriteKey(sid));throw error;}}
    for(const key of dirty){
      if(kv&&kv.put){const nextRevision=crypto.randomUUID();await putRequired(key+':revision',nextRevision);if(administrationAfter104.has(key))await putRequired(key+':'+nextRevision,JSON.stringify({version:46,data:administrationAfter104.get(key)}));}
      dirty.delete(key);
    }
    for(const sid of deletedSubscribers){
      if(kv&&kv.list&&kv.delete){const keys=[];let cursor;do{const page=await kv.list({prefix:favoriteKey(sid)+':',...(cursor?{cursor}:{})});keys.push(...page.keys.map(k=>k.name));cursor=page.list_complete?null:page.cursor;}while(cursor);await Promise.all(keys.map(key=>kv.delete(key)));}
      deletedSubscribers.delete(sid);
    }
  }
  const advertiserRelationKey104=(/** @type {string} */ aid)=>'gh:advertiser-relations:v104:'+aid;
  async function advertiserRelationDelta104(/** @type {string} */ aid,/** @type {string} */ id,/** @type {any} */ row){
    if(!aid||!kv?.put)return;
    await putRequired(advertiserRelationKey104(aid)+':delta:'+encodeURIComponent(id),JSON.stringify({id,data:row,deleted:!row}));
  }
  async function cachedAdvertiserRelations104(/** @type {string} */ aid){
    const key=advertiserRelationKey104(aid),{packet,rev}=await read(key);
    const rows=packet&&Array.isArray(packet.data)?packet.data:remember('suscriptor_anunciante',await db.queryEqual('suscriptor_anunciante','anunciante_id',aid,500));
    if(!packet)await save(key,rows,rev);
    const byId=new Map(rows.map((/** @type {any} */ r)=>[text(r.id),r]));
    if(kv?.list){let cursor;do{const page=await kv.list({prefix:key+':delta:',...(cursor?{cursor}:{})});for(const entry of page.keys){const raw=await kv.get(entry.name,{cacheTtl:30});if(!raw)continue;const change=JSON.parse(raw);if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}cursor=page.list_complete?null:page.cursor;}while(cursor);}
    return remember('suscriptor_anunciante',[...byId.values()]);
  }

  async function relationOwners(id,patch,options){
    // Si el router no cargó el vínculo, leer sólo ese documento para conocer
    // también su propietario anterior. Nunca barrer la colección.
    if(!options?.newDocument&&!owners.has('suscriptor_anunciante/'+text(id))){const previous=await db.get('suscriptor_anunciante',id);if(previous)remember('suscriptor_anunciante',[previous]);}
    const set=new Set([owners.get('suscriptor_anunciante/'+text(id)),text(patch&&patch.suscriptor_id),text(options&&options.subscriberId)].filter(Boolean));
    if(!set.size)throw Error('Falta contexto de suscriptor para invalidar su relación.');
    return set;
  }
  async function prepareFavorite(sid,id){
    const key=favoriteDelta(sid,id);
    return key;
  }
  async function overlayFavorites(sid,rows,packet,rev){
    if(!kv||typeof kv.list!=='function')return rows;
    const rawMarker=await kv.get(favoriteKey(sid)+':changes',{cacheTtl:30});
    if(!rawMarker)return rows;
    const marker=JSON.parse(rawMarker);
    if(packet&&packet.delta_revision===marker.revision)return rows;
    const byId=new Map(rows.map(r=>[text(r.id||r.favorito_id),r]));
    let cursor;
    do{
      const page=await kv.list({prefix:favoriteKey(sid)+':delta:',...(cursor?{cursor}:{})});
      const changes=await Promise.all(page.keys.map(async entry=>{const raw=await kv.get(entry.name,{cacheTtl:30});return raw?JSON.parse(raw):null}));
      for(const change of changes){if(!change||change.sid!==sid)continue;if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}
      cursor=page.list_complete?null:page.cursor;
    }while(cursor);
    for(const change of favoriteChanges.values())if(change.sid===sid){if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}
    const merged=[...byId.values()];
    // Durante propagación de KV repetir sólo el merge de KV. Nunca Firestore.
    await save(favoriteKey(sid),merged,rev,{delta_revision:Date.now()-Number(marker.updated_at)>60000?marker.revision:''});
    return merged;
  }
  return {
    ...db,
    flushLoginCache:flush,
    async repairPrivateGuide132(collection,id,row){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      if(collection==='anunciantes_administracion'){await invalidate(panelAdminKey(id));if(row)administrationAfter104.set(panelAdminKey(id),row);}
    },
    async get(collection,id){const row=await db.get(collection,id);if(row)remember(collection,[row]);return row;},
    async queryEqual(...args){return remember(args[0],await db.queryEqual(...args));},
    async commitPatches(entries){
      for(const e of entries){if(advertiserCollections.has(e.collection)&&(e.remove||loginFieldsChanged132(e.patch,e.before)))await invalidate(recordKey(e.collection,e.id));if(e.collection==='anunciantes_administracion')await invalidate(panelAdminKey(e.id));}
      const saved=await db.commitPatches(entries);
      for(let i=0;i<entries.length;i++){const e=entries[i],row=saved[i];if(e.collection==='anunciantes_administracion'){if(row)administrationAfter104.set(panelAdminKey(e.id),row);else administrationAfter104.delete(panelAdminKey(e.id));}if(row)remember(e.collection,[row]);}
      return saved;
    },
    async patch(collection,id,patch,options={}){
      if(advertiserCollections.has(collection)&&loginFieldsChanged132(patch,null))await invalidate(recordKey(collection,id));
      if(collection==='anunciantes_administracion')await invalidate(panelAdminKey(id));
      let affected=[];
      if(collection==='suscriptor_anunciante'){
        affected=[...await relationOwners(id,patch,options)];
        for(const sid of affected)await invalidate(relationKey(sid));
      }
      let favKey;
      if(collection==='suscriptor_favoritos'){const sid=text(patch.suscriptor_id)||owners.get(collection+'/'+text(id));if(!sid)throw Error('Falta suscriptor del favorito.');favKey=await prepareFavorite(sid,id);}
      const oldAdvertiser104=advertiserOwners104.get(collection+'/'+text(id));
      const row=await db.patch(collection,id,patch,options);
      if(collection==='anunciantes_administracion')administrationAfter104.set(panelAdminKey(id),row);
      if(collection==='suscriptor_anunciante'){const nextAdvertiser104=text(row?.anunciante_id||patch.anunciante_id);if(oldAdvertiser104&&oldAdvertiser104!==nextAdvertiser104)await advertiserRelationDelta104(oldAdvertiser104,text(id),null);if(nextAdvertiser104)await advertiserRelationDelta104(nextAdvertiser104,text(id),{...patch,...row,id:text(id)});}
      if(favKey)favoriteChanges.set(favKey,{sid:text(patch.suscriptor_id)||owners.get(collection+'/'+text(id)),id:text(id),deleted:false,data:{...patch,...row,id:text(id)}});
      if(row)remember(collection,[row]);
      return row;
    },
    async delete(collection,id,options={}){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      if(collection==='anunciantes_administracion')await invalidate(panelAdminKey(id));
      if(collection==='suscriptor_anunciante')for(const sid of await relationOwners(id,null,options))await invalidate(relationKey(sid));
      let favKey;
      if(collection==='suscriptor_favoritos'){let sid=owners.get(collection+'/'+text(id))||text(options.subscriberId);if(!sid){const previous=await db.get(collection,id);if(previous){remember(collection,[previous]);sid=text(previous.suscriptor_id);}}if(sid)favKey=await prepareFavorite(sid,id);}
      if(collection==='suscriptores'){deletedSubscribers.add(text(id));await invalidate(relationKey(id));await invalidate(favoriteKey(id));for(const [key,change]of favoriteChanges)if(change.sid===text(id))favoriteChanges.delete(key);}
      const previousAdvertiser104=advertiserOwners104.get(collection+'/'+text(id));
      const result=await db.delete(collection,id,options);
      if(collection==='anunciantes_administracion')administrationAfter104.delete(panelAdminKey(id));
      if(collection==='suscriptor_anunciante'&&previousAdvertiser104)await advertiserRelationDelta104(previousAdvertiser104,text(id),null);
      if(favKey)favoriteChanges.set(favKey,{sid:owners.get(collection+'/'+text(id))||text(options.subscriberId),id:text(id),deleted:true});
      return result;
    },
    async subscriberFavorites(sid){
      const key=favoriteKey(sid);
      const {packet,rev}=await read(key);
      if(packet&&Array.isArray(packet.data)&&!dirty.has(key))return remember('suscriptor_favoritos',await overlayFavorites(sid,packet.data,packet,rev));
      const rows=remember('suscriptor_favoritos',await db.queryEqual('suscriptor_favoritos','suscriptor_id',sid,500));
      await save(key,rows,rev);return remember('suscriptor_favoritos',await overlayFavorites(sid,rows,null,rev));
    },
    cachedAdvertiserRelations104,
    loginRelations(sid){return relationRows(sid,100);},
    subscriberRelations(sid){return relationRows(sid,500);},
    async primePanelAdministration116(/** @type {any[]} */ rows){
      let prepared=0;
      for(const row of rows||[]){const id=text(row.id||row.anunciante_id);if(!id)continue;const key=panelAdminKey(id),{packet,rev}=await read(key);if(packet||dirty.has(key)||administrationAfter104.has(key))continue;await putRequired(key+':'+rev,JSON.stringify({version:46,data:row}));prepared++;}
      return prepared;
    },
    async panelAdministration(id){
      const key=panelAdminKey(id);if(administrationAfter104.has(key))return administrationAfter104.get(key);const {packet:hit,rev}=await read(key);
      if(hit&&!dirty.has(key))return hit.data;
      const row=await db.get('anunciantes_administracion',id);
      await save(key,row,rev);return row;
    },
    async loginAdvertiser(collection,id){
      if(!advertiserCollections.has(collection))throw Error('Colección no admitida para caché del login.');
      const key=recordKey(collection,id),{packet:hit,rev}=await read(key);
      if(hit&&!dirty.has(key))return hit.data;
      const row=await db.get(collection,id);
      const data=row?{id:text(row.id||id),nombre:text(row.nombre),funcionalidades:row.funcionalidades}:null;
      await save(key,data,rev);
      return data;
    }
  };
}
return withPrivateCacheV46;
})();

// reconstruccion/worker/core/panel-cache-v48.js
var withPanelCacheV48 = (() => {
/** Lecturas privadas del panel. Listas por propietario y cambios por documento. */
const fields={empleos:['owner_id','estado_moderacion','revision_adulto'],anunciantes:['revision_adulto','estado_moderacion'],efemerides_bis:['tipo','provincia_id','ciudad_id'],eventos:['anunciante_id','estado_moderacion','ciudad_id','revision_adulto'],evento_programacion:'evento_id',actividades:['anunciante_id','aprobado','revision_adulto'],solicitudes_anunciante:'estado',solicitudes_soporte:['estado','suscriptor_id'],solicitudes_soporte_mensajes:'solicitud_id',actividad_horarios:'actividad_id',promos:['anunciante_id','revision_adulto','estado_moderacion'],anunciantes_sedes:'anunciante_id',farmacias_ciclos:'anunciante_id',farmacias_ciclo_sedes:'ciclo_id',publicidades:['anunciante_id','revision_adulto','estado_moderacion'],publicidad_media:'publicidad_id',publicidad_segmentacion:'publicidad_id'};
const text=v=>String(v??'').trim();
const queryKey=(c,v,field)=>'panel:query:v48:'+c+':'+(c==='efemerides_bis'||c==='solicitudes_soporte'||field==='estado_moderacion'||field==='ciudad_id'||field==='aprobado'||field==='revision_adulto'?field+':':'')+encodeURIComponent(text(v));
const matchesField=(c,field)=>Array.isArray(fields[c])?fields[c].includes(field):fields[c]===field;
function trackedQueryValue130(field,value){if(field==='estado_moderacion')return value==='PENDIENTE'||value==='REVISION';if(field==='revision_adulto')return value==='PENDIENTE';if(field==='aprobado')return value===false;return true;}
const advertiserKey=id=>'panel:record:v53:anunciantes:'+encodeURIComponent(text(id));
const docKey=id=>'panel:record:v48:publicidad_cambios:'+encodeURIComponent(text(id));
function withPanelCacheV48(db,env,report){
  const kv=env.GLD_CACHE_KV,known=new Map(),changes=new Map(),records=new Map(),pending=new Map(),directoryChanges102=new Map();
  const copy=x=>x==null?x:structuredClone(x);
  function remember(c,rows){for(const row of rows||[])if(row&&row.id)known.set(c+'/'+text(row.id),copy(row));return rows;}
  async function read(key){if(!kv?.get)return null;const raw=await kv.get(key,{cacheTtl:30});if(!raw)return null;try{const p=JSON.parse(raw);return p?.version===48?p:null;}catch(_){return null;}}
  async function optionalSave(key,value){if(kv?.put)try{await kv.put(key,JSON.stringify({version:48,...value}));}catch(_){}}
  async function requiredSave(key,value){if(!kv?.put)return;try{await kv.put(key,JSON.stringify(value));}catch(_){await new Promise(r=>setTimeout(r,1100));await kv.put(key,JSON.stringify(value));}}
  async function merge(key,packet,saveCompaction=true){
    const marker=await read(key+':changes');
    const own=[...changes.values()].filter(c=>c.key===key);
    if(!marker&&!own.length)return packet.data;
    if(marker&&packet.revision===marker.revision&&!own.length)return packet.data;
    const byId=new Map(packet.data.map(row=>[text(row.id),row]));
    if(marker&&kv?.list){let cursor;do{const page=await kv.list({prefix:key+':delta:',...(cursor?{cursor}:{})});for(const item of page.keys){const change=await read(item.name);if(change){if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}}cursor=page.list_complete?null:page.cursor;}while(cursor);}
    for(const c of own){if(c.deleted)byId.delete(c.id);else byId.set(c.id,c.data);}
    const data=[...byId.values()];
    if(saveCompaction&&marker&&!own.length&&Date.now()-marker.updated_at>60000)await optionalSave(key,{data,revision:marker.revision});
    return data;
  }
  async function panelQuery(c,field,value,limit=500){
    if(!matchesField(c,field)||!trackedQueryValue130(field,value)||Number(limit)!==500){if(report)(report.cache_checks??=[]).push({collection:c,field,cache:"panel",result:"not_supported"});return db.queryEqual(c,field,value,limit);}
    const key=queryKey(c,value,field);
    if(pending.has(key))return copy(await pending.get(key));
    const operation=(async()=>{
      let packet=await read(key);const missing=!Array.isArray(packet?.data);
      if(report)(report.cache_checks??=[]).push({collection:c,field,cache:"panel",result:missing?"miss":"hit"});
      if(missing){const data=remember(c,await db.queryEqual(c,field,value,500));packet={version:48,data,revision:''};}
      const data=await merge(key,packet,!missing);
      if(missing){const marker=await read(key+':changes');await optionalSave(key,{data,revision:marker?.revision||''});}
      return remember(c,data);
    })();
    pending.set(key,operation);try{return copy(await operation);}finally{pending.delete(key);}
  }
  async function panelGet(c,id,scope={}){
    const itemKey=c+'/'+text(id);
    if(fields[c]&&known.has(itemKey))return copy(known.get(itemKey));
    if(scope.advertiserId&&matchesField(c,'anunciante_id')){
      const listKey=queryKey(c,scope.advertiserId,'anunciante_id'),packet=await read(listKey);
      if(report)(report.cache_checks??=[]).push({collection:c,field:'anunciante_id',cache:'panel-record-from-list',result:Array.isArray(packet?.data)?'hit':'miss'});
      if(Array.isArray(packet?.data)){
        const rows=remember(c,await merge(listKey,packet));
        const row=rows.find(row=>text(row.id)===text(id));
        if(row)return copy(row);
      }
    }
    async function directGet(){const row=await db.get(c,id);if(fields[c])known.set(itemKey,copy(row));return row;}

    if(c==='anunciantes_administracion'&&db.panelAdministration)return db.panelAdministration(id);
    if(!['publicidad_cambios','anunciantes'].includes(c))return directGet();
    if(c==='publicidad_cambios'){
      const match=text(id).match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
      if(match){
        const key='panel:counter:v58:'+encodeURIComponent(match[1]),date=match[2],hit=await read(key);
        if(hit&&hit.date===date)return copy(hit.data);
        if(hit&&hit.date<date){await optionalSave(key,{date,data:null});return null;}
        const legacy=await read(docKey(id));
        const data=legacy?legacy.data:await db.get(c,id);
        // Never regress the rolling date for requests that crossed midnight.
        if(!hit||hit.date<=date)await optionalSave(key,{date,data});
        return data;
      }
    }
    const key=c==='anunciantes'?advertiserKey(id):docKey(id);if(records.has(key))return copy(records.get(key));
    const hit=await read(key);if(report)(report.cache_checks??=[]).push({collection:c,cache:"panel-record",result:hit?"hit":"miss"});if(hit)return copy(hit.data);
    const data=await db.get(c,id);await optionalSave(key,{data});return data;
  }
  const advertiserLists116=['anunciantes_sedes','eventos','actividades','promos','publicidades','farmacias_ciclos'];
  const initialized116=new Set();
  async function prepareNewAdvertiserPanels116(/** @type {string} */ id){
    id=text(id);if(!id||initialized116.has(id))return;initialized116.add(id);
    for(const c of advertiserLists116){const key=queryKey(c,id,'anunciante_id');if(!await read(key))await requiredSave(key,{version:48,data:[],revision:''});}
  }
  async function primePanelSnapshots116(/** @type {Map<string,any[]>} */ snapshots,cursor=0){
    const advertisers=snapshots.get('anunciantes')||[],admins=snapshots.get('anunciantes_administracion')||[];
    const owners=new Set([...advertisers,...admins].map(r=>text(r.id||r.anunciante_id)).filter(Boolean));
    const allOwners=[...owners].sort(),batch=new Set(allOwners.slice(cursor,cursor+5));
    let preparadas=0,existentes=0,omitidas=0;
    async function prime(/** @type {string} */ key,/** @type {any} */ data){if(await read(key)){existentes++;return;}if(JSON.stringify(data).length>2000000){omitidas++;return;}await requiredSave(key,{version:48,data,revision:''});preparadas++;}
    if(cursor===0){
      /** @type {Array<[string, string, string | boolean]>} */
      const initialQueries=[['anunciantes','revision_adulto','PENDIENTE'],['eventos','revision_adulto','PENDIENTE'],['actividades','revision_adulto','PENDIENTE'],['promos','revision_adulto','PENDIENTE'],['publicidades','revision_adulto','PENDIENTE'],['anunciantes','estado_moderacion','PENDIENTE'],['eventos','estado_moderacion','PENDIENTE'],['eventos','estado_moderacion','REVISION'],['promos','estado_moderacion','PENDIENTE'],['publicidades','estado_moderacion','PENDIENTE'],['actividades','aprobado',false]];
      for(const [c,field,value]of initialQueries){
        if(snapshots.has(c))await prime(queryKey(c,value,field),(snapshots.get(c)||[]).filter(row=>row[field]===value));
      }
    }
    const advertiserMap=new Map(advertisers.map(r=>[text(r.id||r.anunciante_id),r]));for(const id of batch)await prime(advertiserKey(id),advertiserMap.get(id)||null);
    for(const c of advertiserLists116){
      if(!snapshots.has(c))continue;
      const groups=new Map([...batch].map(id=>[id,[]]));
      for(const row of snapshots.get(c)){const id=text(row.anunciante_id);if(!batch.has(id))continue;groups.get(id).push(row);}
      for(const [id,rows]of groups){if(rows.length>500){omitidas++;continue;}await prime(queryKey(c,id,'anunciante_id'),rows);}
    }
    const cache116=createCache(env),relations116=[['eventos','event','evento_id','evento_programacion','programacion_version'],['actividades','activity','actividad_id','actividad_horarios','horarios_version'],['publicidades','publicity-media','publicidad_id','publicidad_media','relaciones_version'],['publicidades','publicity-seg','publicidad_id','publicidad_segmentacion','relaciones_version']];
    for(const [parents,type,idField,children,embedded]of relations116){
      const legacy=(snapshots.get(parents)||[]).filter(r=>batch.has(text(r.anunciante_id))&&Number(r[embedded])!==2);
      if(legacy.length>200){omitidas++;continue;}
      for(const row of legacy){const id=text(row[idField]||row.id),relationKey='relations:prepared:v1:'+type+':'+id;if(await cache116.get(relationKey)){existentes++;continue;}const data=(snapshots.get(children)||[]).filter(r=>text(r[idField])===id);await putPreparedRelationsV1({cache:cache116,type,id,next:row,data});preparadas++;}
    }
    if(db.primePanelAdministration116)preparadas+=await db.primePanelAdministration116(admins.filter(r=>batch.has(text(r.id||r.anunciante_id))));
    return {anunciantes:owners.size,procesados:Math.min(cursor+5,allOwners.length),completo:cursor+5>=allOwners.length,next_cursor:cursor+5<allOwners.length?cursor+5:null,preparadas,existentes,omitidas,lecturas_adicionales_firestore:0,escrituras_firestore:0};
  }
  async function beforeMutation(c,id,options){
    if(!fields[c])return null;
    const k=c+'/'+text(id);
    // Creaciones declaradas por el módulo no requieren leer un ID recién generado.
    if(!known.has(k)&&!options.newDocument){const old=await db.get(c,id);known.set(k,copy(old));}
    return copy(known.get(k)||null);
  }
  function queue(c,id,old,row){
    directoryChanges102.set(c+'/'+id,{c,id,row});
    const entry=fields[c];if(!entry)return;
    for(const field of (Array.isArray(entry)?entry:[entry])){
      const prior=text(old?.[field]),next=text(row?.[field]);
      if(prior&&prior!==next&&trackedQueryValue130(field,old?.[field])){const key=queryKey(c,prior,field);changes.set(key+':delta:'+text(id),{key,id:text(id),deleted:true});}
      if(next&&trackedQueryValue130(field,row?.[field])){const key=queryKey(c,next,field);changes.set(key+':delta:'+text(id),{key,id:text(id),deleted:false,data:{...row,id:text(id)}});}
    }
    known.set(c+'/'+text(id),copy(row));
  }
  async function flush(){
    const affected=new Set();
    for(const [key,change]of changes){affected.add(change.key);try{await requiredSave(key,{version:48,...change});}catch(error){if(kv?.delete)await kv.delete(change.key);throw error;}}
    for(const key of affected){try{await requiredSave(key+':changes',{version:48,revision:crypto.randomUUID(),updated_at:Date.now()});}catch(error){if(kv?.delete)await kv.delete(key);throw error;}}
    changes.clear();
    for(const [key,data]of records){try{await requiredSave(key,{version:48,data});}catch(error){if(kv?.delete)await kv.delete(key);throw error;}}
    for(const [key,data]of records){
      const prefix='panel:record:v48:publicidad_cambios:';
      if(key.startsWith(prefix)){
        const match=decodeURIComponent(key.slice(prefix.length)).match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
        if(match){const rolling='panel:counter:v58:'+encodeURIComponent(match[1]);const hit=await read(rolling);if(!hit||hit.date<=match[2])await requiredSave(rolling,{version:48,date:match[2],data});}
      }
    }

    records.clear();
    const directoryCache102=createCache(env);
    for(const change of directoryChanges102.values()){
      await directoryDelta102(directoryCache102,change.c,change.id,change.row);
      await notify102(directoryCache102,change.c,change.id,change.row);
    }
    directoryChanges102.clear();
    if(db.flushLoginCache)await db.flushLoginCache();
  }
  return {...db,
    primePanelSnapshots116,
    prepareNewAdvertiserPanels116,
    repairPanelGuide132(c,id,before,row){
      queue(c,id,before,row);
      if(c==='anunciantes')records.set(advertiserKey(id),row);
    },

    notePanelCacheCheck(entry){if(report)(report.cache_checks??=[]).push(entry);},
    async cachedPanelRows(c,field,value){const key=queryKey(c,value,field);const packet=await read(key);return Array.isArray(packet?.data)?copy(await merge(key,packet)):null;},
    async commitPatches(/** @type {any[]} */ entries){
      for(const e of entries){const newEmploymentCycle=e.collection==='empleos'&&e.before&&e.patch?.empleo_id!==e.before.empleo_id&&e.patch?.owner_id===e.before.owner_id&&e.patch?.owner_type===e.before.owner_type&&e.patch?.revision_definitiva===false&&Date.parse(e.before.hasta)<=Date.now();if(!newEmploymentCycle&&!e.remove&&e.before&&(e.before.revision_definitiva||directoryState102(e.before)==='RECHAZADA'&&await createCache(env).get('review:closed:v102:'+e.collection+':'+e.id)))throw httpError('La publicación está bloqueada por una revisión definitiva.',403);}
      const result=await db.commitPatches(entries);
      for(let i=0;i<entries.length;i++){const e=entries[i];queue(e.collection,e.id,e.before||null,result[i]);if(e.collection==='anunciantes')records.set(advertiserKey(e.id),result[i]);}
      return result;
    },
    rememberPanelRows(c,rows){if(fields[c])remember(c,rows);},
    async prepareNewPanelList(c,field,value){if(matchesField(c,field))await optionalSave(queryKey(c,value,field),{data:[],revision:''});},
    panelReadDb(scope={}){return {...db,get:(c,id)=>panelGet(c,id,scope),queryEqual:panelQuery};},
    flushLoginCache:flush,
    async get(c,id){const row=await db.get(c,id);if(fields[c])known.set(c+'/'+text(id),copy(row));return row;},
    async queryEqual(...args){return remember(args[0],await db.queryEqual(...args));},
    async patch(c,id,patch,options={}){
      const old=await beforeMutation(c,id,options);
      const removingFreeReceipt=options.quotaReceiptOnly===true&&c==='eventos'&&patch.eliminado===true&&patch.estado==='ELIMINADO'&&patch.nivel==='FREE'&&patch.pausado===true;
      if(!removingFreeReceipt&&(old?.revision_definitiva||old&&directoryState102(old)==='RECHAZADA'&&await createCache(env).get('review:closed:v102:'+c+':'+id)))throw httpError('La publicación está bloqueada por una revisión definitiva.',403);
      if(['publicidad_cambios','anunciantes'].includes(c)&&kv?.delete)await kv.delete(c==='anunciantes'?advertiserKey(id):docKey(id));
      const row=await db.patch(c,id,patch,options);queue(c,id,old,{...old,...patch,...row,id:text(id)});
      if(c==='anunciantes'&&options.newDocument)await prepareNewAdvertiserPanels116(id);
      if(['publicidad_cambios','anunciantes'].includes(c))records.set(c==='anunciantes'?advertiserKey(id):docKey(id),row||{...patch,id:text(id)});
      return row;
    },
    async delete(c,id,options={}){
      const old=await beforeMutation(c,id,options);
      if(['publicidad_cambios','anunciantes'].includes(c)&&kv?.delete)await kv.delete(c==='anunciantes'?advertiserKey(id):docKey(id));
      const result=await db.delete(c,id,options);queue(c,id,old,null);
      if(['publicidad_cambios','anunciantes'].includes(c))records.set(c==='anunciantes'?advertiserKey(id):docKey(id),null);
      return result;
    }
  };
}

return withPanelCacheV48;
})();

// Private authentication projection. Passwords never stored in KV or public responses.
function withAuthCacheV58(db,env){
 const kv=env.GLD_CACHE_KV,rawRows=new Map(),enc=new TextEncoder();
 const text=v=>String(v??'').trim(),norm=v=>text(v).toLowerCase();
 const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 const unhex=s=>Uint8Array.from(s.match(/../g)||[],v=>parseInt(v,16));
 async function mailKey(mail){const secret=text(env.SERVER_SECRET);if(!secret)throw Error('Falta SERVER_SECRET');const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return 'auth:mail:v58:'+hex(await crypto.subtle.sign('HMAC',key,enc.encode(norm(mail))));}
 const sidKey=id=>'auth:sid:v58:'+text(id);
 async function load(key){if(!kv?.get)return null;const v=await kv.get(key,{cacheTtl:30});if(!v)return null;try{const p=JSON.parse(v);return p.version===58?p:null;}catch{return null;}}
 async function put(key,p){if(!kv?.put)throw Error('Falta caché privada de autenticación');try{await kv.put(key,JSON.stringify({...p,version:58}));}catch{await new Promise(r=>setTimeout(r,1100));await kv.put(key,JSON.stringify({...p,version:58}));}}
 async function verifier(password,salt){const key=await crypto.subtle.importKey('raw',enc.encode(text(password)),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256));}
 async function packet(row,prior){const {clave,...data}=row;let salt=prior?.salt,digest=prior?.digest;if(clave!==undefined){salt=hex(crypto.getRandomValues(new Uint8Array(16)));digest=await verifier(clave,salt);}if(!salt||!digest)throw Error('Falta verificador de cuenta');return {version:58,data,salt,digest};}
 async function store(row,prior){const p=await packet(row,prior),key=await mailKey(row.mail);await put(key,p);await put(sidKey(row.suscriptor_id||row.id),{mail_key:key});return p;}
 async function previous(id){if(rawRows.has(text(id)))return {row:rawRows.get(text(id)),p:null};const index=await load(sidKey(id));const p=index?await load(index.mail_key):null;if(p?.data)return {row:p.data,p};const row=await db.get('suscriptores',id);return {row,p:null};}
 return {...db,
  async loginAccount(mail,password,originalMail=mail){const key=await mailKey(mail),hit=await load(key);if(hit){if(hit.deleted||!hit.data)return null;const digest=await verifier(password,hit.salt);let diff=digest.length^hit.digest.length;for(let i=0;i<digest.length;i++)diff|=digest.charCodeAt(i)^hit.digest.charCodeAt(i);return diff?null:structuredClone(hit.data);}
   let rows=await db.queryEqual('suscriptores','mail',norm(mail),5);if(!rows.length&&originalMail!==norm(mail))rows=await db.queryEqual('suscriptores','mail',originalMail,5);const row=rows.find(r=>norm(r.mail)===norm(mail));if(!row){await put(key,{deleted:true});return null;}rawRows.set(text(row.suscriptor_id||row.id),row);await store(row);if(text(row.clave)!==text(password))return null;const {clave,...data}=row;return data;
  },
  async cachedAdminSettings126(id){
   const key='auth:admin:v100:'+encodeURIComponent(text(id)),hit=await load(key);
   if(hit)return structuredClone(hit.data||null);
   let row=await db.get('superadmins',id);
   if(!row){const rows=await db.queryEqual('superadmins','suscriptor_id',id,5);row=rows.find(r=>text(r.suscriptor_id)===text(id));}
   await put(key,{data:row||null});return row||null;
  },
  async loginAdmin(id){
   const key='auth:admin:v100:'+encodeURIComponent(text(id));
   const policyRaw=kv?.get?await kv.get('admin:access:v72:'+text(id),{cacheTtl:30}):null;
   let policy=null;try{policy=policyRaw?JSON.parse(policyRaw):null;}catch{return null;}
   if(policy&&!policy.activo)return null;
   const hit=await load(key);
   if(hit?.data&&(!policy||hit.data.access_revision===policy.revision))return structuredClone(hit.data);
   let row=await db.get('superadmins',id);
   if(!row){const rows=await db.queryEqual('superadmins','suscriptor_id',id,5);row=rows.find(r=>text(r.suscriptor_id)===text(id));}
   if(!row||policy&&row.access_revision!==policy.revision)return null;
   await put(key,{data:row});return structuredClone(row);
  },
  async cachedSubscriberProjection(id){const old=await previous(id);if(!old.row)return null;if(!old.p&&Object.hasOwn(old.row,'clave'))await store(old.row);const {clave,...data}=old.row;return structuredClone(data);},
  async get(c,id){const row=await db.get(c,id);if(c==='suscriptores'&&row)rawRows.set(text(id),row);return row;},
  async patch(c,id,patch,options={}){if(c==='superadmins'&&kv?.delete){await kv.delete('auth:admin:v100:'+encodeURIComponent(text(patch.suscriptor_id||id)));}if(c!=='suscriptores')return db.patch(c,id,patch,options);const old=await previous(id);const result=await db.patch(c,id,patch,options);const row={...old.row,...patch,...result,id:text(id)};if(old.row?.mail&&norm(old.row.mail)!==norm(row.mail))await put(await mailKey(old.row.mail),{deleted:true});await store(row,old.p);await syncBirthdayV83(env,old.row,row);rawRows.set(text(id),row);return result;},
  async delete(c,id,options={}){if(c==='superadmins'&&kv?.delete){await kv.delete('auth:admin:v100:'+encodeURIComponent(text(id)));}if(c!=='suscriptores')return db.delete(c,id,options);const old=await previous(id),result=await db.delete(c,id,options);if(old.row?.mail)await put(await mailKey(old.row.mail),{deleted:true});await put(sidKey(id),{deleted:true});await syncBirthdayV83(env,old.row,null);rawRows.delete(text(id));return result;}
 };
}

// A single access classification, independent of content moderation.
function adultFlag(value){return value===true||value===1||['true','1','si','sí'].includes(String(value??'').trim().toLowerCase());}
function adultFields(current={},payload={}){
 const flag=Object.hasOwn(payload,'contenido_adulto')?adultFlag(payload.contenido_adulto):adultFlag(current?.contenido_adulto);
 return {contenido_adulto:flag,revision_adulto:flag?'PENDIENTE':'NO_APLICA'};
}
function birthDateOnly_(value){
 const raw=String(value??'').trim();
 const match=raw.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/);
 if(!match)return '';
 const [year,month,day]=match[1].split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return '';
 if(raw.length>10&&!Number.isFinite(Date.parse(raw)))return '';
 return match[1];
}
function adultAge(birth,now=new Date(Date.now()-3*60*60*1000)){
 birth=birthDateOnly_(birth);
 if(!birth)return null;
 const [y,m,d]=birth.split('-').map(Number),b=new Date(Date.UTC(y,m-1,d));
 if(b.getUTCFullYear()!==y||b.getUTCMonth()!==m-1||b.getUTCDate()!==d||b>now)return null;
 return now.getUTCFullYear()-y-(now.getUTCMonth()<m-1||(now.getUTCMonth()===m-1&&now.getUTCDate()<d)?1:0);
}
async function adultGrant(env,request){
 const token=String(request.headers.get('X-GLD-Adult-Token')||''),[body,sig]=token.split('.');
 if(!body||!sig||sig!==await hmac2(env,body))return false;
 let p;try{p=JSON.parse(b64decode2(body));}catch{return false;}
 if(p.typ!=='GLD_ADULT_ACCESS'||!p.sid||!p.exp||Date.now()>p.exp)return false;
 const activeSession=await verifySubscriberSession(env,request);if(!activeSession.ok||activeSession.sid!==p.sid)return false;
 const s=await subscriberSessionState(env,p.sid);
 return !s.deleted&&Number(s.version||0)===Number(p.sv||0);
}
function adultPublic(value,authorized){
 if(Array.isArray(value))return value.map(x=>adultPublic(x,authorized)).filter(x=>x!==null);
 if(!value||typeof value!=='object')return value;
 if(value.revision_definitiva||['PENDIENTE','RECHAZADO','RECHAZADA'].includes(String(value.estado_moderacion||'').toUpperCase()))return null;
 if(adultFlag(value.contenido_adulto)){
  if(value.revision_adulto!=='APROBADO')return null;
  if(!authorized){
   const out={contenido_adulto:true,bloqueado18:true,nombre:'Contenido +18',nombre_evento:'Contenido +18',titulo:'Contenido +18',actividad:'Contenido +18',descripcion:'Iniciá sesión y confirmá tu edad para visualizar esta publicación.',sedes:[]};
   if(value.promo_id){out.promo='Promoción con contenido +18';}
   out.sedes=(value.sedes||[]).map(s=>({sede_id:s.sede_id,ciudad_id:s.ciudad_id,nombre_sede:'Contenido +18'}));
   for(const k of ['id','anunciante_id','evento_id','actividad_id','publicidad_id','promo_id','empleo_id','sede_id','ciudad_id','nivel','estado','aprobado','activo','pausado','desde','hasta','fecha_desde','fecha_hasta'])if(Object.hasOwn(value,k))out[k]=value[k];
   return out;
  }
 }
 const out=Object.fromEntries(Object.entries(value).filter(([k])=>!['declaracion_publicacion','aceptacion_terminos','motivo_revision','moderado_por','adulto_revisado_por'].includes(k)).map(([k,v])=>[k,adultPublic(v,authorized)]));
 if(adultFlag(value.contenido_adulto)&&authorized)for(const k of ['nombre','nombre_evento','titulo','promo'])if(out[k])out[k]='+18 · '+out[k];
 return out;
}
async function adultPublicResponse(response,env,request){
 if(!response.headers.get('Content-Type')?.includes('application/json')||response.status!==200)return response;
 const body=await response.json(),authorized=await adultGrant(env,request),safe=adultPublic(body,authorized),headers=new Headers(response.headers);
 headers.set('Cache-Control','private, no-store');headers.set('Vary','X-GLD-Adult-Token');
 return new Response(JSON.stringify(safe),{status:response.status,headers});
}
async function routeAdult(ctx){
 const {path,request,env,db,cache}=ctx;
 if(path==='/adult/access'&&request.method==='POST'){
  const s=await verifySubscriberSession(env,request);if(!s.ok)return json({success:false,code:'LOGIN_REQUIRED',message:'Iniciá sesión para visualizar contenido +18.'},401);
  const body=await request.json();if(body.confirmar!==true)return json({success:false,message:'Confirmá que querés visualizar contenido +18.'},400);
  const profile=await db.cachedSubscriberProjection(s.sid),age=adultAge(profile?.fecha_nacimiento);
  if(!profile||profile.activo===false||age===null||age<18)return json({success:false,code:age===null?'AGE_UNKNOWN':'UNDERAGE',message:age===null?'Completá tu fecha de nacimiento en Mi Guía → Mis datos. Si ya hay una fecha registrada, pedí su corrección en Soporte.':'Tu edad no permite visualizar contenido +18.'},403);
  const payload=b642(JSON.stringify({typ:'GLD_ADULT_ACCESS',sid:s.sid,sv:s.sv||0,exp:s.persistent===true?Date.now()+60*60*1000:Math.min(Number(s.exp),Date.now()+60*60*1000)}));
  return json({success:true,token:payload+'.'+await hmac2(env,payload)});
 }
 if(path!=='/superadmin/adult-review')return null;
 const auth=await requireAdmin(env,request);if(!auth)return json({success:false,message:'Acceso administrativo requerido'},401);
 if(!isTopAdmin2(auth))return json({success:false,message:'Revisión global reservada a superadministración'},403);
 const defs={EMPLEO:['empleos','empleo_id'],PROMO:['promos','promo_id'],ANUNCIO:['anunciantes','anunciante_id'],EVENTO:['eventos','evento_id'],ACTIVIDAD:['actividades','actividad_id'],PUBLICIDAD:['publicidades','publicidad_id']};
 if(request.method==='GET'){
  const reader=db.panelReadDb?db.panelReadDb():db;
  const groups=await Promise.all(Object.entries(defs).map(async([tipo,[collection,idField]])=>(await reader.queryEqual(collection,'revision_adulto','PENDIENTE',500)).filter(x=>!rejectedActivity(x)).map(x=>({...x,tipo,id:String(x[idField]||x.id)}))));
  return json({success:true,results:groups.flat()});
 }
 if(request.method!=='POST')return json({success:false,message:'Método inválido'},405);
 const {tipo,id,decision}=await request.json(),def=defs[tipo];if(!def||!id||!['APROBAR','RECHAZAR'].includes(decision))return json({success:false,message:'Decisión inválida'},400);
 const empVersion109=def[0]==='empleos'?await db.getVersioned('empleos',empRecord109(id)):null;
 const current=empVersion109?empVersion109.doc:await db.get(def[0],id);if(!current||def[0]==='empleos'&&current.empleo_id!==id||rejectedActivity(current)||!adultFlag(current.contenido_adulto)||current.revision_adulto!=='PENDIENTE')return json({success:false,message:'No hay una revisión +18 pendiente.'},409);
 const patch={revision_adulto:decision==='APROBAR'?'APROBADO':'RECHAZADO',adulto_revisado_por:auth.sid,adulto_revisado_en:new Date().toISOString(),actualizado:new Date().toISOString()};
 // A rejection is final for this submission; approval preserves a genuinely unresolved text review.
 if(decision==='RECHAZAR'||!String(current.motivo_revision||'').trim()||['APROBADO','PUBLICADO'].includes(String(current.estado_moderacion||'').toUpperCase())){
  patch.estado_moderacion=decision==='APROBAR'?'APROBADO':'RECHAZADO';
  if(def[0]==='eventos')patch.estado=decision==='APROBAR'?'PUBLICADO':'RECHAZADO';
  if(def[0]==='actividades'){patch.aprobado=decision==='APROBAR';patch.estado=decision==='APROBAR'?'ACTIVA':'RECHAZADA';}
  if(def[0]==='publicidades'||def[0]==='promos'||def[0]==='empleos')patch.aprobado=decision==='APROBAR';
 }
 const saved=empVersion109?(await db.commitPatches([{collection:'empleos',id:empRecord109(id),before:current,patch,options:{updateTime:empVersion109.updateTime}}]))[0]:await db.patch(def[0],id,patch,{mustExist:true});
 await syncPublicationReviewV77({db,cache,collection:def[0],id,current,next:saved});
 return json({success:true,item:saved});
}

// reconstruccion/worker/app-main-v35.js

const clean=p=>{
  p=String(p||"/").replace(/\/+/g,"/");
  return p.length>1&&p.endsWith("/")?p.slice(0,-1):p;
};

async function supportReceiptV74(env,id){
 const body=b64(new TextEncoder().encode(JSON.stringify({scope:"support",ticket_id:id,exp:Date.now()+30*86400000})));
 return body+"."+await hmac(env,body);
}
async function supportActorV74(env,request,id,admin){
 if(admin){const a=await verifyAdmin(env,request);return a.ok&&["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(a.rol)?{ok:true,admin:true,sid:a.sid}:{ok:false};}
 const token=String(request.headers.get("Authorization")||"").replace(/^Bearer /i,"");const parts=token.split(".");
 if(parts.length===2&&parts[1]===await hmac(env,parts[0])){
  try{const p=JSON.parse(b64decode(parts[0]));if(p.scope==="support"&&p.ticket_id===id&&Number(p.exp)>Date.now())return {ok:true,receipt:true};}catch{}
 }
 const a=await verifySubscriberSession(env,request);return a.ok?{ok:true,sid:a.sid}:{ok:false};
}
async function routeSupportConversationV74(ctx){
 const {path,request,env,db,cache,url}=ctx,admin=path.startsWith("/superadmin/");
 if(path==="/support/mine"&&request.method==="GET"){
  const auth=await verifySubscriberSession(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);
  const read=db.panelReadDb?db.panelReadDb():db,rows=await read.queryEqual("solicitudes_soporte","suscriptor_id",auth.sid,500);
  const aid=String(url.searchParams.get('anunciante_id')||''),personal=url.searchParams.get('ambito')==='personal';
  if(aid&&!(auth.auth||[]).some(r=>String(r.anunciante_id||'')===aid))return json({success:false,message:'No tenés acceso a este anunciante.'},403);
  const reviews=await knownReviews102(db,cache,auth.sid,aid);
  return json({success:true,revisiones:reviews,results:rows.filter(r=>personal?!r.anunciante_id:aid?String(r.anunciante_id||'')===aid:true).map(r=>({solicitud_id:r.solicitud_id||r.id,tipo:r.tipo,estado:r.estado,detalle:r.detalle,asunto:String(r.detalle||'').match(/^Publicación: (.+)$/m)?.[1]||String(r.detalle||'').split('\n')[0].slice(0,100),anunciante_id:r.anunciante_id||'',revision:r.revision||reviewReference102(r),creado_en:r.creado_en}))});
 }
 if(!["/support/conversation","/support/reply","/superadmin/support/conversation","/superadmin/support/reply"].includes(path))return null;
 let body={};if(request.method==="POST"){try{body=await request.json();}catch{return json({success:false,message:"Mensaje inválido."},400);}}
 const id=String(body.solicitud_id||url.searchParams.get("solicitud_id")||"").trim();
 if(!id)return json({success:false,message:"Falta la solicitud."},400);
 const actor=await supportActorV74(env,request,id,admin);if(!actor.ok)return json({success:false,message:"Ingresá a tu cuenta o abrí el enlace de tu solicitud."},401);
 const current=await cache.get("support:record:v73:"+id)||await db.get("solicitudes_soporte",id);
 if(!current)return json({success:false,message:"Solicitud no encontrada."},404);
 if(!actor.admin&&!actor.receipt&&String(current.suscriptor_id||"")!==actor.sid)return json({success:false,message:"No tenés acceso a esta solicitud."},403);
 const read=db.panelReadDb?db.panelReadDb():db;
 if(path.endsWith('/conversation')&&request.method==="GET"){
  const rows=await read.queryEqual("solicitudes_soporte_mensajes","solicitud_id",id,500);
  return json({success:true,solicitud:{solicitud_id:id,tipo:current.tipo,estado:current.estado,detalle:current.detalle,resolucion:current.estado==="CERRADA"?current.nota||"":""},mensajes:rows.sort((a,b)=>String(a.creado_en).localeCompare(String(b.creado_en))).map(m=>({id:m.id,autor:m.autor,texto:m.texto,creado_en:m.creado_en}))});
 }
 if(path.endsWith('/reply')&&request.method==="POST"){
  if(current.estado==="CERRADA")return json({success:false,message:"La solicitud está cerrada."},409);
  const texto=String(body.texto||"").trim(),requestKey=String(body.request_key||"");
  if(!texto||texto.length>2000||!/^[a-f0-9-]{36}$/i.test(requestKey))return json({success:false,message:"Escribí un mensaje de hasta 2000 caracteres."},400);
  const mid="MSG-"+(await hmac(env,JSON.stringify([id,actor.admin?"ADMIN":"USUARIO",actor.sid||"",requestKey]))).slice(0,28),key="support:message:v74:"+mid;
  if(await cache.get(key))return json({success:true,repetida:true});
  await db.patch("solicitudes_soporte_mensajes",mid,{solicitud_id:id,autor:actor.admin?"ADMIN":"USUARIO",texto,creado_en:new Date().toISOString()},{newDocument:true});
  await cache.put(key,{sent:true});return json({success:true});
 }
 return json({success:false,message:"Operación no disponible."},405);
}

async function routeSupportV73(ctx){
 const {path,request,env,db,cache,url}=ctx;
 const collection="solicitudes_soporte";
 if(path==="/support/requests"&&request.method==="POST"){
  let body;try{body=await request.json();}catch{return json({success:false,message:"Solicitud inválida."},400);}
  const tipo=String(body.tipo||"").toUpperCase(),mail=String(body.mail||"").trim().toLowerCase(),detalle=String(body.detalle||"").trim();
  if(!["SOPORTE","RECUPERACION"].includes(tipo)||!/^\S+@\S+\.\S+$/.test(mail)||mail.length>200||detalle.length<5||detalle.length>2000)return json({success:false,message:"Indicá un correo válido y el motivo de la solicitud."},400);
  let auth=null;
  if(tipo==="SOPORTE"){
   auth=await verifySubscriberSession(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);
  }
  const aid=tipo==="SOPORTE"?String(body.anunciante_id||"").trim():"";
  if(aid&&!(auth?.auth||[]).some(r=>String(r.anunciante_id||"").trim()===aid))return json({success:false,message:"No tenés acceso a ese anunciante."},403);
  const requestKey=String(body.request_key||"");
  if(tipo==="RECUPERACION"&&!/^[a-f0-9-]{36}$/i.test(requestKey))return json({success:false,message:"Volvé a enviar la solicitud desde la plataforma."},400);
  const reference102=reviewReference102(body);
  if(reference102){await validateReview102(db,aid,reference102,auth.sid);const priorReviews=await knownReviews102(db,cache,auth.sid,aid);const priorReview=priorReviews.find(r=>r.tipo===reference102.tipo&&r.id===reference102.id);if(priorReview)return json(priorReview.estado==='CERRADA'?{success:false,message:'La revisión ya fue atendida. No se admite una nueva apelación.'}:{success:true,repetida:true,solicitud_id:priorReview.solicitud_id,estado:priorReview.estado},priorReview.estado==='CERRADA'?409:200);}
  const day=new Date().toISOString().slice(0,10),digest=await hmac(env,JSON.stringify([day,tipo,mail,detalle,auth?.sid||"",aid,requestKey]));
  const id=reference102?"REV-"+(await hmac(env,JSON.stringify([reference102.tipo,reference102.id]))).slice(0,28):"SOL-"+digest.slice(0,28),key="support:record:v73:"+id;
  const prior=await cache.get(key)||(reference102?await db.get(collection,id):null);
  if(reference102&&prior?.estado==='CERRADA')return json({success:false,message:'La revisión de esta publicación ya fue atendida. No se admite una nueva apelación.'},409);
  if(prior)return json({success:true,solicitud_id:id,estado:prior.estado,ticket_token:tipo==="RECUPERACION"?await supportReceiptV74(env,id):"",repetida:true,message:"La solicitud ya quedó registrada."});
  const now=new Date().toISOString();
  const row={...(reference102?{revision:reference102}:{}),solicitud_id:id,tipo,estado:"PENDIENTE",mail,detalle,nombre:String(body.nombre||"").trim().slice(0,160),whatsapp:String(body.whatsapp||"").replace(/[^0-9]/g,"").slice(0,20),suscriptor_id:auth?.sid||"",anunciante_id:aid,creado_en:now,actualizado_en:now};
  const saved=await db.patch(collection,id,row,{newDocument:true,mustNotExist:true});
  if(db.prepareNewPanelList)await db.prepareNewPanelList('solicitudes_soporte_mensajes','solicitud_id',id);
  await cache.put(key,{...row,...saved,id});
  return json({success:true,solicitud_id:id,estado:"PENDIENTE",ticket_token:tipo==="RECUPERACION"?await supportReceiptV74(env,id):"",message:"Solicitud registrada. Podés consultar al soporte indicando este número."});
 }
 if(path!=="/superadmin/support/requests"&&path!=="/superadmin/support/resolve")return null;
 const auth=await verifyAdmin(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);
 if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(auth.rol))return json({success:false,message:"La atención de soporte requiere un superadministrador."},403);
 if(path==="/superadmin/support/requests"&&request.method==="GET"){
  const state=String(url.searchParams.get("estado")||"ABIERTAS").toUpperCase();
  if(!["ABIERTAS","PENDIENTE","EN_ATENCION","CERRADA"].includes(state))return json({success:false,message:"Estado inválido."},400);
  const read=db.panelReadDb?db.panelReadDb():db,states=state==="ABIERTAS"?["PENDIENTE","EN_ATENCION"]:[state];
  const result=(await Promise.all(states.map(s=>read.queryEqual(collection,"estado",s,500)))).flat().sort((a,b)=>String(a.creado_en).localeCompare(String(b.creado_en)));
  for(const row of result){const key="support:record:v73:"+String(row.solicitud_id||row.id);if(!sameCacheData129(await cache.get(key),row))await cache.put(key,row);}
  return json({success:true,results:result,cantidades:{recuperacion:result.filter(x=>x.tipo==="RECUPERACION").length,soporte:result.filter(x=>x.tipo==="SOPORTE").length,total:result.length}});
 }
 if(path==="/superadmin/support/resolve"&&request.method==="POST"){
  let body;try{body=await request.json();}catch{return json({success:false,message:"Solicitud inválida."},400);}
  const id=String(body.solicitud_id||"").trim(),estado=String(body.estado||"").toUpperCase(),nota=String(body.nota||"").trim();
  if(!id||!["EN_ATENCION","CERRADA"].includes(estado)||nota.length>2000||(estado==="CERRADA"&&!nota))return json({success:false,message:"Al cerrar, indicá cómo fue atendida la solicitud."},400);
  if(body.decision_revision==='RECHAZAR'){if(estado!=='CERRADA')return json({success:false,message:'El rechazo definitivo debe cerrar la solicitud.'},400);return rejectReview102(ctx,auth,id,nota);}
  const key="support:record:v73:"+id,current=await cache.get(key)||await db.get(collection,id);
  if(!current)return json({success:false,message:"Solicitud no encontrada."},404);
  if(current.estado==="CERRADA")return json({success:true,updated:false,solicitud_id:id,estado:"CERRADA"});
  if(current.estado===estado&&String(current.nota||"")===nota)return json({success:true,updated:false,solicitud_id:id,estado});
  if(db.rememberPanelRows)db.rememberPanelRows(collection,[{...current,id}]);
  const patch={estado,nota,atendido_por:auth.sid,actualizado_en:new Date().toISOString()};
  const saved=await db.patch(collection,id,patch,{mustExist:true});
  await cache.put(key,{...current,...patch,...saved,id});
  return json({success:true,updated:true,solicitud_id:id,estado});
 }
 return json({success:false,message:"Operación no disponible."},405);
}

async function routeModeratorsV72(ctx){
  const {path,request,env,db,cache,url}=ctx;
  if(!path.startsWith("/superadmin/")||path==="/superadmin/session/login")return null;
  const auth=await verifyAdmin(env,request);
  if(!auth.ok)return json({success:false,message:auth.message},401);
  if(path.startsWith("/superadmin/moderators")){
    if(auth.rol!=="SUPERADMIN_PRINCIPAL")return json({success:false,message:"Solo el superadministrador principal puede habilitar moderadores."},403);
    if(path==="/superadmin/moderators"&&request.method==="GET"){
      const sid=String(url.searchParams.get("suscriptor_id")||"").trim();
      if(!sid)return json({success:false,message:"Seleccioná un suscriptor."},400);
      const read=db.panelReadDb?db.panelReadDb():db;
      let row;
      if(read.cachedAdminSettings126)row=await read.cachedAdminSettings126(sid);
      else{row=await read.get("superadmins",sid);if(!row){const rows=await read.queryEqual("superadmins","suscriptor_id",sid,5);row=rows.find(r=>String(r.suscriptor_id||"").trim()===sid);}}
      return json({success:true,moderador:row?{suscriptor_id:sid,rol:row.rol,activo:row.activo,ciudades:adminCityIdsV71(row.ciudades),permisos:row.permisos||{}}:null});
    }
    if(path==="/superadmin/moderators"&&request.method==="POST"){
      const body=await request.json();const sid=String(body.suscriptor_id||"").trim();
      if(!sid||sid===auth.sid)return json({success:false,message:"Elegí otro suscriptor; tu acceso principal se conserva."},400);
      const ciudades=adminCityIdsV71(body.ciudades);const activo=body.activo===true;
      const moderacion=Object.fromEntries(["EVENTO","ACTIVIDAD","ANUNCIANTE"].map(k=>[k,body.permisos?.moderacion?.[k]===true]));
      if(activo&&(!ciudades.length||!Object.values(moderacion).some(Boolean)))return json({success:false,message:"Asigná al menos una ciudad y un permiso de moderación."},400);
      const territory=await cache.get("territorio:public:v1")||{};
      const allowed=new Set((territory.ciudades||[]).map(c=>String(c.ciudad_id||c.id)));
      if(ciudades.some(c=>!allowed.has(c)))return json({success:false,message:"Seleccioná ciudades del catálogo territorial vigente."},400);
      const read=db.panelReadDb?db.panelReadDb():db;
      const subscriber=await read.get("suscriptores",sid);
      if(!subscriber)return json({success:false,message:"El suscriptor no existe."},404);
      let existing=await read.get("superadmins",sid);
      if(!existing){const rows=await read.queryEqual("superadmins","suscriptor_id",sid,5);existing=rows.find(r=>String(r.suscriptor_id||"").trim()===sid);}
      if(existing&&String(existing.rol||"").toUpperCase()!=="ADMIN_LOCAL")return json({success:false,message:"Esta cuenta tiene un rol superior; no se modifica desde Moderadores."},403);
      const revision=crypto.randomUUID();const key="admin:access:v72:"+sid;
      await cache.put(key,{activo:false,revision});
      const saved=await db.patch("superadmins",String(existing?.id||sid),{suscriptor_id:sid,rol:"ADMIN_LOCAL",activo,ciudades,permisos:{...(existing?.permisos||{}),moderacion},access_revision:revision,actualizado_en:new Date().toISOString(),actualizado_por:auth.sid});
      await cache.put(key,{activo,revision});
      return json({success:true,moderador:{suscriptor_id:sid,rol:saved.rol,activo:saved.activo,ciudades:saved.ciudades,permisos:saved.permisos},message:"Permisos guardados. El moderador debe volver a iniciar sesión."});
    }
    return json({success:false,message:"Operación no disponible."},405);
  }
  if(path==="/superadmin/free-event-exceptions"){
    if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN","ADMIN_LOCAL"].includes(auth.rol))return json({success:false,message:"Sin permiso para administrar excepciones."},403);
    if(auth.rol==="ADMIN_LOCAL"&&!moderatorAllowsV72(auth,"EVENTO"))return json({success:false,message:"No tenés permiso para moderar eventos."},403);
    /** @type {{results?: any[]}} */
    const index=await cache.get(ADMIN_ADVERTISERS_KEY);
    if(!Array.isArray(index?.results))return json({success:false,message:"El listado de anunciantes no está preparado. Solicitá su actualización a Gran Hermano."},503);
    const allowed=index.results.filter(row=>auth.rol!=="ADMIN_LOCAL"||(row.ciudad_ids?.length&&row.ciudad_ids.every(city=>adminCityIdsV71(auth.ciudades).includes(String(city)))));
    const aid=String(url.searchParams.get('anunciante_id')||'').trim();
    if(request.method==="GET"&&!aid)return json({success:true,results:allowed.map(row=>({id:row.id,nombre:row.nombre,ciudad_ids:row.ciudad_ids}))});
    let body={};if(request.method==="POST")body=await request.json();
    const target=aid||String(body.anunciante_id||'').trim();
    if(!allowed.some(row=>String(row.id)===target))return json({success:false,message:"El anunciante no pertenece a tu ámbito autorizado."},403);
    if(!['GET','POST'].includes(request.method))return json({success:false,message:"Operación no disponible."},405);
    if(request.method==='POST'&&auth.rol==='ADMIN_LOCAL'){
      const advertiser=await db.get('anunciantes',target);
      const sedes=await db.queryEqual('anunciantes_sedes','anunciante_id',target,500);
      const cities=[...new Set([advertiser?.ciudad_id,...sedes.map(row=>row.ciudad_id)].filter(Boolean).map(String))];
      if(!cities.length||cities.some(city=>!adminCityIdsV71(auth.ciudades).includes(city)))return json({success:false,message:"El anunciante tiene ciudades fuera de tu autorización. La excepción debe resolverla Gran Hermano."},403);
    }
    const versioned=request.method==='POST'?await db.getVersioned('anunciantes_administracion',target):null;
    const read=db.panelReadDb?db.panelReadDb():db;
    const admin=versioned?.doc||await read.get('anunciantes_administracion',target);
    if(!admin)return json({success:false,message:"Administración del anunciante no encontrada."},404);
    if(request.method==='GET')return json({success:true,sin_limites:freeEventPolicyV95(admin).sin_limites});
    if(typeof body.sin_limites!=='boolean'||Object.keys(body).some(k=>!['anunciante_id','sin_limites'].includes(k)))return json({success:false,message:"Indicá únicamente la excepción de Eventos Free."},400);
    if(freeEventPolicyV95(admin).sin_limites===body.sin_limites)return json({success:true,updated:false,sin_limites:body.sin_limites});
    const config=structuredClone(admin.funcionalidades_config||{});
    config.EVENTOS_FREE={...(config.EVENTOS_FREE||{}),sin_limites:body.sin_limites};
    const patch={funcionalidades_config:config,actualizado_en:new Date().toISOString(),actualizado_por:auth.sid,eventos_free_excepcion:{sin_limites:body.sin_limites,usuario_id:auth.sid,rol:auth.rol,fecha:new Date().toISOString()}};
    if(db.rememberPanelRows)db.rememberPanelRows('anunciantes_administracion',[{...admin,id:target}]);
    await db.patch('anunciantes_administracion',target,patch,{mustExist:true,updateTime:versioned.updateTime});
    await patchGuideAdminFieldsV2({cache,advertiserId:target,patch});
    return json({success:true,updated:true,sin_limites:body.sin_limites});
  }
  if(auth.rol==="ADMIN_LOCAL"){
    if(path==="/superadmin/dashboard"&&request.method==="GET"){
      const pending=filterAdminPendingV71(await pendingAllV3({db}),auth);
      return json({success:true,admin:{rol:auth.rol,ciudades:auth.ciudades,permisos:auth.permisos},resumen:{suscriptores:"—",anunciantes:pending.cantidades.anunciantes,ciudades:auth.ciudades.length}});
    }
    if(path==="/superadmin/territory"&&request.method==="GET"){
      const territory=await cache.get("territorio:public:v1")||{};
      return json({success:true,...territory,ciudades:(territory.ciudades||[]).filter(c=>auth.ciudades.includes(String(c.ciudad_id||c.id)))});
    }
    if(path==="/superadmin/catalogs/niveles_anunciante"&&request.method==="GET")return null;
    if(!["/superadmin/moderation/pending","/superadmin/moderation/resolve"].includes(path))return json({success:false,message:"El acceso de moderador está limitado a las publicaciones y ciudades asignadas."},403);
  }
  return null;
}

async function syncPublicationReviewV77({db,cache,collection,id,current,next}){
 if(collection==='empleos')return syncEmpleo109({cache,current,next});
 if(collection==='promos')return syncPromo({cache,current,next});
 if(collection==='anunciantes')return patchGuideAdvertiserDataFromCacheV2({cache,advertiserId:id,patch:next});
 if(collection==='eventos')return syncEventV2({db,cache,current,next});
 if(collection==='actividades'){const horarios=await getPreparedRelationsV1({cache,type:'activity',id,current,load:()=>db.queryEqual('actividad_horarios','actividad_id',id,500)});return syncActivityPreparedV2({cache,activityId:id,current,next,horarios,previousCities:[...new Set(horarios.map(h=>h.ciudad_id).filter(Boolean))]});}
 if(collection==='publicidades'){const [media,segmentacion]=await Promise.all([getPreparedRelationsV1({cache,type:'publicity-media',id,current,load:()=>db.queryEqual('publicidad_media','publicidad_id',id,500)}),getPreparedRelationsV1({cache,type:'publicity-seg',id,current,load:()=>db.queryEqual('publicidad_segmentacion','publicidad_id',id,500)})]);return syncPublicityPreparedV2({cache,publicityId:id,current,next,media,segmentacion,previousCities:[...new Set(segmentacion.map(s=>s.ciudad_id).filter(Boolean))]});}
}
const PUBLICATION_TERMS_V77='2026-10-10';
function publicationErrorV77(message,status=400){throw httpError(message,status);}
function publicationPolicyV77(row,rules){
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const fields=['nombre','nombre_evento','titulo','actividad','descripcion','texto','promo','otros','tags','adicionales','lugar','lugar_texto'];
 const collect=value=>{if(Array.isArray(value))return value.flatMap(collect);if(!value||typeof value!=='object')return [];return [...fields.map(k=>value[k]??''),...Object.entries(value).filter(([k,v])=>!fields.includes(k)&&v&&typeof v==='object').flatMap(([,v])=>collect(v))];};
 const text=' '+normalize(collect(row).join(' '))+' ';
 const matches=(rules||[]).filter(active3).filter(r=>{const term=normalize(r.termino||r.palabra||r.nombre);return term&&text.includes(' '+term+' ');});
 return {contenido_adulto:adultFlag(row.contenido_adulto),revision_adulto:adultFlag(row.contenido_adulto)?'PENDIENTE':'NO_APLICA',estado_moderacion:(adultFlag(row.contenido_adulto)||matches.length)?'PENDIENTE':'PUBLICADO',motivo_revision:matches.map(r=>String(r.regla_id||r.id||r.termino||r.palabra||r.nombre)).join(', ')};
}
function publicationDbV77(base,context,cache){
 const known=new Map();const wrap=db=>({...db,publicationContext:context,
  async get(c,id){if(known.has(c+'/'+id))return known.get(c+'/'+id);const r=await db.get(c,id);if(r)known.set(c+'/'+id,r);return r;},
  panelReadDb:db.panelReadDb?scope=>wrap(db.panelReadDb(scope)):undefined,
  async patch(c,id,patch,options={}){
   if(!context.collections.includes(c)){const result=await db.patch(c,id,patch,options);known.set(c+'/'+id,result);return result;}
   const prior=known.get(c+'/'+id),row={...prior,...context.data,...patch};
   const acceptance={version:PUBLICATION_TERMS_V77,usuario_id:context.sid||String(id),fecha:new Date().toISOString()};
   if(c==='suscriptores')patch={...patch,aceptacion_terminos:acceptance};
   else {
    const policy=publicationPolicyV77(row,context.rules);
    patch={...patch,...policy,declaracion_publicacion:acceptance};
    if(c==='eventos')patch.estado=policy.estado_moderacion==='PENDIENTE'?'PENDIENTE':'PUBLICADO';
    if(c==='actividades'){patch.aprobado=policy.estado_moderacion!=='PENDIENTE';patch.estado=patch.aprobado?'ACTIVA':'PENDIENTE';}
    if(c==='publicidades'||c==='promos')patch.aprobado=policy.estado_moderacion!=='PENDIENTE';
   }
   const result=await db.patch(c,id,patch,options);known.set(c+'/'+id,result);
   if(c!=='suscriptores'&&result.estado_moderacion==='PUBLICADO'&&!result.contenido_adulto){
    const date=new Date().toISOString(),item={collection:c,id:String(id),nombre:result.nombre_evento||result.nombre||result.titulo||String(id),ciudad_id:result.ciudad_id||'',ciudades:[...new Set([result.ciudad_id,...(context.data.horarios||context.data.programacion||[]).map(x=>x.ciudad_id)].filter(Boolean))],anunciante_id:result.anunciante_id||String(id),fecha:date,publicacion:result};await cache.put('publication:recent:v77:'+date.slice(0,10)+':'+c+':'+id,item,{expirationTtl:11*86400});await cache.put('publication:recent:latest:v77:'+c+':'+id,item,{expirationTtl:11*86400});
   }else if(c!=='suscriptores'){await cache.put('publication:recent:latest:v77:'+c+':'+id,{retirado:true,collection:c,id},{expirationTtl:11*86400});}
   return result;
  }
 });return wrap(base);
}
async function preparePublicationV77(ctx){
 if(ctx.request.method!=='POST')return;
 const body=await ctx.request.clone().json().catch(()=>({})),action=String(body?.action||body?.accion||ctx.url.searchParams.get('action')||'').toLowerCase();
 const promoData=body.payload&&typeof body.payload==='object'?body.payload:body;
 const promoContent=action==='createpromo'||action==='updatepromo'&&Object.keys(promoData).some(key=>!['promo_id','pausado','action','accion','advertiserId','advertiser_id','declaracion_publicacion'].includes(key));
 const collections=ctx.path==='/promos'&&promoContent?['promos']:ctx.path==='/events-new'&&['createfreeevent','updatefreeevent','createvipevent','updatevipevent'].includes(action)?['eventos']:ctx.path==='/actividades'&&action==='guardar'?['actividades']:ctx.path==='/publicidad'&&['guardar','save'].includes(action)?['publicidades']:ctx.path==='/commerce'&&action==='set_datos'?['anunciantes']:ctx.path==='/suscriptores'&&action==='crear'?['suscriptores']:ctx.path==='/suscriptores'&&action==='solicitar_anunciante'?['anunciantes']:[];
 if(!collections.length)return;
 let sid='';if(collections[0]!=='suscriptores'){const session=await verifySubscriberSession(ctx.env,ctx.request);if(!session.ok)publicationErrorV77(session.message,401);sid=session.sid;}
 const accepted=body.declaracion_publicacion;
 if(!accepted||accepted.aceptada!==true||accepted.version!==PUBLICATION_TERMS_V77)publicationErrorV77('Aceptá los términos y la declaración de responsabilidad antes de publicar.');
 const catalogs=await ctx.cache.get('admin:catalogs:v2');
 if(collections[0]!=='suscriptores'&&(!catalogs||!Array.isArray(catalogs.moderacion_18)))publicationErrorV77('No está disponible el catálogo de moderación. Reintentá cuando se restablezca.',503);
 if(sid&&collections[0]!=='suscriptores'&&ctx.db.cachedSubscriberProjection){const account=await ctx.db.cachedSubscriberProjection(sid),prior=account?.aceptacion_terminos_anunciante;if(prior){const active=await currentTermsV81(ctx.cache);if((account.historial_terminos_anunciante?.[active.version]||prior).version!==active.version)throw Object.assign(new Error('Los términos para anunciantes cambiaron. Revisalos y aceptalos desde el botón Términos y condiciones.'),{status:412,code:'TERMS_REVIEW_REQUIRED'});}}
 const data=body.payload&&typeof body.payload==='object'?body.payload:body;
 ctx.publication={sid,collections,data,rules:catalogs?.moderacion_18||[]};ctx.db=publicationDbV77(ctx.db,ctx.publication,ctx.cache);
}
async function routePublicationsV77(ctx){
 const {path,request,env,cache,db}=ctx;
 if(path==='/superadmin/publications/blocked'){
  const auth=await requireAdmin(env,request);if(!auth)return json({success:false,message:'Sesión administrativa requerida'},401);
  if(!isTopAdmin2(auth))return json({success:false,message:'Esta revisión global corresponde a superadministración'},403);
  const defs={ANUNCIANTE:'anunciantes',PUBLICIDAD:'publicidades',PROMO:'promos',EMPLEO:'empleos'},read=db.panelReadDb?db.panelReadDb():db;
  if(request.method==='GET'){const groups=await Promise.all(Object.entries(defs).map(async([tipo,c])=>(await read.queryEqual(c,'estado_moderacion','PENDIENTE',500)).filter(r=>!rejectedActivity(r)).map(r=>({...r,tipo,id:tipo==='EMPLEO'?r.empleo_id:r.id||r.publicidad_id}))));return json({success:true,results:groups.flat()});}
  const body=await request.json(),c=defs[body.tipo];if(!c||!body.id||!['APROBAR','RECHAZAR'].includes(body.decision))publicationErrorV77('Decisión inválida.');
  const empVersion109=c==='empleos'?await db.getVersioned('empleos',empRecord109(body.id)):null;
  const current=empVersion109?empVersion109.doc:await read.get(c,body.id);if(!current||c==='empleos'&&current.empleo_id!==body.id||current.estado_moderacion!=='PENDIENTE')return json({success:false,message:'No hay una revisión pendiente'},409);
  const patch={estado_moderacion:body.decision==='APROBAR'?'APROBADO':'RECHAZADO',moderado_por:auth.sid,moderado_en:new Date().toISOString()};if(c==='publicidades'||c==='promos'||c==='empleos')patch.aprobado=body.decision==='APROBAR';
  const saved=empVersion109?(await db.commitPatches([{collection:c,id:empRecord109(body.id),before:current,patch,options:{updateTime:empVersion109.updateTime}}]))[0]:await db.patch(c,body.id,patch,{mustExist:true});await syncPublicationReviewV77({db,cache,collection:c,id:body.id,current,next:saved});return json({success:true,item:saved});
 }
 if(path==='/superadmin/publications/recent'){
  const auth=await requireAdmin(env,request);if(!auth)return json({success:false,message:'Sesión administrativa requerida'},401);
  if(!canModerate2(auth))return json({success:false,message:'Sin permiso'},403);
  if(request.method==='POST'){
   const body=await request.json(),c=String(body.collection||''),id=String(body.id||'');if(!['eventos','actividades','anunciantes','publicidades'].includes(c)||!id||body.action!=='retirar')publicationErrorV77('Acción inválida.');
   const read=db.panelReadDb?db.panelReadDb():db,current=await read.get(c,id);if(!current)return json({success:false,message:'Publicación no encontrada'},404);
   const kind=({eventos:'EVENTO',actividades:'ACTIVIDAD',anunciantes:'ANUNCIANTE',publicidades:'PUBLICIDAD'})[c];assertModeratorV72(auth,kind);assertAdminCityV71(auth,current);
   if(auth.rol==='ADMIN_LOCAL'){
    const relation=c==='eventos'?['evento_programacion','evento_id']:c==='actividades'?['actividad_horarios','actividad_id']:c==='publicidades'?['publicidad_segmentacion','publicidad_id']:['anunciantes_sedes','anunciante_id'];
    const related=c==='actividades'?await getPreparedRelationsV1({cache,type:"activity",id,current,load:()=>read.queryEqual(relation[0],relation[1],id,500)}):await read.queryEqual(relation[0],relation[1],id,500);
    for(const item of related)assertAdminCityV71(auth,item);
   }
   const patch={estado_moderacion:'RECHAZADO',moderado_por:auth.sid,moderado_en:new Date().toISOString()};if(c==='eventos')patch.estado='RECHAZADO';if(c==='actividades'){patch.aprobado=false;patch.estado='RECHAZADA';}if(c==='publicidades')patch.aprobado=false;
   const saved=await db.patch(c,id,patch,{mustExist:true});await syncPublicationReviewV77({db,cache,collection:c,id,current,next:saved});await cache.put('publication:recent:latest:v77:'+c+':'+id,{retirado:true,collection:c,id},{expirationTtl:11*86400});
   return json({success:true,item:saved});
  }
  const kv=env.GLD_CACHE_KV;if(!kv.list)return json({success:false,message:'Listado KV no disponible'},503);
  const keys=[],recentPrefix='publication:recent:v77:',firstDay=new Date(Date.now()-10*86400000).toISOString().slice(0,10),lastDay=new Date().toISOString().slice(0,10);let recentCursor;
  do{const page=await kv.list({prefix:recentPrefix,...(recentCursor?{cursor:recentCursor}:{})});for(const item of page.keys){const day=item.name.slice(recentPrefix.length,recentPrefix.length+10);if(day>=firstDay&&day<=lastDay)keys.push(item.name);}recentCursor=page.list_complete?null:page.cursor;}while(recentCursor);
  const cutoff=Date.now()-10*86400000,items=[],seen=new Set(),offset=Math.max(0,Math.floor(Number(ctx.url.searchParams.get('offset'))||0));keys.sort().reverse();
  for(const key of keys.slice(offset,offset+100)){let item=await cache.get(key);if(!item)continue;item=await cache.get('publication:recent:latest:v77:'+item.collection+':'+item.id)||item;const itemId=item.collection+':'+item.id;if(seen.has(itemId)||item.retirado||new Date(item.fecha).getTime()<cutoff)continue;seen.add(itemId);const kind=({eventos:'EVENTO',actividades:'ACTIVIDAD',anunciantes:'ANUNCIANTE',publicidades:'PUBLICIDAD'})[item.collection];if(auth.rol==='ADMIN_LOCAL'&&(!moderatorAllowsV72(auth,kind)||!item.ciudades.length||!item.ciudades.every(c=>adminCityIdsV71(auth.ciudades).includes(c))))continue;items.push({...item,tipo:kind});}
  return json({success:true,results:items.sort((a,b)=>b.fecha.localeCompare(a.fecha)),next_offset:offset+100<keys.length?offset+100:null,source:'kv'});
 }
 if(path!=='/suscriptores'||request.method!=='POST')return null;
 const body=await request.clone().json().catch(()=>({}));if(body.action!=='solicitar_anunciante')return null;
 const s=await verifySubscriberSession(env,request);if(!s.ok)return json({success:false,message:s.message},401);
 if(String(body.modo).toUpperCase()==='RECLAMAR'){
  const aid=String(body.anunciante_id||'').trim(),existing=aid?await db.get('anunciantes',aid):null;if(!existing)publicationErrorV77('Seleccioná un anunciante existente.');
  const id='REQ-'+crypto.randomUUID(),now=new Date().toISOString();await db.patch('solicitudes_anunciante',id,{solicitud_id:id,modo:'RECLAMAR',anunciante_id:aid,suscriptor_id:s.sid,nombre:existing.nombre,ciudad_id:existing.ciudad_id||'',estado:'PENDIENTE',creado_en:now,declaracion_publicacion:{version:PUBLICATION_TERMS_V77,usuario_id:s.sid,fecha:now}},{newDocument:true});return json({success:true,solicitud_id:id,message:'Reclamo enviado para verificar la titularidad. No modifica la publicación existente.'});
 }
 if(String(body.modo).toUpperCase()!=='CREAR')publicationErrorV77('Tipo de solicitud inválido.');
 const cityPacket=await cache.get('territorio:public:v1'),needle=String(body.ciudad||'').trim().toLowerCase();
 const matches=(cityPacket?.ciudades||[]).filter(c=>String(c.ciudad_id||c.id).toLowerCase()===needle||String(c.ciudad_visible||c.nombre||'').toLowerCase()===needle);
 if(matches.length!==1||!String(body.nombre||'').trim())publicationErrorV77('Indicá un nombre y seleccioná una ciudad válida.');
 const city=String(matches[0].ciudad_id||matches[0].id),aid='ANU-'+crypto.randomUUID(),now=new Date().toISOString(),sedeId='SED-'+aid+'-MAIN';
 if(db.prepareNewAdvertiserPanels116)await db.prepareNewAdvertiserPanels116(aid);else if(db.prepareNewPanelList)await db.prepareNewPanelList('anunciantes_sedes','anunciante_id',aid);
 const policy=publicationPolicyV77(body,ctx.publication.rules);
 const advertiser=await db.patch('anunciantes',aid,{id:aid,nombre:String(body.nombre).trim(),actividad:String(body.actividad||''),descripcion:String(body.descripcion||''),mail:String(body.mail||''),whatsapp:String(body.whatsapp||''),web:String(body.web||''),ciudad_id:city,contenido_adulto:adultFlag(body.contenido_adulto),creado_en:now,actualizado_en:now},{newDocument:true});
 const admin=await db.patch('anunciantes_administracion',aid,{id:aid,aprobado:true,nivel:'',subnivel:'',funcionalidades:[],creado_en:now,actualizado_en:now},{newDocument:true});
 const sede=await db.patch('anunciantes_sedes',sedeId,{sede_id:sedeId,anunciante_id:aid,ciudad_id:city,nombre_sede:'Principal',direccion:String(body.direccion||''),whatsapp:String(body.whatsapp||''),mail:String(body.mail||''),web:String(body.web||''),activo:true},{newDocument:true});
 await db.patch('suscriptor_anunciante',s.sid+'__'+aid,{relacion_id:s.sid+'__'+aid,suscriptor_id:s.sid,anunciante_id:aid,anunciante_nombre:advertiser.nombre,rol:'PROPIETARIO',activo:true,fecha_alta:now},{newDocument:true});
 if(db.rememberPanelRows){db.rememberPanelRows('anunciantes',[advertiser]);db.rememberPanelRows('anunciantes_administracion',[admin]);db.rememberPanelRows('anunciantes_sedes',[sede]);}
 if(db.rememberPanelRows)db.rememberPanelRows('anunciantes_sedes',[sede]);
 const createdDb={...db,queryEqual:(c,f,v,limit)=>c==='anunciantes_sedes'&&f==='anunciante_id'&&String(v)===aid?Promise.resolve([sede]):db.queryEqual(c,f,v,limit)};
 await syncGuideAdvertiserV2({db:createdDb,cache,advertiserId:aid});await syncAdvertiserIndexV2({db:createdDb,cache,advertiserId:aid});
 return json({success:true,anunciante_id:aid,publicado:!policy.contenido_adulto&&policy.estado_moderacion==='PUBLICADO',revision_adulto:policy.revision_adulto,estado_moderacion:policy.estado_moderacion,message:'Anuncio creado. Volvé a iniciar sesión para acceder a su panel. La clasificación comercial y los cupos se asignan desde Gran Hermano.'});
}

const LEGACY_ADVERTISER_TERMS_V81={"version": "2026-10-11", "titulo": "Términos y condiciones para anunciantes", "contenido": "Estas condiciones se aplican al uso del panel y a la publicación de fichas de anunciantes, eventos, actividades, promociones y publicidades. Se complementan con la política de privacidad y con las condiciones particulares de cada servicio contratado.\n\n1. Cuenta y autorizaciones\n\nIngresá con tu cuenta personal y administrá únicamente los anunciantes para los que tengas autorización. Protegé tus credenciales y comunicá a Soporte cualquier acceso indebido. Compartir una cuenta no reemplaza la asignación de permisos a cada persona.\n\n2. Información veraz y actualizada\n\nQuien publica debe proporcionar información veraz, suficiente y actualizada sobre su identidad, oferta, ubicación, fechas, horarios, precios y condiciones, cuando corresponda. Debe corregir los errores e informar cambios, cancelaciones y restricciones. No se permite suplantar identidades ni difundir ofertas engañosas.\n\n3. Derechos y autorizaciones\n\nPublicá únicamente textos, imágenes, videos, marcas y otros materiales que puedas utilizar legítimamente. Contá con los derechos, permisos y autorizaciones necesarios, incluidos los relativos a datos personales e imágenes de otras personas. Autorizás a Guía Local a mostrar y distribuir ese contenido dentro de sus servicios para dar visibilidad a tu publicación; conservás los derechos que te correspondan.\n\n4. Publicaciones para mayores de 18 años\n\nMarcá “Sí · +18” cuando el contenido, producto, servicio o espectáculo sea exclusivo para adultos. Estas publicaciones requieren revisión y su visualización se restringe a usuarios con sesión iniciada, edad habilitada y aceptación de acceso. Marcá “No” cuando la publicación sea apta para cualquier público. Las condiciones particulares de admisión del evento deben indicarse también en su información. La marca +18 no permite publicar contenido prohibido.\n\n5. Contenido y conductas prohibidas\n\nNo publiques contenido que promueva o facilite violencia, amenazas, acoso, abuso, explotación, discriminación o actividades ilícitas. Tampoco material íntimo sin consentimiento, explotación sexual de menores ni información personal ajena sin fundamento legítimo. Estas reglas se aplican a todas las publicaciones, incluidas las marcadas +18.\n\n6. Responsabilidad por la publicación\n\nLa persona que carga o modifica contenido y el anunciante responsable deben cumplir las obligaciones legales y administrativas que les correspondan. Esto incluye las habilitaciones, derechos y autorizaciones exigibles para su actividad, la exactitud de la oferta y el cumplimiento de lo anunciado. La declaración de cada publicación confirma estos compromisos.\n\n7. Controles y responsabilidad de Guía Local\n\nGuía Local utiliza controles automatizados y puede realizar revisiones humanas. Los controles pueden detectar incumplimientos o requerir revisión, pero no garantizan detectar todos los errores ni certifican la legalidad o veracidad de una publicación. La publicación directa o la aprobación de una revisión no reemplazan las obligaciones de quien publica.\n\nLa plataforma puede solicitar aclaraciones, limitar la difusión, retirar contenido o restringir accesos ante incumplimientos, reclamos fundados o requerimientos de autoridades. Estas condiciones no excluyen ni limitan las responsabilidades y obligaciones que la legislación aplicable imponga a Guía Local, ni los derechos que no puedan renunciarse.\n\n8. Soporte y cambios\n\nUsá el espacio Soporte del panel para registrar consultas, solicitar correcciones o plantear una revisión de medidas sobre tus publicaciones. Las funcionalidades y cupos disponibles son los asignados al anunciante; aceptar estas condiciones no contrata servicios pagos ni habilita prestaciones adicionales.\n\nPodés consultar esta versión en cualquier momento. Los cambios sustanciales se comunicarán y requerirán una nueva aceptación en el panel."};
const TERMS_ACTIVE_KEY='advertiser:terms:active:v81';
const TERMS_VERSION_KEY=version=>'advertiser:terms:version:'+version;
async function termsHashV81(terms){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(terms.titulo+'\n'+terms.contenido))),x=>x.toString(16).padStart(2,'0')).join('');}
async function currentTermsV81(cache){const active=await cache.get(TERMS_ACTIVE_KEY);if(active)return active;const terms={...LEGACY_ADVERTISER_TERMS_V81};return {...terms,hash:await termsHashV81(terms)};}
async function knownTermsV81(cache,version){if(version===LEGACY_ADVERTISER_TERMS_V81.version){const term=await cache.get(TERMS_VERSION_KEY(version));return term||{...LEGACY_ADVERTISER_TERMS_V81,hash:await termsHashV81(LEGACY_ADVERTISER_TERMS_V81)};}return cache.get(TERMS_VERSION_KEY(version));}
async function archiveTermsV81(db,cache,terms){
 const cached=await cache.get(TERMS_VERSION_KEY(terms.version));if(cached?.archivada)return cached;
 const snapshot={...terms,hash:await termsHashV81(terms),archivado_en:new Date().toISOString()};
 try{await db.patch('terminos_anunciantes',terms.version,snapshot,{mustNotExist:true,newDocument:true});}
 catch(error){if(!/409|ALREADY_EXISTS|FAILED_PRECONDITION/.test(error.message))throw error;const old=await db.get('terminos_anunciantes',terms.version);if(!old||old.hash!==snapshot.hash)throw Error('No se puede modificar una versión histórica de términos.');}
 const archived={...snapshot,archivada:true};await cache.put(TERMS_VERSION_KEY(terms.version),archived);return archived;
}
async function routeAdvertiserTermsV80({path,request,env,db,cache,url}){
 if(path==='/advertiser/terms/content'&&request.method==='GET'){
  const version=url.searchParams.get('version'),terms=version?await knownTermsV81(cache,version):await currentTermsV81(cache);
  return terms?json({success:true,terms}):json({success:false,message:'Esta versión no está disponible en caché.'},404);
 }
 if(path==='/superadmin/advertiser-terms'){
  const auth=await requireAdmin(env,request);if(!auth)return json({success:false,message:'Sesión administrativa requerida.'},401);
  if(!isTopAdmin2(auth))return json({success:false,message:'Esta configuración corresponde a superadministración.'},403);
  const active=await currentTermsV81(cache);
  if(request.method==='GET'){
   const sid=String(url.searchParams.get('suscriptor_id')||'').trim();
   if(sid){
    const account=await db.cachedSubscriberProjection(sid);if(!account)return json({success:false,message:'Cuenta no encontrada.'},404);
    const map=new Map();for(const receipt of [...Object.values(account.historial_terminos_anunciante||{}),account.aceptacion_terminos_anunciante].filter(Boolean))if(receipt.usuario_id===sid)map.set(receipt.version,receipt);
    const records=[];for(const receipt of map.values()){
     let terms=await knownTermsV81(cache,receipt.version);if(!terms){terms=await db.get('terminos_anunciantes',receipt.version);if(terms)await cache.put(TERMS_VERSION_KEY(receipt.version),{...terms,archivada:true});}
     records.push({aceptacion:receipt,terminos:terms||null});
    }
    return json({success:true,suscriptor_id:sid,nombre:account.nombre||'',mail:account.mail||'',registros:records});
   }
   return json({success:true,actual:active,historial:await cache.get('advertiser:terms:history:v81')||[{version:active.version,titulo:active.titulo,hash:active.hash}]});
  }
  if(request.method!=='POST')return json({success:false,message:'Método no permitido.'},405);
  const body=await request.json().catch(()=>({})),titulo=String(body.titulo||'').trim(),contenido=String(body.contenido||'').trim();
  if(body.action!=='publicar'||titulo.length<5||titulo.length>200||contenido.length<100||contenido.length>50000)return json({success:false,message:'Indicá el título y el texto completo de los términos.'},400);
  const hash=await termsHashV81({titulo,contenido});if(hash===active.hash)return json({success:true,actual:active,sin_cambios:true});
  await archiveTermsV81(db,cache,await knownTermsV81(cache,LEGACY_ADVERTISER_TERMS_V81.version));
  const now=new Date().toISOString(),version='TA-'+now.replace(/[^0-9]/g,'').slice(0,14)+'-'+crypto.randomUUID().slice(0,8);
  const terms=await archiveTermsV81(db,cache,{version,titulo,contenido,hash,publicado_en:now,publicado_por:auth.sid});
  const history=await cache.get('advertiser:terms:history:v81')||[{version:LEGACY_ADVERTISER_TERMS_V81.version,titulo:LEGACY_ADVERTISER_TERMS_V81.titulo}];
  await cache.put('advertiser:terms:history:v81',[...history,{version,titulo,hash,publicado_en:now,publicado_por:auth.sid}]);await cache.put(TERMS_ACTIVE_KEY,terms);
  return json({success:true,actual:terms,message:'Nueva versión publicada. Requerirá una nueva aceptación.'});
 }
 if(path!=='/advertiser/terms')return null;
 if(!['GET','POST'].includes(request.method))return json({success:false,message:'Método no permitido.'},405);
 const session=await verifySubscriberSession(env,request);if(!session.ok)return json({success:false,message:session.message},401);
 const account=await db.cachedSubscriberProjection(session.sid);if(!account)return json({success:false,message:'Cuenta no encontrada.'},404);
 const terms=await currentTermsV81(cache),prior=account.historial_terminos_anunciante?.[terms.version]||account.aceptacion_terminos_anunciante;
 const valid=prior?.version===terms.version&&prior?.usuario_id===session.sid&&!!prior?.fecha&&(!prior.hash||prior.hash===terms.hash);
 if(request.method==='GET')return json({success:true,version:terms.version,hash:terms.hash,aceptada:valid,aceptacion:valid?prior:null,requiere_revision:!valid&&!!prior,terms:valid?{version:terms.version,titulo:terms.titulo,hash:terms.hash}:terms});
 const body=await request.json().catch(()=>({}));
 if(body.aceptada!==true)return json({success:false,message:'Marcá la aceptación de los términos antes de continuar.'},400);
 if(body.version!==terms.version||body.hash&&body.hash!==terms.hash)return json({success:false,code:'TERMS_REVIEW_REQUIRED',message:'Revisá y aceptá la versión vigente de los términos.'},412);
 await archiveTermsV81(db,cache,terms);
 if(valid)return json({success:true,version:terms.version,hash:terms.hash,aceptada:true,aceptacion:prior,ya_registrada:true});
 const acceptance={version:terms.version,hash:terms.hash,usuario_id:session.sid,fecha:new Date().toISOString()};
 const history=new Map();for(const receipt of [...Object.values(account.historial_terminos_anunciante||{}),prior,acceptance].filter(Boolean))history.set(receipt.version,{...receipt,...(!receipt.hash&&receipt.version===LEGACY_ADVERTISER_TERMS_V81.version?{hash:await termsHashV81(LEGACY_ADVERTISER_TERMS_V81)}:{})});
 await db.patch('suscriptores',session.sid,{aceptacion_terminos_anunciante:acceptance,historial_terminos_anunciante:Object.fromEntries(history)},{mustExist:true,fieldPaths:['aceptacion_terminos_anunciante',...[...history.keys()].map(version=>'historial_terminos_anunciante.`'+version+'`')]});
 return json({success:true,version:terms.version,hash:terms.hash,aceptada:true,aceptacion:acceptance});
}

// Private administrative index. Public promo packets cannot represent paused records.
const PROMOS_ADMIN_READY_V91='admin:promos:ready:v91';
const PROMOS_ADMIN_PREFIX_V91='admin:promos:item:v91:';
/** @param {ReturnType<typeof createCache>} cache @param {Record<string, any> | null} current @param {Record<string, any> | null} next */
async function syncAdminPromoV91(cache,current,next){
 const id=String(next?.promo_id||next?.id||current?.promo_id||current?.id||'').trim();
 if(!id)return;
 await cache.put(PROMOS_ADMIN_PREFIX_V91+encodeURIComponent(id),{id,deleted:!next,row:next?{...next,promo_id:id}:null,updated_at:new Date().toISOString()});
}
/** @param {Record<string, any>} row */
function promoPendingV91(row){if(row?.revision_definitiva||['RECHAZADO','RECHAZADA'].includes(String(row?.estado_moderacion||row?.estado||'').toUpperCase()))return false;return String(row?.estado_moderacion||'').toUpperCase()==='PENDIENTE'||(adultFlag(row?.contenido_adulto)&&String(row?.revision_adulto||'').toUpperCase()==='PENDIENTE');}
/** @param {Record<string, any>} row */
function promoStateV91(row){
 if(promoPendingV91(row))return 'PENDIENTE';
 if(['RECHAZADO','RECHAZADA'].includes(String(row?.estado_moderacion||row?.estado||'').toUpperCase()))return 'RECHAZADA';
 return paused(row)?'PAUSADA':'ACTIVA';
}
/** @param {{path:string,request:Request,env:Record<string, any>,cache:ReturnType<typeof createCache>,db:Record<string, any>,url:URL}} ctx */
async function routeAdminPromosV91(ctx){
 const {path,request,env,cache,db,url}=ctx;
 if(!['/superadmin/promos','/superadmin/promos/prepare'].includes(path))return null;
 const auth=await requireAdmin(env,request);
 if(!auth)return json({success:false,message:'Sesión administrativa requerida.'},401);
 if(!isTopAdmin2(auth))return json({success:false,message:'La gestión de promociones corresponde a superadministración.'},403);
 if(path.endsWith('/prepare')){
  if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
  if(await cache.get(PROMOS_ADMIN_READY_V91))return json({success:true,preparado:true,ya_preparado:true});
  const key='admin:promos:preparation:v91';let progress=await cache.get(key);
  if(!progress){progress={rows:await db.listCollection('promos'),offset:0};await cache.put(key,progress);}
  const chunk=progress.rows.slice(progress.offset,progress.offset+100);
  for(const row of chunk){
   const id=String(row.promo_id||row.id||'').trim();if(!id)continue;
   // A mutation completed after the snapshot takes precedence over preparation.
   const existing=await cache.get(PROMOS_ADMIN_PREFIX_V91+encodeURIComponent(id));
   if(existing)continue;
   await syncAdminPromoV91(cache,null,row);
  }
  progress.offset+=chunk.length;
  if(progress.offset<progress.rows.length){await cache.put(key,progress);return json({success:true,preparado:false,continuar:true,procesadas:progress.offset});}
  await cache.put(PROMOS_ADMIN_READY_V91,{preparado_en:new Date().toISOString()});await cache.del(key);
  return json({success:true,preparado:true,procesadas:progress.offset});
 }
 if(request.method==='GET'){
  if(!await cache.get(PROMOS_ADMIN_READY_V91))return json({success:true,preparado:false,results:[],next_cursor:null,message:'Prepará una vez el listado de promociones existentes. Hasta entonces la lista está incompleta.'});
  const cursor=url.searchParams.get('cursor')||undefined;
  const page=await env.GLD_CACHE_KV.list({prefix:PROMOS_ADMIN_PREFIX_V91,limit:100,...(cursor?{cursor}:{})});
  const items=await Promise.all(page.keys.map(item=>cache.get(item.name)));
  return json({success:true,preparado:true,results:items.filter(x=>x&&!x.deleted&&x.row).map(x=>({...x.row,promo_id:x.id,estado_panel:promoStateV91(x.row)})),next_cursor:page.list_complete?null:page.cursor,source:'kv'});
 }
 if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
 const body=await request.json(),id=String(body.promo_id||body.id||'').trim(),action=String(body.action||'').toLowerCase();
 if(!id||!['pausar','reanudar','borrar','aprobar','rechazar'].includes(action))return json({success:false,message:'Acción o promoción inválida.'},400);
 const read=db.panelReadDb?db.panelReadDb():db,current=await read.get('promos',id);
 if(!current)return json({success:false,message:'La promoción ya no existe. Actualizá la lista.'},404);
 if(action==='borrar'){
  await db.delete('promos',id,{mustExist:true});await syncPromo({cache,current,next:null});
  return json({success:true,deleted:true,promo_id:id});
 }
 let patch;
 if(action==='pausar'||action==='reanudar'){
  const pause=action==='pausar';
  if(paused(current)===pause)return json({success:true,unchanged:true,promo:current});
  if(!pause){const aid=String(current.anunciante_id||current.id_comercio||'');const q=await quota({db:db.panelReadDb?db.panelReadDb({advertiserId:aid}):db,advertiserId:aid,cupoFromAdmin:a=>cupo(a,'PROMOS'),excludeId:id});if(q.max<=0||q.active>=q.max)return json({success:false,message:'El anunciante no tiene cupo para reanudar esta promoción.'},409);}
  patch={pausado:pause};
 }else{
  if(!promoPendingV91(current))return json({success:false,message:'No hay una revisión pendiente para esta promoción.'},409);
  patch={aprobado:action==='aprobar',estado_moderacion:action==='aprobar'?'APROBADO':'RECHAZADO',revision_adulto:adultFlag(current.contenido_adulto)?(action==='aprobar'?'APROBADO':'RECHAZADO'):'NO_APLICA',moderado_por:auth.sid,moderado_en:new Date().toISOString()};
 }
 const saved=await db.patch('promos',id,{...patch,actualizado:new Date().toISOString()},{mustExist:true});
 await syncPromo({cache,current,next:saved});return json({success:true,promo:{...saved,estado_panel:promoStateV91(saved)}});
}

// Private calendar projections; no subscriber identities in summary responses.
const BIRTHDAY_READY_V83='private:birthdays:ready:v91';
const BIRTHDAY_PREFIX_V91='private:birthdays:v91:';
function birthdayKeyV83(row){const birth=birthDateOnly_(row?.fecha_nacimiento),sid=String(row?.suscriptor_id||row?.id||'').trim();return sid&&adultAge(birth)!==null&&adultAge(birth)<=120?BIRTHDAY_PREFIX_V91+birth.slice(5)+':'+encodeURIComponent(sid):'';}
async function syncBirthdayV83(env,previous,next){
 const kv=env.GLD_CACHE_KV;if(!kv?.put||!kv?.delete)return;
 const sid=String(next?.suscriptor_id||next?.id||previous?.suscriptor_id||previous?.id||'').trim();
 const oldKey=birthdayKeyV83(previous),key=birthdayKeyV83(next),active=next&&(next.activo===undefined||truthy4(next.activo));
 if(oldKey&&(oldKey!==key||!active))await kv.delete(oldKey);
 if(sid)await kv.put('private:birthdays:subscriber:v91:'+encodeURIComponent(sid),JSON.stringify({key:key&&active?key:null}));
 if(!key||!active)return;
 await kv.put(key,JSON.stringify({fecha_nacimiento:birthDateOnly_(next.fecha_nacimiento)}));
}
/** @param {Record<string, any>} env @param {Record<string, any>} db @param {ReturnType<typeof createCache>} cache @param {Request} request */
async function prepareBirthdaysV91(env,db,cache,request){
 let body={};try{body=await request.json();}catch{}
 if(await cache.get('private:birthdays:ready:v83')){
  const page=await env.GLD_CACHE_KV.list({prefix:'private:birthdays:v83:',limit:100,...(body.cursor?{cursor:body.cursor}:{})});
  for(const item of page.keys){const row=await cache.get(item.name);if(!row)continue;
   let sid;try{sid=decodeURIComponent(item.name.slice(item.name.lastIndexOf(':')+1));}catch{continue;}
   if(await cache.get('private:birthdays:subscriber:v91:'+encodeURIComponent(sid)))continue;
   await syncBirthdayV83(env,null,{...row,suscriptor_id:sid,activo:true});
  }
  if(!page.list_complete)return {success:true,continuar:true,cursor:page.cursor};
 }else{
  const progressKey='private:birthdays:preparation:v91';let progress=await cache.get(progressKey);
  if(!progress){progress={rows:(await db.listCollection('suscriptores')).map(row=>({suscriptor_id:row.suscriptor_id||row.id,fecha_nacimiento:row.fecha_nacimiento,activo:row.activo??true})),offset:0};await cache.put(progressKey,progress);}
  const chunk=progress.rows.slice(progress.offset,progress.offset+100);
  for(const row of chunk){const sid=String(row.suscriptor_id||row.id||'').trim();if(sid&&await cache.get('private:birthdays:subscriber:v91:'+encodeURIComponent(sid)))continue;await syncBirthdayV83(env,null,row);}
  progress.offset+=chunk.length;
  if(progress.offset<progress.rows.length){await cache.put(progressKey,progress);return {success:true,continuar:true,procesadas:progress.offset};}
  await cache.del(progressKey);
 }
 await cache.put(BIRTHDAY_READY_V83,{preparado_en:new Date().toISOString()});
 return {success:true,...await birthdaySummaryV83(env,cache)};
}
function calendarDaysV83(now=new Date()){
 const local=new Date(now.getTime()-3*3600000),start=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
 return Array.from({length:30},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
}
async function birthdaySummaryV83(env,cache,now=new Date()){
 const days=calendarDaysV83(now),ready=await cache.get(BIRTHDAY_READY_V83);
 if(!ready)return {preparado:false,total:null,dias:days.map(fecha=>({fecha,total:null})),desde:days[0],hasta:days[29]};
 const kv=env.GLD_CACHE_KV,dias=[];
 for(const fecha of days){
  let cursor,total=0,mayores18=0,menores18=0;
  do{
   const page=await kv.list({prefix:BIRTHDAY_PREFIX_V91+fecha.slice(5)+':',...(cursor?{cursor}:{})});
   for(const item of page.keys){const raw=await kv.get(item.name);if(!raw)continue;let row;try{row=JSON.parse(raw);}catch{continue;}
    const age=adultAge(row.fecha_nacimiento,new Date(fecha+'T12:00:00Z'));if(age===null||age>120)continue;total++;if(age>=18)mayores18++;else menores18++;
   }
   cursor=page.list_complete?null:page.cursor;
  }while(cursor);
  dias.push({fecha,total,mayores18,menores18});
 }
 return {preparado:true,desde:days[0],hasta:days[29],total:dias.reduce((a,x)=>a+x.total,0),mayores18:dias.reduce((a,x)=>a+x.mayores18,0),menores18:dias.reduce((a,x)=>a+x.menores18,0),dias};
}
async function routeCalendarV83(ctx){
 const {path,request,env,db,cache,url}=ctx;
 if(!['/superadmin/birthdays','/superadmin/birthdays/prepare','/superadmin/ephemerides/upcoming'].includes(path))return null;
 const auth=await requireAdmin(env,request);if(!auth)return json({success:false,message:'Acceso administrativo requerido'},401);
 if(!isTopAdmin2(auth))return json({success:false,message:'Disponible para superadministración.'},403);
 if(path==='/superadmin/birthdays'&&request.method==='GET')return json({success:true,...await birthdaySummaryV83(env,cache)});
 if(path==='/superadmin/birthdays/prepare'&&request.method==='POST'){
  if(await cache.get(BIRTHDAY_READY_V83))return json({success:true,...await birthdaySummaryV83(env,cache),ya_preparado:true});
  return json(await prepareBirthdaysV91(env,db,cache,request));
 }
 if(path==='/superadmin/ephemerides/upcoming'&&request.method==='GET'){
  const territory=await cache.get('territorio:public:v1')||{},city=String(url.searchParams.get('ciudad_id')||'').trim();
  const cities=(territory.ciudades||[]).filter(c=>c.activo===undefined||truthy4(c.activo));
  if(city&&!cities.some(c=>String(c.ciudad_id||c.id)===city))return json({success:false,message:'Ciudad no disponible.'},400);
  const ids=city?[city]:cities.map(c=>String(c.ciudad_id||c.id)).filter(Boolean),days=calendarDaysV83(),unique=new Map(),missing=[];
  for(const id of ids){const packet=await cache.get(efemCityKeyV2(id));if(!packet){missing.push(id);continue;}
   for(const row of packet.efemerides||[]){if(row.activo!==undefined&&!truthy4(row.activo))continue;
    for(const fecha of days){if(!matches2(row,new Date(fecha+'T12:00:00Z')))continue;
     const key=fecha+':'+String(row.efemeride_id||row.id||JSON.stringify(row));
     if(!unique.has(key))unique.set(key,{fecha,efemeride_id:String(row.efemeride_id||row.id||''),nombre:String(row.nombre||''),descripcion:String(row.descripcion||''),tipo:String(row.tipo||''),provincia_id:String(row.provincia_id||''),ciudad_id:String(row.ciudad_id||'')});
    }
   }
  }
  return json({success:true,desde:days[0],hasta:days[29],ciudad_id:city,results:[...unique.values()].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.nombre.localeCompare(b.nombre,'es')),ciudades_sin_cache:missing,incompleto:missing.length>0||!ids.length,source:'kv'});
 }
 return json({success:false,message:'Método inválido.'},405);
}

/**
 * Territory declarations are normalized at the API boundary before storage.
 * @typedef {{ciudad_id?: unknown, ciudad?: unknown, provincia?: unknown, pais?: unknown}} GLDResidenceInputV88
 * @typedef {{ciudad_id: string, ciudad: string, provincia: string, pais: string}} GLDResidenceV88
 * @typedef {{id?: string | number, ciudad_id?: string | number, ciudad_visible?: string, ciudad?: string, nombre?: string, provincia_id?: string, provincia?: string, pais_id?: string, pais?: string}} GLDCityRecordV88
 * @typedef {{ciudades?: GLDCityRecordV88[]}} GLDPublicTerritoryV88
 * @typedef {{get: (key: string) => Promise<GLDPublicTerritoryV88 | null>}} GLDTerritoryReaderV88
 * @typedef {{residencia_declarada?: GLDResidenceInputV88, ciudad_predeterminada_id?: unknown, condicion_ciudad?: unknown, ciudad_natal?: unknown}} GLDRegistrationTerritoryV88
 */

// Residence and city-specific relationship are explicit declarations, never inferred from legacy fields.
function subscriberTerritoryV84(s={}){return {residencia_declarada:s.residencia_declarada||null,ciudad_natal:String(s.ciudad_natal||''),vinculos_ciudades:s.vinculos_ciudades||{},ciudad_origen_otro:String(s.ciudad_origen_otro||''),provincia_origen:String(s.provincia_origen||''),territorio_perfil_version:84};}
/**
 * @param {GLDTerritoryReaderV88} cache
 * @param {GLDResidenceInputV88 | null | undefined} input
 * @returns {Promise<GLDResidenceV88>}
 */
async function residenceV84(cache,input){
 if(!input||typeof input!=='object')throw httpError('Indicá dónde vivís actualmente.',400);
 const id=String(input.ciudad_id||'').trim(),territory=await cache.get('territorio:public:v1')||{};
 if(id){const city=(territory.ciudades||[]).find(c=>String(c.ciudad_id||c.id)===id);if(!city)throw httpError('La ciudad de residencia seleccionada no está disponible.',400);
 return {ciudad_id:id,ciudad:String(city.ciudad_visible||city.ciudad||city.nombre||id),provincia:String(city.provincia_id||city.provincia||''),pais:String(city.pais_id||city.pais||'ARG')};}
 const city=String(input.ciudad||'').trim(),province=String(input.provincia||'').trim(),country=String(input.pais||'').trim();
 if(!city||!province||!country||[city,province,country].some(x=>x.length>120))throw httpError('Completá país, provincia y ciudad donde vivís actualmente.',400);
 return {ciudad_id:'',ciudad:city,provincia:province,pais:country};
}
/**
 * @param {GLDTerritoryReaderV88} cache
 * @param {unknown} cityId
 * @param {unknown} condition
 * @param {GLDResidenceV88 | null | undefined} residence
 * @returns {Promise<{condicion: string, confirmada_en: string}>}
 */
async function cityRelationshipV84(cache,cityId,condition,residence){
 const territory=await cache.get('territorio:public:v1')||{},id=String(cityId||'').trim(),value=String(condition||'').trim().toUpperCase();
 if(!(territory.ciudades||[]).some(c=>String(c.ciudad_id||c.id)===id))throw httpError('Elegí una ciudad disponible en la guía.',400);
 if(!['RESIDENTE','VISITANTE_TURISTA'].includes(value))throw httpError('Indicá si vivís en esa ciudad o la consultás como visitante.',400);
 if(value==='RESIDENTE'&&residence?.ciudad_id!==id)throw httpError('Para declararte residente de esta ciudad, seleccionála también como tu residencia actual.',400);
 return {condicion:value,confirmada_en:new Date().toISOString()};
}
/**
 * @param {GLDTerritoryReaderV88} cache
 * @param {GLDRegistrationTerritoryV88} body
 */
async function registrationTerritoryV84(cache,body){
 if(!Object.hasOwn(body,'residencia_declarada'))return {};
 const res=await residenceV84(cache,body.residencia_declarada),city=String(body.ciudad_predeterminada_id||'').trim();
 const link=await cityRelationshipV84(cache,city,body.condicion_ciudad,res);
 const natal=String(body.ciudad_natal||'').trim();if(natal.length>120)throw httpError('La ciudad donde naciste supera los 120 caracteres.',400);
 return {residencia_declarada:{...res,confirmada_en:new Date().toISOString()},ciudad_natal:natal,vinculos_ciudades:{[city]:link},tipo_usuario:''};
}
async function routeSubscriberTerritoryV84(ctx){
 const {path,request,env,db,cache}=ctx;if(path==='/suscriptores/territory-schema'&&request.method==='GET')return json({success:true,version:84});if(path!=='/suscriptores/territory')return null;
 const auth=await verifySubscriberSession(env,request);if(!auth.ok)return json({success:false,message:'Iniciá sesión para consultar tus datos.'},401);
 const current=await db.cachedSubscriberProjection(auth.sid);if(!current||(current.activo!==undefined&&!truthy4(current.activo)))return json({success:false,message:'Cuenta no activa.'},403);
 if(request.method==='GET')return json({success:true,suscriptor:publicProfile(current)});
 if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
 const body=await request.json(),patch={},links={};
 const res=Object.hasOwn(body,'residencia_declarada')?await residenceV84(cache,body.residencia_declarada):current.residencia_declarada;
 if(Object.hasOwn(body,'residencia_declarada')){
  const comparable=r=>r?JSON.stringify({ciudad_id:r.ciudad_id||'',ciudad:r.ciudad||'',provincia:r.provincia||'',pais:r.pais||''}):'';
  if(comparable(res)!==comparable(current.residencia_declarada)){
   patch.residencia_declarada={...res,confirmada_en:new Date().toISOString()};
   for(const [city,link] of Object.entries(current.vinculos_ciudades||{}))if(link.condicion==='RESIDENTE'&&city!==res.ciudad_id)links[city]={condicion:'SIN_CONFIRMAR',confirmada_en:''};
  }
 }
 if(Object.hasOwn(body,'ciudad_natal')){const natal=String(body.ciudad_natal||'').trim();if(natal.length>120)throw httpError('La ciudad donde naciste supera los 120 caracteres.',400);if(natal!==String(current.ciudad_natal||''))patch.ciudad_natal=natal;}
 if(Object.hasOwn(body,'ciudad_id')){
  const city=String(body.ciudad_id||'').trim(),link=await cityRelationshipV84(cache,city,body.condicion_ciudad,res);
  if(current.vinculos_ciudades?.[city]?.condicion!==link.condicion||links[city])links[city]=link;
  if(String(current.ciudad_predeterminada_id||'')!==city)patch.ciudad_predeterminada_id=city;
 }
 const fields=Object.keys(patch);
 if(Object.keys(links).length){patch.vinculos_ciudades=links;fields.push(...Object.keys(links).map(city=>'vinculos_ciudades.`'+city.replace(/\\/g,'\\\\').replace(/`/g,'\\`')+'`'));}
 if(!fields.length)return json({success:true,updated:false,suscriptor:publicProfile(current)});
 patch.actualizado_en=new Date().toISOString();fields.push('actualizado_en');
 const saved=await db.patch('suscriptores',auth.sid,patch,{mustExist:true,fieldPaths:fields});
 await upsertSubscriberIndexV2({cache,subscriber:saved});
 return json({success:true,updated:true,suscriptor:publicProfile(saved)});
}


// Explicit, read-only diagnostic snapshots. KV only; never Firestore.
const DIAGNOSTIC_SHARE_TTL_V90=3600;
/** @param {unknown} rows */
function diagnosticRowsV90(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>160)throw httpError('Compartí entre 1 y 160 registros.',400);
 const plain=(/** @type {unknown} */ value,max=160)=>typeof value==='string'?value.replace(/[<>\u0000-\u001f]/g,'').slice(0,max):null;
 const count=(/** @type {unknown} */ value)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
 const route=(/** @type {unknown} */ value)=>{const raw=plain(value)||'';return raw.split(/[?#]/)[0].split('/').map(part=>part.includes('@')||part.includes('%40')||/^[A-Za-z0-9_-]{24,}$/.test(part)?':id':part).join('/');};
 const identifier=(/** @type {unknown} */ value)=>typeof value==='string'&&/^[A-Za-z0-9_:/ .-]{1,100}$/.test(value)?value:null;
 return rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw httpError('Registro inválido.',400);
  const clean={fecha:plain(row.fecha,40),hora:plain(row.hora,30),pagina:route(row.pagina),ruta:route(row.ruta),accion:identifier(row.accion),metodo:identifier(row.metodo),estado:Number.isInteger(row.estado)?row.estado:plain(row.estado,40),resultado:plain(row.resultado,40),vista:plain(row.vista,40),version:identifier(row.version),request_id:identifier(row.request_id),consultas:count(row.consultas),documentos:count(row.documentos),escrituras:count(row.escrituras),eliminaciones:count(row.eliminaciones),origen:identifier(row.origen)};
  clean.operaciones=Array.isArray(row.operaciones)?row.operaciones.slice(0,40).map(item=>({operation:identifier(item?.operation),collection:identifier(item?.collection),calls:count(item?.calls),documents_returned:count(item?.documents_returned)})):null;
  clean.cache=Array.isArray(row.cache)?row.cache.slice(0,40).map(item=>({collection:identifier(item?.collection),result:identifier(item?.result)})):null;
  return clean;
 });
}
/** @param {{rows: ReturnType<typeof diagnosticRowsV90>, updated_at:number, expires_at:number}} snapshot */
function diagnosticShareHtmlV90(snapshot){
 const escape=(/** @type {unknown} */ value)=>String(value??'Sin medición').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const columns=[['hora','Hora Argentina'],['pagina','Pantalla'],['ruta','Ruta'],['accion','Acción'],['metodo','Método'],['estado','HTTP'],['resultado','Respuesta'],['vista','Vista'],['version','Worker'],['consultas','Consultas'],['documentos','Documentos retornados'],['escrituras','Escrituras'],['eliminaciones','Eliminaciones'],['origen','Origen'],['request_id','ID de traza']];
 const rows=snapshot.rows.map(row=>'<tr>'+columns.map(([key])=>'<td>'+escape(row[key])+'</td>').join('')+'<td>'+escape(row.operaciones===null?null:row.operaciones.map(item=>`${item.operation} · ${item.collection}: ${item.calls} operación(es), ${item.documents_returned} documento(s)`).join('; ')||'Sin operaciones en Firestore')+'</td><td>'+escape(row.cache===null?null:row.cache.map(item=>`${item.collection}: ${item.result}`).join('; ')||'Sin comprobaciones')+'</td></tr>').join('');
 return '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registro compartido · Guía Local</title><style>body{font:15px Arial,sans-serif;margin:24px;color:#17212b}h1{font-size:24px}.table{overflow:auto}table{border-collapse:collapse;white-space:nowrap}th,td{text-align:left;padding:9px;border:1px solid #ddd}th{background:#e8f0f4}p{max-width:900px;line-height:1.5}</style><h1>Registro compartido de Guía Local</h1><p>Copia de '+snapshot.rows.length+' registros. Actualizada: '+escape(new Date(snapshot.updated_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))+'. Caduca: '+escape(new Date(snapshot.expires_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))+'.</p><p>Solo lectura. Consultas y documentos retornados no equivalen al contador de lecturas facturadas. Sin medición no significa cero. Esta copia no incluye registros de otra ventana ni operaciones previas a activar las pruebas.</p><div class="table"><table><thead><tr>'+columns.map(([,label])=>'<th>'+label+'</th>').join('')+'<th>Operaciones</th><th>Caché</th></tr></thead><tbody>'+rows+'</tbody></table></div></html>';
}
/** @param {{path:string, request:Request, url:URL, env:any, cache:{get:(key:string)=>Promise<any>, put:(key:string,value:any,options?:any)=>Promise<void>, del:(key:string)=>Promise<void>}}} context */
async function routeDiagnosticShareV90({path,request,url,env,cache}){
 const match=path.match(/^\/diagnostics\/shared\/([a-f0-9]{64})$/);
 if(match){
  if(request.method!=='GET')return json({success:false,message:'Solo lectura.'},405);
  const snapshot=await cache.get('diagnostics:share:v90:'+match[1]);
  const headers={...cors(),'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'X-Content-Type-Options':'nosniff'};
  if(!snapshot||snapshot.expires_at<=Date.now())return new Response('Enlace inexistente, revocado o vencido.',{status:404,headers});
  if(url.searchParams.get('format')==='json')return new Response(JSON.stringify({success:true,updated_at:snapshot.updated_at,expires_at:snapshot.expires_at,rows:snapshot.rows}),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  return new Response(diagnosticShareHtmlV90(snapshot),{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 }
 if(path!=='/superadmin/diagnostics/share')return null;
 if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
 const auth=await verifyAdmin(env,request);
 if(!auth.ok)return json({success:false,message:auth.message},401);
 if(auth.rol!=='SUPERADMIN_PRINCIPAL')return json({success:false,message:'Solo el administrador principal puede compartir el registro.'},403);
 const text=await request.text();if(text.length>250000)return json({success:false,message:'Registro demasiado grande.'},400);
 let body;try{body=JSON.parse(text);}catch{return json({success:false,message:'Registro inválido.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({success:false,message:'Registro inválido.'},400);
 if(!['create','update','revoke'].includes(body.action))return json({success:false,message:'Acción inválida.'},400);
 let token,snapshot;
 if(body.action!=='create'){
  token=String(body.token||'');if(!/^[a-f0-9]{64}$/.test(token))return json({success:false,message:'Enlace inválido.'},400);
  snapshot=await cache.get('diagnostics:share:v90:'+token);
  if(!snapshot||snapshot.owner!==auth.sid)return json({success:false,message:'Enlace no encontrado.'},404);
  if(body.action==='revoke'){await cache.del('diagnostics:share:v90:'+token);return json({success:true,revoked:true});}
  if(snapshot.expires_at<=Date.now())return json({success:false,message:'El enlace venció. Creá uno nuevo.'},409);
 }
 const rows=diagnosticRowsV90(body.rows);
 if(body.action==='create'){
  token=Array.from(crypto.getRandomValues(new Uint8Array(32)),value=>value.toString(16).padStart(2,'0')).join('');
  snapshot={owner:auth.sid,expires_at:Date.now()+DIAGNOSTIC_SHARE_TTL_V90*1000};
 }
 snapshot={...snapshot,updated_at:Date.now(),rows};
 await cache.put('diagnostics:share:v90:'+token,snapshot,{expirationTtl:Math.max(60,Math.ceil((snapshot.expires_at-Date.now())/1000))});
 return json({success:true,token,url:url.origin+'/diagnostics/shared/'+token,expires_at:snapshot.expires_at,rows:rows.length,source:'kv'});
}

// Diagnostics capabilities are read-only and cannot serve as administrator sessions.
async function routeDiagnosticsV87({path,request,env,cache}){
 if(path!=='/superadmin/diagnostics/session')return null;
 if(request.method!=='POST')return json({success:false,message:'Método inválido.'},405);
 const body=await request.json().catch(()=>({}));
 if(body.action==='validate'){
  const parts=String(body.capability||'').split('.');
  if(parts.length!==2||parts[1]!==await hmac(env,parts[0]))return json({success:false,message:'Diagnóstico no autorizado.'},401);
  let p;try{p=JSON.parse(b64decode(parts[0]));}catch{return json({success:false},401);}
  if(p.typ!=='GLD_DIAGNOSTIC'||!p.sid||!Number.isFinite(p.exp)||p.exp<=Date.now())return json({success:false},401);
  const [policy,state]=await Promise.all([cache.get('admin:access:v72:'+p.sid),subscriberSessionState(env,p.sid)]);
  if(state.deleted||Number(state.version||0)!==Number(p.sv||0)||policy&&(!policy.activo||policy.revision!==p.access_revision))return json({success:false},401);
  return json({success:true,expires_at:p.exp,source:'kv'});
 }
 const auth=await verifyAdmin(env,request);
 if(!auth.ok)return json({success:false,message:auth.message},401);
 if(auth.rol!=='SUPERADMIN_PRINCIPAL')return json({success:false,message:'Solo el administrador principal puede activar estas pruebas.'},403);
 const state=await subscriberSessionState(env,auth.sid),exp=Date.now()+8*60*60*1000;
 const payload=b64(JSON.stringify({typ:'GLD_DIAGNOSTIC',sid:auth.sid,sv:Number(state.version||0),access_revision:auth.access_revision,exp}));
 return json({success:true,capability:payload+'.'+await hmac(env,payload),expires_at:exp,source:'kv'});
}

const EMP_AREAS109=['Administración','Comercio y ventas','Gastronomía','Oficios y mantenimiento','Transporte y logística','Salud y cuidados','Educación','Tecnología','Servicios generales','Otros'];
function empRecord109(/** @type {any} */ id){const value=String(id||'');if(!/^EMP-[A-Za-z0-9_-]{32}(?:__[0-9a-f-]{36})?$/.test(value))throw httpError('Referencia de publicación inválida.',400);return value.slice(0,36);}
function empNormalize109(/** @type {any} */ v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function empLive109(/** @type {any} */ r,/** @type {any} */ now=Date.now()){return !!r&&!r.eliminado&&!r.pausado&&!r.revision_definitiva&&['PUBLICADO','APROBADO'].includes(r.estado_moderacion)&&(!r.contenido_adulto||r.revision_adulto==='APROBADO')&&Date.parse(r.hasta)>now;}
function empPublic109(/** @type {any} */ r){return Object.fromEntries(['empleo_id','tipo','nombre','titulo','puesto','area','descripcion','modalidad','disponibilidad','tags','ciudad_id','ciudad_ids','desde','hasta','contacto','contenido_adulto','revision_adulto','estado_moderacion','anunciante_id','sede_id','sede_nombre','condiciones_url'].map((/** @type {any} */ k)=>[k,r[k]??'']));}
async function empCityRows109(/** @type {any} */ cache,/** @type {any} */ env,/** @type {any} */ city){
 const generation=await cache.get('employment:revision:v109:'+city)||'empty',prepared=await cache.get('employment:prepared:v109:'+city);
 if(prepared?.generation===generation)return prepared.rows;
 const rows=[];let cursor;
 do{const page=await env.GLD_CACHE_KV.list({prefix:'employment:city:v109:'+encodeURIComponent(city)+':',limit:1000,...(cursor?{cursor}:{})});
 for(let i=0;i<page.keys.length;i+=32){const items=await Promise.all(page.keys.slice(i,i+32).map((/** @type {any} */ key)=>cache.get(key.name)));rows.push(...items.filter(Boolean));}
 cursor=page.list_complete?null:page.cursor;
 }while(cursor);if(JSON.stringify(rows).length<4000000)await cache.put('employment:prepared:v109:'+city,{generation,rows});return rows;
}
async function syncEmpleo109(/** @type {any} */ {cache,current,next}){
 const record=String(next?.record_id||current?.record_id||empRecord109(next?.empleo_id||current?.empleo_id));
 if(!record)return;
 await cache.put('employment:record:v109:'+record,{row:next||null});
 const cities=[...new Set([...(current?.ciudad_ids||[]),...(next?.ciudad_ids||[])])];
 for(const city of cities){const key='employment:city:v109:'+encodeURIComponent(city)+':'+record;if(next&&next.ciudad_ids.includes(city)&&empLive109(next))await cache.put(key,empPublic109(next));else await cache.del(key);await cache.put('employment:revision:v109:'+city,crypto.randomUUID());}

}

function empMatch109(/** @type {any} */ a,/** @type {any} */ b){
 if(!empLive109(b)||a.tipo==='CONCESION'||b.tipo==='CONCESION'||a.tipo===b.tipo||!a.ciudad_ids.some((/** @type {any} */ c)=>b.ciudad_ids.includes(c))||a.area!==b.area)return 0;
 if(a.modalidad!==b.modalidad)return 0;
 if(a.disponibilidad!=='A_CONVENIR'&&b.disponibilidad!=='A_CONVENIR'&&a.disponibilidad!==b.disponibilidad)return 0;
 const words=(/** @type {any} */ v)=>new Set(empNormalize109(v).split(/[^a-z0-9]+/).filter((/** @type {any} */ w)=>w.length>2&&!['busco','busca','trabajo','empleo','para','como','con','sin','los','las','del','una','uno'].includes(w)).map((/** @type {any} */ w)=>/^administrativ[oa]s?$/.test(w)?'administrativo':w));
 const x=words(a.puesto),y=words(b.puesto),tags=new Set((a.tags||[]).map(empNormalize109));
 const exact=empNormalize109(a.puesto)===empNormalize109(b.puesto),overlap=[...x].filter((/** @type {any} */ w)=>y.has(w)).length,tagOverlap=(b.tags||[]).some((/** @type {any} */ t)=>tags.has(empNormalize109(t)));
 return exact?100:overlap?70+Math.min(20,overlap*5):tagOverlap?50:0;
}
function empRead109(/** @type {any} */ ctx){return ctx.db.panelReadDb?ctx.db.panelReadDb():ctx.db;}
async function empOwner109(/** @type {any} */ ctx,/** @type {any} */ aid){
 const s=await verifySubscriberSession(ctx.env,ctx.request);if(!s.ok)throw httpError(s.message,401);
 if(aid&&!sessionAllows(s,aid,'modificar_datos'))throw httpError('Solo el propietario o administrador puede publicar por este anunciante.',403);
 if(aid){const read=empRead109(ctx);const admin=await read.get('anunciantes_administracion',aid);if(!admin||admin.aprobado===false||admin.activo===false)throw httpError('El anunciante no está habilitado para publicar.',403);}
 const kind=aid?'ANUNCIANTE':'PERSONA',owner=aid||s.sid,record='EMP-'+(await hmac(ctx.env,'employment:'+kind+':'+owner)).slice(0,32);
 return {session:s,kind,owner,record,aid};
}
async function routeEmpleo109(/** @type {any} */ ctx){
 const {path,request,cache,db,url,env}=ctx;if(!path.startsWith('/empleo'))return null;
 if(path==='/empleo/catalogo'&&request.method==='GET'){const t=await cache.get('territorio:public:v1');return json({success:true,areas:EMP_AREAS109,ciudades:t?.ciudades||[],version:110});}
 if(path==='/empleo/publicas'&&request.method==='GET'){
  const city=String(url.searchParams.get('ciudad_id')||'');if(!city)throw httpError('Abrí Empleo desde una ciudad de la guía.',400);
  const cityRows=await empCityRows109(cache,env,city),q=empNormalize109(url.searchParams.get('q')),type=url.searchParams.get('tipo')||'',area=url.searchParams.get('area')||'';
  const rows=cityRows.filter((/** @type {any} */ r)=>empLive109(r)&&(!type||r.tipo===type||type==='OPORTUNIDADES'&&['OFREZCO','CONCESION'].includes(r.tipo))&&(!area||r.area===area)&&(!q||empNormalize109([r.puesto,r.descripcion,...r.tags].join(' ')).includes(q))).sort((/** @type {any} */ a,/** @type {any} */ b)=>String(b.desde).localeCompare(String(a.desde))||a.empleo_id.localeCompare(b.empleo_id));
  const page=Math.max(1,Number(url.searchParams.get('pagina'))||1),out={success:true,rows:rows.slice((page-1)*10,page*10),total:rows.length,pagina:page};return adultPublicResponse(json(out),env,request);
 }
 if(path==='/empleo/admin'&&request.method==='POST'){
  const auth=await requireAdmin(env,request);if(!auth||!isTopAdmin2(auth))throw httpError('La gestión de Empleo requiere Gran Hermano.',403);
  const b=await request.json(),id=String(b.id||''),record=empRecord109(id),v=await db.getVersioned('empleos',record),r=v.doc;
  if(!r||r.empleo_id!==id)throw httpError('La publicación cambió. Actualizá el listado.',409);
  if(!['aprobar','rechazar','pausar','eliminar'].includes(b.action))throw httpError('Acción inválida.',400);
  if(['aprobar','rechazar'].includes(b.action)&&r.estado_moderacion!=='PENDIENTE')throw httpError('No hay una revisión pendiente.',409);
  const patch=b.action==='eliminar'?{eliminado:true,pausado:true}:b.action==='pausar'?{pausado:true}:{estado_moderacion:b.action==='aprobar'?'APROBADO':'RECHAZADO',revision_adulto:r.contenido_adulto?(b.action==='aprobar'?'APROBADO':'RECHAZADO'):'NO_APLICA',aprobado:b.action==='aprobar',moderado_por:auth.sid};
  if(r.revision_definitiva&&b.action!=='eliminar')throw httpError('Esta publicación está bloqueada definitivamente.',403);
  const [saved]=await db.commitPatches([{collection:'empleos',id:record,before:r,patch:{...patch,actualizado_en:new Date().toISOString()},options:{updateTime:v.updateTime}}]);await syncEmpleo109({cache,current:r,next:saved});return json({success:true,item:saved});
 }
 if(!['/empleo/panel','/empleo'].includes(path))return null;
 let body={};if(request.method==='POST'){try{body=await request.json();}catch{throw httpError('Solicitud inválida.',400);}}
 const aid=String(body.anunciante_id||url.searchParams.get('anunciante_id')||''),owner=await empOwner109(ctx,aid);
 if(path==='/empleo/panel'&&request.method==='GET'){
  const hit=await cache.get('employment:record:v109:'+owner.record);let row=hit?.row||null;
  if(!hit){row=await db.get('empleos',owner.record);await cache.put('employment:record:v109:'+owner.record,{row});}
  let matches=[];if(row&&!row.eliminado&&Date.parse(row.hasta)>Date.now()&&!row.pausado){const packets=await Promise.all(row.ciudad_ids.map((/** @type {any} */ c)=>empCityRows109(cache,env,c)));const pool=[...new Map(packets.flat().map((/** @type {any} */ r)=>[r.empleo_id,r])).values()];matches=pool.map((/** @type {any} */ r)=>({...r,coincidencia:empMatch109(row,r)})).filter((/** @type {any} */ r)=>r.coincidencia>0).sort((/** @type {any} */ a,/** @type {any} */ b)=>b.coincidencia-a.coincidencia).slice(0,30);}
  const ticket=row?await cache.get('support:record:v73:REV-'+(await hmac(env,JSON.stringify(['EMPLEO',row.empleo_id]))).slice(0,28)):null;
  const read=empRead109(ctx),datos=aid?await read.get('anunciantes',aid):null,sedes=aid?await read.queryEqual('anunciantes_sedes','anunciante_id',aid,500):[];
  const perfil=aid?null:await db.cachedSubscriberProjection(owner.session.sid);
  const fuentes=aid?{nombre:datos?.nombre||datos?.nombre_comercio||'',contacto:{email:datos?.mail||datos?.email||'',whatsapp:datos?.whatsapp||'',telefono:datos?.telefono||''},sedes:sedes.map((/** @type {any} */ s)=>({sede_id:s.sede_id||s.id,nombre_sede:s.nombre_sede||'',ciudad_id:s.ciudad_id||'',mail:s.mail||'',whatsapp:s.whatsapp||'',telefono:s.telefono||''}))}:{nombre:perfil?.nombre||'',contacto:{email:perfil?.mail||'',whatsapp:perfil?.whatsapp||''}};
  return json({success:true,fuentes,publicacion:row,coincidencias:adultPublic(matches,await adultGrant(env,request)),revision_estado:ticket?.estado||'',cupo:1,version:110});
 }
 if(path!=='/empleo'||request.method!=='POST')throw httpError('Operación no disponible.',405);
 const action=String(body.action||''),data=body.payload||{},version=await db.getVersioned('empleos',owner.record),current=version.doc,now=Date.now(),iso=new Date(now).toISOString();
 if(!['guardar','renovar','pausar','eliminar'].includes(action))throw httpError('Acción inválida.',400);
 if(current?.revision_definitiva&&action!=='eliminar'&&!(action==='renovar'&&Date.parse(current.hasta)<=now))throw httpError('Esta publicación quedó bloqueada definitivamente.',403);
 let next;
 if(action==='pausar'||action==='eliminar'){
  if(!current)throw httpError('No hay una publicación guardada.',404);
  next={...current,...(action==='eliminar'?{eliminado:true,pausado:true}:{pausado:data.pausado!==false})};
  if(current.eliminado&&action==='pausar')throw httpError('La publicación está eliminada.',409);
  if(!next.pausado&&Date.parse(current.hasta)<=now)throw httpError('La publicación venció. Renovala para volver a mostrarla.',409);
  if(next.pausado===current.pausado&&next.eliminado===current.eliminado)return json({success:true,sin_cambios:true,publicacion:current});
 }else{
  if(body.declaracion_publicacion?.aceptada!==true||body.declaracion_publicacion.version!==PUBLICATION_TERMS_V77)throw httpError('Aceptá los términos y la declaración de responsabilidad.',400);
  const catalogs=await cache.get('admin:catalogs:v2');if(!Array.isArray(catalogs?.moderacion_18))throw httpError('Las reglas de moderación no están disponibles. Reintentá más tarde.',503);
  const expired=current&&Date.parse(current.hasta)<=now;
  if(action==='renovar'&&(!current||!expired))throw httpError('Podés renovar cuando se cumplan los 30 días de vigencia.',409);
  if(current&&action==='guardar'&&(expired||current.eliminado))throw httpError(expired?'La publicación venció. Usá Renovar.':'Esta publicación está eliminada. El cupo del período no se recupera al borrar.',409);
  const text=(/** @type {any} */ key,/** @type {any} */ max)=>{const v=String(data[key]??'').trim();if(v.length>max)throw httpError('El campo '+key+' admite hasta '+max+' caracteres.',400);return v;};
  const type=owner.aid?String(data.tipo||'OFREZCO'):'BUSCO';if(!['BUSCO','OFREZCO','CONCESION'].includes(type)||owner.aid&&type==='BUSCO')throw httpError('Tipo de publicación inválido.',400);
  const territory=await cache.get('territorio:public:v1'),cities=new Set((territory?.ciudades||[]).map((/** @type {any} */ c)=>String(c.ciudad_id||c.id))),city=text('ciudad_id',180),extra=Array.isArray(data.ciudad_ids)?data.ciudad_ids:[];
  const coverage=[...new Set([city,...extra].map(String))];if(!city||coverage.length>10||coverage.some((/** @type {any} */ c)=>!cities.has(c)))throw httpError('Elegí una ciudad habilitada. La búsqueda ampliada permite hasta 10 ciudades en total.',400);
  const tags=[...new Set(String(data.tags||'').split(/[,;\n]+/).map((/** @type {any} */ t)=>t.trim()).filter(Boolean))];if(tags.length>10||tags.join(', ').length>300)throw httpError('Usá hasta 10 especialidades y 300 caracteres en total.',400);
  const contact={email:String(data.contacto?.email||'').trim(),whatsapp:String(data.contacto?.whatsapp||'').replace(/[^0-9]/g,''),telefono:String(data.contacto?.telefono||'').replace(/[^0-9+() -]/g,'').trim()};if(contact.telefono.length>30||contact.telefono&&!/^[+() 0-9-]{6,30}$/.test(contact.telefono)||contact.email.length>200||contact.email&&!/^\S+@\S+\.\S+$/.test(contact.email)||contact.whatsapp.length>20||contact.whatsapp&&contact.whatsapp.length<8||!contact.email&&!contact.whatsapp&&!contact.telefono)throw httpError('Indicá un correo, teléfono o WhatsApp de contacto válido.',400);
  if(data.contacto_publico!==true)throw httpError('Confirmá que querés mostrar esos datos de contacto.',400);
  const sedeId=text('sede_id',180);let sede=null;if(sedeId){if(!aid)throw httpError('La selección de sede corresponde a un anunciante.',400);sede=await empRead109(ctx).get('anunciantes_sedes',sedeId);if(!sede||String(sede.anunciante_id)!==aid)throw httpError('La sede no pertenece a este anunciante.',403);}
  const conditions=text('condiciones_url',1000);if(conditions){let u;try{u=new URL(conditions);}catch{throw httpError('Indicá un enlace válido al PDF de condiciones en Drive.',400);}if(type!=='CONCESION'||u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.username||u.password||u.port||!/^\/(?:file\/d\/[^/]+|open|uc)(?:\/|$)/.test(u.pathname))throw httpError('Usá un enlace de archivo de Google Drive, solo para concesiones.',400);}
  const fields={sede_id:sedeId,sede_nombre:sede?String(sede.nombre_sede||''):'',condiciones_url:conditions,tipo:type,nombre:text('nombre',100),puesto:text('puesto',80),titulo:text('puesto',80),area:text('area',60),descripcion:text('descripcion',1000),modalidad:text('modalidad',20),disponibilidad:text('disponibilidad',30),tags,ciudad_id:city,ciudad_ids:coverage,contacto:contact,contenido_adulto:adultFlag(data.contenido_adulto)};
  if(!fields.nombre||!fields.puesto||!fields.descripcion||!EMP_AREAS109.includes(fields.area)||!['PRESENCIAL','REMOTO','MIXTO'].includes(fields.modalidad)||!['COMPLETA','PARCIAL','POR_HORAS','A_CONVENIR'].includes(fields.disponibilidad))throw httpError('Completá nombre público, puesto, rubro, descripción, modalidad y disponibilidad.',400);
  const same=current&&Object.entries(fields).every((/** @type {any} */ [k,v])=>JSON.stringify(v)===JSON.stringify(current[k]));if(same&&action==='guardar')return json({success:true,sin_cambios:true,publicacion:current});
  if(current&&action==='guardar'&&current.ediciones>=1)throw httpError('Ya utilizaste la única modificación de este período de 30 días.',409);
  const newCycle=!current||action==='renovar',policy=publicationPolicyV77({...fields,nombre:fields.nombre+' '+fields.puesto},catalogs.moderacion_18);
  next={...(current||{}),...fields,record_id:owner.record,empleo_id:newCycle?owner.record+'__'+crypto.randomUUID():current.empleo_id,owner_type:owner.kind,owner_id:owner.owner,suscriptor_id:owner.session.sid,anunciante_id:owner.aid,desde:newCycle?iso:current.desde,hasta:newCycle?new Date(now+30*86400000).toISOString():current.hasta,ediciones:newCycle?0:current.ediciones+1,eliminado:false,pausado:newCycle?false:current.pausado,revision_definitiva:false,...policy,aprobado:policy.estado_moderacion!=='PENDIENTE',declaracion_publicacion:{version:PUBLICATION_TERMS_V77,usuario_id:owner.session.sid,fecha:iso}};
 }
 next.actualizado_en=iso;
 const [saved]=await db.commitPatches([{collection:'empleos',id:owner.record,before:current,patch:next,options:current?{updateTime:version.updateTime}:{mustNotExist:true}}]);
 await syncEmpleo109({cache,current,next:saved});return json({success:true,publicacion:saved});
}
function observeKv117(env,report){
 const original=env.GLD_CACHE_KV;if(!original)return env;
 const stats=report.kv={get_calls:0,put_calls:0,delete_calls:0,list_calls:0,failures:0,write_groups:{}};
 const names={get:'get_calls',put:'put_calls',delete:'delete_calls',list:'list_calls'},methods=new Map();
 const binding=new Proxy(original,{get(target,property){
  const method=Reflect.get(target,property,target);if(typeof method!=='function')return method;
  if(!names[property])return method.bind(target);
  if(!methods.has(property))methods.set(property,async(...args)=>{
   stats[names[property]]++;
   if(property==='put'){const group=String(args[0]||'').split(':').slice(0,3).join(':');stats.write_groups[group]=(stats.write_groups[group]||0)+1;}
   try{return await Reflect.apply(method,target,args);}catch(error){stats.failures++;throw error;}
  });return methods.get(property);
 }});
 return new Proxy(env,{get(target,property){return property==='__gldCatalogScope126'?original:property==='__gldRequestReport119'?report:property==='GLD_CACHE_KV'?binding:Reflect.get(target,property,target);}});
}

const RECOVERABLE119=new Set(['eventos','evento_programacion','actividades','actividad_horarios','promos','publicidades','publicidad_media','publicidad_segmentacion','anunciantes','anunciantes_administracion','anunciantes_sedes','efemerides_bis','farmacias_ciclos','farmacias_ciclo_sedes']);
// One strongly consistent actor per module/city. Legacy KV is read only.
// The actor merges entity changes, never replaces another request's full list.
function cityDefinition119(key){
 const m=String(key).match(/^(guide|events|activities|promos|publicity|efemerides|farmacias):city:v([12]):(.+)$/);
 if(!m)return null;
 const [field,id,collection]=({guide:['anunciantes','anunciante_id','anunciantes'],events:['events','evento_id','eventos'],activities:['actividades','actividad_id','actividades'],promos:['promos','promo_id','promos'],publicity:['publicidades','publicidad_id','publicidades'],efemerides:['efemerides','efemeride_id','efemerides_bis'],farmacias:['ciclos','ciclo_id','farmacias_ciclos']})[m[1]];
 return {field,id,collection,module:m[1]};
}
function sourceStamp119(value){
 const m=String(value||'').match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/);
 return m?m[1]+'.'+(m[2]||'').padEnd(9,'0')+'Z':'';
}
function noteSource119(env,c,id,doc,stamp){
 const report=env.__gldRequestReport119,s=sourceStamp119(stamp);if(!report||!s)return;
 const stamps=report.source_versions119??={},parentsSeen=report.source_parents119??={};
 const put=(key)=>{if(s>(stamps[key]||''))stamps[key]=s;};
 put(c+'/'+id);
 const parents={evento_programacion:['eventos','evento_id'],actividad_horarios:['actividades','actividad_id'],publicidad_media:['publicidades','publicidad_id'],publicidad_segmentacion:['publicidades','publicidad_id'],anunciantes_administracion:['anunciantes','anunciante_id'],anunciantes_sedes:['anunciantes','anunciante_id'],farmacias_ciclo_sedes:['farmacias_ciclos','ciclo_id']};
 const p=parents[c];if(p){const parent=doc?.[p[1]]||(c==='anunciantes_administracion'?id:'')||parentsSeen[c+'/'+id];if(parent){parentsSeen[c+'/'+id]=parent;put(p[0]+'/'+parent);}}
}
function samePublicValueInternal(a,b){
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 return JSON.stringify(stable(a))===JSON.stringify(stable(b));
}
function sortPublicCity119(key,rows){
 const mod=cityDefinition119(key)?.module;
 if(mod==='guide')return sortCards2(rows);
 if(mod==='events')return sort2(rows);
 if(mod==='activities')return sort5(rows);
 if(mod==='promos')return sort(rows);
 if(mod==='publicity')return sort6(rows);
 if(mod==='farmacias')return sortTurnos2(rows);
 return rows;
}
class GldPublicCache119 {
 constructor(state,env){
  this.state=state;this.env=env;this.sql=state.storage.sql;this.cached=null;
  this.sql.exec('CREATE TABLE IF NOT EXISTS packet (slot INTEGER PRIMARY KEY, value TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, value TEXT, stamp TEXT NOT NULL, position INTEGER NOT NULL)');
 }
 query(sql,...args){const cursor=this.sql.exec(sql,...args),rows=[...cursor];this.metrics.rows_read+=cursor.rowsRead||0;this.metrics.rows_written+=cursor.rowsWritten||0;return rows;}
 async legacy(key){this.metrics.legacy_gets++;const raw=await this.env.GLD_CACHE_KV.get(key);return raw?JSON.parse(raw):null;}
 guideSnapshot135(packet,maxBytes=1500000){
  // Stay below the provider's 2 MB row limit. Larger cities retain the
  // existing entity representation rather than failing a read or a save.
  const serialized=JSON.stringify(packet);
  return new TextEncoder().encode(serialized).byteLength<=maxBytes?serialized:null;
 }
 async read(key,def){
  if(this.cached!==null)return this.cached;
  const head=this.query('SELECT value,deleted FROM packet WHERE slot=1')[0];
  if(!head)return this.legacy(key);
  if(head.deleted)return null;
  const stored=JSON.parse(head.value);
  if(def.module==='guide'&&Array.isArray(stored[def.field])){
   if(head.value.length<2000000)this.cached=stored;
   return stored;
  }
  const rows=this.query('SELECT value FROM entities WHERE value IS NOT NULL ORDER BY position,id').map(x=>JSON.parse(x.value));
  const result={...stored,[def.field]:sortPublicCity119(key,rows)};
  // Upgrade the old metadata-only row once per city. Subsequent cold reads
  // use the finished packet; normal saves replace the row they already wrote.
  if(def.module==='guide'){
   const snapshot=this.guideSnapshot135(result);
   if(snapshot!==null){
    try{this.query('UPDATE packet SET value=? WHERE slot=1',snapshot);}
    catch(error){console.warn(JSON.stringify({event:'gld_guide_snapshot_deferred',worker_version:'135',error:String(error?.message||error)}));}
   }
  }
  if(JSON.stringify(result).length<2000000)this.cached=result;
  return result;
 }
 initialize(packet,def){
  if(this.query('SELECT slot FROM packet WHERE slot=1').length)return;
  const {[def.field]:rows=[],...meta}=packet||{};
  const snapshot=def.module==='guide'?this.guideSnapshot135({...meta,[def.field]:rows}):null;
  this.query('INSERT INTO packet(slot,value,deleted) VALUES(1,?,0)',snapshot??JSON.stringify(meta));
  for(const [position,row]of rows.entries()){
   const id=String(row[def.id]||row.id||'');if(!id)throw Error('Public cache entity missing identifier');
   this.query('INSERT OR REPLACE INTO entities(id,value,stamp,position) VALUES(?,?,?,?)',id,JSON.stringify(row),'',position);
  }
 }
 async handle(body){
  const {key,op}=body,def=cityDefinition119(key);if(!def)throw Error('Invalid public cache key');
  if(op==='get')return {value:await this.read(key,def)};
  if(!['put','delete'].includes(op))throw Error('Invalid public cache operation');
  const prior=await this.read(key,def),merged=new Map((prior?.[def.field]||[]).map(row=>[String(row[def.id]||row.id||''),row]));let nextPacket=null;
  this.state.storage.transactionSync(()=>{
   this.initialize(prior,def);
   if(op==='delete'){
    // Maintenance must compare its observed packet before removing a city.
    if(JSON.stringify(body.base)!==JSON.stringify(prior))throw Error('Public cache conflict');
    this.query('UPDATE entities SET value=NULL');this.query('UPDATE packet SET deleted=1 WHERE slot=1');return;
   }
   const {[def.field]:incoming=[],...meta}=body.value||{};
   if(!Array.isArray(incoming))throw Error('Invalid public cache packet');
   const baseRows=body.base?.[def.field]||[];
   const identify=row=>String(row?.[def.id]||row?.id||'');
   const before=new Map(baseRows.map(row=>[identify(row),row])),after=new Map(incoming.map(row=>[identify(row),row]));
   if(after.has('')||after.size!==incoming.length)throw Error('Invalid public cache entity identifiers');
   for(const id of new Set([...before.keys(),...after.keys()])){
    const a=before.get(id),b=after.get(id);if(JSON.stringify(a)===JSON.stringify(b))continue;
    const current=this.query('SELECT value,stamp,position FROM entities WHERE id=?',id)[0];
    const stamp=sourceStamp119(body.stamps?.[id]);
    // A late projection cannot revive an entity deleted by a newer source write.
    if(current?.stamp&&(!stamp||stamp<current.stamp))continue;
    const currentRow=current?.value?JSON.parse(current.value):undefined;
    if(stamp&&current?.stamp===stamp){
     if(samePublicValueInternal(currentRow,b))continue;
     // Equal source revision with incompatible contents requires a fresh repair.
     throw Error('Public cache conflict');
    }
    if(!stamp&&!samePublicValueInternal(currentRow,a)&&!samePublicValueInternal(currentRow,b))throw Error('Public cache conflict');
    this.query('INSERT INTO entities(id,value,stamp,position) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,stamp=excluded.stamp',id,b?JSON.stringify(b):null,stamp||current?.stamp||'',current?.position??Date.now());
    if(b)merged.set(id,b);else merged.delete(id);
   }
   nextPacket={...meta,[def.field]:sortPublicCity119(key,[...merged.values()])};
   const snapshot=def.module==='guide'?this.guideSnapshot135(nextPacket):null;
   this.query('UPDATE packet SET value=?,deleted=0 WHERE slot=1',snapshot??JSON.stringify(meta));
  });
  this.cached=nextPacket&&JSON.stringify(nextPacket).length<2000000?nextPacket:null;
  return {ok:true};
 }
 async fetch(request){
  // Preserve ordering across external I/O without the 30-second input gate.
  const previous=this.requestTail127||Promise.resolve();
  let release=()=>{};
  this.requestTail127=new Promise(resolve=>{release=()=>resolve(undefined);});
  await previous;
  try{return await this.process127(request);}finally{release();}
 }
 async process127(request){
  return (async()=>{
   this.metrics={rows_read:0,rows_written:0,legacy_gets:0};
   try{const body=await request.json();if(body.op==='guide-save132')return await this.guideSave132(body);if(['pending-events-read','pending-events-invalidate'].includes(body.op))return Response.json({...await this.pending126(body.op),metrics:this.metrics});if(body.op==='migration-snapshot')return Response.json({...await this.moduleSnapshot125(body),metrics:this.metrics});await this.reconcileLegacy125(body.key);return Response.json({...await this.handle(body),metrics:this.metrics});}
   catch(error){this.cached=null;return Response.json({error:String(error?.message||error),metrics:this.metrics},{status:/conflict/i.test(String(error))?409:503});}
  })();
 }
}
function coordinatedCities119(env,report){
 if(!env.GLD_PUBLIC_CACHE){report.public_cache_backend='legacy-kv';return env;}
 report.public_cache_backend='coordinated-sqlite';
 const kv=env.GLD_CACHE_KV,bases=new Map();
 async function call(key,op,value){
  const def=cityDefinition119(key),stamps={};
  for(const row of [...(bases.get(key)?.[def.field]||[]),...(value?.[def.field]||[])]){
   const id=String(row[def.id]||row.id||'');stamps[id]=report.source_versions119?.[def.collection+'/'+id]||'';
  }
  const stub=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('public-city-v119:'+key));
  const response=await stub.fetch(new Request('https://public-cache.internal/',{method:'POST',body:JSON.stringify({key,op,value,base:bases.get(key)||null,stamps})}));
  const result=await response.json(),stats=report.public_store??={calls:0,rows_read:0,rows_written:0,legacy_gets:0,legacy_lists:0};stats.calls++;
  for(const k of ['rows_read','rows_written','legacy_gets','legacy_lists'])stats[k]+=Number(result.metrics?.[k]||0);
  for(const [key,entry]of Object.entries(result.metrics?.source_operations||{})){const target=report.operations[key]??={operation:entry.operation,collection:entry.collection,field:entry.field||'',calls:0,documents_returned:0,failures:0};for(const field of ['calls','documents_returned','failures'])target[field]+=Number(entry[field]||0);}
  if(!response.ok)throw Object.assign(Error(result.error||'Public cache unavailable'),{cacheRecoverable:true});
  return result;
 }
 const binding=new Proxy(kv,{get(target,prop){
  if(prop==='get')return async(key,options)=>{if(!cityDefinition119(key)||options?.type&&options.type!=='text')return target.get(key,options);const {value}=await call(key,'get');bases.set(key,value);return value?JSON.stringify(value):null;};
  if(prop==='put')return async(key,value,options)=>{if(!cityDefinition119(key))return target.put(key,value,options);if(options&&Object.keys(options).length)throw Error('Public cache TTL unsupported');const packet=JSON.parse(value);
   if(!bases.has(key)){
    // A full catalog rebuild has no preceding city read. Capture the current
    // packet and apply the source revisions collected by the rebuild, so rows
    // omitted from that snapshot are removed without dropping newer additions.
    const {value:current}=await call(key,'get');bases.set(key,current);
    const def=cityDefinition119(key),ids=new Set((packet?.[def.field]||[]).map(row=>String(row[def.id]||row.id||'')));
    const source=observeDbV41(createDb(env),report);
    for(const row of current?.[def.field]||[]){
     const id=String(row[def.id]||row.id||'');
     if(ids.has(id)||report.source_versions119?.[def.collection+'/'+id])continue;
     // Only maintenance needs these absence checks. Ordinary saves have a base
     // and take no extra source reads. A source created after the scan survives.
     const fresh=await source.getVersioned(def.collection,id);
     if(fresh.doc){packet[def.field].push(row);ids.add(id);}
    }
   }
   await call(key,'put',packet);bases.set(key,packet);};
  if(prop==='delete')return async key=>{if(!cityDefinition119(key))return target.delete(key);await call(key,'delete');bases.set(key,null);};
  const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;
 }});
 return new Proxy(env,{get(target,prop){return prop==='GLD_CACHE_KV'?binding:Reflect.get(target,prop,target);}});
}

// Request lifetime only. Authentication and expiry semantics remain unchanged.
function requestCache121(env,report,readOnly126=false){
 const native=env.GLD_CACHE_KV;if(!native)return env;
 let shared=PUBLIC_CATALOG_POOL126.get(env.__gldCatalogScope126);if(!shared){shared=new Map();PUBLIC_CATALOG_POOL126.set(env.__gldCatalogScope126,shared);}
 const values=new Map(),pending=new Map(),epochs=new Map(),lists=new Map();
 const stats=report.cache_optimization={reads_reused:0,lists_reused:0,writes_unchanged:0,catalogs_reused:0};
 const epoch=k=>epochs.get(k)||0;
 function invalidate(k){epochs.set(k,epoch(k)+1);values.delete(k);pending.delete(k);lists.clear();if(PUBLIC_CATALOG_KEYS126.has(k))shared.delete(k);}
 const kv=new Proxy(native,{get(target,method){
  if(method==='get')return async(key,options)=>{
   if(typeof options==='string'&&options!=='text'||options?.type&&options.type!=='text')return target.get(key,options);
   if(readOnly126&&PUBLIC_CATALOG_KEYS126.has(key)){const hit=shared.get(key);if(hit&&Date.now()<hit.until){stats.catalogs_reused=(stats.catalogs_reused||0)+1;return hit.value;}}
   if(values.has(key)){stats.reads_reused++;return values.get(key);}
   if(pending.has(key)){stats.reads_reused++;return pending.get(key);}
   const version=epoch(key),read=Promise.resolve().then(()=>target.get(key,options));pending.set(key,read);
   try{const value=await read;if(epoch(key)===version){values.set(key,value);if(PUBLIC_CATALOG_KEYS126.has(key)&&value!==null)shared.set(key,{value,until:Date.now()+30000});}return value;}
   finally{if(pending.get(key)===read)pending.delete(key);}
  };
  if(method==='put')return async(key,value,options)=>{
   if(typeof value==='string'&&values.get(key)===value&&(!options||Object.keys(options).length===0)){stats.writes_unchanged++;return;}
   invalidate(key);const version=epoch(key);await target.put(key,value,options);
   if(epoch(key)===version&&typeof value==='string'){values.set(key,value);if(PUBLIC_CATALOG_KEYS126.has(key))shared.set(key,{value,until:Date.now()+30000});}
  };
  if(method==='delete')return async key=>{invalidate(key);const version=epoch(key);await target.delete(key);if(epoch(key)===version)values.set(key,null);};
  if(method==='list')return async options=>{
   const key=JSON.stringify(options||{});if(lists.has(key)){stats.lists_reused++;return structuredClone(await lists.get(key));}
   const read=Promise.resolve().then(()=>target.list(options));lists.set(key,read);
   try{return structuredClone(await read);}catch(error){if(lists.get(key)===read)lists.delete(key);throw error;}
  };
  const value=Reflect.get(target,method,target);return typeof value==='function'?value.bind(target):value;
 }});
 return new Proxy(env,{get(target,key){return key==='GLD_CACHE_KV'?kv:Reflect.get(target,key,target);}});
}

function requestDb119(db,report){
 const cache=new Map(),epochs=new Map();
 const stats=report.database_reuse={get:0,versioned:0,queries:0};
 const epoch=c=>epochs.get(c)||0;
 function invalidate(c){epochs.set(c,epoch(c)+1);for(const k of cache.keys())if(k.startsWith(c+'\u0000'))cache.delete(k);}
 async function once(c,key,kind,work){
  const k=c+'\u0000'+key;
  if(cache.has(k)){stats[kind]++;return structuredClone(await cache.get(k));}
  const version=epoch(c),pending=Promise.resolve().then(work);
  cache.set(k,pending);
  try{return structuredClone(await pending);}catch(error){if(cache.get(k)===pending)cache.delete(k);throw error;}
  finally{if(version!==epoch(c)&&cache.get(k)===pending)cache.delete(k);}
 }
 function remember(c,id,row){cache.set(c+'\u0000get:'+String(id),Promise.resolve(structuredClone(row)));}
 return {...db,
  get:(c,id)=>once(c,'get:'+String(id),'get',()=>db.get(c,id)),
  async getVersioned(c,id){const version=epoch(c),value=await once(c,'versioned:'+String(id),'versioned',()=>db.getVersioned(c,id));if(version===epoch(c))remember(c,id,value.doc);return value;},
  queryEqual:(c,field,value,limit=1000,operator119='EQUAL')=>once(c,'query:'+JSON.stringify([field,value,limit,operator119]),'queries',()=>db.queryEqual(c,field,value,limit,operator119)),
  async patch(c,id,patch,options={}){invalidate(c);const version=epoch(c),row=await db.patch(c,id,patch,options);if(version===epoch(c))remember(c,id,row);return row;},
  async delete(c,id,options={}){invalidate(c);const version=epoch(c),result=await db.delete(c,id,options);if(version===epoch(c))remember(c,id,null);return result;},
  async commitPatches(entries){const versions=new Map();for(const c of new Set(entries.map(e=>e.collection))){invalidate(c);versions.set(c,epoch(c));}const result=await db.commitPatches(entries);for(let i=0;i<entries.length;i++){const e=entries[i];if(versions.get(e.collection)===epoch(e.collection)&&(e.remove||e.before||e.options?.mustNotExist))remember(e.collection,e.id,result[i]);}return result;}
 };
}

GldPublicCache119.prototype.reconcileLegacy125=async function(key){
 if(this.env.GLD_PUBLIC_CACHE_MIGRATION!=='source-bootstrap')return;
 if(Date.now()<(this.nextLegacyCheck125||0))return;
 const def=cityDefinition119(key);if(!def)return;
 if(this.legacyFingerprint125===undefined){
  this.sql.exec('CREATE TABLE IF NOT EXISTS migration_state (slot INTEGER PRIMARY KEY, fingerprint TEXT NOT NULL)');
  this.legacyFingerprint125=this.query('SELECT fingerprint FROM migration_state WHERE slot=1')[0]?.fingerprint||'';
 }
 // Guía already routes every public mutation through this actor. A durable
 // bootstrap marker finishes its legacy bridge; other modules keep their policy.
 if(def.module==='guide'&&this.legacyFingerprint125)return;
 this.metrics.legacy_gets++;
 const raw=await this.env.GLD_CACHE_KV.get(key);
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw||'')))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash===this.legacyFingerprint125){this.nextLegacyCheck125=Date.now()+60000;return;}
 const basePacket=await this.read(key,def);
 const report={operations:{}};this.metrics.source_operations=report.operations;
 const sourceEnv=new Proxy(this.env,{get(target,p){return p==='__gldRequestReport119'?report:Reflect.get(target,p,target);}});
 const actor=this.env.GLD_PUBLIC_CACHE.get(this.env.GLD_PUBLIC_CACHE.idFromName('migration-source-snapshot-v125:'+def.module));
 const response=await actor.fetch(new Request('https://migration.internal/',{method:'POST',body:JSON.stringify({op:'migration-snapshot',module:def.module,key,fingerprint:hash,ids:(basePacket?.[def.field]||[]).map(row=>String(row[def.id]||row.id||''))})}));
 const result=await response.json();
 for(const metric of ['rows_read','rows_written','legacy_gets','legacy_lists'])this.metrics[metric]=(this.metrics[metric]||0)+(result.metrics?.[metric]||0);
 for(const [k,stat]of Object.entries(result.metrics?.source_operations||{})){const own=report.operations[k]??={...stat,calls:0,documents_returned:0,failures:0};for(const f of ['calls','documents_returned','failures'])own[f]+=stat[f]||0;}
 if(!response.ok)throw Error(result.error||'Source migration snapshot unavailable');
 const packet=result.packet,db=observeDbV41(createDb(sourceEnv),report);
 report.source_versions119=Object.fromEntries(Object.entries(result.stamps||{}).map(([id,stamp])=>[def.collection+'/'+id,stamp]));
 const incomingIds=new Set(packet[def.field].map(row=>String(row[def.id]||row.id||'')));
 for(const row of basePacket?.[def.field]||[]){
  const id=String(row[def.id]||row.id||'');
  if(incomingIds.has(id)||report.source_versions119?.[def.collection+'/'+id])continue;
  const fresh=await db.getVersioned(def.collection,id);
  // A record created after the scan is retained until its current projection
  // arrives. An absent record carries Firestore's server readTime tombstone.
  if(fresh.doc){packet[def.field].push(row);incomingIds.add(id);}
 }
 const stamps={};
 for(const row of [...(basePacket?.[def.field]||[]),...packet[def.field]]){
  const id=String(row[def.id]||row.id||'');stamps[id]=report.source_versions119?.[def.collection+'/'+id]||'';
 }
 // Persist the fingerprint only after the full canonical projection succeeds.
 // If that final marker fails, retrying the source rebuild is idempotent.
 try{
  await this.handle({key,op:'put',value:packet,base:basePacket,stamps});
  this.query('INSERT INTO migration_state(slot,fingerprint) VALUES(1,?) ON CONFLICT(slot) DO UPDATE SET fingerprint=excluded.fingerprint',hash);
 }catch(error){this.cached=null;throw error;}
 this.legacyFingerprint125=hash;this.nextLegacyCheck125=Date.now()+60000;
 this.metrics.source_operations=report.operations;
};

GldPublicCache119.prototype.moduleSnapshot125=async function(body){
 const {module,key,fingerprint}=body,def=cityDefinition119(key);
 if(!def||def.module!==module)throw Error('Invalid migration module');
 if(!this.snapshotTables125){
  this.sql.exec('CREATE TABLE IF NOT EXISTS migration_heads (key TEXT PRIMARY KEY, meta TEXT NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS migration_rows (key TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(key,id))');
  this.sql.exec('CREATE TABLE IF NOT EXISTS migration_versions (id TEXT PRIMARY KEY,stamp TEXT NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS migration_fingerprints (key TEXT PRIMARY KEY,hash TEXT NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS migration_ready (slot INTEGER PRIMARY KEY)');
  this.snapshotTables125=true;
 }
 const emptyHash='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
 const ready=this.query('SELECT slot FROM migration_ready WHERE slot=1').length;
 const known=this.query('SELECT hash FROM migration_fingerprints WHERE key=?',key)[0]?.hash||emptyHash;
 if(!ready||known!==fingerprint){
  const fingerprints=new Map();let cursor;
  do{
   this.metrics.legacy_lists=(this.metrics.legacy_lists||0)+1;
   const page=await this.env.GLD_CACHE_KV.list({prefix:module+':city:',...(cursor?{cursor}:{})});
   for(const item of page.keys){
    if(cityDefinition119(item.name)?.module!==module)continue;
    this.metrics.legacy_gets++;const raw=await this.env.GLD_CACHE_KV.get(item.name);
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw||'')))].map(x=>x.toString(16).padStart(2,'0')).join('');
    fingerprints.set(item.name,hash);
   }
   cursor=page.list_complete?null:page.cursor;
  }while(cursor);
  fingerprints.set(key,fingerprint);
  const report={operations:{}};this.metrics.source_operations=report.operations;
  const sourceEnv=new Proxy(this.env,{get(t,p){return p==='__gldRequestReport119'?report:Reflect.get(t,p,t);}});
  const db=observeDbV41(createDb(sourceEnv),report),packets=new Map();
  const metrics=this.metrics;const cache={async get(k){metrics.legacy_gets++;const raw=await sourceEnv.GLD_CACHE_KV.get(k);return raw?JSON.parse(raw):null;},async put(k,v){if(cityDefinition119(k)?.module===module)packets.set(k,v);},async del(k){packets.delete(k);}};
  const rebuild={guide:rebuildGuideAllV2,events:rebuildEventsAllV2,activities:rebuildActivitiesAllV2,promos:rebuildPromosAll,publicity:rebuildPublicityAllV2,efemerides:rebuildEfemeridesAllV3,farmacias:rebuildFarmAllV2}[module];
  await rebuild({db,cache,env:sourceEnv});
  this.state.storage.transactionSync(()=>{
   for(const table of ['migration_heads','migration_rows','migration_versions','migration_fingerprints'])this.query('DELETE FROM '+table);
   for(const [k,p]of packets){
    const {[def.field]:rows=[],...meta}=p;this.query('INSERT INTO migration_heads(key,meta) VALUES(?,?)',k,JSON.stringify(meta));
    for(const row of rows){const id=String(row[def.id]||row.id||'');if(!id)throw Error('Migration row has no identifier');this.query('INSERT INTO migration_rows(key,id,value) VALUES(?,?,?)',k,id,JSON.stringify(row));}
   }
   for(const [id,stamp]of Object.entries(report.source_versions119||{}))if(id.startsWith(def.collection+'/'))this.query('INSERT INTO migration_versions(id,stamp) VALUES(?,?)',id.slice(def.collection.length+1),stamp);
   for(const [k,hash]of fingerprints)this.query('INSERT INTO migration_fingerprints(key,hash) VALUES(?,?)',k,hash);
   this.query('INSERT OR IGNORE INTO migration_ready(slot) VALUES(1)');
  });
 }
 const head=this.query('SELECT meta FROM migration_heads WHERE key=?',key)[0];
 const rows=this.query('SELECT id,value FROM migration_rows WHERE key=? ORDER BY id',key);
 const packet={...(head?JSON.parse(head.meta):{version:module==='promos'?1:2,ciudad_id:key.split(':').slice(3).join(':')}),[def.field]:rows.map(x=>JSON.parse(x.value))};
 const stamps={};
 for(const id of new Set([...rows.map(x=>x.id),...(body.ids||[])])){
  const value=this.query('SELECT stamp FROM migration_versions WHERE id=?',id)[0];if(value)stamps[id]=value.stamp;
 }
 return {packet,stamps};
};

const PUBLIC_CATALOG_POOL126=new WeakMap();
const PUBLIC_CATALOG_KEYS126=new Set(['catalogs:publicidad:v1','catalogs:commerce:v1','catalogs:eventos:v1','catalogs:actividades:v1','catalogs:promos:v1']);
async function pendingActor126(env,op){
 const actor=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('admin-pending-events-v126'));
 const response=await actor.fetch(new Request('https://pending.internal/',{method:'POST',body:JSON.stringify({op})}));
 const result=await response.json(),report=env.__gldRequestReport119;
 if(report){
  const metrics=report.admin_store126??={calls:0,rows_read:0,rows_written:0};metrics.calls++;
  for(const field of ['rows_read','rows_written'])metrics[field]+=result.metrics?.[field]||0;
  for(const [key,entry]of Object.entries(result.metrics?.source_operations||{})){const target=report.operations[key]??={operation:entry.operation,collection:entry.collection,field:entry.field||'',calls:0,documents_returned:0,failures:0};for(const f of ['calls','documents_returned','failures'])target[f]+=entry[f]||0;}
 }
 if(!response.ok)throw Error(result.error||'No se pudo consultar la moderación.');
 return result.value;
}
GldPublicCache119.prototype.pending126=async function(op){
 if(!this.pendingTable126){this.sql.exec('CREATE TABLE IF NOT EXISTS pending_events_cache (slot INTEGER PRIMARY KEY,value TEXT NOT NULL)');this.pendingTable126=true;}
 if(op==='pending-events-invalidate'){this.query('DELETE FROM pending_events_cache');this.pendingRows126=undefined;return {value:null};}
 if(this.pendingRows126!==undefined)return {value:this.pendingRows126};
 const stored=this.query('SELECT value FROM pending_events_cache WHERE slot=1')[0];
 if(stored){this.pendingRows126=JSON.parse(stored.value);return {value:this.pendingRows126};}
 const report={operations:{}};this.metrics.source_operations=report.operations;
 const env=new Proxy(this.env,{get(t,p){return p==='__gldRequestReport119'?report:Reflect.get(t,p,t);}});
 const value=await pendingEventsV2({db:observeDbV41(createDb(env),report),limit:100});
 this.query('INSERT INTO pending_events_cache(slot,value) VALUES(1,?)',JSON.stringify(value));
 this.pendingRows126=value;return {value};
};

function sameCacheData129(a,b){
 if(a===b)return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameCacheData129(a[k],b[k]));
}
async function stageAdvertiserSaveInternal(db,cache,operation){
 const pending=new Map(),cacheChanges=new Map();
 function add(entry){
  const key=entry.collection+'/'+entry.id;
  if(pending.has(key))throw httpError('La ficha contiene cambios repetidos. Volvé a abrirla antes de guardar.',409);
  if(!entry.options?.updateTime&&!entry.options?.mustNotExist)throw httpError('No se pudo comprobar la versión de todos los datos. Volvé a abrir la ficha.',409);
  pending.set(key,entry);
 }
 const stagedDb={...db,
  async patch(collection,id,patch,options={}){
   const current=options.mustNotExist||options.newDocument?null:(await db.getVersioned(collection,id)).doc;
   add({collection,id,before:current,patch,options});return {...current,...patch,id};
  },
  async commitPatches(entries){for(const entry of entries)add(entry);return entries.map(e=>e.remove?null:{...e.before,...e.patch,id:e.id});}
 };
 const stagedCache={...cache,
  async get(key){if(cacheChanges.has(key))return cacheChanges.get(key).deleted?null:structuredClone(cacheChanges.get(key).value);return cache.get(key);},
  async put(key,value,options){cacheChanges.set(key,{value:structuredClone(value),options});},
  async del(key){cacheChanges.set(key,{deleted:true});}
 };
 const result=await operation(stagedDb,stagedCache);
 if(pending.size>100)throw httpError('La ficha tiene demasiados cambios juntos. Guardá hasta 100 registros por vez.',400);
 if(pending.size)await db.commitPatches([...pending.values()]);
 for(const [key,entry]of cacheChanges){if(entry.deleted)await cache.del(key);else await cache.put(key,entry.value,entry.options);}
 return {...result,firestore_writes:pending.size};
}
async function routeAtomicAdvertiserInternal(ctx){
 const {path,request,db,cache}=ctx;
 if(request.method!=='POST')return null;
 const match=path.match(/^\/superadmin\/advertisers\/([^/]+)\/save$/);
 if(!match&&path!=='/commerce')return null;
 const body=await request.clone().json().catch(()=>({}));
 if(!match&&String(body.action||body.accion||'').toLowerCase()!=='save_ficha')return null;
 if(match){
  const auth=await verifyAdmin(ctx.env,request);if(!auth.ok)return json({success:false,message:auth.message},401);
  if(!isTopAdmin(auth))throw httpError('No tenés permiso para guardar esta configuración.',403);
  const aid=decodeURIComponent(match[1]);
  const result=await stageAdvertiserSaveInternal(db,cache,async(stagedDb,stagedCache)=>{
   const output={success:true,updated:false,anunciante_id:aid};
   if(body.commercial&&Object.keys(body.commercial).length){
    if(Object.hasOwn(body.commercial,'segmento_id'))throw httpError('El segmento debe guardarse con los datos de la ficha.',400);
    const r=await updateAdvertiserCommercialV2({db:stagedDb,cache:stagedCache,auth,advertiserId:aid,payload:body.commercial});output.updated||=r.updated;output.revision_comercial=r.revision_comercial;
   }
   if(body.profile&&Object.keys(body.profile).length){const r=await updateAdvertiserProfileV2({db:stagedDb,cache:stagedCache,auth,advertiserId:aid,payload:body.profile});output.updated||=r.updated;output.revision_perfil=r.revision_perfil;}
   if(body.sedes?.length){const r=await updateAdvertiserSedeRelationsV2({db:stagedDb,cache:stagedCache,auth,advertiserId:aid,sedes:body.sedes});output.updated||=r.updated;output.revision_sedes=r.revision_sedes;}
   return output;
  });return json(result);
 }
 const aid=aidOf4(ctx.url,body);if(!aid)throw httpError('Falta el anunciante.',400);
 const auth=await requirePanel4(ctx.env,request,aid,true);if(auth.response)return auth.response;
 const result=await stageAdvertiserSaveInternal(db,cache,async(stagedDb,stagedCache)=>{
  const output={success:true,updated:false,id:aid};
  if(body.datos&&Object.keys(body.datos).length){
   const data={...body,...body.datos,action:'set_datos',advertiserId:aid};
   const child={...ctx,db:stagedDb,cache:stagedCache,request:new Request(request,{body:JSON.stringify(data)})};
   await preparePublicationV77(child);
   const r=await commerceSetDatosV3({db:child.db,cache:stagedCache,advertiserId:aid,body:data});
   if(r.updated)await patchGuideAdvertiserDataFromCacheV2({cache:stagedCache,advertiserId:aid,patch:r.patch});
   output.updated||=r.updated;output.revision_datos=r.revision_datos;output.datos=r.advertiser;
  }
  if(body.sedes?.length){const r=await commerceSetSedesV3({db:stagedDb,cache:stagedCache,advertiserId:aid,body:{sedes:body.sedes}});if(r.updated)await patchGuideAdvertiserSedesFromCacheV2({cache:stagedCache,advertiserId:aid,savedSedes:r.changed_sedes});output.updated||=r.updated;output.sedes=r.sedes;output.revision_sedes=r.revision_sedes;}
  return output;
 });return json(result);
}

// A durable, per-advertiser intent precedes the source commit. Recovery rebuilds
// projections from current source; it never repeats the user's mutation.
const GUIDE_SOURCE132=new Set(['anunciantes','anunciantes_administracion','anunciantes_sedes']);
async function routeGuideDispatch132(ctx){
 const {env,request,path,url}=ctx;
 if(request.method!=='POST'||env.__gldGuideActor132||!env.GLD_PUBLIC_CACHE)return null;
 const admin=path.match(/^\/superadmin\/advertisers\/([^/]+)\/(save|commercial|profile|sedes\/relations)$/);
 if(!admin&&path!=='/commerce')return null;
 const body=await request.clone().json().catch(()=>({}));
 if(!admin&&!['save_ficha','set_datos','set_sedes','set_relaciones_sede','delete_sede'].includes(actionOf4(url,body)))return null;
 const aid=admin?decodeURIComponent(admin[1]):aidOf4(url,body);
 if(!aid)throw httpError('Falta el anunciante.',400);
 if(admin){const auth=await verifyAdmin(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);if(!isTopAdmin(auth))throw httpError('No tenés permiso para modificar esta ficha.',403);}
 else{const auth=await requirePanel4(env,request,aid,true);if(auth.response)return auth.response;}
 const actor=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('guide-save-v132:'+aid));
 const response=await actor.fetch(new Request('https://guide-write.internal/',{method:'POST',body:JSON.stringify({op:'guide-save132',aid,url:request.url,headers:[...request.headers].filter(([key])=>!['host','content-length'].includes(key.toLowerCase())),body})}));
 const renewal=SESSION_RENEWALS_V87.get(request);
 if(!renewal||response.headers.has('X-GLD-Session-Token'))return response;
 const headers=new Headers(response.headers);headers.set('X-GLD-Session-Token',renewal.token);headers.set('X-GLD-Session-Kind',renewal.kind);headers.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function guideJournalDb132(db,env){
 const actor=env.__gldGuideActor132;
 if(!actor)return db;
 const begin=entries=>actor.beginGuide132(entries.filter(e=>GUIDE_SOURCE132.has(e.collection)));
 return {...db,
  async commitPatches(entries){await begin(entries);return db.commitPatches(entries);},
  async patch(collection,id,patch,options={}){const before=GUIDE_SOURCE132.has(collection)&&!options.mustNotExist?(await db.getVersioned(collection,id)).doc:null;await begin([{collection,id,patch,before}]);return db.patch(collection,id,patch,options);},
  async delete(collection,id,options={}){const before=GUIDE_SOURCE132.has(collection)?(await db.getVersioned(collection,id)).doc:null;await begin([{collection,id,remove:true,before}]);return db.delete(collection,id,options);}
 };
}
GldPublicCache119.prototype.guideJob132=async function(){
 if(this.guidePending132===undefined){this.guideState132=await this.state.storage.get('guide-intent-v132')||{pending:null,receipts:[]};this.guidePending132=this.guideState132.pending||null;}
 return this.guidePending132;
};
GldPublicCache119.prototype.beginGuide132=async function(entries){
 if(!entries.length)return;
 const job=await this.guideJob132()||{aid:this.guideAid132,operation_id:this.guideOperation132||'',references:[],attempts:0};
 if(!job.aid)throw Error('Falta contexto de recuperación de Guía.');
 for(const e of entries){
  const existing=job.references.find(x=>x.collection===e.collection&&x.id===String(e.id));
  const expectedKeys=Object.keys(e.patch||{}),expectation=e.remove?{removed:true}:{keys:expectedKeys,hash:await fieldRevisionInternal(e.patch||{},expectedKeys)};
  if(existing){existing.checks.push(expectation);continue;}
  const before=e.before||{};
  const fields=['anunciante_id','estado_moderacion','revision_adulto','aprobado','ciudad_id'];
  job.references.push({collection:e.collection,id:String(e.id),checks:[expectation],before:Object.fromEntries(fields.filter(k=>before[k]!==undefined).map(k=>[k,before[k]]))});
 }
 // No intervening await: SQLite Durable Object storage coalesces these writes
 // atomically. Both complete before Firestore receives any mutation.
 this.guideState132.pending=job;
 while(this.guideState132.receipts.length&&new TextEncoder().encode(JSON.stringify(this.guideState132)).length>120000)this.guideState132.receipts.shift();
 if(new TextEncoder().encode(JSON.stringify(this.guideState132)).length>120000)throw httpError('La ficha tiene demasiados cambios juntos. Guardá menos sedes por vez.',400);
 const saved=this.state.storage.put('guide-intent-v132',this.guideState132);
 const alarm=this.state.storage.setAlarm(Date.now()+60000);
 await Promise.all([saved,alarm]);this.guidePending132=job;
};
GldPublicCache119.prototype.finishGuide132=async function(applied=true){
 const job=await this.guideJob132();
 let receipts=(this.guideState132.receipts||[]).filter(x=>Date.now()-x.at<86400000&&x.operation_id!==job?.operation_id);
 if(job?.operation_id)receipts.push({operation_id:job.operation_id,applied,at:Date.now(),references:job.references.map(x=>({collection:x.collection,id:x.id}))});
 while(receipts.length>1&&(receipts.length>20||new TextEncoder().encode(JSON.stringify(receipts)).length>48000))receipts.shift();
 this.guideState132={pending:null,receipts};
 const removed=this.state.storage.put('guide-intent-v132',this.guideState132);
 const cancelled=this.state.storage.deleteAlarm();
 await Promise.all([removed,cancelled]);this.guidePending132=null;
};
GldPublicCache119.prototype.replayGuide132=async function(receipt,aid){
 if(receipt.applied===false)return json({success:false,code:'GUIDE_OPERATION_REVIEW',message:'No se confirmó ese guardado. Volvé a abrir la ficha para revisar los datos antes de intentarlo otra vez.'},409);
 const report={event:'gld_guide_replay',worker_version:'135',started_at:new Date().toISOString(),status:500,request_id:crypto.randomUUID(),method:'REPLAY',path:'/internal/guide/replay',operations:{}};
 const db=observeDbV41(createDb(this.env),report);
 try{
  const datos=await db.get('anunciantes',aid),sedes=[];
  for(const ref of receipt.references)if(ref.collection==='anunciantes_sedes'){const row=await db.get(ref.collection,ref.id);if(row&&String(row.anunciante_id)===aid)sedes.push(row);}
  report.status=200;
  return json({success:true,updated:true,operation_recovered:true,datos,sedes,revision_datos:await wholeRevisionInternal(datos),revision_sedes:Object.fromEntries(await Promise.all(sedes.map(async row=>[String(row.sede_id||row.id),await wholeRevisionInternal(row)]))),firestore_writes:0});
 }finally{console.log(JSON.stringify(finishObservationV42(report)));}
};
GldPublicCache119.prototype.repairGuide132=async function(){
 const job=await this.guideJob132();if(!job)return;
 const report={event:'gld_guide_recovery',worker_version:'135',started_at:new Date().toISOString(),status:500,request_id:crypto.randomUUID(),method:'ALARM',path:'/internal/guide/recover',operations:{}};
 const env=coordinatedCities119(requestCache121(observeKv117(this.env,report),report),report);
 const source=requestDb119(observeDbV41(createDb(env),report),report);
 const db=withPanelCacheV48(withPrivateCacheV46(source,env),env,report),cache=createCache(env);
 try{
  const refs=new Map(job.references.map(ref=>[ref.collection+'/'+ref.id,ref]));
  for(const c of ['anunciantes','anunciantes_administracion'])if(!refs.has(c+'/'+job.aid))refs.set(c+'/'+job.aid,{collection:c,id:job.aid,before:{}});
  let sourceMatches132=true;
  for(const ref of refs.values()){
   const row=await source.get(ref.collection,ref.id);
   for(const check of ref.checks||[])if(check.removed?!!row:!row||await fieldRevisionInternal(row,check.keys)!==check.hash)sourceMatches132=false;
   await db.repairPrivateGuide132(ref.collection,ref.id,row);
   db.repairPanelGuide132(ref.collection,ref.id,ref.before,row);
  }
  await syncGuideAdvertiserV2({db:source,cache,advertiserId:job.aid});
  await syncAdvertiserIndexV2({db:source,cache,advertiserId:job.aid});
  await db.flushLoginCache();
  await this.finishGuide132(sourceMatches132);report.status=200;
 }finally{delete report.source_versions119;delete report.source_parents119;console.log(JSON.stringify(finishObservationV42(report)));}
};
GldPublicCache119.prototype.guideSave132=async function(body){
 try{await this.repairGuide132();}catch(error){return json({success:false,message:'No se pudo terminar de sincronizar la ficha. La recuperación sigue programada; no repitas el cambio anterior.',code:'GUIDE_SYNC_PENDING'},503);}
 this.guideAid132=String(body.aid);
 this.guideOperation132=/^[a-f0-9-]{36}$/i.test(String(body.body.operation_id||''))?body.body.operation_id:'';
 const receipt=(this.guideState132.receipts||[]).find(x=>x.operation_id===this.guideOperation132&&Date.now()-x.at<86400000);
 if(receipt&&this.guideOperation132&&new URL(body.url).pathname==='/commerce')return this.replayGuide132(receipt,this.guideAid132);
 const env=new Proxy(this.env,{get:(target,key)=>key==='__gldGuideActor132'?this:Reflect.get(target,key,target)});
 const response=await app_main_v35_default.fetch(new Request(body.url,{method:'POST',headers:body.headers,body:JSON.stringify(body.body)}),env);
 if(await this.guideJob132()){
  if(response.ok){try{await this.finishGuide132();return response;}catch(error){return json({success:false,operation_unconfirmed:true,code:'GUIDE_SYNC_PENDING',message:'El cambio se guardó, pero falta confirmar la sincronización. No lo repitas: la recuperación automática verificará la ficha.'},503);}}
  if(response.status>=500){
   const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');
   return new Response(JSON.stringify({success:false,operation_unconfirmed:true,code:'GUIDE_SYNC_PENDING',message:'La respuesta del guardado no quedó confirmada. No repitas el cambio: la recuperación automática comprobará los datos guardados y actualizará la ficha.'}),{status:503,headers});
  }
 }
 return response;
};
GldPublicCache119.prototype.alarm=async function(){
 const previous=this.requestTail127||Promise.resolve();let release=()=>{};
 this.requestTail127=new Promise(resolve=>{release=()=>resolve(undefined);});await previous;
 try{await this.repairGuide132();}
 catch(error){
  const job=await this.guideJob132();if(!job)throw error;
  job.attempts=(job.attempts||0)+1;
  this.guideState132.pending=job;
  await this.state.storage.put('guide-intent-v132',this.guideState132);
  await this.state.storage.setAlarm(Date.now()+Math.min(3600000,60000*2**Math.min(job.attempts,6)));
  console.error('gld_guide_recovery_retry',String(error?.message||error));
 }finally{release();}
};


var app_main_v35_default = {
  async fetch(request,env){
    const report={event:'gld_firestore_observation',worker_version:'135',started_at:new Date().toISOString(),status:500,request_id:crypto.randomUUID(),method:request.method,path:observationPathV41(clean(new URL(request.url).pathname)),operations:{}};
    env=coordinatedCities119(requestCache121(observeKv117(env,report),report,request.method==="GET"),report);
    let db,cacheFlushed=false;
    const traced=async (/** @type {Response} */ response)=>{
      if(db&&db.flushLoginCache&&!cacheFlushed){cacheFlushed=true;await db.flushLoginCache();}
      report.status=response.status;
      const headers=new Headers(response.headers);
      const renewal=SESSION_RENEWALS_V87.get(request);
      if(renewal){headers.set('X-GLD-Session-Token',renewal.token);headers.set('X-GLD-Session-Kind',renewal.kind);headers.set('Cache-Control','no-store');}
      headers.set('X-GLD-Request-Id',report.request_id);
      const {totals}=finishObservationV42(report);
      headers.set('X-GLD-Worker-Version',report.worker_version);
      headers.set('X-GLD-Read-Calls',String(totals.read_calls));
      headers.set('X-GLD-Documents-Returned',String(totals.documents_returned));
      headers.set('X-GLD-Write-Calls',String(totals.write_calls));
      headers.set('X-GLD-Delete-Calls',String(totals.delete_calls));
      headers.set('X-GLD-Source',report.source||'worker');
      headers.set('X-GLD-Action',report.action||'');
      headers.set('X-GLD-Operations',encodeURIComponent(JSON.stringify(Object.values(report.operations))));
      headers.set('X-GLD-Cache-Checks',encodeURIComponent(JSON.stringify(report.cache_checks||[])));
      headers.set('X-GLD-Public-Blocked',String(report.public_blocked||0));
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    };
    try{
      if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
      const url=new URL(request.url),path=clean(url.pathname);
      db=withPanelCacheV48(withAuthCacheV58(withPrivateCacheV46(requestDb119(observeDbV41(createDb(env),report),report),env),env),env,report);
      db=guideJournalDb132(db,env);
      const cache=createCache(env);
      const action=await observationActionV43(request,url);
      if(action)report.action=action;
      cache.ensureGuideBaseInternal=aid=>ensureGuideBaseFromPrivateInternal({db,cache,advertiserId:aid});
      const ctx={path,request,url,env,db,cache};
      const guideDispatch=await routeGuideDispatch132(ctx);if(guideDispatch){report.event='gld_guide_dispatch';report.source='guide-dispatch';report.status=guideDispatch.status;return guideDispatch;}
      const atomicAdvertiser=await routeAtomicAdvertiserInternal(ctx);if(atomicAdvertiser)return await traced(atomicAdvertiser);
      await preparePublicationV77(ctx);

      if(path==="/")return await traced(json({success:true,app:"Guía Local reconstrucción modular",version:"135"}));

      const sharedDiagnostic=await routeDiagnosticShareV90(ctx);if(sharedDiagnostic){report.source="diagnostics-kv";return await traced(sharedDiagnostic);}
      const diagnostics=await routeDiagnosticsV87(ctx);if(diagnostics)return await traced(diagnostics);
      const subscriberTerritory=await routeSubscriberTerritoryV84(ctx);if(subscriberTerritory)return await traced(subscriberTerritory);
      const employment109=await routeEmpleo109(ctx);if(employment109)return await traced(employment109);
      const directory102=await routeDirectories102(ctx);if(directory102)return await traced(directory102);
      const notifications102=await routeNotifications102(ctx);if(notifications102)return await traced(notifications102);
      const publicityAdmin=await routeAdminPublicityV101(ctx);if(publicityAdmin)return await traced(publicityAdmin);
      const promosAdmin=await routeAdminPromosV91(ctx);if(promosAdmin)return await traced(promosAdmin);
      const calendar=await routeCalendarV83(ctx);if(calendar)return await traced(calendar);
      const terms=await routeAdvertiserTermsV80(ctx);if(terms)return await traced(terms);
      const publications=await routePublicationsV77(ctx);if(publications)return await traced(publications);
      const conversation=await routeSupportConversationV74(ctx);if(conversation)return await traced(conversation);
      const support=await routeSupportV73(ctx);if(support)return await traced(support);
      const adult=await routeAdult(ctx);if(adult)return await traced(adult);
      const pub=await routePublicV12({...ctx,db:publicDbGuardV44(report)});if(pub){report.source='public-kv';return await traced(await adultPublicResponse(pub,env,request));}
      const panel=await routePanelV15(ctx);if(panel)return await traced(panel);
      const panelPreparation=await routePanelPreparation116(ctx);if(panelPreparation)return await traced(panelPreparation);
      const moderators=await routeModeratorsV72(ctx);if(moderators)return await traced(moderators);
      const admin=await routeAdminV11(ctx);if(admin)return await traced(admin);

      return await traced(json({success:false,message:"Ruta no encontrada"},404));
    }catch(err){
      return await traced(json({success:false,message:String(err&&err.message?err.message:err),...(err?.code?{code:err.code}:{})},[400,401,403,409,412,503].includes(err?.status)?err.status:500));
    }finally{
      delete report.source_versions119;delete report.source_parents119;
      if(request.method!=="OPTIONS")console.log(JSON.stringify(finishObservationV42(report)));
    }
  }
};
export {app_main_v35_default as default,GldPublicCache119};


