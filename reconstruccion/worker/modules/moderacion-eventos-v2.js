import {syncEventV2} from "../core/events-read-model-v2.js";
const text=v=>String(v??"").trim();

export async function pendingEventsV2({db,limit=100}){
  const rows=await db.queryEqual("eventos","estado_moderacion","PENDIENTE",limit);
  return {
    success:true,
    tipo:"EVENTO",
    pendientes:rows.map(e=>({
      tipo:"EVENTO",
      id:text(e.evento_id||e.id),
      evento_id:text(e.evento_id||e.id),
      anunciante_id:text(e.anunciante_id||e.id_anunciante),
      nombre:text(e.nombre_evento||e.nombre),
      ciudad_id:text(e.ciudad_id),
      nivel:text(e.nivel),
      fecha_desde:text(e.fecha_desde),
      fecha_hasta:text(e.fecha_hasta),
      estado_moderacion:text(e.estado_moderacion)
    }))
  };
}
export async function resolveEventModerationV2({db,cache,eventId,decision,moderatorId}){
  const id=text(eventId),dec=text(decision).toUpperCase();
  if(!id)throw new Error("Falta evento_id.");
  if(!["APROBAR","RECHAZAR"].includes(dec))throw new Error("Decisión inválida.");
  const current=await db.get("eventos",id);
  if(!current)throw new Error("Evento no encontrado.");
  const approved=dec==="APROBAR";
  const saved=await db.patch("eventos",id,{
    estado_moderacion:approved?"APROBADO":"RECHAZADO",
    estado:approved?"ACTIVO":"RECHAZADO",
    moderado_por:text(moderatorId),
    moderado_en:new Date().toISOString(),
    actualizado:new Date().toISOString()
  },{mustExist:true});
  await syncEventV2({db,cache,current,next:saved});
  return{success:true,tipo:"EVENTO",id,decision:dec,estado_moderacion:saved.estado_moderacion};
}
