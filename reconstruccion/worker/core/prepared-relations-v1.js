const text=v=>String(v??"").trim();
const key=(type,id)=>"relations:prepared:v1:"+type+":"+text(id);
const revision=row=>text(row?.actualizado||row?.actualizado_en||row?.creado);
// Sólo para publicación de relaciones intactas. Editarlas o eliminarlas exige
// consultar sus filas autoritativas. Propiedad/permisos se validan en Firestore.
export async function getPreparedRelationsV1({cache,type,id,current,load}){
  const packet=await cache.get(key(type,id));
  if(packet&&packet.revision===revision(current)&&packet.data)return packet.data;
  return load();
}
export async function putPreparedRelationsV1({cache,type,id,next,data}){
  await cache.put(key(type,id),{revision:revision(next),data:next?data:null});
}
