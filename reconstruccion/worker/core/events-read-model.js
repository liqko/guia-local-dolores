/**
 * READ MODEL PUBLICO — EVENTOS POR CIUDAD
 * La guía pública no consulta Firestore. Publicar/despublicar toca sólo la ciudad afectada.
 */
const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
export const eventsCityKey=cityId=>"events:city:v1:"+text(cityId);

function published(e){
  if(bool(e&&e.pausado)) return false;
  const estado=text(e&&e.estado).toUpperCase();
  const mod=text(e&&e.estado_moderacion).toUpperCase();
  if(["RECHAZADA","RECHAZADO","BORRADOR","INACTIVA","INACTIVO"].includes(estado))return false;
  if(mod && !["APROBADO","APROBADA","PUBLICADO","PUBLICADA"].includes(mod))return false;
  return true;
}
function publicEvent(e){
  const out={...e};
  delete out.__id;
  delete out.moderado_por;
  delete out.motivo_revision;
  return out;
}
function sort(rows){
  return [...rows].sort((a,b)=>{
    const da=text(a.fecha_desde||a.fecha||a.desde);
    const db=text(b.fecha_desde||b.fecha||b.desde);
    return da.localeCompare(db)||text(a.nombre_evento||a.nombre).localeCompare(text(b.nombre_evento||b.nombre),"es",{sensitivity:"base"});
  });
}
export async function syncEvent({cache,current=null,next=null}){
  const id=text((next&&next.evento_id)||(current&&current.evento_id)||(next&&next.id)||(current&&current.id));
  const cities=[...new Set([text(current&&current.ciudad_id),text(next&&next.ciudad_id)].filter(Boolean))];

  for(const cityId of cities){
    const key=eventsCityKey(cityId);
    const packet=(await cache.get(key))||{version:1,ciudad_id:cityId,updated_at:"",events:[]};
    let rows=(packet.events||[]).filter(x=>text(x.evento_id||x.id)!==id);
    if(next&&text(next.ciudad_id)===cityId&&published(next))rows.push(publicEvent(next));
    await cache.put(key,{version:1,ciudad_id:cityId,updated_at:new Date().toISOString(),events:sort(rows)});
  }
  return{success:true,ciudades_actualizadas:cities};
}
export async function getEventsCity({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(eventsCityKey(city));
  return packet?{success:true,...packet}:{success:true,ciudad_id:city,events:[],cold:true};
}
export async function rebuildEventsAll({db,cache}){
  const rows=await db.listCollection("eventos");
  const byCity=new Map();
  for(const e of rows){
    if(!published(e))continue;
    const city=text(e.ciudad_id);if(!city)continue;
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push(publicEvent(e));
  }
  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,events])=>cache.put(eventsCityKey(city),{
    version:1,ciudad_id:city,updated_at:now,events:sort(events)
  })));
  return{success:true,ciudades:byCity.size,eventos:rows.length,updated_at:now};
}
