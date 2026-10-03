/**
 * REBUILD EFEMERIDES — mantenimiento explícito.
 * Nunca se ejecuta desde una lectura pública o una mutación normal.
 */
const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
const key=cityId=>"efemerides:city:v1:"+text(cityId);

function applies(e,city,territory){
  const tipo=text(e.tipo).toUpperCase();
  if(tipo==="GENERAL")return true;
  if(tipo==="LOCAL")return text(e.ciudad_id)===city;
  if(tipo==="PROVINCIAL"){
    const c=(territory.ciudades||[]).find(x=>text(x.ciudad_id||x.id)===city)||{};
    return text(e.provincia_id)===text(c.provincia_id);
  }
  return false;
}

export async function rebuildEfemeridesAllV2({db,cache}){
  const [rows,territory]=await Promise.all([
    db.listCollection("efemerides_bis"),
    cache.get("territorio:public:v1")
  ]);
  if(!territory)throw new Error("Territorio público no inicializado.");

  const active=rows.filter(x=>x.activo===undefined||bool(x.activo));
  const now=new Date().toISOString();
  const writes=[];

  for(const city of (territory.ciudades||[])){
    const cityId=text(city.ciudad_id||city.id);
    if(!cityId)continue;
    const efemerides=active.filter(e=>applies(e,cityId,territory));
    writes.push(cache.put(key(cityId),{
      version:1,
      ciudad_id:cityId,
      updated_at:now,
      efemerides
    }));
  }

  await Promise.all(writes);

  return{
    success:true,
    ciudades:writes.length,
    efemerides:rows.length,
    activas:active.length,
    updated_at:now
  };
}
