import {resolveEventModerationV2} from "./moderacion-eventos-v2.js";
import {syncActivityPreparedV2} from "../core/activities-read-model-v2.js";
import {syncGuideAdvertiserV2} from "../core/guide-read-model-v2.js";
import {syncAdvertiserIndexV2} from "../core/admin-indexes-v2.js";
import {getPreparedRelationsV1} from "../core/prepared-relations-v1.js";

const text=v=>String(v??"").trim();

function rejectedActivity(a){
  return ["RECHAZADA","RECHAZADO","ELIMINADA","ELIMINADO"].includes(text(a&&a.estado).toUpperCase());
}

export async function pendingAllV3({db}){
  const [evPend,evRev,activities,requests]=await Promise.all([
    db.queryEqual("eventos","estado_moderacion","PENDIENTE",200),
    db.queryEqual("eventos","estado_moderacion","REVISION",200),
    db.queryEqual("actividades","aprobado",false,200),
    db.queryEqual("solicitudes_anunciante","estado","PENDIENTE",200)
  ]);

  const eventos=[...evPend,...evRev].map(e=>({
    ...e,
    tipo:"EVENTO",
    id:text(e.evento_id||e.id),
    evento_id:text(e.evento_id||e.id),
    nombre:text(e.nombre_evento||e.nombre),
    ciudad_id:text(e.ciudad_id),
    anunciante_id:text(e.anunciante_id||e.id_anunciante),
    nivel:text(e.nivel),
    estado:text(e.estado_moderacion||"PENDIENTE"),
    fecha:text(e.fecha_desde||e.fecha_carga),
    motivo:text(e.motivo_revision)
  }));

  const actividades=activities
    .filter(a=>!rejectedActivity(a))
    .map(a=>({
      ...a,
      tipo:"ACTIVIDAD",
      id:text(a.actividad_id||a.id),
      actividad_id:text(a.actividad_id||a.id),
      nombre:text(a.nombre),
      ciudad_id:text(a.ciudad_id),
      anunciante_id:text(a.anunciante_id),
      estado:text(a.estado||"PENDIENTE"),
      fecha:text(a.creado||a.actualizado)
    }));

  const anunciantes=requests.map(x=>({
    ...x,
    tipo:"ANUNCIANTE",
    id:text(x.solicitud_id||x.id),
    solicitud_id:text(x.solicitud_id||x.id),
    modo:text(x.modo).toUpperCase(),
    nombre:text(x.nombre),
    ciudad_id:text(x.ciudad_id),
    anunciante_id:text(x.anunciante_id),
    suscriptor_id:text(x.suscriptor_id),
    estado:"PENDIENTE",
    fecha:text(x.creado_en),
    detalle:x.detalle||{}
  }));

  return{
    success:true,
    cantidades:{
      eventos:eventos.length,
      actividades:actividades.length,
      anunciantes:anunciantes.length,
      total:eventos.length+actividades.length+anunciantes.length
    },
    eventos,
    actividades,
    anunciantes
  };
}

function newAdvertiserId(){
  return "ADV-"+crypto.randomUUID().replace(/-/g,"").slice(0,16).toUpperCase();
}

export async function resolvePendingV3({db,cache,auth,tipo,id,decision,nivel=""}){
  const kind=text(tipo).toUpperCase();
  const itemId=text(id);
  const dec=text(decision).toUpperCase();
  if(!itemId||!["APROBAR","RECHAZAR"].includes(dec))throw new Error("Falta indicar contenido o decisión.");

  if(kind==="EVENTO"){
    return resolveEventModerationV2({
      db,cache,eventId:itemId,decision:dec,moderatorId:auth.sid
    });
  }

  if(kind==="ACTIVIDAD"){
    const current=await db.get("actividades",itemId);
    if(!current)throw new Error("Actividad no encontrada.");

    const horarios=await getPreparedRelationsV1({cache,type:"activity",id:itemId,current,
      load:()=>db.queryEqual("actividad_horarios","actividad_id",itemId,500)});
    const previousCities=[...new Set(horarios.map(h=>text(h.ciudad_id)).filter(Boolean))];
    const saved=await db.patch("actividades",itemId,{
      aprobado:dec==="APROBAR",
      estado:dec==="APROBAR"?"ACTIVA":"RECHAZADA",
      moderado_por:text(auth.sid),
      moderado_en:new Date().toISOString(),
      actualizado:new Date().toISOString()
    },{mustExist:true});

    await syncActivityPreparedV2({
      cache,
      activityId:itemId,
      current,
      next:saved,
      horarios,
      previousCities
    });

    return{
      success:true,
      tipo:kind,
      id:itemId,
      decision:dec,
      estado:saved.estado,
      actividad:{...saved,horarios}
    };
  }

  if(kind==="ANUNCIANTE"){
    const req=await db.get("solicitudes_anunciante",itemId);
    if(!req)throw new Error("Solicitud de anunciante no encontrada.");
    if(text(req.estado).toUpperCase()!=="PENDIENTE")throw new Error("La solicitud ya fue resuelta.");

    const now=new Date().toISOString();
    const sid=text(req.suscriptor_id),modo=text(req.modo).toUpperCase();

    if(dec==="RECHAZAR"){
      const savedReq=await db.patch("solicitudes_anunciante",itemId,{
        estado:"RECHAZADA",
        moderado_por:text(auth.sid),
        moderado_en:now,
        actualizado_en:now
      },{mustExist:true});
      return{success:true,tipo:kind,id:itemId,decision:dec,solicitud:savedReq};
    }

    let aid=text(req.anunciante_id);

    if(modo==="CREAR"){
      const level=text(nivel);
      if(!level)throw new Error("Seleccioná el nivel del nuevo anunciante.");
      aid=newAdvertiserId();
      const detail=req.detalle||{};
      const city=text(req.ciudad_id);

      await db.patch("anunciantes",aid,{
        id:aid,
        nombre:text(req.nombre),
        actividad:text(detail.actividad),
        descripcion:text(detail.descripcion),
        whatsapp:text(detail.whatsapp),
        mail:text(detail.mail),
        web:text(detail.web),
        creado_en:now,
        actualizado_en:now
      });

      await db.patch("anunciantes_administracion",aid,{
        id:aid,
        aprobado:true,
        nivel:level,
        subnivel:"0",
        verificado:false,
        gold:false,
        funcionalidades:[],
        creado_en:now,
        actualizado_en:now
      });

      if(city){
        const sedeId="SED-"+aid+"-MAIN";
        await db.patch("anunciantes_sedes",sedeId,{
          sede_id:sedeId,
          anunciante_id:aid,
          ciudad_id:city,
          nombre_sede:"Principal",
          direccion:text(detail.direccion),
          whatsapp:text(detail.whatsapp),
          mail:text(detail.mail),
          web:text(detail.web),
          activo:true,
          creado_en:now,
          actualizado_en:now
        });
      }
    }else if(modo==="RECLAMAR"){
      if(!aid||!await db.get("anunciantes",aid))throw new Error("El anunciante reclamado ya no existe.");
    }else{
      throw new Error("Tipo de solicitud inválido.");
    }

    const relId=sid+"__"+aid;
    await db.patch("suscriptor_anunciante",relId,{
      relacion_id:relId,
      suscriptor_id:sid,
      anunciante_id:aid,
      rol:"PROPIETARIO",
      activo:true,
      fecha_alta:now,
      actualizado:now
    });

    const savedReq=await db.patch("solicitudes_anunciante",itemId,{
      estado:"APROBADA",
      anunciante_id:aid,
      moderado_por:text(auth.sid),
      moderado_en:now,
      actualizado_en:now
    },{mustExist:true});

    if(modo==="CREAR"){
      await Promise.all([
        syncGuideAdvertiserV2({db,cache,advertiserId:aid}),
        syncAdvertiserIndexV2({db,cache,advertiserId:aid})
      ]);
    }

    return{
      success:true,
      tipo:kind,
      id:itemId,
      decision:dec,
      anunciante_id:aid,
      suscriptor_id:sid,
      solicitud:savedReq
    };
  }

  throw new Error("Tipo de contenido no reconocido.");
}
