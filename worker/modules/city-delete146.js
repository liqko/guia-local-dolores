// Ciudad: eliminación segura. El borrado de datos vinculados está prohibido en este primer alcance.
async function deleteCity146({env,request,db,cache,idFromPath="",skipDependencies146=false}){
 const auth=await authOr401(env,request);
 if(auth instanceof Response)return auth;
 if(auth.rol!=="SUPERADMIN_PRINCIPAL")return json({success:false,message:"Solo el administrador principal puede eliminar ciudades."},403);
 const id=text3(idFromPath),admin=packet(await cache.get(ADMIN_KEY)),pub=packet(await cache.get(PUBLIC_KEY));
 if(!admin.ciudades.some(row=>text3(row.ciudad_id||row.id)===id))return json({success:false,message:"Ciudad inexistente."},404);
 if(!GLD_ACTIONS138.isInternal(env))return json({success:false,message:"Debe intervenir el coordinador."},503);
 if(!skipDependencies146){
  const links=[
   ["anunciantes_sedes","ciudad_id"],["eventos","ciudad_id"],["evento_programacion","ciudad_id"],
   ["actividades","ciudad_id"],["actividad_horarios","ciudad_id"],["promos","ciudad_id"],
   ["publicidades","ciudad_id"],["publicidad_ubicaciones","ciudad_id"],["publicidad_segmentacion","ciudad_id"],
   ["farmacias_ciclos","ciudad_id"],["farmacias_participantes","ciudad_id"],["farmacias_ciclo_sedes","ciudad_id"],
   ["empleos","ciudad_id"],["lugares","ciudad_id"],["efemerides_bis","ciudad_id"],
   ["suscriptores","ciudad_origen_id"],["suscriptores","ciudad_predeterminada_id"],
   ["solicitudes_anunciante","ciudad_id"],["solicitudes_soporte","ciudad_id"]
  ];
  const found=[];
  for(const [collection,field] of links)if((await db.queryEqual(collection,field,id,1)).length)found.push(collection+"."+field);
  if(found.length)return json({success:false,code:"CITY_HAS_REFERENCES",message:"La ciudad tiene datos vinculados: no se eliminó nada.",referencias:found},409);
 }
 await db.delete(C.ciudades,id);
 const now=new Date().toISOString();
 await Promise.all([
  cache.put(ADMIN_KEY,{...admin,updated_at:now,ciudades:remove(admin.ciudades,"ciudad_id",id)}),
  cache.put(PUBLIC_KEY,{...pub,updated_at:now,ciudades:remove(pub.ciudades,"ciudad_id",id)})
 ]);
 return json({success:true,eliminada:true,ciudad_id:id});
}
