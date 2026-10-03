/**
 * Índice administrativo de suscriptores en KV.
 * Se actualiza con el resultado de la mutación, sin releer Firestore.
 */
import {ADMIN_SUBSCRIBERS_KEY} from "./admin-indexes-v2.js";

const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();

function rowOf(s){
  const id=text(s&&s.suscriptor_id||s&&s.id);
  const nombre=text(s&&s.nombre),mail=text(s&&s.mail),whatsapp=text(s&&s.whatsapp);
  return{
    suscriptor_id:id,
    id,
    nombre,
    mail,
    whatsapp,
    tipo_usuario:text(s&&s.tipo_usuario).toUpperCase(),
    ciudad_id:text(s&&s.ciudad_predeterminada_id||s&&s.ciudad_origen_id||s&&s.ciudad_id),
    activo:s&&s.activo,
    search:norm([id,nombre,mail,whatsapp].join(" "))
  };
}
function sort(rows){
  return [...rows].sort((a,b)=>text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"}));
}

export async function upsertSubscriberIndexV2({cache,subscriber}){
  const row=rowOf(subscriber);
  if(!row.suscriptor_id)return{success:true,changed:false};

  const packet=(await cache.get(ADMIN_SUBSCRIBERS_KEY))||{version:2,results:[]};
  const rows=(packet.results||[]).filter(x=>text(x.suscriptor_id||x.id)!==row.suscriptor_id);
  rows.push(row);

  await cache.put(ADMIN_SUBSCRIBERS_KEY,{
    ...packet,
    version:2,
    updated_at:new Date().toISOString(),
    results:sort(rows)
  });
  return{success:true,changed:true};
}

export async function removeSubscriberIndexV2({cache,subscriberId}){
  const sid=text(subscriberId);
  const packet=(await cache.get(ADMIN_SUBSCRIBERS_KEY))||{version:2,results:[]};
  const rows=(packet.results||[]).filter(x=>text(x.suscriptor_id||x.id)!==sid);

  await cache.put(ADMIN_SUBSCRIBERS_KEY,{
    ...packet,
    version:2,
    updated_at:new Date().toISOString(),
    results:sort(rows)
  });
  return{success:true,changed:true};
}
