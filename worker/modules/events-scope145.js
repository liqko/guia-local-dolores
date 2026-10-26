// Distribution is independent from the event's physical/virtual location.
var GLD_EVENTS145=(()=>{
 const text=v=>String(v??'').trim();
 const virtual=row=>text(row?.ciudad_id)==='VIRTUAL'||text(row?.modalidad).toUpperCase()==='VIRTUAL';
 const hasVirtual=row=>virtual(row)||(row?.programacion||[]).some(virtual);
 const revision=row=>fieldRevisionInternal(row,Object.keys(row||{}).filter(k=>!['id','__id','_version','revision_evento145'].includes(k)));
 async function result(row,programacion=row?.programacion||[]){return {...row,programacion,revision_evento145:await revision(row)};}
 function geo(territory,city){
  const row=(territory?.ciudades||[]).find(c=>text(c.ciudad_id||c.id)===text(city));
  if(!row)return null;
  const province=(territory.provincias||[]).find(p=>text(p.provincia_id||p.id)===text(row.provincia_id));
  return {...row,pais_id:text(row.pais_id||province?.pais_id)};
 }
 async function scope({db,cache,advertiserId,data,current=null,advertiser=null}){
  if(!hasVirtual(data))return;
  let raw=data.alcance_publicacion;
  if(!raw){
   // Keep the distribution of existing records until their owner changes it.
   if(current){if(current.alcance_publicacion)data.alcance_publicacion=current.alcance_publicacion;return;}
   advertiser ||= await db.get('anunciantes',advertiserId);
   raw={modo:'CIUDAD',ciudad_id:text(advertiser?.ciudad_id||advertiser?.ciudad_ids?.[0])};
  }
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw httpError('Elegí dónde mostrar el evento virtual.',400);
  const modo=text(raw.modo).toUpperCase();
  if(!['CIUDAD','CIUDADES','PROVINCIA','PAIS','TODAS'].includes(modo))throw httpError('Alcance de publicación inválido.',400);
  if(modo==='TODAS'){data.alcance_publicacion={version:1,modo};return;}
  const territory=await cache.get('territorio:public:v1');
  if(!territory)throw httpError('El catálogo de ciudades no está disponible. No se guardó el evento.',503);
  const provinces=new Map((territory.provincias||[]).map(p=>[text(p.provincia_id||p.id),p]));
  const places=(territory.ciudades||[]).map(c=>({...c,pais_id:text(c.pais_id||provinces.get(text(c.provincia_id))?.pais_id)}));
  const cityIndex=new Set(places.map(c=>text(c.ciudad_id||c.id)));
  const next={version:1,modo};
  if(modo==='CIUDAD'||modo==='CIUDADES'){
   const cities=[...new Set((modo==='CIUDAD'?[raw.ciudad_id]:Array.isArray(raw.ciudades)?raw.ciudades:[]).map(text).filter(Boolean))].sort();
   if(!cities.length||cities.length>500||cities.some(c=>c==='VIRTUAL'||!cityIndex.has(c)))throw httpError('Elegí entre 1 y 500 ciudades válidas para publicar.',400);
   if(modo==='CIUDAD')next.ciudad_id=cities[0];else next.ciudades=cities;
  }else if(modo==='PROVINCIA'){
   const province=text(raw.provincia_id),country=text(raw.pais_id);
   if(!province||!country||!places.some(c=>text(c.provincia_id)===province&&text(c.pais_id)===country))throw httpError('Elegí una provincia válida y su país.',400);
   next.provincia_id=province;next.pais_id=country;
  }else{
   const country=text(raw.pais_id);
   if(!country||!places.some(c=>text(c.pais_id)===country))throw httpError('Elegí un país con ciudades disponibles.',400);
   next.pais_id=country;
  }
  data.alcance_publicacion=next;
 }
 function matches(row,city,place){
  if(text(row?.ciudad_id)!=='VIRTUAL')return true;
  const scope=row.alcance_publicacion;
  if(!scope)return true; // Legacy global publication, never silently migrated.
  if(scope.modo==='TODAS')return true;
  if(scope.modo==='CIUDAD')return text(scope.ciudad_id)===city;
  if(scope.modo==='CIUDADES')return Array.isArray(scope.ciudades)&&scope.ciudades.includes(city);
  if(scope.modo==='PAIS')return !!place&&text(scope.pais_id)===text(place.pais_id);
  if(scope.modo==='PROVINCIA')return !!place&&text(scope.pais_id)===text(place.pais_id)&&text(scope.provincia_id)===text(place.provincia_id);
  return false;
 }
 async function publicRows(rows,city,cache){
  const needsGeo=rows.some(r=>text(r.ciudad_id)==='VIRTUAL'&&['PROVINCIA','PAIS'].includes(r.alcance_publicacion?.modo));
  // At most one already-prepared territory packet, no Firestore and no fan-out.
  const territory=needsGeo?await cache.get('territorio:public:v1'):null;
  if(needsGeo&&!territory)throw httpError('No se puede verificar el alcance de los eventos. Reintentá más tarde.',503);
  const place=needsGeo?geo(territory,city):null;
  return rows.filter(row=>matches(row,city,place));
 }
 async function dispatch(ctx){
  const {request,path,url,env,db}=ctx;
  if(request.method!=='POST')return null;
  const owner=path==='/events-new';
  const moderation=['/superadmin/moderation/events/resolve','/superadmin/moderation/resolve'].includes(path);
  if(!owner&&!moderation)return null;
  const body=await GLD_ACTIONS138.readJson(request);
  if(path==='/superadmin/moderation/resolve'&&text(body.tipo).toUpperCase()!=='EVENTO')return null;
  const action=text(body.action||body.accion||body.decision).toLowerCase();
  if(owner&&!['createfreeevent','updatefreeevent','pausefreeevent','deletefreeevent','createvipevent','updatevipevent','pausevipevent','deletevipevent','duplicatevipevent','duplicate'].includes(action))return null;
  let aid,identity;
  if(owner){
   aid=aidOf4(url,body);if(!aid)return null;
   const auth=await requirePanel(env,request,aid,action.includes('free')?'eventos_free':'eventos',true);
   if(auth.response)return auth.response;identity={kind:'subscriber',value:auth.session};
  }else{
   const auth=await verifyAdmin(env,request);if(!auth.ok)return json({success:false,message:auth.message},401);if(!canModerate2(auth))return json({success:false,message:'No tenés permiso para moderar eventos.'},403);
   const row=await db.get('eventos',text(body.evento_id||body.id));if(!row)return null;
   assertModeratorV72(auth,'EVENTO');assertAdminCityV71(auth,row);
   if(auth.rol==='ADMIN_LOCAL')for(const part of await getPreparedRelationsV1({cache:ctx.cache,type:'event',id:text(row.evento_id||row.id),current:row,load:()=>db.queryEqual('evento_programacion','evento_id',text(row.evento_id||row.id),500)}))assertAdminCityV71(auth,{...part,ciudad_id:part.ciudad_id||row.ciudad_id});
   aid=text(row.anunciante_id||row.id_anunciante);if(!aid)return null;identity={kind:'admin',value:auth};
  }
  const actor=env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName('guide-save-v132:'+aid));
  const validId=v=>/^[a-f0-9-]{36}$/i.test(text(v))?text(v):'';
  const command={op:'business-save143',origin_request_id:ctx.request_id143,aid,url:request.url,headers:[...request.headers].filter(([k])=>!['host','content-length'].includes(k.toLowerCase())),body,action,identity,kind:'eventos',publishRecent:owner&&['createfreeevent','updatefreeevent','createvipevent','updatevipevent'].includes(action),key:validId(body.operation_id)||validId(body.request_key)||validId(request.headers.get('Idempotency-Key'))};
  const response=await actor.fetch(new Request('https://business.internal/',{method:'POST',body:JSON.stringify(command)}));
  const renewal=SESSION_RENEWALS_V87.get(request);if(!renewal||response.headers.has('X-GLD-Session-Token'))return response;
  const headers=new Headers(response.headers);headers.set('X-GLD-Session-Token',renewal.token);headers.set('X-GLD-Session-Kind',renewal.kind);headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,headers});
 }
 async function repair({job,source,cache,db}){
  const ids=new Set(job.refs.filter(r=>r.collection==='eventos').map(r=>r.id));
  for(const ref of job.refs.filter(r=>r.collection==='evento_programacion')){
   const row=await source.get('evento_programacion',ref.id);const id=text(row?.evento_id||ref.before?.evento_id);if(id)ids.add(id);
  }
  for(const id of ids){
   const ref=job.refs.find(r=>r.collection==='eventos'&&r.id===id),current=ref?.before||{evento_id:id};
   const stored=await source.get('eventos',id),row=stored&&!stored.eliminado?stored:null;
   const programacion=row?await getPreparedRelationsV1({cache,type:'event',id,current:row,load:()=>source.queryEqual('evento_programacion','evento_id',id,500)}):[];
   await syncEventV2({db:source,cache,current,next:row,previousProgramacion:current.programacion||[],programacion});
   if(row&&job.publishRecent){
    const latest='publication:recent:latest:v77:eventos:'+id;
    if(row.estado_moderacion==='PUBLICADO'&&!row.contenido_adulto){
     const date=row.actualizado||row.fecha_carga;
     const item={collection:'eventos',id,nombre:row.nombre_evento||id,ciudad_id:row.ciudad_id||'',ciudades:[...new Set([row.ciudad_id,...programacion.map(p=>p.ciudad_id)].filter(Boolean))],anunciante_id:job.aid,fecha:date,publicacion:row};
     for(const key of ['publication:recent:v77:'+date.slice(0,10)+':eventos:'+id,latest])if(!GLD_BUSINESS143.equal(await cache.get(key),item))await cache.put(key,item,{expirationTtl:11*86400});
    }else{const item={retirado:true,collection:'eventos',id};if(!GLD_BUSINESS143.equal(await cache.get(latest),item))await cache.put(latest,item,{expirationTtl:11*86400});}
   }
  }
  if(ids.size&&source.invalidatePendingEvents126)await source.invalidatePendingEvents126();
 }
 return {scope,publicRows,matches,geo,hasVirtual,dispatch,repair,revision,result};
})();
