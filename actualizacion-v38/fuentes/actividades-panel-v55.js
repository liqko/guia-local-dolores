/**
 * MODULO ACTIVIDADES
 * No consulta colección ciudades.
 */
export async function actividadesPanelData({db, advertiserId, categorias, lugares, featureAllowed, cupoMax}){
  if(db.panelReadDb)db=db.panelReadDb();
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin || !featureAllowed(admin)) return {success:false,message:"No tenés habilitado el módulo Actividades."};
  const [actividades,sedes]=await Promise.all([
    db.queryEqual("actividades","anunciante_id",advertiserId,500),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId,500)
  ]);
  const conHorarios=await Promise.all(actividades.map(async a=>({
    ...a,
    horarios:await db.queryEqual("actividad_horarios","actividad_id",String(a.actividad_id||a.id||""),500)
  })));
  const max=Number(cupoMax(admin)||0);
  const activas=conHorarios.filter(a=>a.activo!==false && String(a.estado||"").toUpperCase()!=="PAUSADA").length;
  return {
    success:true,
    permisos:{actividades:true,actividades_cant:max},
    cupo:{max,activas,total:conHorarios.length,totalMax:max>0?max*2:0},
    lugares:lugares||[],
    sedes,
    categorias:categorias||[],
    actividades:conHorarios
  };
}
