/**
 * FARMACIAS PANEL V3
 * Sin scans globales: ciclos se consultan por anunciante_id.
 */
const text=v=>String(v??"").trim();
const active=v=>!text(v)||["activa","activo","true","1","x"].includes(text(v).toLowerCase());
// Selección territorial desde la guía preparada: el administrador de turnos
// no es necesariamente propietario de las farmacias que participan.
async function pharmacyCatalog(cache,cityIds,cycles){
  const catalogs=(await cache.get("catalogs:commerce:v1"))||{};
  const pharmacyIds=new Set((catalogs.categorias||[]).filter(c=>
    [c.nombre,c.titulo,c.categoria].some(v=>text(v).toLowerCase().includes("farmacia"))
  ).map(c=>text(c.categoria_id||c.id)));
  const participantIds=new Set(cycles.flatMap(c=>(c.participantes||[]).map(p=>text(p.sede_id))));
  const result=new Map();
  await Promise.all(cityIds.map(async city=>{
    const packet=await cache.get("guide:city:v1:"+city);
    for(const card of packet?.anunciantes||[]){
      const categories=Array.isArray(card.categoria_ids)?card.categoria_ids:text(card.categoria_ids||card.categoria_id).split(/[;,|]+/);
      const byCategory=categories.some(id=>pharmacyIds.has(text(id)))||(card.categorias||[]).some(v=>text(v).toLowerCase().includes("farmacia"));
      for(const sede of card.sedes||[]){
        const id=text(sede.sede_id||sede.id);
        if(!id||text(sede.ciudad_id||card.ciudad_id)!==city||!active(sede.estado))continue;
        const byName=[card.nombre,sede.nombre_ref,sede.nombre_sede,sede.nombre].some(v=>text(v).toLowerCase().includes("farmacia"));
        if(!byName&&!byCategory&&!participantIds.has(id))continue;
        // Sólo información de contacto preparada para la vista pública.
        const row={...sede,sede_id:id,anunciante_id:text(card.id||card.anunciante_id),ciudad_id:city,nombre_ref:text(card.nombre||sede.nombre_ref),nombre_sede:text(sede.nombre_sede),estado:"ACTIVA"};
        for(const key of ["telefono","telefono2","telefono3","telefono4","telefono5","whatsapp","whatsapp2","whatsapp3","whatsapp4","whatsapp5","mail","instagram","facebook","logo"])row[key]=text(sede[key]||card[key]);
        result.set(id,row);
      }
    }
  }));
  return [...result.values()].sort((a,b)=>text(a.nombre_ref||a.nombre_sede).localeCompare(text(b.nombre_ref||b.nombre_sede),"es"));
}

export async function farmaciasPanelDataV3({db,cache,advertiserId,featureAllowed,allowedCityIds=[]}){
  if(db.panelReadDb)db=db.panelReadDb();
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin||!featureAllowed(admin))return{success:false,message:"Farmacias de turno no habilitado."};

  const [ciclos,territorio]=await Promise.all([
    db.queryEqual("farmacias_ciclos","anunciante_id",advertiserId,500),
    cache.get("territorio:public:v1")
  ]);

  const cicloData=await Promise.all(ciclos.map(async c=>{
    const id=text(c.ciclo_id||c.id);
    const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500);
    return{...c,participantes};
  }));

  const ciudades=allowedCityIds.length
    ? ((territorio&&territorio.ciudades)||[]).filter(c=>allowedCityIds.includes(text(c.ciudad_id||c.id)))
    : ((territorio&&territorio.ciudades)||[]);

  const farmacias=await pharmacyCatalog(cache,ciudades.map(c=>text(c.ciudad_id||c.id)).filter(Boolean),cicloData);
  return{
    success:true,
    farmacias,
    ciclos:cicloData,
    participantes:cicloData.flatMap(c=>Array.isArray(c.participantes)?c.participantes:[]),
    ciudades
  };
}
