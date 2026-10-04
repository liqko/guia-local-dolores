import {syncPublicity,getPublicityCity} from "../core/publicity-read-model.js";
const text=v=>String(v??"").trim();

export async function publicityPublicV2({cache,cityId}){return getPublicityCity({cache,cityId});}

function parseCategoriaKey(value){
  const raw=text(value);
  const idx=raw.indexOf(":");
  if(idx>0){
    return {
      categoria_key:raw,
      ubicacion_id:raw.slice(0,idx),
      categoria_id:raw.slice(idx+1)
    };
  }
  return {categoria_key:raw,ubicacion_id:"",categoria_id:raw};
}

export async function publicitySaveV2({db,cache,advertiserId,body,config={prioridad_id:undefined}}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:{};
  const id=text(data.publicidad_id)||("PUB-"+crypto.randomUUID());
  const current=text(data.publicidad_id)?await db.get("publicidades",id):null;
  if(current&&text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");

  const previousSeg=current?await db.queryEqual("publicidad_segmentacion","publicidad_id",id):[];
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
  await db.patch("publicidades",id,doc,{mustExist:!!current});

  if(Array.isArray(data.media)){
    const old=await db.queryEqual("publicidad_media","publicidad_id",id);
    for(const x of old){
      const xid=text(x.media_id||x.id);
      if(xid)await db.delete("publicidad_media",xid);
    }
    let orden=0;
    for(const m of data.media.filter(x=>text(x&&x.url))){
      orden++;
      const mid="MED-"+crypto.randomUUID();
      await db.patch("publicidad_media",mid,{
        media_id:mid,
        publicidad_id:id,
        tipo_media:text(data.formato||doc.formato).toUpperCase(),
        url:text(m.url),
        poster:text(m.poster),
        orden,
        activo:true,
        actualizado:now
      });
    }
  }

  if(Array.isArray(data.ciudades)||Array.isArray(data.categorias)){
    const old=await db.queryEqual("publicidad_segmentacion","publicidad_id",id);
    for(const x of old){
      const xid=text(x.segmentacion_id||x.id);
      if(xid)await db.delete("publicidad_segmentacion",xid);
    }

    const cities=Array.isArray(data.ciudades)?[...new Set(data.ciudades.map(text).filter(Boolean))]:[];
    const cats=Array.isArray(data.categorias)?[...new Set(data.categorias.map(text).filter(Boolean))]:[];

    for(const city of cities){
      for(const raw of cats){
        const cat=parseCategoriaKey(raw);
        if(!cat.ubicacion_id||!cat.categoria_id)continue;

        const sid="SEG-"+crypto.randomUUID();
        await db.patch("publicidad_segmentacion",sid,{
          segmentacion_id:sid,
          publicidad_id:id,
          ciudad_id:city,
          ubicacion_id:cat.ubicacion_id,
          categoria_id:cat.categoria_id,
          categoria_key:cat.categoria_key,
          prioridad_id:text(config.prioridad_id).toUpperCase(),
          activo:true,
          creado:now,
          actualizado:now
        });
      }
    }
  }

  await syncPublicity({db,cache,publicityId:id,previousCities});
  return{success:true,publicidad_id:id,created:!current,updated:!!current};
}

export async function publicityDeleteV2({db,cache,advertiserId,publicityId}){
  const id=text(publicityId);if(!id)throw new Error("Falta publicidad_id.");
  const current=await db.get("publicidades",id);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");
  const seg=await db.queryEqual("publicidad_segmentacion","publicidad_id",id);
  const media=await db.queryEqual("publicidad_media","publicidad_id",id);
  const cities=[...new Set(seg.map(x=>text(x.ciudad_id)).filter(Boolean))];
  for(const x of seg){const xid=text(x.segmentacion_id||x.id);if(xid)await db.delete("publicidad_segmentacion",xid);}
  for(const x of media){const xid=text(x.media_id||x.id);if(xid)await db.delete("publicidad_media",xid);}
  await db.delete("publicidades",id,{mustExist:true});
  await syncPublicity({db,cache,publicityId:id,previousCities:cities});
  return{success:true,deleted:true,publicidad_id:id};
}
