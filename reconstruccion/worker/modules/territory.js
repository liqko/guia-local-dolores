import {json,publicJson} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";

const PUBLIC_KEY="territorio:public:v1";
const ADMIN_KEY="territorio:admin:v1";
const C={paises:"paises",provincias:"provincias",ciudades:"ciudades"};

const text=v=>String(v??"").trim();
function bool(v){
  if(v===true||v===1)return true;
  return ["true","1","si","sí","activo","activa"].includes(text(v).toLowerCase());
}
function active(row){
  if(row.activa===undefined&&row.activo===undefined)return true;
  return bool(row.activa??row.activo);
}
function packet(v){
  const x=v&&typeof v==="object"?v:{};
  return{version:1,updated_at:text(x.updated_at),paises:Array.isArray(x.paises)?x.paises:[],provincias:Array.isArray(x.provincias)?x.provincias:[],ciudades:Array.isArray(x.ciudades)?x.ciudades:[]};
}
function upsert(rows,idField,item){
  const id=text(item[idField]||item.id);const out=[...(rows||[])];
  const i=out.findIndex(x=>text(x[idField]||x.id)===id);
  if(i>=0)out[i]=item;else out.push(item);return out;
}
function remove(rows,idField,id){return(rows||[]).filter(x=>text(x[idField]||x.id)!==text(id));}
function sortCities(rows){return[...(rows||[])].sort((a,b)=>text(a.ciudad_visible||a.nombre||a.ciudad).localeCompare(text(b.ciudad_visible||b.nombre||b.ciudad),"es",{sensitivity:"base"}));}
function publicCity(row,admin){
  const prov=(admin.provincias||[]).find(x=>text(x.provincia_id||x.id)===text(row.provincia_id))||{};
  const pais=(admin.paises||[]).find(x=>text(x.pais_id||x.id)===text(row.pais_id||prov.pais_id))||{};
  return{
    ciudad_id:text(row.ciudad_id||row.id),
    ciudad_visible:text(row.ciudad_visible||row.nombre||row.ciudad),
    provincia_id:text(row.provincia_id),
    provincia_visible:text(row.provincia_visible||row.provincia||prov.provincia_visible||prov.nombre||prov.provincia),
    pais_id:text(row.pais_id||prov.pais_id),
    pais_visible:text(row.pais_visible||row.pais||pais.pais_visible||pais.nombre||pais.pais),
    pais_codigo:text(row.pais_codigo||row.codigo_pais||pais.pais_codigo||pais.codigo_pais||pais.codigo),
    activa:active(row)
  };
}
async function authOr401(env,request){
  const a=await verifyAdmin(env,request);
  return a.ok?a:json({success:false,message:a.message},401);
}
export async function territoryPublic({cache}){
  const p=await cache.get(PUBLIC_KEY);
  if(!p)return json({success:false,message:"Catálogo territorial no inicializado"},503);
  return publicJson({success:true,...packet(p)});
}
export async function territoryAdmin({env,request,cache}){
  const a=await authOr401(env,request);if(a instanceof Response)return a;
  const p=await cache.get(ADMIN_KEY);
  if(!p)return json({success:false,message:"Catálogo territorial no inicializado"},503);
  return json({success:true,...packet(p)});
}
export async function saveCountry({env,request,db,cache,idFromPath=""}){
  const a=await authOr401(env,request);if(a instanceof Response)return a;
  let body={};try{body=await request.json()}catch(_){}
  const item=body.item&&typeof body.item==="object"?body.item:body;
  const id=text(idFromPath||item.pais_id||item.id),nombre=text(item.pais_visible||item.nombre||item.pais);
  if(!id||!nombre)return json({success:false,message:"Faltan pais_id o nombre"},400);
  const saved=await db.patch(C.paises,id,{...item,pais_id:id,nombre,pais_visible:nombre,activo:item.activo!==undefined?bool(item.activo):true,actualizado_en:new Date().toISOString()});
  const admin=packet(await cache.get(ADMIN_KEY)),pub=packet(await cache.get(PUBLIC_KEY)),now=new Date().toISOString();
  const nextAdmin={...admin,updated_at:now,paises:upsert(admin.paises,"pais_id",saved)};
  let paises=remove(pub.paises,"pais_id",id);if(active(saved))paises=upsert(paises,"pais_id",saved);
  await Promise.all([cache.put(ADMIN_KEY,nextAdmin),cache.put(PUBLIC_KEY,{...pub,updated_at:now,paises})]);
  return json({success:true,pais:saved});
}
export async function saveProvince({env,request,db,cache,idFromPath=""}){
  const a=await authOr401(env,request);if(a instanceof Response)return a;
  let body={};try{body=await request.json()}catch(_){}
  const item=body.item&&typeof body.item==="object"?body.item:body;
  const id=text(idFromPath||item.provincia_id||item.id),nombre=text(item.provincia_visible||item.nombre||item.provincia),pais_id=text(item.pais_id);
  const admin=packet(await cache.get(ADMIN_KEY));
  if(!id||!nombre||!pais_id)return json({success:false,message:"Faltan provincia_id, nombre o pais_id"},400);
  if(!admin.paises.some(x=>text(x.pais_id||x.id)===pais_id))return json({success:false,message:"pais_id inexistente"},400);
  const saved=await db.patch(C.provincias,id,{...item,provincia_id:id,nombre,provincia_visible:nombre,pais_id,activo:item.activo!==undefined?bool(item.activo):true,actualizado_en:new Date().toISOString()});
  const pub=packet(await cache.get(PUBLIC_KEY)),now=new Date().toISOString();
  const nextAdmin={...admin,updated_at:now,provincias:upsert(admin.provincias,"provincia_id",saved)};
  let provincias=remove(pub.provincias,"provincia_id",id);if(active(saved))provincias=upsert(provincias,"provincia_id",saved);
  await Promise.all([cache.put(ADMIN_KEY,nextAdmin),cache.put(PUBLIC_KEY,{...pub,updated_at:now,provincias})]);
  return json({success:true,provincia:saved});
}
export async function saveCity({env,request,db,cache,idFromPath=""}){
  const a=await authOr401(env,request);if(a instanceof Response)return a;
  let body={};try{body=await request.json()}catch(_){}
  const item=body.item&&typeof body.item==="object"?body.item:body;
  const admin=packet(await cache.get(ADMIN_KEY));
  const id=text(idFromPath||item.ciudad_id||item.id),nombre=text(item.ciudad_visible||item.nombre||item.ciudad),pais_id=text(item.pais_id),provincia_id=text(item.provincia_id);
  if(!id||!nombre||!pais_id||!provincia_id)return json({success:false,message:"Faltan datos obligatorios de ciudad"},400);
  const prov=admin.provincias.find(x=>text(x.provincia_id||x.id)===provincia_id);
  if(!prov||text(prov.pais_id)!==pais_id)return json({success:false,message:"Provincia/país inválidos"},400);
  const saved=await db.patch(C.ciudades,id,{...item,ciudad_id:id,ciudad_visible:nombre,pais_id,provincia_id,activa:item.activa!==undefined?bool(item.activa):true,actualizado_en:new Date().toISOString()});
  const pub=packet(await cache.get(PUBLIC_KEY)),now=new Date().toISOString();
  const nextAdmin={...admin,updated_at:now,ciudades:sortCities(upsert(admin.ciudades,"ciudad_id",saved))};
  let ciudades=remove(pub.ciudades,"ciudad_id",id);if(active(saved))ciudades=upsert(ciudades,"ciudad_id",publicCity(saved,nextAdmin));
  await Promise.all([cache.put(ADMIN_KEY,nextAdmin),cache.put(PUBLIC_KEY,{...pub,updated_at:now,ciudades:sortCities(ciudades)})]);
  return json({success:true,ciudad:saved});
}
export async function rebuildTerritory({env,request,db,cache}){
  const a=await authOr401(env,request);if(a instanceof Response)return a;
  if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(a.rol))return json({success:false,message:"Permiso insuficiente"},403);
  const[paises,provincias,ciudades]=await Promise.all([db.listCollection(C.paises),db.listCollection(C.provincias),db.listCollection(C.ciudades)]);
  const now=new Date().toISOString(),admin={version:1,updated_at:now,paises,provincias,ciudades:sortCities(ciudades)};
  const pub={version:1,updated_at:now,paises:paises.filter(active),provincias:provincias.filter(active),ciudades:sortCities(ciudades.filter(active).map(x=>publicCity(x,admin)))};
  await Promise.all([cache.put(ADMIN_KEY,admin),cache.put(PUBLIC_KEY,pub)]);
  return json({success:true,rebuilt:true,counts:{paises:paises.length,provincias:provincias.length,ciudades:ciudades.length}});
}
