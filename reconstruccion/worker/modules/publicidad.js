/**
 * MODULO PUBLICIDAD
 * Ciudades fuera del panel data: el HTML usa /territory/public.
 */
export async function publicidadPanelData({db, advertiserId, catalogs, featureEnabled, configFromAdmin, cambiosHoy, enrichMany}){
  const [admin,publicidades]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("publicidades","anunciante_id",advertiserId)
  ]);
  if(!admin) return {success:false,message:"No existe la administración del anunciante."};
  if(!featureEnabled(admin)) return {success:false,message:"El anunciante no tiene PUBLICIDAD habilitada."};
  const config=configFromAdmin(admin);
  if(enrichMany) await enrichMany(publicidades);
  const activas=publicidades.filter(p=>String(p.estado||"").toUpperCase()==="ACTIVA").length;
  return {
    success:true,
    config,
    cupo:{activas,activas_max:config.activas_max,guardadas:publicidades.length,guardadas_max:config.guardadas_max},
    cambios_activos:await cambiosHoy(advertiserId,config),
    categorias:catalogs.categorias||[],
    ubicaciones:catalogs.ubicaciones||[],
    prioridades:catalogs.prioridades||[],
    publicidades
  };
}
