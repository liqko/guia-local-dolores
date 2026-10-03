/**
 * EVENTOS READ MODEL V2
 * Incluye programación dentro del paquete público del evento.
 */
const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
export const eventsCityKey=cityId=>"events:city:v2:"+text(cityId);

function published(e){
  if(bool(e&&e.pausado))return false;
  const estado=text(e&&e.estado).toUpperCase();
  const mod=text(e&&e.estado_moderacion).toUpperCase();
  if(["RECHAZADA","RECHAZADO","BORRADOR","INACTIVA","INACTIVO"].includes(estado))return false;
  return ["APROBADO","APROBADA","PUBLICADO","PUBLICADA"].includes(mod);
}
function cleanEvent(e,programacion=[]){
  const out={...e,programacion:[...programacion].sort((a,b)=>
    Number(a.orden||0)-Number(b.orden||0) ||
    text(a.fecha).localeCompare(text(b.fecha)) ||
    text(a.hora_desde).localeCompare(text(b.hora_desde))
  )};
  delete out.__id;
  delete out.moderado_por;
  delete out.motivo_revision;
  return out;
}
function sort(rows){
  return [...rows].sort((a,b)=>{
    const da=text(a.fecha_desde||a.fecha||a.desde),db=text(b.fecha_desde||b.fecha||b.desde);
    return da.localeCompare(db)||text(a.nombre_evento||a.nombre).localeCompare(text(b.nombre_evento||b.nombre),"es",{sensitivity:"base"});
  });
}
export async function syncEventV2({db,cache,current=null,next=null}){
  const id=text((next&&next.evento_id)||(current&&current.evento_id)||(next&&next.id)||(current&&current.id));
  const cities=[...new Set([text(current&&current.ciudad_id),text(next&&next.ciudad_id)].filter(Boolean))];
  let programacion=[];
  if(next)programacion=await db.queryEqual("evento_programacion","evento_id",id,500);

  for(const cityId of cities){
    const key=eventsCityKey(cityId);
    const packet=(await cache.get(key))||{version:2,ciudad_id:cityId,updated_at:"",events:[]};
    let rows=(packet.events||[]).filter(x=>text(x.evento_id||x.id)!==id);
    if(next&&text(next.ciudad_id)===cityId&&published(next))rows.push(cleanEvent(next,programacion));
    await cache.put(key,{version:2,ciudad_id:cityId,updated_at:new Date().toISOString(),events:sort(rows)});
  }
  return{success:true,ciudades_actualizadas:cities};
}
export async function getEventsCityV2({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(eventsCityKey(city));
  return packet?{success:true,...packet}:{success:true,ciudad_id:city,events:[],cold:true};
}
export async function rebuildEventsAllV2({db,cache}){
  const [events,programas]=await Promise.all([
    db.listCollection("eventos"),
    db.listCollection("evento_programacion")
  ]);
  const byEvent=new Map();
  for(const p of programas){
    const id=text(p.evento_id);if(!id)continue;
    if(!byEvent.has(id))byEvent.set(id,[]);
    byEvent.get(id).push(p);
  }
  const byCity=new Map();
  for(const e of events){
    if(!published(e))continue;
    const city=text(e.ciudad_id);if(!city)continue;
    const id=text(e.evento_id||e.id);
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push(cleanEvent(e,byEvent.get(id)||[]));
  }
  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,rows])=>cache.put(eventsCityKey(city),{
    version:2,ciudad_id:city,updated_at:now,events:sort(rows)
  })));
  return{success:true,ciudades:byCity.size,eventos:events.length,updated_at:now};
}
