import {patchGuideAdvertiserDataFromCacheV2,patchGuideAdvertiserSedesFromCacheV2} from "../core/commerce-cache-patch-v2.js";

const text=v=>String(v??"").trim();

function isTopAdmin(auth){
  return ["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(text(auth&&auth.rol).toUpperCase());
}

export async function updateAdvertiserProfileV2({db,cache,auth,advertiserId,payload}){
  if(!isTopAdmin(auth))throw new Error("No tenés permiso para modificar los datos del anunciante.");
  const aid=text(advertiserId);
  if(!aid)throw new Error("Falta anunciante_id.");

  const patch={actualizado_en:new Date().toISOString()};
  let touched=false;

  if(Object.prototype.hasOwnProperty.call(payload,"segmento_id")){patch.segmento_id=text(payload.segmento_id);touched=true;}
  if(Object.prototype.hasOwnProperty.call(payload,"categoria_ids")){
    patch.categoria_ids=Array.isArray(payload.categoria_ids)?payload.categoria_ids.map(text).filter(Boolean):[];
    touched=true;
  }
  for(const key of ["pet","eco","gayfriendly"]){
    if(Object.prototype.hasOwnProperty.call(payload,key)){patch[key]=!!payload[key];touched=true;}
  }

  if(!touched)return{success:true,updated:false,anunciante_id:aid};

  await db.patch("anunciantes",aid,patch,{mustExist:true});
  await patchGuideAdvertiserDataFromCacheV2({cache,advertiserId:aid,patch});

  return{
    success:true,
    updated:true,
    anunciante_id:aid,
    firestore_writes:1
  };
}

export async function updateAdvertiserSedeRelationsV2({db,cache,auth,advertiserId,sedes}){
  if(!isTopAdmin(auth))throw new Error("No tenés permiso para modificar las sedes.");
  const aid=text(advertiserId);
  if(!aid)throw new Error("Falta anunciante_id.");

  const rows=Array.isArray(sedes)?sedes:[];
  let writes=0;
  const prepared=[],seen=new Set(),savedSedes=[];

  for(const raw of rows){
    const sid=text(raw&&raw.sede_id);
    if(!sid)continue;
    if(seen.has(sid))throw new Error("Sede repetida en la operación.");
    seen.add(sid);

    const current=await db.get("anunciantes_sedes",sid);
    if(!current||text(current.anunciante_id)!==aid){
      throw new Error("La sede "+sid+" no pertenece al anunciante.");
    }

    const patch={};
    if(Object.prototype.hasOwnProperty.call(raw,"actividad_ids")){
      patch.actividad_ids=Array.isArray(raw.actividad_ids)?raw.actividad_ids.map(text).filter(Boolean):[];
    }
    if(Object.prototype.hasOwnProperty.call(raw,"accion_ids")){
      patch.accion_ids=Array.isArray(raw.accion_ids)?raw.accion_ids.map(text).filter(Boolean):[];
    }
    if(Object.prototype.hasOwnProperty.call(raw,"nodo_ids")){
      patch.nodo_ids=Array.isArray(raw.nodo_ids)?raw.nodo_ids.map(text).filter(Boolean):[];
    }

    for(const key of Object.keys(patch)){
      if(JSON.stringify(patch[key])===JSON.stringify(current[key]))delete patch[key];
    }
    prepared.push({sid,patch});
  }

  // Toda la pertenencia se valida antes de la primera escritura.
  for(const {sid,patch} of prepared){
    if(!Object.keys(patch).length)continue;
    patch.actualizado_en=new Date().toISOString();
    savedSedes.push(await db.patch("anunciantes_sedes",sid,patch,{mustExist:true}));
    writes++;
  }
  if(writes)await patchGuideAdvertiserSedesFromCacheV2({cache,advertiserId:aid,savedSedes});

  return{success:true,updated:!!writes,sedes_actualizadas:writes,firestore_writes:writes};
}
