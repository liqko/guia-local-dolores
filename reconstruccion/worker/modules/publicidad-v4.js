import {patchChildRowsV1} from '../core/child-rows-patch-v1.js';
import {syncPublicityPreparedV2} from "../core/publicity-read-model-v2.js";
import {changedFieldsV1} from "../core/changed-fields-v1.js";
import {getPreparedRelationsV1} from "../core/prepared-relations-v1.js";

const text=v=>String(v??"").trim();

function parseCategoriaKey(value){
  const raw=text(value);
  const idx=raw.indexOf(":");
  if(idx>0)return{categoria_key:raw,ubicacion_id:raw.slice(0,idx),categoria_id:raw.slice(idx+1)};
  return{categoria_key:raw,ubicacion_id:"",categoria_id:raw};
}
function dateKeyArgentina(){
  return new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
}

export async function publicitySaveV4({db,cache,advertiserId,body,config={}}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:{};
  const id=text(data.publicidad_id)||("PUB-"+crypto.randomUUID());
  const current=text(data.publicidad_id)?await db.get("publicidades",id):null;
  if(text(data.publicidad_id)&&!current)throw new Error("Publicidad no encontrada.");
  if(current&&text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");
  if(!current){
    const own=await db.queryEqual("publicidades","anunciante_id",advertiserId,500);
    const max=Number(config.guardadas_max||0);
    if(max<=0||own.length>=max)throw new Error("publicidades_maximo_guardadas");
  }

  const hasSeg=Array.isArray(data.ciudades)||Array.isArray(data.categorias);
  const previousSeg=current?(hasSeg?await db.queryEqual("publicidad_segmentacion","publicidad_id",id,500):
    await getPreparedRelationsV1({cache,type:"publicity-seg",id,current,load:()=>db.queryEqual("publicidad_segmentacion","publicidad_id",id,500)})):[];
  const previousCities=[...new Set(previousSeg.map(x=>text(x.ciudad_id)).filter(Boolean))];
  const now=new Date().toISOString();

  const doc={
    ...(current||{}),
    publicidad_id:id,
    anunciante_id:advertiserId,
    nombre_interno:text(data.nombre_interno??current?.nombre_interno),
    titulo:text(data.titulo??current?.titulo),
    formato:text(data.formato??current?.formato).toUpperCase(),
    cta_texto:text(data.cta_texto??current?.cta_texto),
    cta_tipo:text(data.cta_tipo??current?.cta_tipo).toUpperCase(),
    cta_destino:text(data.cta_destino??current?.cta_destino),
    aprobado:current?current.aprobado:true,
    estado:current?text(current.estado):"INACTIVA",
    vigente_desde:current?text(current.vigente_desde):"",
    vigente_hasta:current?text(current.vigente_hasta):"",
    creado:current?text(current.creado):now,
    actualizado:now
  };
  if(!doc.titulo)throw new Error("Falta título de publicidad.");

  let media=current?(Array.isArray(data.media)?await db.queryEqual("publicidad_media","publicidad_id",id,500):
    await getPreparedRelationsV1({cache,type:"publicity-media",id,current,load:()=>db.queryEqual("publicidad_media","publicidad_id",id,500)})):[];
  if(Array.isArray(data.media)){
    media=await patchChildRowsV1({db,collection:'publicidad_media',idField:'media_id',prefix:'MED',previous:media,
      desired:data.media.filter(m=>text(m?.url)).map((m,i)=>({publicidad_id:id,tipo_media:text(data.formato||doc.formato).toUpperCase(),url:text(m.url),poster:text(m.poster),orden:i+1,activo:true}))});
  }
  let segmentacion=previousSeg;
  if(Array.isArray(data.ciudades)||Array.isArray(data.categorias)){
    const cities=Array.isArray(data.ciudades)?[...new Set(data.ciudades.map(text).filter(Boolean))]:previousCities;
    const cats=Array.isArray(data.categorias)?[...new Set(data.categorias.map(text).filter(Boolean))]:[...new Set(previousSeg.map(x=>text(x.categoria_key)||text(x.ubicacion_id)+':'+text(x.categoria_id)))];
    const desired=[];
    for(const city of cities)for(const raw of cats){
      const cat=parseCategoriaKey(raw);if(!cat.ubicacion_id||!cat.categoria_id)continue;
      desired.push({publicidad_id:id,ciudad_id:city,...cat,prioridad_id:text(config.prioridad_id).toUpperCase(),activo:true});
    }
    segmentacion=await patchChildRowsV1({db,collection:'publicidad_segmentacion',idField:'segmentacion_id',prefix:'SEG',previous:previousSeg,desired,
      matchKey:r=>[r.ciudad_id,r.ubicacion_id,r.categoria_id].join('|')});
  }
  const fields=["nombre_interno","titulo","formato","cta_texto","cta_tipo","cta_destino"].filter(k=>Object.prototype.hasOwnProperty.call(data,k));
  const patch=changedFieldsV1(current,doc,{touch:!!media.changed||!!segmentacion.changed,fields:current?fields:null});
  const saved=Object.keys(patch).length?await db.patch("publicidades",id,patch,{mustExist:!!current}):current;

  await syncPublicityPreparedV2({
    cache,
    publicityId:id,
    current,
    next:saved,
    segmentacion,
    media,
    previousCities
  });

  return{
    success:true,
    publicidad_id:id,
    created:!current,
    updated:!!current,
    publicidad:{...saved,media,segmentacion}
  };
}

export async function publicityActiveChangeV4({db,cache,advertiserId,ids,configFromAdmin}){
  const [admin,own]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("publicidades","anunciante_id",advertiserId,500)
  ]);
  if(!admin)throw new Error("No existe la administración del anunciante.");

  const cfg=configFromAdmin(admin);
  const selected=[...new Set((Array.isArray(ids)?ids:[]).map(text).filter(Boolean))];
  if(cfg.activas_max<=0)throw new Error("sin_cupo_publicidades_activas");
  if(selected.length>cfg.activas_max)throw new Error("supera_publicidades_activas_max");

  const ownIds=new Set(own.map(p=>text(p.publicidad_id||p.id)).filter(Boolean));
  if(selected.some(id=>!ownIds.has(id)))throw new Error("publicidad_no_pertenece_al_anunciante");

  const currentIds=own.filter(p=>text(p.estado).toUpperCase()==="ACTIVA").map(p=>text(p.publicidad_id||p.id)).sort();
  const nextIds=[...selected].sort();
  if(JSON.stringify(currentIds)===JSON.stringify(nextIds)){
    return{success:true,sin_cambios:true,publicidades:own};
  }

  const fecha=dateKeyArgentina(),changeId=advertiserId+"_"+fecha;
  const change=await db.get("publicidad_cambios",changeId);
  const usados=Number(change&&change.usados||0);
  if(cfg.cambios_activos_por_dia_max<=0||usados>=cfg.cambios_activos_por_dia_max){
    throw new Error("cambio_activos_diario_agotado");
  }

  const changed=[],now=new Date().toISOString();
  for(const p of own){
    const id=text(p.publicidad_id||p.id);
    const should=selected.includes(id);
    const is=text(p.estado).toUpperCase()==="ACTIVA";
    if(is===should)continue;

    const [seg,media]=await Promise.all([
      getPreparedRelationsV1({cache,type:"publicity-seg",id,current:p,load:()=>db.queryEqual("publicidad_segmentacion","publicidad_id",id,500)}),
      getPreparedRelationsV1({cache,type:"publicity-media",id,current:p,load:()=>db.queryEqual("publicidad_media","publicidad_id",id,500)})
    ]);
    const cities=[...new Set(seg.map(x=>text(x.ciudad_id)).filter(Boolean))];
    const saved=await db.patch("publicidades",id,{estado:should?"ACTIVA":"INACTIVA",actualizado:now},{mustExist:true});

    await syncPublicityPreparedV2({
      cache,
      publicityId:id,
      current:p,
      next:saved,
      segmentacion:seg,
      media,
      previousCities:cities
    });

    changed.push({...saved,media,segmentacion:seg});
  }

  await db.patch("publicidad_cambios",changeId,{
    cambio_id:changeId,
    anunciante_id:advertiserId,
    fecha,
    usados:usados+1,
    actualizado:now
  });

  const changedMap=new Map(changed.map(x=>[text(x.publicidad_id||x.id),x]));
  const result=own.map(p=>changedMap.get(text(p.publicidad_id||p.id))||p);

  return{
    success:true,
    sin_cambios:false,
    cambios:changed.length,
    publicidades:result,
    cambios_activos:{usados:usados+1,max:cfg.cambios_activos_por_dia_max,disponibles:Math.max(0,cfg.cambios_activos_por_dia_max-(usados+1))}
  };
}

export async function publicityDeleteSafeV4({db,cache,advertiserId,publicityId}){
  const id=text(publicityId);
  if(!id)throw new Error("Falta publicidad_id.");

  const current=await db.get("publicidades",id);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");
  if(text(current.estado).toUpperCase()==="ACTIVA")throw new Error("publicidad_activa_no_eliminable");

  const [seg,media]=await Promise.all([
    db.queryEqual("publicidad_segmentacion","publicidad_id",id,500),
    db.queryEqual("publicidad_media","publicidad_id",id,500)
  ]);
  const cities=[...new Set(seg.map(x=>text(x.ciudad_id)).filter(Boolean))];

  for(const x of seg){
    const xid=text(x.segmentacion_id||x.id);
    if(xid)await db.delete("publicidad_segmentacion",xid);
  }
  for(const x of media){
    const xid=text(x.media_id||x.id);
    if(xid)await db.delete("publicidad_media",xid);
  }

  await db.delete("publicidades",id,{mustExist:true});
  await syncPublicityPreparedV2({
    cache,
    publicityId:id,
    current,
    next:null,
    segmentacion:[],
    media:[],
    previousCities:cities
  });

  return{success:true,deleted:true,publicidad_id:id};
}
