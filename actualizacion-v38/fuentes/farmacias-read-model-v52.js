import {putPreparedRelationsV1} from "./prepared-relations-v1.js";
const text=v=>String(v??"").trim();
export const farmCityKeyV2=cityId=>"farmacias:city:v2:"+text(cityId);

async function prepareFarmSedes(cache,city,sedes,guide=null){
  guide=guide||(await cache.get("guide:city:v1:"+text(city)))||{};
  const names=new Map();
  for(const card of guide.anunciantes||[])for(const sede of card.sedes||[]){
    if(text(sede.ciudad_id||card.ciudad_id)!==text(city))continue;
    const id=text(sede.sede_id||sede.id);
    if(id)names.set(id,{nombre_ref:text(card.nombre||sede.nombre_ref),nombre_sede:text(sede.nombre_sede)});
  }
  const used=new Set((sedes||[]).map(row=>text(row.sede_id||row.id)));
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([...names].filter(([id])=>used.has(id)).sort(([a],[b])=>a.localeCompare(b)))));
  const revision="52:"+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
  const useful=v=>text(v)&&text(v).toLowerCase()!=="farmacia";
  return{revision,sedes:(sedes||[]).map(row=>{
    const prepared=names.get(text(row.sede_id||row.id));
    if(!prepared)return row;
    // El nombre de sucursal y el del anunciante son datos distintos.
    return{...row,nombre_ref:prepared.nombre_ref||text(row.nombre_ref||row.nombre),
      nombre_sede:prepared.nombre_sede||(useful(row.nombre_sede)?text(row.nombre_sede):"")};
  })};
}

function sortTurnos(rows){
  return [...rows].sort((a,b)=>{
    const ad=text(a.fecha_inicio)+" "+text(a.hora_inicio);
    const bd=text(b.fecha_inicio)+" "+text(b.hora_inicio);
    return ad.localeCompare(bd);
  });
}

export async function syncFarmCyclePreparedV2({
  cache,
  cycleId,
  current=null,
  next=null,
  participantes=[],
  sedes=[],
  previousCity=""
}){
  const id=text(cycleId||next&&next.ciclo_id||current&&current.ciclo_id);
  const nextCity=text(next&&next.ciudad_id);
  const targets=[...new Set([text(previousCity),text(current&&current.ciudad_id),nextCity].filter(Boolean))];

  const prepared=await prepareFarmSedes(cache,nextCity||text(current&&current.ciudad_id),sedes);
  sedes=prepared.sedes;
  for(const city of targets){
    const key=farmCityKeyV2(city);
    const packet=(await cache.get(key))||{version:2,ciudad_id:city,updated_at:"",ciclos:[]};
    let rows=(packet.ciclos||[]).filter(x=>text(x.ciclo_id||x.id)!==id);

    if(next&&nextCity===city&&next.activo!==false){
      rows.push({...next,participantes:[...(participantes||[])],sedes:[...(sedes||[])]});
    }

    const guide=(await cache.get("guide:city:v1:"+city))||{};
    const completeRows=await Promise.all(rows.map(async c=>({...c,sedes:(await prepareFarmSedes(cache,city,c.sedes,guide)).sedes})));
    await cache.put(key,{
      version:2,
      ciudad_id:city,
      updated_at:new Date().toISOString(),
      ciclos:sortTurnos(completeRows),
      names_revision:(await prepareFarmSedes(cache,city,completeRows.flatMap(c=>c.sedes||[]),guide)).revision
    });
  }

  await putPreparedRelationsV1({cache,type:"farm",id,next,data:{participantes,sedes}});
  return{success:true,ciudades_actualizadas:targets};
}

export async function getFarmCityV2({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const key=farmCityKeyV2(city),packet=await cache.get(key);
  if(!packet)return{success:true,ciudad_id:city,ciclos:[],cold:true};
  if(!(packet.ciclos||[]).length)return{success:true,...packet};
  const guide=(await cache.get("guide:city:v1:"+city))||{};
  const context=await prepareFarmSedes(cache,city,packet.ciclos.flatMap(c=>c.sedes||[]),guide);
  if(packet.names_revision===context.revision)return{success:true,...packet};
  // Actualizar únicamente la copia KV del ciclo existente. Nunca Firestore,
  // nunca cambiar fechas, orden o participantes, ni exigir recrear el ciclo.
  const ciclos=await Promise.all(packet.ciclos.map(async c=>({...c,sedes:(await prepareFarmSedes(cache,city,c.sedes,guide)).sedes})));
  const next={...packet,ciclos,names_revision:context.revision};
  try{await cache.put(key,next)}catch(_){} // KV puede propagar lentamente; la respuesta sigue completa.
  return{success:true,...next};
}

export async function rebuildFarmAllV2({db,cache}){
  const [cycles,participants,sedes]=await Promise.all([
    db.listCollection("farmacias_ciclos"),
    db.listCollection("farmacias_ciclo_sedes"),
    db.listCollection("anunciantes_sedes")
  ]);

  const partBy=new Map();
  for(const p of participants){
    const id=text(p.ciclo_id);
    if(!partBy.has(id))partBy.set(id,[]);
    partBy.get(id).push(p);
  }

  const sedeMap=new Map(sedes.map(s=>[text(s.sede_id||s.id),s]));
  const byCity=new Map();

  for(const c of cycles){
    const preparedId=text(c.ciclo_id||c.id),preparedParts=partBy.get(preparedId)||[];
    const prepared=await prepareFarmSedes(cache,text(c.ciudad_id),preparedParts.map(p=>sedeMap.get(text(p.sede_id))).filter(Boolean));
    await putPreparedRelationsV1({cache,type:"farm",id:preparedId,next:c,data:{
      participantes:preparedParts,sedes:prepared.sedes
    }});
    if(c.activo===false)continue;
    const city=text(c.ciudad_id);
    if(!city)continue;
    const ps=partBy.get(text(c.ciclo_id||c.id))||[];
    const ss=prepared.sedes;
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push({...c,participantes:ps,sedes:ss});
  }

  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(async ([city,ciclos])=>cache.put(farmCityKeyV2(city),{
    version:2,ciudad_id:city,updated_at:now,ciclos:sortTurnos(ciclos),names_revision:(await prepareFarmSedes(cache,city,ciclos.flatMap(c=>c.sedes||[]))).revision
  })));

  return{success:true,ciudades:byCity.size,ciclos:cycles.length,updated_at:now};
}
