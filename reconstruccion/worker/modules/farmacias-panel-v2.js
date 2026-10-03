/**
 * FARMACIAS PANEL V2
 * Usa las colecciones reales farmacias_ciclos + farmacias_ciclo_sedes.
 */
const text=v=>String(v??"").trim();

export async function farmaciasPanelDataV2({db,cache,advertiserId,featureAllowed,allowedCityIds=[]}){
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin||!featureAllowed(admin))return{success:false,message:"Farmacias de turno no habilitado."};

  const sedes=await db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId,500);
  const farmacias=allowedCityIds.length
    ? sedes.filter(s=>allowedCityIds.includes(text(s.ciudad_id)))
    : sedes;

  const ciclosAll=await db.listCollection("farmacias_ciclos");
  const ciclos=ciclosAll.filter(c=>
    text(c.anunciante_id)===text(advertiserId) ||
    allowedCityIds.includes(text(c.ciudad_id))
  );

  const cicloData=await Promise.all(ciclos.map(async c=>{
    const id=text(c.ciclo_id||c.id);
    const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500);
    return{...c,participantes};
  }));

  const territorio=(await cache.get("territorio:public:v1"))||{};
  const ciudades=allowedCityIds.length
    ? (territorio.ciudades||[]).filter(c=>allowedCityIds.includes(text(c.ciudad_id||c.id)))
    : territory.ciudades||[];

  return{success:true,farmacias,ciclos:cicloData,ciudades};
}
