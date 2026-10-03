/**
 * MODULO COMMERCE / MODIFICAR DATOS
 * No devuelve ciudades. Territorio se obtiene por /territory/public.
 */
export async function commercePanelData({db, advertiserId, catalogs}){
  const [datos,administracion,sedes]=await Promise.all([
    db.get("anunciantes",advertiserId),
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId)
  ]);
  if(!datos) return {success:false,error:"anunciante_no_encontrado"};
  return {
    success:true,
    advertiser:{
      id:advertiserId,
      datos,
      administracion:administracion||{},
      sedes,
      segmentos:catalogs.segmentos||[],
      categorias:catalogs.categorias||[],
      actividades_clave:catalogs.actividades_clave||[],
      acciones:catalogs.acciones||[],
      nodos:catalogs.nodos||[],
      funcionalidades:catalogs.funcionalidades||[],
      niveles_anunciante:catalogs.niveles_anunciante||[]
    }
  };
}
