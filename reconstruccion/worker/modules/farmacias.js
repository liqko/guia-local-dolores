/**
 * MODULO FARMACIAS
 * No devuelve catálogo global de ciudades.
 */
export async function farmaciasPanelData({db, advertiserId, featureAllowed}){
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin || !featureAllowed(admin)) return {success:false,message:"Farmacias de turno no habilitado."};
  const [sedes,ciclos,participantes]=await Promise.all([
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId),
    db.queryEqual("farmacias_ciclos","anunciante_id",advertiserId),
    db.queryEqual("farmacias_participantes","anunciante_id",advertiserId)
  ]);
  return {success:true,farmacias:sedes,ciclos,participantes};
}
