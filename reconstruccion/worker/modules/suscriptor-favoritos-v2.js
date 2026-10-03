/**
 * FAVORITOS SUSCRIPTOR V2
 * Requiere sesión HMAC. Nunca acepta suscriptor_id ajeno al token.
 */
import {verifySubscriberSession} from "./suscriptores.js";

const text=v=>String(v??"").trim();
const allowedTypes=new Set(["ANUNCIANTE","EVENTO","PROMO","ACTIVIDAD"]);

function typeOf(v){
  const t=text(v).toUpperCase();
  return allowedTypes.has(t)?t:"";
}
async function favoriteDocId(sid,type,ref){
  const raw=new TextEncoder().encode([sid,type,ref].join("|"));
  const hash=await crypto.subtle.digest("SHA-256",raw);
  const bytes=new Uint8Array(hash);
  return "FAV-"+[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,40);
}
async function sessionOrThrow(env,request){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)throw new Error(s.message||"Sesión inválida.");
  return s;
}

export async function listFavoritesV2({env,request,db,type=""}){
  const s=await sessionOrThrow(env,request);
  const wanted=typeOf(type);
  if(type&&!wanted)throw new Error("Tipo de favorito inválido.");

  const rows=await db.queryEqual("suscriptor_favoritos","suscriptor_id",text(s.sid),500);
  const favoritos=rows
    .filter(x=>x.activo===undefined||x.activo===true)
    .filter(x=>!wanted||text(x.tipo).toUpperCase()===wanted);

  return{success:true,favoritos};
}

export async function addFavoriteV2({env,request,db,body}){
  const s=await sessionOrThrow(env,request);
  const sid=text(s.sid);
  const tipo=typeOf(body&&body.tipo);
  const ref=text(body&&body.referencia_id);
  if(!tipo)throw new Error("Tipo de favorito inválido.");
  if(!ref)throw new Error("Falta referencia_id.");

  const id=await favoriteDocId(sid,tipo,ref);
  const now=new Date().toISOString();
  const doc={
    favorito_id:id,
    suscriptor_id:sid,
    tipo,
    referencia_id:ref,
    nombre_ref:text(body&&body.nombre_ref),
    ciudad_id:text(body&&body.ciudad_id),
    fecha_alta:now,
    activo:true,
    actualizado:now
  };
  await db.patch("suscriptor_favoritos",id,doc);
  return{success:true,message:"Favorito guardado",favorito:doc};
}

export async function removeFavoriteV2({env,request,db,body}){
  const s=await sessionOrThrow(env,request);
  const sid=text(s.sid);
  const tipo=typeOf(body&&body.tipo);
  const ref=text(body&&body.referencia_id);
  if(!tipo)throw new Error("Tipo de favorito inválido.");
  if(!ref)throw new Error("Falta referencia_id.");

  const id=await favoriteDocId(sid,tipo,ref);
  const current=await db.get("suscriptor_favoritos",id);
  if(!current)return{success:true,message:"El favorito ya no existe"};
  if(text(current.suscriptor_id)!==sid)throw new Error("Favorito inválido.");

  await db.delete("suscriptor_favoritos",id,{mustExist:true});
  return{success:true,message:"Favorito eliminado",favorito:current};
}
