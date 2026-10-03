const text=v=>String(v??"").trim();
export const farmCityKeyV2=cityId=>"farmacias:city:v2:"+text(cityId);

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

  for(const city of targets){
    const key=farmCityKeyV2(city);
    const packet=(await cache.get(key))||{version:2,ciudad_id:city,updated_at:"",ciclos:[]};
    let rows=(packet.ciclos||[]).filter(x=>text(x.ciclo_id||x.id)!==id);

    if(next&&nextCity===city&&next.activo!==false){
      rows.push({...next,participantes:[...(participantes||[])],sedes:[...(sedes||[])]});
    }

    await cache.put(key,{
      version:2,
      ciudad_id:city,
      updated_at:new Date().toISOString(),
      ciclos:sortTurnos(rows)
    });
  }

  return{success:true,ciudades_actualizadas:targets};
}

export async function getFarmCityV2({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(farmCityKeyV2(city));
  return packet?{success:true,...packet}:{success:true,ciudad_id:city,ciclos:[],cold:true};
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
    if(c.activo===false)continue;
    const city=text(c.ciudad_id);
    if(!city)continue;
    const ps=partBy.get(text(c.ciclo_id||c.id))||[];
    const ss=ps.map(p=>sedeMap.get(text(p.sede_id))).filter(Boolean);
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push({...c,participantes:ps,sedes:ss});
  }

  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,ciclos])=>cache.put(farmCityKeyV2(city),{
    version:2,ciudad_id:city,updated_at:now,ciclos:sortTurnos(ciclos)
  })));

  return{success:true,ciudades:byCity.size,ciclos:cycles.length,updated_at:now};
}
