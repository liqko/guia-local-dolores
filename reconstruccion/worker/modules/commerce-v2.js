/**
 * COMMERCE / MODIFICAR DATOS — V2
 * Mutaciones puntuales, sin reconstrucciones globales.
 */
function text(v){ return String(v ?? "").trim(); }
function ids(v){
  if(Array.isArray(v)) return [...new Set(v.map(text).filter(Boolean))];
  return [...new Set(text(v).split(/[;,|\n]/).map(text).filter(Boolean))];
}
function newSedeId(advertiserId){
  return "SED-"+text(advertiserId)+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,10);
}

export async function commercePanelData({db, advertiserId, catalogs}){
  const [datos, administracion, sedes] = await Promise.all([
    db.get("anunciantes", advertiserId),
    db.get("anunciantes_administracion", advertiserId),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId)
  ]);
  if(!datos) return {success:false,error:"anunciante_no_encontrado"};
  return {
    success:true,
    advertiser:{
      id:advertiserId,
      datos,
      administracion:administracion||{},
      sedes,
      segmentos:catalogs.segmentos||[],
      categorias:catalogs.categorias||[],
      actividades_clave:catalogs.actividades_clave||[],
      acciones:catalogs.acciones||[],
      nodos:catalogs.nodos||[],
      funcionalidades:catalogs.funcionalidades||[],
      niveles_anunciante:catalogs.niveles_anunciante||[]
    }
  };
}

export async function commerceSetDatos({db,advertiserId,body}){
  const reserved=new Set(["action","accion","id","__id","comercio_id","advertiserId","advertiser_id"]);
  const patch={actualizado_en:new Date().toISOString()};

  for(const [k,v] of Object.entries(body||{})){
    if(reserved.has(k)) continue;
    if(k==="categoria_id") patch.categoria_ids=ids(v);
    else patch[k]=v;
  }

  const saved=await db.patch("anunciantes",advertiserId,patch,{mustExist:true});
  return {success:true,updated:true,id:advertiserId,advertiser:saved};
}

export async function commerceSetSedes({db,advertiserId,body}){
  const incoming=Array.isArray(body&&body.sedes)?body.sedes:[];
  const saved=[];

  for(const raw of incoming){
    const existingId=text(raw&&raw.sede_id);
    const id=existingId||newSedeId(advertiserId);

    if(existingId){
      const current=await db.get("anunciantes_sedes",id);
      if(!current || text(current.anunciante_id)!==text(advertiserId)){
        throw new Error("La sede no pertenece al anunciante.");
      }
    }

    const patch={
      ...(raw||{}),
      sede_id:id,
      anunciante_id:advertiserId,
      actualizado_en:new Date().toISOString()
    };

    if("actividad_ids" in patch) patch.actividad_ids=ids(patch.actividad_ids);
    if("accion_ids" in patch) patch.accion_ids=ids(patch.accion_ids);
    if("nodo_ids" in patch) patch.nodo_ids=ids(patch.nodo_ids);
    delete patch.__id;

    await db.patch("anunciantes_sedes",id,patch,{mustExist:!!existingId});
    saved.push(id);
  }

  return {success:true,updated:true,id:advertiserId,sedes:saved};
}

export async function commerceSetRelacionesSede({db,advertiserId,body}){
  const id=text(body&&body.sede_id);
  if(!id) throw new Error("Falta sede_id.");

  const current=await db.get("anunciantes_sedes",id);
  if(!current || text(current.anunciante_id)!==text(advertiserId)){
    throw new Error("La sede no pertenece al anunciante.");
  }

  const patch={actualizado_en:new Date().toISOString()};
  if(body.actividad_ids!==undefined) patch.actividad_ids=ids(body.actividad_ids);
  if(body.accion_ids!==undefined) patch.accion_ids=ids(body.accion_ids);
  if(body.nodo_ids!==undefined) patch.nodo_ids=ids(body.nodo_ids);

  await db.patch("anunciantes_sedes",id,patch,{mustExist:true});
  return {success:true,updated:true,sede_id:id};
}

export async function commerceDeleteSede({db,advertiserId,body}){
  const id=text(body&&body.sede_id);
  if(!id) throw new Error("Falta sede_id.");

  const current=await db.get("anunciantes_sedes",id);
  if(!current || text(current.anunciante_id)!==text(advertiserId)){
    throw new Error("La sede no pertenece al anunciante.");
  }

  await db.delete("anunciantes_sedes",id,{mustExist:true});
  return {success:true,deleted:true,sede_id:id};
}
