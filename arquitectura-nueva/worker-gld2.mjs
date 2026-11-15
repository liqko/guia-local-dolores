/* Guía Local 2 — arquitectura transversal, aislada de producción.
   Adaptador Cloudflare D1 y KV. Tres planos, un único modelo de entidades y permisos.
   Instalar requiere bindings GLD2_DB y GLD2_PUBLIC; nunca usa bindings viejos.
   Las consultas de seguridad van a D1 sin cache; una revocación afecta próximas acciones.
   Medición por acción: counters D1 desde meta, KV contado, requests/bytes; CPU, GB-segundos,
   red del proveedor y almacenamiento facturable se declaran desconocidos, NO cero.
*/
const U=['worker_requests','kv_reads','kv_writes','kv_deletes','d1_queries','d1_rows_read','d1_rows_written','identity_requests','bytes_request','bytes_response'];
const unknownProvider=['worker_cpu_ms','billable_egress_gb','d1_storage_gb_month','kv_storage_gb_month','identity_service_cost'];
const json=v=>JSON.stringify(v);
const parse=s=>{try{return JSON.parse(s)}catch{return null}};
const enc=new TextEncoder();
const validId=v=>typeof v==='string'&&/^[\w:-]{1,120}$/.test(v);
function meter(action,env){
 const units=Object.fromEntries(U.map(k=>[k,0]));units.worker_requests=1;
 const rates=parse(env.GLD2_RATES_USD||'{}')||{};
 const limits=parse(env.GLD2_QUOTAS||'{}')||{};
 const absent=new Set();
 const db=env.GLD2_DB;
 const kv=env.GLD2_PUBLIC;
 function capture(result){
  for(const [unit,field] of [['d1_rows_read','rows_read'],['d1_rows_written','rows_written']]){
   if(Number.isFinite(result?.meta?.[field]))units[unit]+=result.meta[field];
   else absent.add(unit);
  }
  return result;
 }
 async function query(sql,...args){
  units.d1_queries++;
  return capture(await db.prepare(sql).bind(...args).all());
 }
 async function one(sql,...args){const r=await query(sql,...args);return r.results?.[0]??null;}
 async function write(sql,...args){return query(sql,...args);}
 async function batch(statements){
  units.d1_queries+=statements.length;
  const results=await db.batch(statements);
  for(const result of results)capture(result);
  return results;
 }
 const cache={
  async get(key){units.kv_reads++;return kv.get(key,'json')},
  async put(key,val){units.kv_writes++;return kv.put(key,json(val))},
  async delete(key){units.kv_deletes++;return kv.delete(key)}
 };
 function snapshot(){
  const missing=[...new Set([...unknownProvider,...absent,...U.filter(k=>!Number.isFinite(rates[k]))])];
  const priced=U.filter(k=>Number.isFinite(rates[k]));
  const knownUSD=priced.reduce((sum,k)=>sum+units[k]*rates[k],0);
  const quotaShare=Object.fromEntries(U.filter(k=>Number.isFinite(limits[k])&&limits[k]>0)
   .map(k=>[k,{limit:limits[k],actionPercent:100*units[k]/limits[k]}]));
  return {action,units:{...units},knownUSD,complete:missing.length===0,missing,quotaShare,
    mode:'INSTRUMENTED_OPERATIONS',note:'Costo y cuota por acción; componentes faltantes no se consideran cero'};
 }
 return {query,one,write,batch,cache,units,snapshot};
}
function headers(request,env){
 const origin=request.headers.get('origin')||'';
 const allowed=env.GLD2_ORIGIN||'';
 return {'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'vary':'Origin',...(allowed&&allowed===origin?{'access-control-allow-origin':origin,
  'access-control-allow-headers':'authorization,content-type',
  'access-control-allow-methods':'GET,POST,OPTIONS'}:{})};
}
function send(request,env,m,data,status=200){
 // Count bytes of server response; response size counts telemetry as response overhead.
 const result={...data,consumption:m.snapshot()};
 let body=json(result);
 // Se contabiliza la respuesta completa incluyendo telemetría.
 for(let i=0;i<6;i++){
  const bytes=enc.encode(body).byteLength;
  if(m.units.bytes_response===bytes)break;
  m.units.bytes_response=bytes;result.consumption=m.snapshot();body=json(result);
 }
 return new Response(body,{status,headers:headers(request,env)});
}
function fail(message,status=400){const error=new Error(message);error.status=status;throw error}
function claims(request,env){
 const header=request.headers.get('authorization')||'';
 const token=header.startsWith('Bearer ')?header.slice(7):'';
 // Validation delegated to trusted identity provider: no custom JWT parsing or client role claims.
 if(!token)return null;
 return token;
}
async function authorized(m,request,env){
 const token=claims(request,env);if(!token)fail('Sesión requerida',401);
 if(!env.GLD2_IDENTITY || typeof env.GLD2_IDENTITY.fetch!=='function')
  fail('Proveedor de identidad no configurado',503);
 // Every authenticated operation checks server side revocation.
 m.units.identity_requests++;
 const verification=await env.GLD2_IDENTITY.fetch('https://identity.internal/verify',{
  method:'POST',headers:{authorization:'Bearer '+token}});
 if(!verification.ok)fail('Sesión inválida o revocada',401);
 const p=await verification.json();
 if(!validId(p?.principal_id))fail('Identidad inválida',401);
 return p.principal_id;
}
async function allowed(m,who,entity,permission){
 const isAdmin=await m.one('SELECT 1 AS ok FROM gld2_roles WHERE principal_id=? AND role=? AND active=1',who,'GRAN_HERMANO');
 if(isAdmin)return true;
 const owner=await m.one('SELECT 1 AS ok FROM gld2_entities WHERE id=? AND owner_id=? AND removed=0',entity,who);
 if(owner)return true;
 const grant=await m.one('SELECT 1 AS ok FROM gld2_grants WHERE principal_id=? AND entity_id=? AND permission=? AND active=1',who,entity,permission);
 return !!grant;
}
async function route(request,env,m,url){
 if(url.pathname==='/gld2/health')return {service:'GLD2',state:'development',bindings:!!env.GLD2_DB&&!!env.GLD2_PUBLIC};
 if(!env.GLD2_DB||!env.GLD2_PUBLIC)fail('Almacenamiento GLD2 sin configurar',503);
 const path=url.pathname,method=request.method;
 if(method==='GET'&&path==='/gld2/city'){
  const city=url.searchParams.get('city'),kind=url.searchParams.get('kind');
  if(!validId(city)||!['guide','event','activity','promotion','advertising'].includes(kind))fail('Solicitud inválida');
  const rev=await m.one('SELECT revision FROM gld2_revisions WHERE city=? AND kind=?',city,kind);
  if(!rev)return {city,kind,revision:0,items:[]};
  const key='city:'+city+':'+kind+':'+rev.revision;
  let packet=await m.cache.get(key);
  if(!packet){
   const result=await m.query('SELECT id,public_json,revision FROM gld2_entities WHERE city=? AND kind=? AND published=1 AND removed=0 ORDER BY id LIMIT 5000',city,kind);
   packet={city,kind,revision:rev.revision,items:result.results.map(r=>({id:r.id,...(parse(r.public_json)||{}),revision:r.revision}))};
   await m.cache.put(key,packet);
  }
  return packet;
 }
 const who=await authorized(m,request,env);
 if(method==='GET'&&path==='/gld2/session'){
  const roles=await m.query('SELECT role FROM gld2_roles WHERE principal_id=? AND active=1',who);
  const count=await m.one('SELECT count(*) as n FROM gld2_entities e LEFT JOIN gld2_grants g ON g.entity_id=e.id AND g.principal_id=? AND g.active=1 WHERE e.removed=0 AND (e.owner_id=? OR g.principal_id IS NOT NULL)',who,who);
  return {principal_id:who,roles:roles.results.map(r=>r.role),managed_count:count?.n||0};
 }
 if(method==='GET'&&path==='/gld2/managed'){
  const limit=Math.max(1,Math.min(50,Number(url.searchParams.get('limit'))||25));
  const after=url.searchParams.get('after')||'';
  const list=await m.query('SELECT e.id,e.kind,e.city,e.revision FROM gld2_entities e LEFT JOIN gld2_grants g ON g.entity_id=e.id AND g.principal_id=? AND g.active=1 WHERE e.removed=0 AND e.id>? AND (e.owner_id=? OR g.principal_id IS NOT NULL OR EXISTS (SELECT 1 FROM gld2_roles r WHERE r.principal_id=? AND r.role=? AND r.active=1)) GROUP BY e.id ORDER BY e.id LIMIT ?',who,after,who,who,'GRAN_HERMANO',limit);
  return {items:list.results,next:list.results.length===limit?list.results.at(-1).id:null};
 }
 if(method==='GET'&&path==='/gld2/detail'){
  const id=url.searchParams.get('id');
  if(!validId(id))fail('ID inválido');
  if(!await allowed(m,who,id,'READ'))fail('Sin permiso',403);
  const entity=await m.one('SELECT id,kind,city,owner_id,revision,public_json,data_json FROM gld2_entities WHERE id=? AND removed=0',id);
  if(!entity)fail('Registro inexistente',404);
  const {data_json,public_json,...fields}=entity;
  return {...fields,public_data:parse(public_json)||{},private_data:parse(data_json)||{}};
 }
 if(method==='POST'&&path==='/gld2/create'){
  const body=await request.json();
  const {id,kind,city,public_data={},private_data={}}=body||{};
  if(!validId(id)||!validId(city)||!['guide','event','activity','promotion','advertising'].includes(kind)||
     !public_data||typeof public_data!=='object'||Array.isArray(public_data)||
     !private_data||typeof private_data!=='object'||Array.isArray(private_data))fail('Datos de publicación inválidos');
  const save=await m.write('INSERT OR IGNORE INTO gld2_entities(id,kind,city,owner_id,revision,published,removed,public_json,data_json) VALUES(?,?,?,?,1,0,0,?,?)',
    id,kind,city,who,json(public_data),json(private_data));
  if(save.meta?.changes!==1)fail('Ya existe ese identificador',409);
  return {id,kind,city,revision:1,published:false};
 }
 if(method==='POST'&&path==='/gld2/publish'){
  const body=await request.json();
  const {id,expected_revision,published}=body||{};
  if(!validId(id)||!Number.isSafeInteger(expected_revision)||expected_revision<1||typeof published!=='boolean')
   fail('Estado de publicación inválido');
  // Publicación moderada: sólo un administrador autorizado, nunca un permiso delegado.
  const admin=await m.one('SELECT 1 AS ok FROM gld2_roles WHERE principal_id=? AND role=? AND active=1',who,'GRAN_HERMANO');
  if(!admin)fail('Sólo Gran Hermano puede publicar en esta primera implementación',403);
  const entity=await m.one('SELECT city,kind FROM gld2_entities WHERE id=? AND removed=0',id);
  if(!entity)fail('Registro inexistente',404);
  const result=await m.batch([
   env.GLD2_DB.prepare(`UPDATE gld2_entities SET revision=revision+1,published=?
     WHERE id=? AND revision=? AND EXISTS
      (SELECT 1 FROM gld2_roles WHERE principal_id=? AND role='GRAN_HERMANO' AND active=1)`)
      .bind(published?1:0,id,expected_revision,who),
   env.GLD2_DB.prepare(`INSERT INTO gld2_revisions(city,kind,revision)
     SELECT ?,?,1 WHERE changes()=1
     ON CONFLICT(city,kind) DO UPDATE SET revision=revision+1`).bind(entity.city,entity.kind)]);
  if(result[0]?.meta?.changes!==1)fail('La revisión o los permisos cambiaron',409);
  return {id,revision:expected_revision+1,published};
 }
 if(method==='POST'&&path==='/gld2/update'){
  const body=await request.json();
  const {id,expected_revision,public_data,private_data}=body||{};
  if(!validId(id)||!Number.isSafeInteger(expected_revision)||expected_revision<1||
    (public_data===undefined&&private_data===undefined))fail('Edición inválida');
  if(!await allowed(m,who,id,'WRITE'))fail('Sin permiso',403);
  const e=await m.one('SELECT id,city,kind,revision,public_json,data_json FROM gld2_entities WHERE id=? AND removed=0',id);
  if(!e)fail('Registro inexistente',404);
  if(e.revision!==expected_revision)fail('Registro modificado por otra sesión',409);
  const newPublic=public_data===undefined?e.public_json:json(public_data);
  const newPrivate=private_data===undefined?e.data_json:json(private_data);
  // The transaction guarantees an atomic entity + publication revision. No KV invalidation required:
  // publication keys are immutable and versioned.
  // Revalidación de permiso DENTRO de la escritura atómica.
  const rs=await m.batch([
   env.GLD2_DB.prepare(`UPDATE gld2_entities SET revision=revision+1,public_json=?,data_json=?
     WHERE id=? AND revision=? AND
       (owner_id=? OR EXISTS(SELECT 1 FROM gld2_roles WHERE principal_id=? AND role='GRAN_HERMANO' AND active=1)
         OR EXISTS(SELECT 1 FROM gld2_grants WHERE entity_id=? AND principal_id=? AND permission='WRITE' AND active=1))`
   ).bind(newPublic,newPrivate,id,expected_revision,who,who,id,who),
   env.GLD2_DB.prepare(`INSERT INTO gld2_revisions(city,kind,revision)
     SELECT ?,?,1 WHERE changes()=1
     ON CONFLICT(city,kind) DO UPDATE SET revision=revision+1`).bind(e.city,e.kind)]);
  if(rs[0]?.meta?.changes!==1)fail('Revisión o permiso cambiado; no se guardó',409);
  return {id,revision:expected_revision+1};
 }
 if(method==='POST'&&path==='/gld2/grant'){
  const body=await request.json();const {entity_id,principal_id,permission,active}=body||{};
  if(!validId(entity_id)||!validId(principal_id)||!['READ','WRITE'].includes(permission)||typeof active!=='boolean')fail('Permiso inválido');
  const e=await m.one('SELECT owner_id FROM gld2_entities WHERE id=? AND removed=0',entity_id);
  if(!e)fail('Registro inexistente',404);
  const admin=await m.one('SELECT 1 AS ok FROM gld2_roles WHERE principal_id=? AND role=? AND active=1',who,'GRAN_HERMANO');
  if(e.owner_id!==who&&!admin)fail('Solo propietario o Gran Hermano',403);
  if(e.owner_id===principal_id)fail('No se modifica al propietario por delegación');
  await m.write('INSERT INTO gld2_grants(entity_id,principal_id,permission,active) VALUES(?,?,?,?) ON CONFLICT(entity_id,principal_id,permission) DO UPDATE SET active=excluded.active',entity_id,principal_id,permission,active?1:0);
  return {entity_id,principal_id,permission,active};
 }
 fail('Ruta desconocida',404);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),action=request.method+' '+url.pathname,m=meter(action,env);
  const reqLength=Number(request.headers.get('content-length')||0);
  if(Number.isFinite(reqLength)&&reqLength>0)m.units.bytes_request=reqLength;
  try{
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(request,env)});
   if(!url.pathname.startsWith('/gld2/'))return send(request,env,m,{error:'Not found'},404);
   const data=await route(request,env,m,url);return send(request,env,m,{ok:true,data});
  }catch(err){return send(request,env,m,{ok:false,error:err?.message||'Error del servidor'},err?.status||500);}
 }
};
