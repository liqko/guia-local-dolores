const text=v=>String(v??"").trim();
export const farmCityKey=cityId=>"farmacias:city:v1:"+text(cityId);

function sortTurnos(rows){
  return [...rows].sort((a,b)=>{
    const ad=text(a.fecha_inicio)+" "+text(a.hora_inicio);
    const bd=text(b.fecha_inicio)+" "+text(b.hora_inicio);
    return ad.localeCompare(bd);
  });
}
export async function syncFarmCycle({db,cache,cycleId,previousCity=""}){
  const id=text(cycleId);
  const cycle=await db.get("farmacias_ciclos",id);
  const nextCity=text(cycle&&cycle.ciudad_id);
  const targets=[...new Set([text(previousCity),nextCity].filter(Boolean))];
  for(const city of targets){
    const key=farmCityKey(city);
    const packet=(await cache.get(key))||{version:1,ciudad_id:city,updated_at:"",ciclos:[]};
    let rows=(packet.ciclos||[]).filter(x=>text(x.ciclo_id||x.id)!==id);
    if(cycle&&nextCity===city){
      const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id);
      const sedeIds=[...new Set(participantes.map(x=>text(x.sede_id)).filter(Boolean))];
      const sedes=[];
      for(const sid of sedeIds){
        const s=await db.get("anunciantes_sedes",sid);
        if(s)sedes.push(s);
      }
      rows.push({...cycle,participantes,sedes});
    }
    await cache.put(key,{version:1,ciudad_id:city,updated_at:new Date().toISOString(),ciclos:sortTurnos(rows)});
  }
  return{success:true,ciudades_actualizadas:targets};
}
export async function getFarmCity({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const p=await cache.get(farmCityKey(city));
  return p?{success:true,...p}:{success:true,ciudad_id:city,ciclos:[],cold:true};
}
export async function rebuildFarmAll({db,cache}){
  const [cycles,participants,sedes]=await Promise.all([
    db.listCollection("farmacias_ciclos"),
    db.listCollection("farmacias_ciclo_sedes"),
    db.listCollection("anunciantes_sedes")
  ]);
  const partBy=new Map(),sedeMap=new Map(sedes.map(s=>[text(s.sede_id||s.id),s]));
  for(const p of participants){
    const id=text(p.ciclo_id);if(!partBy.has(id))partBy.set(id,[]);
    partBy.get(id).push(p);
  }
  const byCity=new Map();
  for(const c of cycles){
    const city=text(c.ciudad_id);if(!city)continue;
    const ps=partBy.get(text(c.ciclo_id||c.id))||[];
    const ss=ps.map(p=>sedeMap.get(text(p.sede_id))).filter(Boolean);
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push({...c,participantes:ps,sedes:ss});
  }
  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,ciclos])=>cache.put(farmCityKey(city),{
    version:1,ciudad_id:city,updated_at:now,ciclos:sortTurnos(ciclos)
  })));
  return{success:true,ciudades:byCity.size,ciclos:cycles.length,updated_at:now};
}
