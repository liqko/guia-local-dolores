/**
 * MODULO EVENTOS
 * Territorio fuera del módulo. No devuelve ciudades.
 */
export async function eventosPanelData({db, advertiserId, catalogs, featureEnabled, cupo, enrichPrograms}){
  const [admin,advertiser,eventos,sedes]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.get("anunciantes",advertiserId),
    db.queryEqual("eventos","anunciante_id",advertiserId),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId)
  ]);
  if(!admin) return {success:false,message:"No existe la administración del anunciante."};
  const vip=eventos.filter(e=>String(e.nivel||"").toUpperCase()!=="FREE");
  const free=eventos.filter(e=>String(e.nivel||"").toUpperCase()==="FREE");
  if(enrichPrograms) await enrichPrograms(vip);
  return {
    success:true,
    advertiser:advertiser||{id:advertiserId},
    funcionalidades:{
      eventos:!!featureEnabled(admin,"EVENTOS"),
      eventos_free:!!featureEnabled(admin,"EVENTOS_FREE")
    },
    eventos_cant:Number(cupo(admin,"EVENTOS")||0),
    eventos_free_cant:Number(cupo(admin,"EVENTOS_FREE")||0),
    categorias:catalogs.categorias||[],
    lugares:[...(catalogs.lugares||[]),...sedes],
    partners:catalogs.partners||[],
    eventos:vip,
    eventos_free:free
  };
}
