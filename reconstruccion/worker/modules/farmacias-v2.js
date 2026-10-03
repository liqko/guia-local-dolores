import {syncFarmCycle,getFarmCity} from "../core/farmacias-read-model.js";
const text=v=>String(v??"").trim();

export async function farmPublicV2({cache,cityId}){return getFarmCity({cache,cityId});}

export async function farmSaveCycleV2({db,cache,advertiserId,body,allowedCityIds=[]}){
  const payload=body&&body.payload&&typeof body.payload==="object"?body.payload:body||{};
  let id=text(payload.ciclo_id);
  const current=id?await db.get("farmacias_ciclos",id):null;
  if(current&&text(current.anunciante_id)&&text(current.anunciante_id)!==text(advertiserId)){
    throw new Error("El ciclo no pertenece al anunciante.");
  }
  const merged={...(current||{}),...payload};
  const city=text(merged.ciudad_id);
  if(!city)throw new Error("Falta ciudad.");
  if(allowedCityIds.length && !allowedCityIds.includes(city))throw new Error("La ciudad no está habilitada para esta cuenta.");
  if(!text(merged.fecha_inicio))throw new Error("Falta fecha de inicio.");
  if(!text(merged.hora_inicio))throw new Error("Falta hora de inicio.");

  const dur=Math.max(1,Number(merged.duracion_horas||24));
  const simult=Math.max(1,Math.floor(Number(merged.farmacias_por_turno||1)));
  if(!id)id="FAR-"+crypto.randomUUID();

  let nuevos=null;
  if(Array.isArray(payload.participantes)){
    nuevos=payload.participantes.map((p,i)=>({
      ciclo_id:id,sede_id:text(p.sede_id),orden:Number(p.orden||i+1),activo:true,actualizado:new Date().toISOString()
    })).filter(p=>p.sede_id);
    if(!nuevos.length)throw new Error("Seleccioná al menos una farmacia.");
    if(simult>nuevos.length)throw new Error("La cantidad simultánea supera las farmacias seleccionadas.");
    for(const p of nuevos){
      const sede=await db.get("anunciantes_sedes",p.sede_id);
      if(!sede)throw new Error("Hay una farmacia/sede inexistente.");
      if(text(sede.ciudad_id)!==city)throw new Error("Todas las farmacias deben pertenecer a la ciudad del ciclo.");
    }
  }

  const previousCity=text(current&&current.ciudad_id);
  await db.patch("farmacias_ciclos",id,{
    ciclo_id:id,anunciante_id:advertiserId,ciudad_id:city,
    fecha_inicio:text(merged.fecha_inicio),hora_inicio:text(merged.hora_inicio),
    duracion_horas:dur,farmacias_por_turno:simult,
    activo:merged.activo===undefined?true:!!merged.activo,
    observaciones:text(merged.observaciones),actualizado:new Date().toISOString()
  },{mustExist:!!current});

  if(nuevos){
    const existentes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id);
    const keep=new Set(nuevos.map(p=>id+"__"+p.sede_id));
    for(const r of existentes){
      const rid=text(r.id||(id+"__"+text(r.sede_id)));
      if(rid&&!keep.has(rid))await db.delete("farmacias_ciclo_sedes",rid);
    }
    for(const p of nuevos)await db.patch("farmacias_ciclo_sedes",id+"__"+p.sede_id,p);
  }

  await syncFarmCycle({db,cache,cycleId:id,previousCity});
  return{success:true,ciclo_id:id};
}
