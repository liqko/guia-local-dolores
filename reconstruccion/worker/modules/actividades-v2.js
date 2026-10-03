import {syncActivity,getActivitiesCity} from "../core/activities-read-model.js";
const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());

function today(){
  const d=new Date(Date.now()-3*60*60*1000);
  return d.toISOString().slice(0,10);
}
function addDays(iso,n){
  const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+Number(n||0));return d.toISOString().slice(0,10);
}
function id(prefix){return prefix+"-"+crypto.randomUUID();}
function quota(admin){
  const cfg=(admin&&admin.funcionalidades_config&&admin.funcionalidades_config.ACTIVIDADES)||{};
  for(const v of [cfg.cantidad,cfg.cupo,cfg.max,cfg.maximo,admin&&admin.actividades_cant]){
    const n=Number(v);if(Number.isFinite(n)&&n>=0)return Math.floor(n);
  }
  return 0;
}
function enabled(admin){
  if(bool(admin&&admin.actividades))return true;
  const raw=Array.isArray(admin&&admin.funcionalidades)?admin.funcionalidades:text(admin&&admin.funcionalidades).split(/[;,|\n]/);
  return raw.map(x=>text(x).toUpperCase()).includes("ACTIVIDADES");
}
async function validateSchedule({db,cache,advertiserId,h}){
  const city=text(h&&h.ciudad_id);if(!city)throw new Error("Cada horario necesita ciudad.");
  const territory=await cache.get("territorio:public:v1");
  if(!territory||(territory.ciudades||[]).every(c=>text(c.ciudad_id||c.id)!==city))throw new Error("Hay un horario con ciudad inexistente.");
  const type=text(h.tipo_lugar).toUpperCase();
  const virtual=type.includes("VIRTUAL")||type.includes("ONLINE");
  if(virtual){
    if(!text(h.url_virtual||h.link_virtual||h.enlace_virtual||h.web||h.maps))throw new Error("La actividad virtual necesita enlace o plataforma.");
    return;
  }
  if(text(h.sede_id)){
    const sede=await db.get("anunciantes_sedes",text(h.sede_id));
    if(!sede||text(sede.anunciante_id)!==text(advertiserId)||text(sede.ciudad_id)!==city)throw new Error("La sede no corresponde al anunciante/ciudad.");
    return;
  }
  if(!text(h.lugar_texto)||!text(h.direccion))throw new Error("El lugar físico necesita nombre y dirección.");
}
export async function activitySaveV2({db,cache,advertiserId,body}){
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin||!enabled(admin))throw new Error("No tenés habilitado el módulo Actividades.");
  const payload=body&&body.payload&&typeof body.payload==="object"?body.payload:{};
  const own=await db.queryEqual("actividades","anunciante_id",advertiserId);
  const max=quota(admin),totalMax=max>0?max*2:0;
  let activityId=text(payload.actividad_id),current=null;
  if(activityId){
    current=await db.get("actividades",activityId);
    if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("Actividad no encontrada.");
  }else{
    const active=own.filter(a=>bool(a.activo)&&text(a.estado).toUpperCase()!=="PAUSADA").length;
    if(max<=0)throw new Error("actividades_sin_cupo");
    if(totalMax>0&&own.length>=totalMax)throw new Error("actividades_maximo_guardadas");
    if(active>=max)throw new Error("actividades_cupo_activo_completo");
    activityId=id("ACT");
  }
  for(const h of (Array.isArray(payload.horarios)?payload.horarios:[]))await validateSchedule({db,cache,advertiserId,h});
  const oldSchedules=activityId?await db.queryEqual("actividad_horarios","actividad_id",activityId):[];
  const oldCities=[...new Set(oldSchedules.map(h=>text(h.ciudad_id)).filter(Boolean))];
  const hoy=today();
  const doc={
    ...(current||{}),...payload,actividad_id:activityId,anunciante_id:advertiserId,
    aprobado:current?bool(current.aprobado):false,activo:current?bool(current.activo):true,
    estado:current?text(current.estado||"ACTIVA"):"PENDIENTE",
    vigente_desde:current?text(current.vigente_desde||hoy):hoy,
    vigente_hasta:current?text(current.vigente_hasta||addDays(hoy,30)):addDays(hoy,30),
    creado:current?text(current.creado||new Date().toISOString()):new Date().toISOString(),
    actualizado:new Date().toISOString()
  };
  delete doc.horarios;
  if(!text(doc.nombre))throw new Error("Falta nombre de la actividad.");
  if(!text(doc.categoria))throw new Error("Falta categoría.");
  await db.patch("actividades",activityId,doc,{mustExist:!!current});
  if(Array.isArray(payload.horarios)){
    for(const h of oldSchedules){
      const hid=text(h.actividad_horario_id||h.id);if(hid)await db.delete("actividad_horarios",hid);
    }
    for(const h of payload.horarios){
      const hid=id("AH");
      await db.patch("actividad_horarios",hid,{
        ...h,actividad_horario_id:hid,actividad_id:activityId,
        ciudad_id:text(h.ciudad_id),activo:h.activo===undefined?true:bool(h.activo),
        actualizado:new Date().toISOString()
      });
    }
  }
  await syncActivity({db,cache,activityId,previousCities:oldCities});
  return{success:true,actividad_id:activityId};
}
export async function activityActionV2({db,cache,advertiserId,action,activityId}){
  const current=await db.get("actividades",activityId);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("Actividad no encontrada.");
  const hs=await db.queryEqual("actividad_horarios","actividad_id",activityId);
  const cities=[...new Set(hs.map(h=>text(h.ciudad_id)).filter(Boolean))];
  if(action==="eliminar"){
    for(const h of hs){const hid=text(h.actividad_horario_id||h.id);if(hid)await db.delete("actividad_horarios",hid);}
    await db.delete("actividades",activityId,{mustExist:true});
    await syncActivity({db,cache,activityId,previousCities:cities});
    return{success:true};
  }
  const patch={actualizado:new Date().toISOString()};
  if(action==="pausar"){patch.activo=false;patch.estado="PAUSADA";}
  if(action==="reanudar"||action==="renovar"){
    patch.activo=true;patch.estado="ACTIVA";
    if(action==="renovar"){patch.vigente_desde=today();patch.vigente_hasta=addDays(today(),30);}
  }
  await db.patch("actividades",activityId,patch,{mustExist:true});
  await syncActivity({db,cache,activityId,previousCities:cities});
  return{success:true};
}
export async function activitiesPublicV2({cache,cityId}){return getActivitiesCity({cache,cityId});}
