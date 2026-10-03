import {syncGuideAdvertiserV2} from "../core/guide-read-model-v2.js";

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
  await syncGuideAdvertiserV2({db,cache,advertiserId:aid});

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

  for(const raw of rows){
    const sid=text(raw&&raw.sede_id);
    if(!sid)continue;

    const current=await db.get("anunciantes_sedes",sid);
    if(!current||text(current.anunciante_id)!==aid){
      throw new Error("La sede "+sid+" no pertenece al anunciante.");
    }

    const patch={actualizado_en:new Date().toISOString()};
    if(Object.prototype.hasOwnProperty.call(raw,"actividad_ids")){
      patch.actividad_ids=Array.isArray(raw.actividad_ids)?raw.actividad_ids.map(text).filter(Boolean):[];
    }
    if(Object.prototype.hasOwnProperty.call(raw,"accion_ids")){
      patch.accion_ids=Array.isArray(raw.accion_ids)?raw.accion_ids.map(text).filter(Boolean):[];
    }
    if(Object.prototype.hasOwnProperty.call(raw,"nodo_ids")){
      patch.nodo_ids=Array.isArray(raw.nodo_ids)?raw.nodo_ids.map(text).filter(Boolean):[];
    }

    await db.patch("anunciantes_sedes",sid,patch,{mustExist:true});
    writes++;
  }

  if(writes)await syncGuideAdvertiserV2({db,cache,advertiserId:aid});

  return{success:true,updated:!!writes,sedes_actualizadas:writes,firestore_writes:writes};
}
