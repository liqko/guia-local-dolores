/**
 * PUBLICIDAD PANEL V2
 * Catálogos desde KV. Hijos sólo de las publicidades del anunciante.
 */
const text=v=>String(v??"").trim();

export async function publicidadPanelDataV2({db,cache,advertiserId,featureEnabled,configFromAdmin}){
  const [admin,docs,catalogs]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("publicidades","anunciante_id",advertiserId,500),
    cache.get("catalogs:publicidad:v1")
  ]);
  if(!admin)return{success:false,message:"No existe la administración del anunciante."};
  if(!featureEnabled(admin))return{success:false,message:"El anunciante no tiene PUBLICIDAD habilitada."};

  const publicidades=await Promise.all(docs.map(async p=>{
    const id=text(p.publicidad_id||p.id);
    const [media,segmentacion]=await Promise.all([
      db.queryEqual("publicidad_media","publicidad_id",id,500),
      db.queryEqual("publicidad_segmentacion","publicidad_id",id,500)
    ]);
    return{...p,media,segmentacion};
  }));

  const config=configFromAdmin(admin);
  const fecha=new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
  const cambioId=advertiserId+"_"+fecha;
  const cambios=await db.get("publicidad_cambios",cambioId);
  const usados=Number(cambios&&cambios.usados||0);
  const max=Number(config.cambios_activos_por_dia_max||0);
  const activas=publicidades.filter(p=>text(p.estado).toUpperCase()==="ACTIVA").length;

  return{
    success:true,
    config,
    cupo:{
      activas,
      activas_max:Number(config.activas_max||0),
      guardadas:publicidades.length,
      guardadas_max:Number(config.guardadas_max||0)
    },
    cambios_activos:{
      usados,max,
      disponibles:max>0?Math.max(0,max-usados):0
    },
    categorias:(catalogs&&catalogs.categorias)||[],
    ubicaciones:(catalogs&&catalogs.ubicaciones)||[],
    prioridades:(catalogs&&catalogs.prioridades)||[],
    publicidades
  };
}
