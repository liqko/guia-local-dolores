const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
export const efemCityKeyV2=cityId=>"efemerides:city:v2:"+text(cityId);

function matchesCity(e,city,territory){
  const tipo=text(e&&e.tipo).toUpperCase();
  if(tipo==="GENERAL")return true;
  if(tipo==="LOCAL")return text(e.ciudad_id)===city;
  if(tipo==="PROVINCIAL"){
    const c=(territory.ciudades||[]).find(x=>text(x.ciudad_id||x.id)===city)||{};
    return text(e.provincia_id)===text(c.provincia_id);
  }
  return false;
}
function targetsFor(e,territory){
  const out=new Set();
  if(!e)return out;
  const tipo=text(e.tipo).toUpperCase();
  if(tipo==="LOCAL"&&text(e.ciudad_id))out.add(text(e.ciudad_id));
  if(tipo==="PROVINCIAL"){
    for(const c of territory.ciudades||[]){
      if(text(c.provincia_id)===text(e.provincia_id))out.add(text(c.ciudad_id||c.id));
    }
  }
  if(tipo==="GENERAL"){
    for(const c of territory.ciudades||[])out.add(text(c.ciudad_id||c.id));
  }
  return out;
}
export async function syncEfemeridePreparedV2({cache,efemerideId,previous=null,next=null}){
  const id=text(efemerideId);
  const territory=(await cache.get("territorio:public:v1"))||{};
  const targets=new Set([...targetsFor(previous,territory),...targetsFor(next,territory)]);

  for(const city of [...targets].filter(Boolean)){
    const key=efemCityKeyV2(city);
    const packet=(await cache.get(key))||{version:2,ciudad_id:city,updated_at:"",efemerides:[]};
    let rows=(packet.efemerides||[]).filter(x=>text(x.efemeride_id||x.id)!==id);
    if(next&&(next.activo===undefined||bool(next.activo))&&matchesCity(next,city,territory))rows.push(next);
    await cache.put(key,{version:2,ciudad_id:city,updated_at:new Date().toISOString(),efemerides:rows});
  }

  return{success:true,ciudades_actualizadas:[...targets]};
}
export async function getEfemCityV2({cache,cityId}){
  const city=text(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(efemCityKeyV2(city));
  return packet?{success:true,...packet}:{success:true,ciudad_id:city,efemerides:[],cold:true};
}
export async function rebuildEfemeridesAllV3({db,cache}){
  const [rows,territory]=await Promise.all([
    db.listCollection("efemerides_bis"),
    cache.get("territorio:public:v1")
  ]);
  if(!territory)throw new Error("Territorio público no inicializado.");

  const active=rows.filter(x=>x.activo===undefined||bool(x.activo));
  const now=new Date().toISOString(),writes=[];

  for(const c of territory.ciudades||[]){
    const city=text(c.ciudad_id||c.id);
    if(!city)continue;
    writes.push(cache.put(efemCityKeyV2(city),{
      version:2,
      ciudad_id:city,
      updated_at:now,
      efemerides:active.filter(e=>matchesCity(e,city,territory))
    }));
  }
  await Promise.all(writes);
  return{success:true,ciudades:writes.length,efemerides:rows.length,activas:active.length,updated_at:now};
}
