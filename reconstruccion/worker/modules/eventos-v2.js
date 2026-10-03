import {getEventsCity,syncEvent} from "../core/events-read-model.js";

const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
const isFree=e=>text(e&&e.nivel).toUpperCase()==="FREE";
const isVip=e=>!isFree(e);

function eventId(prefix="evt"){
  return prefix+"-"+crypto.randomUUID();
}
function cityExists(territory,id){
  return (territory&&territory.ciudades||[]).some(c=>text(c.ciudad_id||c.id)===text(id));
}
async function validateBase({cache,data}){
  const city=text(data.ciudad_id);
  if(!city)throw new Error("ciudad_id obligatorio.");
  const territory=await cache.get("territorio:public:v1");
  if(!territory||!cityExists(territory,city))throw new Error("La ciudad indicada no existe o no está activa.");
  if(!text(data.nombre_evento||data.nombre))throw new Error("Falta nombre del evento.");
  return city;
}
async function eventQuota({db,advertiserId,max,free=false,exclude=""}){
  const own=await db.queryEqual("eventos","anunciante_id",advertiserId);
  const filtered=own.filter(e=>free?isFree(e):isVip(e));
  const active=filtered.filter(e=>text(e.evento_id||e.id)!==text(exclude)&&!bool(e.pausado)).length;
  return{total:filtered.length,active,max:Number(max||0),totalMax:Number(max||0)>0?Number(max)*2:0};
}

export async function eventsPublicV2({cache,cityId}){
  return getEventsCity({cache,cityId});
}

export async function vipCreateV2({db,cache,advertiserId,payload,max,advertiser}){
  const data=payload&&typeof payload==="object"?payload:{};
  await validateBase({cache,data});
  const q=await eventQuota({db,advertiserId,max,free:false});
  if(q.max<=0)throw new Error("El anunciante no tiene cupo de Eventos.");
  if(q.active>=q.max)throw new Error("Alcanzaste el máximo de eventos activos.");
  if(q.total>=q.totalMax)throw new Error("Alcanzaste el máximo de eventos guardados.");

  const now=new Date().toISOString();
  const id=eventId("vip");
  const doc={...data,
    evento_id:id,anunciante_id:advertiserId,id_anunciante:advertiserId,nivel:"VIP",
    estado_moderacion:"PENDIENTE",pausado:false,
    acepta_responsabilidad:true,fecha_aceptacion:now,fecha_carga:now,actualizado:now,
    organizador:text(data.organizador||(advertiser&&advertiser.nombre)),
    logo_organizador:text(data.logo_organizador||(advertiser&&advertiser.logo))
  };
  delete doc.programacion;
  const saved=await db.patch("eventos",id,doc);
  await syncEvent({cache,next:saved});
  return{success:true,created:true,evento_id:id};
}

export async function vipUpdateV2({db,cache,advertiserId,payload}){
  const data=payload&&typeof payload==="object"?payload:{};
  const id=text(data.evento_id);if(!id)throw new Error("Falta evento_id.");
  const current=await db.get("eventos",id);
  if(!current||text(current.anunciante_id||current.id_anunciante)!==text(advertiserId)||!isVip(current))throw new Error("El evento no pertenece al anunciante.");

  const next={...current};
  for(const[k,v]of Object.entries(data)){
    if(["evento_id","programacion"].includes(k))continue;
    next[k]=v;
  }
  await validateBase({cache,data:next});
  next.evento_id=id;next.anunciante_id=advertiserId;next.id_anunciante=advertiserId;next.nivel="VIP";
  next.actualizado=new Date().toISOString();
  const saved=await db.patch("eventos",id,next,{mustExist:true});
  await syncEvent({cache,current,next:saved});
  return{success:true,updated:true,evento_id:id};
}

export async function vipPauseV2({db,cache,advertiserId,payload,max}){
  const id=text(payload&&payload.evento_id);if(!id)throw new Error("Falta evento_id.");
  const current=await db.get("eventos",id);
  if(!current||text(current.anunciante_id||current.id_anunciante)!==text(advertiserId)||!isVip(current))throw new Error("El evento no pertenece al anunciante.");
  const pause=bool(payload&&((payload.pause!==undefined)?payload.pause:payload.pausado));
  if(!pause&&bool(current.pausado)){
    const q=await eventQuota({db,advertiserId,max,free:false,exclude:id});
    if(q.active>=q.max)throw new Error("Alcanzaste el máximo de eventos activos.");
  }
  const saved=await db.patch("eventos",id,{pausado:pause,actualizado:new Date().toISOString()},{mustExist:true});
  await syncEvent({cache,current,next:saved});
  return{success:true,evento_id:id};
}

export async function eventDeleteV2({db,cache,advertiserId,payload,level="VIP"}){
  const id=text(payload&&payload.evento_id);if(!id)throw new Error("Falta evento_id.");
  const current=await db.get("eventos",id);
  const own=current&&text(current.anunciante_id||current.id_anunciante)===text(advertiserId);
  if(!own || (level==="VIP"?!isVip(current):!isFree(current)))throw new Error("El evento no pertenece al anunciante.");
  await db.delete("eventos",id,{mustExist:true});
  await syncEvent({cache,current,next:null});
  return{success:true,deleted:true,evento_id:id};
}
