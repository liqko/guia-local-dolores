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
const coverageKey=id=>'events:coverage:v1:'+text(id);
function eventCities(event,programacion=[]){
  if(!event)return[];
  if(programacion.length)return [...new Set(programacion.filter(p=>p.activo!==false).map(p=>text(p.ciudad_id||event.ciudad_id)).filter(Boolean))];
  return [text(event.ciudad_id)].filter(Boolean);
}
function cityEvent(event,programacion,city){
  const local=programacion.filter(p=>p.activo!==false&&text(p.ciudad_id||event.ciudad_id)===city);
  const dates=local.map(p=>text(p.fecha)).filter(Boolean).sort();
  return cleanEvent({...event,ciudad_origen_id:text(event.ciudad_id),ciudad_id:city,
    ...(dates.length?{fecha_desde:dates[0],fecha_hasta:dates.at(-1)}:{})},local);
}
export async function syncEventV2({db,cache,current=null,next=null,previousProgramacion=[],programacion:provided}){
  const id=text(next?.evento_id||current?.evento_id||next?.id||current?.id);
  const previous=await cache.get(coverageKey(id));
  const programacion=provided??(next?await db.queryEqual('evento_programacion','evento_id',id,500):[]);
  const nextCities=eventCities(next,programacion);
  const cities=[...new Set([...(previous?.ciudades||[]),...eventCities(current,previousProgramacion),...nextCities])];
  for(const cityId of cities){
    const key=eventsCityKey(cityId);
    const packet=(await cache.get(key))||{version:2,ciudad_id:cityId,updated_at:'',events:[]};
    const rows=(packet.events||[]).filter(x=>text(x.evento_id||x.id)!==id);
    if(next&&nextCities.includes(cityId)&&published(next))rows.push(cityEvent(next,programacion,cityId));
    await cache.put(key,{version:2,ciudad_id:cityId,updated_at:new Date().toISOString(),events:sort(rows)});
  }
  await cache.put(coverageKey(id),{ciudades:nextCities});
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
    const id=text(e.evento_id||e.id),programacion=byEvent.get(id)||[];
    const cities=eventCities(e,programacion);
    const previous=await cache.get(coverageKey(id));
    for(const city of previous?.ciudades||[])if(!byCity.has(city))byCity.set(city,[]);
    await cache.put(coverageKey(id),{ciudades:cities});
    if(!published(e))continue;
    for(const city of cities){
      if(!byCity.has(city))byCity.set(city,[]);
      byCity.get(city).push(cityEvent(e,programacion,city));
    }
  }
  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,rows])=>cache.put(eventsCityKey(city),{
    version:2,ciudad_id:city,updated_at:now,events:sort(rows)
  })));
  return{success:true,ciudades:byCity.size,eventos:events.length,updated_at:now};
}
