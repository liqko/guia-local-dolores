/**
 * GUIA LOCAL — RECONSTRUCCION TOTAL
 * TERRITORIO V1
 *
 * PRINCIPIOS:
 * - Firestore = fuente maestra.
 * - GLD_CACHE_KV = capa intermedia de lectura.
 * - Lecturas normales de territorio: 0 lecturas Firestore.
 * - Crear/editar ciudad: 1 escritura Firestore + actualización puntual de 2 claves KV.
 * - Rebuild global: sólo endpoint de mantenimiento explícito.
 */

const COLL_PAISES = "paises";
const COLL_PROVINCIAS = "provincias";
const COLL_CIUDADES = "ciudades";

const KV_PUBLIC = "territorio:public:v1";
const KV_ADMIN = "territorio:admin:v1";

function t(v){ return String(v ?? "").trim(); }
function b(v){
  if(v === true || v === 1) return true;
  return ["true","1","si","sí","activo","activa"].includes(t(v).toLowerCase());
}
function cors(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,Authorization"
  };
}
function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json; charset=utf-8",...cors()}
  });
}
function cleanPath(pathname){
  const p=String(pathname||"/").replace(/\\/+/g,"/");
  return p.length>1 && p.endsWith("/") ? p.slice(0,-1) : p;
}

/* ---------- SUPERADMIN TOKEN: CERO FIRESTORE ---------- */

function b64(input){
  const bytes=typeof input==="string" ? new TextEncoder().encode(input) : input;
  let binary="";
  bytes.forEach(x=>binary+=String.fromCharCode(x));
  return btoa(binary).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/g,"");
}
function b64decode(s){
  s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4) s+="=";
  const binary=atob(s);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(env,value){
  const secret=t(env.SERVER_SECRET);
  if(!secret) throw new Error("Falta SERVER_SECRET");
  const key=await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},
    false,
    ["sign"]
  );
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}
async function verifyAdmin(env,request){
  const auth=t(request.headers.get("Authorization"));
  if(!auth.toLowerCase().startsWith("bearer ")){
    return {ok:false,message:"Sesión de administrador requerida"};
  }
  const parts=auth.slice(7).trim().split(".");
  if(parts.length!==2) return {ok:false,message:"Sesión inválida"};
  const [body,sig]=parts;
  if(sig!==await hmac(env,body)) return {ok:false,message:"Sesión inválida"};

  let p=null;
  try{ p=JSON.parse(b64decode(body)); }catch(_){}
  if(!p || !p.sid || !p.exp || Date.now()>Number(p.exp)){
    return {ok:false,message:"Sesión inválida o vencida"};
  }
  const rol=t(p.rol).toUpperCase();
  if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN","ADMIN_LOCAL"].includes(rol)){
    return {ok:false,message:"Rol administrativo no habilitado"};
  }
  return {ok:true,sid:t(p.sid),rol};
}

/* ---------- GOOGLE / FIRESTORE SIN EFECTOS LATERALES ---------- */

function base64Url(input){
  const bytes=typeof input==="string" ? new TextEncoder().encode(input) : input;
  let binary="";
  bytes.forEach(x=>binary+=String.fromCharCode(x));
  return btoa(binary).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/g,"");
}
function pemBuffer(pem){
  const clean=String(pem||"")
    .replace(/\\\\n/g,"\\n")
    .replace("-----BEGIN PRIVATE KEY-----","")
    .replace("-----END PRIVATE KEY-----","")
    .replace(/\\s+/g,"");
  const binary=atob(clean);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes.buffer;
}

const TOKEN={value:"",expiresAt:0,pending:null};

async function createGoogleToken(env){
  const email=t(env.FIREBASE_CLIENT_EMAIL);
  const keyText=t(env.FIREBASE_PRIVATE_KEY);
  if(!email || !keyText) throw new Error("Faltan credenciales Firebase");

  const now=Math.floor(Date.now()/1000);
  const head=base64Url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const body=base64Url(JSON.stringify({
    iss:email,
    scope:"https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud:"https://oauth2.googleapis.com/token",
    iat:now,
    exp:now+3600
  }));
  const unsigned=head+"."+body;

  const key=await crypto.subtle.importKey(
    "pkcs8",
    pemBuffer(keyText),
    {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},
    false,
    ["sign"]
  );
  const sig=await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt=unsigned+"."+base64Url(new Uint8Array(sig));

  const resp=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:jwt
    })
  });
  const raw=await resp.text();
  let data={};
  try{ data=raw?JSON.parse(raw):{}; }catch(_){}
  if(!resp.ok || !data.access_token) throw new Error("No se pudo obtener token Google");

  TOKEN.value=data.access_token;
  TOKEN.expiresAt=Date.now()+Math.max(60,Number(data.expires_in||3600)-120)*1000;
  return TOKEN.value;
}
async function googleToken(env){
  if(TOKEN.value && Date.now()<TOKEN.expiresAt) return TOKEN.value;
  if(TOKEN.pending) return TOKEN.pending;
  TOKEN.pending=createGoogleToken(env);
  try{ return await TOKEN.pending; }
  finally{ TOKEN.pending=null; }
}
function fsBase(env){
  const project=t(env.FIREBASE_PROJECT_ID);
  if(!project) throw new Error("Falta FIREBASE_PROJECT_ID");
  return "https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(project)+"/databases/(default)/documents";
}
function toFs(v){
  if(v===null || v===undefined) return {nullValue:null};
  if(Array.isArray(v)) return {arrayValue:{values:v.map(toFs)}};
  if(typeof v==="boolean") return {booleanValue:v};
  if(typeof v==="number"){
    return Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v};
  }
  if(typeof v==="object"){
    const fields={};
    for(const [k,val] of Object.entries(v)) if(val!==undefined) fields[k]=toFs(val);
    return {mapValue:{fields}};
  }
  return {stringValue:String(v)};
}
function fromFs(v){
  if(v==null) return null;
  if("stringValue" in v) return v.stringValue;
  if("booleanValue" in v) return v.booleanValue;
  if("integerValue" in v) return Number(v.integerValue);
  if("doubleValue" in v) return Number(v.doubleValue);
  if("timestampValue" in v) return v.timestampValue;
  if("nullValue" in v) return null;
  if("arrayValue" in v) return ((v.arrayValue&&v.arrayValue.values)||[]).map(fromFs);
  if("mapValue" in v) return fieldsFromFs((v.mapValue&&v.mapValue.fields)||{});
  return null;
}
function fieldsFromFs(fields){
  const out={};
  for(const [k,v] of Object.entries(fields||{})) out[k]=fromFs(v);
  return out;
}
function docFromFs(doc,id=""){
  if(!doc) return null;
  return {id:id||String(doc.name||"").split("/").pop(),...fieldsFromFs(doc.fields||{})};
}
async function fsRequest(env,path,{method="GET",body=null,allow404=false}={}){
  const token=await googleToken(env);
  const resp=await fetch(fsBase(env)+"/"+path,{
    method,
    headers:{
      "Authorization":"Bearer "+token,
      ...(body!==null?{"Content-Type":"application/json"}:{})
    },
    ...(body!==null?{body:JSON.stringify(body)}:{})
  });
  if(allow404 && resp.status===404) return null;
  const raw=await resp.text();
  let data=null;
  try{ data=raw?JSON.parse(raw):null; }catch(_){}
  if(!resp.ok) throw new Error("Firestore "+method+" "+path+": "+resp.status);
  return data;
}
async function fsPatch(env,collection,id,patch){
  const clean={};
  for(const [k,v] of Object.entries(patch||{})) if(v!==undefined) clean[k]=v;
  const keys=Object.keys(clean);
  if(!keys.length) throw new Error("No hay campos para guardar");

  const qs=new URLSearchParams();
  keys.forEach(k=>qs.append("updateMask.fieldPaths",k));

  const fields={};
  for(const [k,v] of Object.entries(clean)) fields[k]=toFs(v);

  const doc=await fsRequest(
    env,
    encodeURIComponent(collection)+"/"+encodeURIComponent(id)+"?"+qs.toString(),
    {method:"PATCH",body:{fields}}
  );
  return docFromFs(doc,id);
}
async function fsList(env,collection){
  let pageToken="";
  const out=[];
  do{
    const qs=new URLSearchParams({pageSize:"1000"});
    if(pageToken) qs.set("pageToken",pageToken);
    const data=await fsRequest(env,encodeURIComponent(collection)+"?"+qs.toString())||{};
    (data.documents||[]).forEach(d=>out.push(docFromFs(d)));
    pageToken=t(data.nextPageToken);
  }while(pageToken);
  return out;
}

/* ---------- KV ---------- */

function kv(env){
  if(!env.GLD_CACHE_KV || typeof env.GLD_CACHE_KV.get!=="function"){
    throw new Error("Falta binding GLD_CACHE_KV");
  }
  return env.GLD_CACHE_KV;
}
async function kvGet(env,key){
  const raw=await kv(env).get(key);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(_){ return null; }
}
async function kvPut(env,key,value){
  await kv(env).put(key,JSON.stringify(value));
}
function packet(x){
  return {
    version:1,
    updated_at:t(x&&x.updated_at),
    paises:Array.isArray(x&&x.paises)?x.paises:[],
    provincias:Array.isArray(x&&x.provincias)?x.provincias:[],
    ciudades:Array.isArray(x&&x.ciudades)?x.ciudades:[]
  };
}
function active(row){
  if(row.activa===undefined && row.activo===undefined) return true;
  return b(row.activa ?? row.activo);
}
function publicCity(row){
  return {
    ciudad_id:t(row.ciudad_id||row.id),
    ciudad_visible:t(row.ciudad_visible||row.nombre||row.ciudad),
    provincia_id:t(row.provincia_id),
    provincia_visible:t(row.provincia_visible||row.provincia),
    pais_id:t(row.pais_id),
    pais_visible:t(row.pais_visible||row.pais),
    pais_codigo:t(row.pais_codigo||row.codigo_pais),
    activa:active(row)
  };
}
function upsert(rows,idField,item){
  const id=t(item[idField]||item.id);
  const out=[...(Array.isArray(rows)?rows:[])];
  const i=out.findIndex(x=>t(x[idField]||x.id)===id);
  if(i>=0) out[i]=item; else out.push(item);
  return out;
}
function remove(rows,idField,id){
  return (Array.isArray(rows)?rows:[]).filter(x=>t(x[idField]||x.id)!==t(id));
}
function sortCities(rows){
  return [...rows].sort((a,b)=>
    t(a.ciudad_visible||a.nombre||a.ciudad)
      .localeCompare(t(b.ciudad_visible||b.nombre||b.ciudad),"es",{sensitivity:"base"})
  );
}

/* ---------- TERRITORIO ---------- */

async function publicTerritory(env){
  const data=await kvGet(env,KV_PUBLIC);
  if(!data) return json({success:false,message:"Catálogo territorial no inicializado"},503);
  return json({success:true,...packet(data)});
}
async function adminTerritory(env,request){
  const auth=await verifyAdmin(env,request);
  if(!auth.ok) return json({success:false,message:auth.message},401);
  const data=await kvGet(env,KV_ADMIN);
  if(!data) return json({success:false,message:"Catálogo territorial no inicializado"},503);
  return json({success:true,...packet(data)});
}
function validateCity(city,admin){
  if(!t(city.ciudad_id)) return "Falta ciudad_id";
  if(!t(city.ciudad_visible)) return "Falta nombre de ciudad";
  if(!t(city.pais_id)) return "Falta pais_id";
  if(!t(city.provincia_id)) return "Falta provincia_id";

  const paisOk=admin.paises.some(x=>t(x.pais_id||x.id)===t(city.pais_id));
  if(!paisOk) return "pais_id inexistente";

  const prov=admin.provincias.find(x=>t(x.provincia_id||x.id)===t(city.provincia_id));
  if(!prov) return "provincia_id inexistente";
  if(t(prov.pais_id) && t(prov.pais_id)!==t(city.pais_id)) return "Provincia no pertenece al país";
  return "";
}
async function saveCity(env,request,idFromPath=""){
  const auth=await verifyAdmin(env,request);
  if(!auth.ok) return json({success:false,message:auth.message},401);

  let body={};
  try{ body=await request.json(); }catch(_){}
  const item=body.item && typeof body.item==="object" ? body.item : body;

  const admin=packet(await kvGet(env,KV_ADMIN));
  if(!admin.paises.length || !admin.provincias.length){
    return json({success:false,message:"Inicializá primero el catálogo territorial"},503);
  }

  const ciudad_id=t(idFromPath||item.ciudad_id||item.id);
  const city={
    ...item,
    ciudad_id,
    ciudad_visible:t(item.ciudad_visible||item.nombre||item.ciudad),
    pais_id:t(item.pais_id),
    provincia_id:t(item.provincia_id),
    activa:item.activa!==undefined?b(item.activa):(item.activo!==undefined?b(item.activo):true),
    actualizado_en:new Date().toISOString()
  };

  const error=validateCity(city,admin);
  if(error) return json({success:false,message:error},400);

  // EXACTAMENTE UNA escritura Firestore.
  const saved=await fsPatch(env,COLL_CIUDADES,ciudad_id,city);

  const now=new Date().toISOString();
  const nextAdmin={
    ...admin,
    updated_at:now,
    ciudades:sortCities(upsert(admin.ciudades,"ciudad_id",saved||city))
  };

  const pub=packet(await kvGet(env,KV_PUBLIC));
  let cities=remove(pub.ciudades,"ciudad_id",ciudad_id);
  if(active(saved||city)) cities=upsert(cities,"ciudad_id",publicCity(saved||city));

  const nextPublic={
    ...pub,
    version:1,
    updated_at:now,
    ciudades:sortCities(cities)
  };

  await Promise.all([
    kvPut(env,KV_ADMIN,nextAdmin),
    kvPut(env,KV_PUBLIC,nextPublic)
  ]);

  return json({
    success:true,
    ciudad:saved||city,
    firestore_writes:1,
    firestore_global_reads:0
  });
}

/* Mantenimiento explícito. NUNCA se llama desde una lectura o escritura normal. */
async function rebuildTerritory(env,request){
  const auth=await verifyAdmin(env,request);
  if(!auth.ok) return json({success:false,message:auth.message},401);
  if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(auth.rol)){
    return json({success:false,message:"Permiso insuficiente"},403);
  }

  const [paises,provincias,ciudades]=await Promise.all([
    fsList(env,COLL_PAISES),
    fsList(env,COLL_PROVINCIAS),
    fsList(env,COLL_CIUDADES)
  ]);

  const now=new Date().toISOString();
  const admin={version:1,updated_at:now,paises,provincias,ciudades:sortCities(ciudades)};
  const pub={
    version:1,
    updated_at:now,
    paises:paises.filter(active),
    provincias:provincias.filter(active),
    ciudades:sortCities(ciudades.filter(active).map(publicCity))
  };

  await Promise.all([kvPut(env,KV_ADMIN,admin),kvPut(env,KV_PUBLIC,pub)]);
  return json({
    success:true,
    rebuilt:true,
    counts:{paises:paises.length,provincias:provincias.length,ciudades:ciudades.length}
  });
}

/* ---------- ROUTER ---------- */

export default {
  async fetch(request,env){
    try{
      const url=new URL(request.url);
      const p=cleanPath(url.pathname);

      if(request.method==="OPTIONS"){
        return new Response(null,{status:204,headers:cors()});
      }
      if(p==="/"){
        return json({success:true,app:"Guía Local reconstrucción",version:"territorio-v1"});
      }
      if(p==="/territory/public" && request.method==="GET"){
        return publicTerritory(env);
      }
      if(p==="/superadmin/territory" && request.method==="GET"){
        return adminTerritory(env,request);
      }
      if(p==="/superadmin/territory/rebuild-cache" && request.method==="POST"){
        return rebuildTerritory(env,request);
      }
      if(p==="/superadmin/cities/create" && request.method==="POST"){
        return saveCity(env,request);
      }

      const match=p.match(/^\\/superadmin\\/cities\\/([^/]+)$/);
      if(match && request.method==="PATCH"){
        return saveCity(env,request,decodeURIComponent(match[1]));
      }

      return json({success:false,message:"Ruta no encontrada"},404);
    }catch(err){
      return json({success:false,message:String(err&&err.message?err.message:err)},500);
    }
  }
};
