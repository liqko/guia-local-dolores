import {patchGuideAdminFieldsV2} from "../core/guide-read-model-v2.js";
import {patchGuideSegmentV2} from "../core/guide-patch-v2.js";

const text=v=>String(v??"").trim();

function isTopAdmin(auth){
  return ["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(text(auth&&auth.rol).toUpperCase());
}
export async function updateAdvertiserCommercialV2({db,cache,auth,advertiserId,payload}){
  if(!isTopAdmin(auth))throw new Error("No tenés permiso para modificar la configuración comercial.");
  const aid=text(advertiserId||payload&&payload.anunciante_id||payload&&payload.id);
  if(!aid)throw new Error("Falta anunciante_id.");

  const adminPatch={actualizado_en:new Date().toISOString(),actualizado_por:text(auth.sid)};
  let adminTouched=false;

  if(Object.prototype.hasOwnProperty.call(payload,"nivel")){
    const nivel=text(payload.nivel);
    if(!["0","3","4","5"].includes(nivel))throw new Error("Nivel inválido. Usá 0, 3, 4 o 5.");
    adminPatch.nivel=nivel;adminTouched=true;
  }
  if(Object.prototype.hasOwnProperty.call(payload,"subnivel")){adminPatch.subnivel=text(payload.subnivel);adminTouched=true;}
  if(Object.prototype.hasOwnProperty.call(payload,"aprobado")){adminPatch.aprobado=!!payload.aprobado;adminTouched=true;}
  if(Object.prototype.hasOwnProperty.call(payload,"verificado")){adminPatch.verificado=!!payload.verificado;adminTouched=true;}
  if(Object.prototype.hasOwnProperty.call(payload,"gold")){adminPatch.gold=!!payload.gold;adminTouched=true;}

  if(Object.prototype.hasOwnProperty.call(payload,"funcionalidades")){
    adminPatch.funcionalidades=Array.isArray(payload.funcionalidades)
      ? payload.funcionalidades.map(text).filter(Boolean)
      : text(payload.funcionalidades).split(/[;,|\n]/).map(text).filter(Boolean);
    adminTouched=true;
  }
  if(Object.prototype.hasOwnProperty.call(payload,"funcionalidades_config")){
    if(!payload.funcionalidades_config||typeof payload.funcionalidades_config!=="object"||Array.isArray(payload.funcionalidades_config)){
      throw new Error("La configuración de funcionalidades no es válida.");
    }
    adminPatch.funcionalidades_config=payload.funcionalidades_config;adminTouched=true;
  }

  let firestoreWrites=0;
  if(adminTouched){
    await db.patch("anunciantes_administracion",aid,adminPatch,{mustExist:true});
    firestoreWrites++;
    await patchGuideAdminFieldsV2({cache,advertiserId:aid,patch:adminPatch});
  }

  let segmentoId=null;
  if(Object.prototype.hasOwnProperty.call(payload,"segmento_id")){
    segmentoId=text(payload.segmento_id);
    await db.patch("anunciantes",aid,{segmento_id:segmentoId,actualizado_en:new Date().toISOString()},{mustExist:true});
    firestoreWrites++;
    await patchGuideSegmentV2({cache,advertiserId:aid,segmentoId});
  }

  return{
    success:true,
    updated:true,
    anunciante_id:aid,
    administracion_patch:adminTouched?adminPatch:{},
    segmento_id:segmentoId,
    firestore_writes:firestoreWrites,
    firestore_reads:0
  };
}
