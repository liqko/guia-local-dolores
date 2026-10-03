/**
 * READ MODEL PUBLICO — PROMOS POR CIUDAD
 * Lectura pública: KV.
 * Cada mutación toca únicamente la ciudad anterior/nueva afectada.
 */
const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
export const promoCityKey=cityId=>"promos:city:v1:"+text(cityId);

function isPaused(p){ return bool(p&&p.pausado); }
function visible(p){
  if(isPaused(p))return false;
  const estado=text(p&&p.estado).toUpperCase();
  return !estado || !["INACTIVA","INACTIVO","BORRADOR","RECHAZADA","RECHAZADO"].includes(estado);
}
function publicPromo(p){
  return {
    promo_id:text(p.promo_id||p.id),
    anunciante_id:text(p.anunciante_id||p.id_comercio),
    promo:text(p.promo),
    categoria:text(p.categoria),
    categoria_id:text(p.categoria_id),
    logo_categoria:text(p.logo_categoria),
    sede_id:text(p.sede_id),
    ciudad_id:text(p.ciudad_id),
    img:text(p.img),
    desde:text(p.desde),
    hasta:text(p.hasta),
    otros:text(p.otros),
    direccion:text(p.direccion),
    maps:text(p.maps),
    telefono:text(p.telefono),
    whatsapp:text(p.whatsapp),
    instagram:text(p.instagram),
    facebook:text(p.facebook),
    youtube:text(p.youtube),
    tiktok:text(p.tiktok),
    linkedin:text(p.linkedin),
    x:text(p.x)
  };
}
function sort(rows){
  return [...rows].sort((a,b)=>text(a.promo).localeCompare(text(b.promo),"es",{sensitivity:"base"}));
}
export async function syncPromo({cache,current=null,next=null}){
  const id=text((next&&next.promo_id)||(current&&current.promo_id)||(next&&next.id)||(current&&current.id));
  const cities=[...new Set([text(current&&current.ciudad_id),text(next&&next.ciudad_id)].filter(Boolean))];
  for(const cityId of cities){
    const key=promoCityKey(cityId);
    const packet=(await cache.get(key))||{version:1,ciudad_id:cityId,updated_at:"",promos:[]};
    let rows=(packet.promos||[]).filter(x=>text(x.promo_id)!==id);
    if(next&&text(next.ciudad_id)===cityId&&visible(next))rows.push(publicPromo(next));
    await cache.put(key,{version:1,ciudad_id:cityId,updated_at:new Date().toISOString(),promos:sort(rows)});
  }
  return {success:true,ciudades_actualizadas:cities};
}
export async function getPromosCity({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(promoCityKey(city));
  return packet ? {success:true,...packet} : {success:true,ciudad_id:city,promos:[],cold:true};
}
export async function rebuildPromosAll({db,cache}){
  const all=await db.listCollection("promos");
  const byCity=new Map();
  for(const p of all){
    if(!visible(p))continue;
    const city=text(p.ciudad_id);if(!city)continue;
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push(publicPromo(p));
  }
  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,promos])=>cache.put(promoCityKey(city),{version:1,ciudad_id:city,updated_at:now,promos:sort(promos)})));
  return{success:true,ciudades:byCity.size,promos:all.length,updated_at:now};
}
