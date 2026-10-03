/**
 * FARMACIAS PANEL V3
 * Sin scans globales: ciclos se consultan por anunciante_id.
 */
const text=v=>String(v??"").trim();

export async function farmaciasPanelDataV3({db,cache,advertiserId,featureAllowed,allowedCityIds=[]}){
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin||!featureAllowed(admin))return{success:false,message:"Farmacias de turno no habilitado."};

  const [sedes,ciclos,territorio]=await Promise.all([
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId,500),
    db.queryEqual("farmacias_ciclos","anunciante_id",advertiserId,500),
    cache.get("territorio:public:v1")
  ]);

  const farmacias=allowedCityIds.length
    ? sedes.filter(s=>allowedCityIds.includes(text(s.ciudad_id)))
    : sedes;

  const cicloData=await Promise.all(ciclos.map(async c=>{
    const id=text(c.ciclo_id||c.id);
    const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500);
    return{...c,participantes};
  }));

  const ciudades=allowedCityIds.length
    ? ((territorio&&territorio.ciudades)||[]).filter(c=>allowedCityIds.includes(text(c.ciudad_id||c.id)))
    : ((territorio&&territorio.ciudades)||[]);

  return{
    success:true,
    farmacias,
    ciclos:cicloData,
    participantes:cicloData.flatMap(c=>Array.isArray(c.participantes)?c.participantes:[]),
    ciudades
  };
}
