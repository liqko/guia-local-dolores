/**
 * MODULO PROMOS
 * getPanelData no devuelve ciudades.
 */
export async function promosPanelData({db, advertiserId, categories, cupoFromAdmin}){
  const [admin,advertiser,sedes,promos]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.get("anunciantes",advertiserId),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId),
    db.queryEqual("promos","anunciante_id",advertiserId)
  ]);
  if(!admin) return {success:false,message:"No existe la administración del anunciante."};
  return {
    success:true,
    advertiser:advertiser||{id:advertiserId},
    sedes,
    categorias:categories||[],
    promos,
    promos_cant:Number(cupoFromAdmin(admin)||0)
  };
}
