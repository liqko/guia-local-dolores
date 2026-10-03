import {syncPublicity} from "../core/publicity-read-model.js";
const text=v=>String(v??"").trim();

function dateKeyArgentina(){
  const d=new Date(Date.now()-3*60*60*1000);
  return d.toISOString().slice(0,10);
}
function configFromAdmin(admin){
  const root=admin&&admin.funcionalidades_config&&typeof admin.funcionalidades_config==="object"?admin.funcionalidades_config:{};
  const cfg=root.PUBLICIDAD&&typeof root.PUBLICIDAD==="object"?root.PUBLICIDAD:{};
  const n=(...vals)=>{
    for(const v of vals){const x=Number(v);if(Number.isFinite(x)&&x>=0)return Math.floor(x);}
    return 0;
  };
  return {
    activas_max:n(cfg.activas_max,cfg.activas,cfg.max_activas,admin&&admin.publicidad_activas_max),
    guardadas_max:n(cfg.guardadas_max,cfg.guardadas,cfg.max_guardadas,admin&&admin.publicidad_guardadas_max),
    cambios_activos_por_dia_max:n(cfg.cambios_activos_por_dia_max,cfg.cambios_diarios,admin&&admin.publicidad_cambios_diarios)
  };
}
export async function publicityActiveChangeV3({db,cache,advertiserId,ids}){
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin)throw new Error("No existe la administración del anunciante.");
  const cfg=configFromAdmin(admin);
  const selected=[...new Set((Array.isArray(ids)?ids:[]).map(text).filter(Boolean))];
  if(cfg.activas_max<=0)throw new Error("sin_cupo_publicidades_activas");
  if(selected.length>cfg.activas_max)throw new Error("supera_publicidades_activas_max");

  const own=await db.queryEqual("publicidades","anunciante_id",advertiserId,500);
  const ownIds=new Set(own.map(p=>text(p.publicidad_id||p.id)).filter(Boolean));
  if(selected.some(id=>!ownIds.has(id)))throw new Error("publicidad_no_pertenece_al_anunciante");

  const current=own.filter(p=>text(p.estado).toUpperCase()==="ACTIVA").map(p=>text(p.publicidad_id||p.id)).sort();
  const next=[...selected].sort();
  if(JSON.stringify(current)===JSON.stringify(next))return{success:true,sin_cambios:true};

  const fecha=dateKeyArgentina(),changeId=advertiserId+"_"+fecha;
  const change=await db.get("publicidad_cambios",changeId);
  const usados=Number(change&&change.usados||0);
  if(cfg.cambios_activos_por_dia_max<=0||usados>=cfg.cambios_activos_por_dia_max){
    throw new Error("cambio_activos_diario_agotado");
  }

  const changed=[];
  for(const p of own){
    const id=text(p.publicidad_id||p.id);
    const should=selected.includes(id);
    const is=text(p.estado).toUpperCase()==="ACTIVA";
    if(is===should)continue;
    await db.patch("publicidades",id,{estado:should?"ACTIVA":"INACTIVA",actualizado:new Date().toISOString()},{mustExist:true});
    changed.push(id);
  }

  await db.patch("publicidad_cambios",changeId,{
    cambio_id:changeId,anunciante_id:advertiserId,fecha,usados:usados+1,actualizado:new Date().toISOString()
  });

  for(const id of changed)await syncPublicity({db,cache,publicityId:id});
  return{success:true,sin_cambios:false,cambios:changed.length};
}

export async function publicityDeleteSafeV3({db,cache,advertiserId,publicityId}){
  const id=text(publicityId);if(!id)throw new Error("Falta publicidad_id.");
  const current=await db.get("publicidades",id);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");
  if(text(current.estado).toUpperCase()==="ACTIVA")throw new Error("publicidad_activa_no_eliminable");

  const seg=await db.queryEqual("publicidad_segmentacion","publicidad_id",id,500);
  const media=await db.queryEqual("publicidad_media","publicidad_id",id,500);
  const cities=[...new Set(seg.map(x=>text(x.ciudad_id)).filter(Boolean))];

  for(const x of seg){const xid=text(x.segmentacion_id||x.id);if(xid)await db.delete("publicidad_segmentacion",xid);}
  for(const x of media){const xid=text(x.media_id||x.id);if(xid)await db.delete("publicidad_media",xid);}
  await db.delete("publicidades",id,{mustExist:true});
  await syncPublicity({db,cache,publicityId:id,previousCities:cities});
  return{success:true,deleted:true,publicidad_id:id};
}

export {configFromAdmin};
