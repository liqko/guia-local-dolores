import {verifySubscriberSession} from "./suscriptores.js";
import {revokeSubscriberSessions} from "../core/subscriber-session-state.js";

const text=v=>String(v??"").trim();

export async function deleteSubscriberAccountSecureV2({env,request,db,body}){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)throw new Error(s.message||"Sesión inválida.");

  const sid=text(s.sid);
  const clave=text(body&&body.clave_actual);
  if(!clave)throw new Error("Ingresá tu contraseña actual.");

  const current=await db.get("suscriptores",sid);
  if(!current)throw new Error("Suscriptor no encontrado.");
  if(text(current.clave)!==clave)throw new Error("La contraseña actual no coincide.");

  const [relations,favorites]=await Promise.all([
    db.queryEqual("suscriptor_anunciante","suscriptor_id",sid,500),
    db.queryEqual("suscriptor_favoritos","suscriptor_id",sid,500)
  ]);

  for(const r of relations){
    const id=text(r.relacion_id||r.id);
    if(id)await db.delete("suscriptor_anunciante",id);
  }
  for(const f of favorites){
    const id=text(f.favorito_id||f.id);
    if(id)await db.delete("suscriptor_favoritos",id);
  }

  await db.delete("suscriptores",sid,{mustExist:true});
  await revokeSubscriberSessions(env,sid,{deleted:true});
  return{success:true,deleted:true,suscriptor_id:sid};
}
