// Ciudad: eliminación segura. El borrado de datos vinculados está prohibido en este primer alcance.
async function deleteCity146({env,request,db,cache,idFromPath="",skipDependencies146=false}){
 const auth=await authOr401(env,request);
 if(auth instanceof Response)return auth;
 if(auth.rol!=="SUPERADMIN_PRINCIPAL")return json({success:false,message:"Solo el administrador principal puede eliminar ciudades."},403);
 const id=text3(idFromPath),admin=packet(await cache.get(ADMIN_KEY)),pub=packet(await cache.get(PUBLIC_KEY));
 if(!admin.ciudades.some(row=>text3(row.ciudad_id||row.id)===id))return json({success:false,message:"Ciudad inexistente."},404);
 if(!GLD_ACTIONS138.isInternal(env))return json({success:false,message:"Debe intervenir el coordinador."},503);
 if(!skipDependencies146){
  // La sede pertenece a una sola ciudad. El anunciante es compartido y se conserva.
  const sedes=await db.queryEqual("anunciantes_sedes","ciudad_id",id,500);
  if(sedes.length===500)return json({success:false,message:"Demasiadas sedes: se requiere borrado por lotes; no se modificó nada."},409);
  // No eliminar contenido compartido sin revisar sus relaciones: evita borrar datos de otras ciudades.
  const complex=[
   ["eventos","ciudad_id"],["evento_programacion","ciudad_id"],["actividades","ciudad_id"],
   ["actividad_horarios","ciudad_id"],["promos","ciudad_id"],["publicidades","ciudad_id"],
   ["publicidad_segmentacion","ciudad_id"],["publicidad_ubicaciones","ciudad_id"],
   ["farmacias_ciclos","ciudad_id"],["farmacias_ciclo_sedes","ciudad_id"],
   ["farmacias_participantes","ciudad_id"],["efemerides_bis","ciudad_id"],
   ["suscriptores","ciudad_origen_id"],["suscriptores","ciudad_predeterminada_id"]
  ];
  const blocked=[];
  for(const [collection,field] of complex)
   if((await db.queryEqual(collection,field,id,1)).length)blocked.push(collection+"."+field);
  if(blocked.length)return json({success:false,code:"CITY_HAS_COMPLEX_REFERENCES",message:"Hay publicaciones o referencias que requieren eliminación territorial específica. No se eliminó nada.",referencias:blocked},409);
  const direct=[
   ["empleos","ciudad_id","empleo_id"],["lugares","ciudad_id","lugar_id"],
   ["solicitudes_anunciante","ciudad_id","solicitud_id"],
   ["solicitudes_soporte","ciudad_id","solicitud_id"]
  ];
  const planned=[];
  for(const [collection,field,idField] of direct){
   const rows=await db.queryEqual(collection,field,id,500);
   if(rows.length===500)return json({success:false,message:"Demasiados registros en "+collection+". No se eliminó nada."},409);
   for(const row of rows){
    const rid=text3(row[idField]||row.id);
    if(!rid)return json({success:false,message:"Registro sin ID en "+collection+". No se eliminó nada."},409);
    planned.push({collection,id:rid});
   }
  }
  for(const row of sedes){
   const rid=text3(row.sede_id||row.id);
   if(!rid)return json({success:false,message:"Sede sin ID: no se eliminó nada."},409);
   planned.push({collection:"anunciantes_sedes",id:rid});
  }
  for(const row of planned)await db.delete(row.collection,row.id);
 }
 await db.delete(C.ciudades,id);
 const now=new Date().toISOString();
 await Promise.all([
  cache.put(ADMIN_KEY,{...admin,updated_at:now,ciudades:remove(admin.ciudades,"ciudad_id",id)}),
  cache.put(PUBLIC_KEY,{...pub,updated_at:now,ciudades:remove(pub.ciudades,"ciudad_id",id)})
 ]);
 return json({success:true,eliminada:true,ciudad_id:id});
}
