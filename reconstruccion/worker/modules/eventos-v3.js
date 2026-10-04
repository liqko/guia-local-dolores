import {syncEventV2,getEventsCityV2} from "../core/events-read-model-v2.js";

const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
const isFree=e=>text(e&&e.nivel).toUpperCase()==="FREE";
const isVip=e=>!isFree(e);
const norm=v=>text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\s_-]+/g,"");

function id(prefix){return prefix+"-"+crypto.randomUUID();}
function cityExists(territory,cid){return (territory&&territory.ciudades||[]).some(c=>text(c.ciudad_id||c.id)===text(cid));}

async function validateLocation({db,cache,advertiserId,row,fallbackCity=""}){
  const city=text(row.ciudad_id||fallbackCity);
  if(!city)throw new Error("Falta ciudad.");
  const territory=await cache.get("territorio:public:v1");
  if(!territory||!cityExists(territory,city))throw new Error("La ciudad indicada no existe o no está activa.");

  const tipo=text(row.tipo_lugar).toUpperCase();
  const sedeId=text(row.sede_id),lugarId=text(row.lugar_id),lugarTexto=text(row.lugar_texto||row.lugar),direccion=text(row.direccion);
  if(tipo.includes("VIRTUAL")||tipo.includes("ONLINE")){
    if(!text(row.url_virtual||row.link_virtual||row.enlace_virtual||row.web||row.maps))throw new Error("El evento virtual necesita enlace o plataforma.");
    return city;
  }
  if(sedeId){
    const sede=await db.get("anunciantes_sedes",sedeId);
    if(!sede||text(sede.anunciante_id)!==text(advertiserId)||text(sede.ciudad_id)!==city)throw new Error("La sede no pertenece al anunciante/ciudad.");
    return city;
  }
  if(lugarId){
    const lugar=await db.get("lugares",lugarId);
    if(!lugar||text(lugar.ciudad_id)!==city)throw new Error("El lugar no pertenece a la ciudad.");
    return city;
  }
  if(!lugarTexto)throw new Error("Falta indicar el lugar del evento.");
  if(!direccion)throw new Error("El lugar necesita dirección física.");
  return city;
}
async function validateEvent({db,cache,advertiserId,data}){
  if(!text(data.nombre_evento))throw new Error("Falta nombre del evento.");
  if(!text(data.categoria||data.categoria_id))throw new Error("Falta categoría.");
  if(!text(data.ciudad_id))throw new Error("Falta ciudad.");
  if(!text(data.fecha_desde))throw new Error("Falta fecha del evento.");
  const programacion=Array.isArray(data.programacion)?data.programacion:[];
  if(programacion.length){
    for(let i=0;i<programacion.length;i++){
      const row=programacion[i]||{};
      if(!text(row.fecha))throw new Error("Falta fecha en la instancia "+(i+1)+".");
      await validateLocation({db,cache,advertiserId,row,fallbackCity:data.ciudad_id});
    }
  }else{
    await validateLocation({db,cache,advertiserId,row:data,fallbackCity:data.ciudad_id});
  }
}
async function replaceProgramacion({db,cache,advertiserId,eventId,programacion,fallbackCity}){
  const old=await db.queryEqual("evento_programacion","evento_id",eventId,500);
  for(const p of old){
    const pid=text(p.evento_programacion_id||p.id);if(pid)await db.delete("evento_programacion",pid);
  }
  let orden=0;
  const saved=[];
  for(const raw of (Array.isArray(programacion)?programacion:[])){
    if(!text(raw.fecha))throw new Error("Cada instancia del evento necesita fecha.");
    const city=await validateLocation({db,cache,advertiserId,row:raw,fallbackCity});
    // Cada reemplazo/duplicación crea filas propias; un ID recibido nunca toma otra instancia.
    const pid=id("evp");
    const {id:legacyId,evento_programacion_id:legacyProgramId,...fields}=raw;
    orden++;
    const row=await db.patch("evento_programacion",pid,{
      ...fields,evento_programacion_id:pid,evento_id:eventId,ciudad_id:city,
      fecha:text(raw.fecha),hora_desde:text(raw.hora_desde),hora_hasta:text(raw.hora_hasta),
      activo:raw.activo===false?false:true,orden:Number(raw.orden||orden),actualizado:new Date().toISOString()
    });
    saved.push(row);
  }
  return saved;
}
async function quota({db,advertiserId,max,free=false,exclude=""}){
  const own=await db.queryEqual("eventos","anunciante_id",advertiserId,500);
  const rows=own.filter(e=>free?isFree(e):isVip(e));
  return{
    total:rows.length,
    active:rows.filter(e=>text(e.evento_id||e.id)!==text(exclude)&&!bool(e.pausado)).length,
    max:Number(max||0),totalMax:Number(max||0)>0?Number(max)*2:0
  };
}
async function similarFree({db,data}){
  const city=text(data.ciudad_id);if(!city)return[];
  const rows=await db.queryEqual("eventos","ciudad_id",city,300);
  const n=norm(data.nombre_evento),place=norm(data.lugar||data.lugar_texto),date=text(data.fecha_desde);
  return rows.filter(isFree).filter(e=>{
    const sameDate=date&&text(e.fecha_desde)===date;
    return sameDate&&((n&&norm(e.nombre_evento)===n)||(place&&norm(e.lugar||e.lugar_texto)===place));
  }).slice(0,5);
}
export async function eventsPublicV3({cache,cityId}){return getEventsCityV2({cache,cityId});}

export async function createEventV3({db,cache,advertiserId,payload,max,advertiser,level="VIP"}){
  const data=payload&&typeof payload==="object"?payload:{};
  await validateEvent({db,cache,advertiserId,data});
  const free=level==="FREE";
  const q=await quota({db,advertiserId,max,free});
  if(q.max<=0)throw new Error("El anunciante no tiene cupo de "+(free?"Eventos Free":"Eventos")+".");
  if(q.active>=q.max)throw new Error("Alcanzaste el máximo de eventos activos.");
  if(q.totalMax>0&&q.total>=q.totalMax)throw new Error("Alcanzaste el máximo de eventos guardados.");

  if(free&&!bool(data.confirmar_similar)){
    const dup=await similarFree({db,data});
    if(dup.length)return{success:false,requires_confirmation:true,duplicados:dup};
  }

  const now=new Date().toISOString(),eventId=id(free?"free":"vip");
  const doc={...data,
    evento_id:eventId,anunciante_id:advertiserId,id_anunciante:advertiserId,nivel:free?"FREE":"VIP",
    estado_moderacion:"PENDIENTE",estado:"PENDIENTE",pausado:false,
    acepta_responsabilidad:free?bool(data.acepta_responsabilidad):true,
    fecha_aceptacion:now,fecha_carga:now,actualizado:now,
    organizador:text(data.organizador||(advertiser&&advertiser.nombre)),
    logo_organizador:text(data.logo_organizador||(advertiser&&advertiser.logo))
  };
  delete doc.confirmar_similar;delete doc.programacion;
  const saved=await db.patch("eventos",eventId,doc);
  const programacion=await replaceProgramacion({db,cache,advertiserId,eventId,programacion:data.programacion,fallbackCity:doc.ciudad_id});
  await syncEventV2({db,cache,next:saved});
  return{
    success:true,
    created:true,
    evento_id:eventId,
    estado_moderacion:"PENDIENTE",
    evento:{...saved,programacion}
  };
}
export async function updateEventV3({db,cache,advertiserId,payload,level="VIP"}){
  const data=payload&&typeof payload==="object"?payload:{},eventId=text(data.evento_id);
  if(!eventId)throw new Error("Falta evento_id.");
  const current=await db.get("eventos",eventId);
  const wanted=level==="FREE"?isFree(current):isVip(current);
  if(!current||text(current.anunciante_id||current.id_anunciante)!==text(advertiserId)||!wanted)throw new Error("El evento no pertenece al anunciante.");

  const next={...current};
  for(const[k,v]of Object.entries(data))if(!["evento_id","programacion"].includes(k))next[k]=v;
  next.evento_id=eventId;next.anunciante_id=advertiserId;next.id_anunciante=advertiserId;next.nivel=level;
  next.estado_moderacion="PENDIENTE";next.estado="PENDIENTE";next.actualizado=new Date().toISOString();
  const validation={...next,programacion:Object.prototype.hasOwnProperty.call(data,"programacion")?data.programacion:await db.queryEqual("evento_programacion","evento_id",eventId,500)};
  await validateEvent({db,cache,advertiserId,data:validation});
  const saved=await db.patch("eventos",eventId,next,{mustExist:true});
  let programacion=validation.programacion;
  if(Object.prototype.hasOwnProperty.call(data,"programacion")){
    programacion=await replaceProgramacion({db,cache,advertiserId,eventId,programacion:data.programacion,fallbackCity:next.ciudad_id});
  }
  await syncEventV2({db,cache,current,next:saved});
  return{
    success:true,
    updated:true,
    evento_id:eventId,
    estado_moderacion:"PENDIENTE",
    evento:{...saved,programacion:Array.isArray(programacion)?programacion:[]}
  };
}
export async function pauseEventV3({db,cache,advertiserId,payload,max,level="VIP"}){
  const eventId=text(payload&&payload.evento_id);if(!eventId)throw new Error("Falta evento_id.");
  const current=await db.get("eventos",eventId);
  const wanted=level==="FREE"?isFree(current):isVip(current);
  if(!current||text(current.anunciante_id||current.id_anunciante)!==text(advertiserId)||!wanted)throw new Error("El evento no pertenece al anunciante.");
  const pause=bool(payload&&((payload.pause!==undefined)?payload.pause:payload.pausado));
  if(!pause&&bool(current.pausado)){
    const q=await quota({db,advertiserId,max,free:level==="FREE",exclude:eventId});
    if(q.active>=q.max)throw new Error("Alcanzaste el máximo de eventos activos.");
  }
  const saved=await db.patch("eventos",eventId,{pausado:pause,actualizado:new Date().toISOString()},{mustExist:true});
  await syncEventV2({db,cache,current,next:saved});
  return{success:true,evento_id:eventId,evento:saved};
}
export async function deleteEventV3({db,cache,advertiserId,payload,level="VIP"}){
  const eventId=text(payload&&payload.evento_id);if(!eventId)throw new Error("Falta evento_id.");
  const current=await db.get("eventos",eventId);
  const wanted=level==="FREE"?isFree(current):isVip(current);
  if(!current||text(current.anunciante_id||current.id_anunciante)!==text(advertiserId)||!wanted)throw new Error("El evento no pertenece al anunciante.");
  const programas=await db.queryEqual("evento_programacion","evento_id",eventId,500);
  for(const p of programas){const pid=text(p.evento_programacion_id||p.id);if(pid)await db.delete("evento_programacion",pid);}
  await db.delete("eventos",eventId,{mustExist:true});
  await syncEventV2({db,cache,current,next:null});
  return{success:true,deleted:true,evento_id:eventId};
}
export async function duplicateVipV3({db,cache,advertiserId,payload,max,advertiser}){
  const sourceId=text(payload&&(payload.evento_id||payload.source_id));if(!sourceId)throw new Error("Falta evento_id.");
  const source=await db.get("eventos",sourceId);
  if(!source||text(source.anunciante_id||source.id_anunciante)!==text(advertiserId)||!isVip(source))throw new Error("El evento no pertenece al anunciante.");
  const programacion=await db.queryEqual("evento_programacion","evento_id",sourceId,500);
  const copy={...source,programacion,nombre_evento:text(payload.nombre_evento||(text(source.nombre_evento)+" - copia"))};
  for(const k of ["evento_id","id","fecha_carga","actualizado","estado_moderacion","estado","moderado_por","moderado_en"])delete copy[k];
  return createEventV3({db,cache,advertiserId,payload:copy,max,advertiser,level:"VIP"});
}
