const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
export const activityCityKeyV2=cityId=>"activities:city:v2:"+text(cityId);

function isPublic(a){
  if(!a||!bool(a.activo)||!bool(a.aprobado))return false;
  const estado=text(a.estado).toUpperCase();
  if(["PAUSADA","PAUSADO","INACTIVA","INACTIVO","BORRADOR","ELIMINADA","ELIMINADO","RECHAZADA","RECHAZADO"].includes(estado))return false;
  const hoy=new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
  if(text(a.vigente_desde)&&text(a.vigente_desde)>hoy)return false;
  if(text(a.vigente_hasta)&&text(a.vigente_hasta)<hoy)return false;
  return true;
}
function sort(rows){
  return [...rows].sort((a,b)=>text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"}));
}
export async function syncActivityPreparedV2({cache,activityId,current=null,next=null,horarios=[],previousCities=[]}){
  const id=text(activityId||next&&next.actividad_id||current&&current.actividad_id);
  const currentCities=[...new Set((horarios||[]).map(h=>text(h.ciudad_id)).filter(Boolean))];
  const targets=[...new Set([...(previousCities||[]).map(text),...currentCities].filter(Boolean))];

  for(const cityId of targets){
    const key=activityCityKeyV2(cityId);
    const packet=(await cache.get(key))||{version:2,ciudad_id:cityId,updated_at:"",actividades:[]};
    let rows=(packet.actividades||[]).filter(x=>text(x.actividad_id||x.id)!==id);

    if(next&&isPublic(next)){
      const hs=(horarios||[]).filter(h=>text(h.ciudad_id)===cityId&&(h.activo===undefined||bool(h.activo)));
      if(hs.length)rows.push({...next,horarios:hs});
    }

    await cache.put(key,{version:2,ciudad_id:cityId,updated_at:new Date().toISOString(),actividades:sort(rows)});
  }
  return{success:true,ciudades_actualizadas:targets};
}

export async function getActivitiesCityV2({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(activityCityKeyV2(city));
  return packet?{success:true,...packet,actividades:(packet.actividades||[]).filter(isPublic)}:{success:true,ciudad_id:city,actividades:[],cold:true};
}

export async function rebuildActivitiesAllV2({db,cache}){
  const [activities,schedules]=await Promise.all([
    db.listCollection("actividades"),
    db.listCollection("actividad_horarios")
  ]);

  const byAct=new Map();
  for(const h of schedules){
    const id=text(h.actividad_id);if(!id)continue;
    if(!byAct.has(id))byAct.set(id,[]);
    byAct.get(id).push(h);
  }

  const byCity=new Map();
  for(const a of activities){
    if(!isPublic(a))continue;
    const id=text(a.actividad_id||a.id),groups=new Map();

    for(const h of (byAct.get(id)||[])){
      if(h.activo!==undefined&&!bool(h.activo))continue;
      const city=text(h.ciudad_id);if(!city)continue;
      if(!groups.has(city))groups.set(city,[]);
      groups.get(city).push(h);
    }

    for(const [city,hs] of groups){
      if(!byCity.has(city))byCity.set(city,[]);
      byCity.get(city).push({...a,horarios:hs});
    }
  }

  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,actividades])=>cache.put(activityCityKeyV2(city),{
    version:2,ciudad_id:city,updated_at:now,actividades:sort(actividades)
  })));

  return{success:true,ciudades:byCity.size,actividades:activities.length,updated_at:now};
}
