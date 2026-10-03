const text=v=>String(v??"").trim();
export const publicityCityKeyV2=cityId=>"publicity:city:v2:"+text(cityId);

function isActive(p){
  return text(p&&p.estado).toUpperCase()==="ACTIVA";
}
function sort(rows){
  return [...rows].sort((a,b)=>text(a.titulo||a.nombre_interno).localeCompare(text(b.titulo||b.nombre_interno),"es",{sensitivity:"base"}));
}

export async function syncPublicityPreparedV2({
  cache,
  publicityId,
  current=null,
  next=null,
  segmentacion=[],
  media=[],
  previousCities=[]
}){
  const id=text(publicityId||next&&next.publicidad_id||current&&current.publicidad_id);
  const currentCities=[...new Set((segmentacion||[]).map(x=>text(x.ciudad_id)).filter(Boolean))];
  const targets=[...new Set([...(previousCities||[]).map(text),...currentCities].filter(Boolean))];

  for(const cityId of targets){
    const key=publicityCityKeyV2(cityId);
    const packet=(await cache.get(key))||{version:2,ciudad_id:cityId,updated_at:"",publicidades:[]};
    let rows=(packet.publicidades||[]).filter(x=>text(x.publicidad_id||x.id)!==id);

    if(next&&isActive(next)&&currentCities.includes(cityId)){
      rows.push({
        ...next,
        media:[...(media||[])],
        segmentacion:(segmentacion||[]).filter(x=>text(x.ciudad_id)===cityId)
      });
    }

    await cache.put(key,{
      version:2,
      ciudad_id:cityId,
      updated_at:new Date().toISOString(),
      publicidades:sort(rows)
    });
  }

  return{success:true,ciudades_actualizadas:targets};
}

export async function getPublicityCityV2({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(publicityCityKeyV2(city));
  return packet?{success:true,...packet}:{success:true,ciudad_id:city,publicidades:[],cold:true};
}

export async function rebuildPublicityAllV2({db,cache}){
  const [docs,seg,media]=await Promise.all([
    db.listCollection("publicidades"),
    db.listCollection("publicidad_segmentacion"),
    db.listCollection("publicidad_media")
  ]);

  const segBy=new Map(),mediaBy=new Map();
  for(const x of seg){
    const id=text(x.publicidad_id);
    if(!segBy.has(id))segBy.set(id,[]);
    segBy.get(id).push(x);
  }
  for(const x of media){
    const id=text(x.publicidad_id);
    if(!mediaBy.has(id))mediaBy.set(id,[]);
    mediaBy.get(id).push(x);
  }

  const byCity=new Map();
  for(const d of docs){
    if(!isActive(d))continue;
    const id=text(d.publicidad_id||d.id);
    for(const s of (segBy.get(id)||[])){
      const city=text(s.ciudad_id);
      if(!city)continue;
      if(!byCity.has(city))byCity.set(city,[]);
      if(!byCity.get(city).some(x=>text(x.publicidad_id||x.id)===id)){
        byCity.get(city).push({
          ...d,
          media:mediaBy.get(id)||[],
          segmentacion:(segBy.get(id)||[]).filter(x=>text(x.ciudad_id)===city)
        });
      }
    }
  }

  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([city,publicidades])=>cache.put(publicityCityKeyV2(city),{
    version:2,ciudad_id:city,updated_at:now,publicidades:sort(publicidades)
  })));

  return{success:true,ciudades:byCity.size,publicidades:docs.length,updated_at:now};
}
