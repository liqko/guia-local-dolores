/**
 * EVENTOS PANEL V2
 * Datos propios del anunciante + programación.
 * No devuelve ciudades: usa /territory/public.
 */
const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\s_-]+/g,"");
const isFree=e=>text(e&&e.nivel).toUpperCase()==="FREE";

export async function eventsPanelDataV2({db,cache,advertiserId,featureEnabled,cupo}){
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin,advertiser,events,sedes,catalogs]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.get("anunciantes",advertiserId),
    db.queryEqual("eventos","anunciante_id",advertiserId,500),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId,500),
    cache.get("catalogs:eventos:v1")
  ]);

  if(!admin)return{success:false,message:"No existe la administración del anunciante."};

  const enriched=await Promise.all(events.map(async e=>({
    ...e,
    programacion:await db.queryEqual("evento_programacion","evento_id",text(e.evento_id||e.id),500)
  })));

  return{
    success:true,
    advertiser:advertiser||{id:advertiserId},
    funcionalidades:{
      eventos:!!featureEnabled(admin,"EVENTOS"),
      eventos_free:!!featureEnabled(admin,"EVENTOS_FREE")
    },
    eventos_cant:Number(cupo(admin,"EVENTOS")||0),
    eventos_free_cant:Number(cupo(admin,"EVENTOS_FREE")||0),
    categorias:(catalogs&&catalogs.categorias)||[],
    lugares:[...((catalogs&&catalogs.lugares)||[]),...sedes],
    partners:(catalogs&&catalogs.partners)||[],
    eventos:enriched.filter(e=>!isFree(e)),
    eventos_free:enriched.filter(isFree)
  };
}

export async function checkFreeDuplicatesV2({db,payload}){
  const data=payload&&typeof payload==="object"?payload:{};
  const city=text(data.ciudad_id);
  if(!city)return[];
  const rows=await db.queryEqual("eventos","ciudad_id",city,300);
  const wantedName=norm(data.nombre_evento);
  const wantedPlace=norm(data.lugar||data.lugar_texto);
  const wantedDate=text(data.fecha_desde);

  return rows
    .filter(isFree)
    .filter(e=>{
      const sameDate=wantedDate&&text(e.fecha_desde)===wantedDate;
      const sameName=wantedName&&norm(e.nombre_evento)===wantedName;
      const samePlace=wantedPlace&&norm(e.lugar||e.lugar_texto)===wantedPlace;
      return sameDate&&(sameName||samePlace);
    })
    .slice(0,5);
}
