import {upsertSubscriberIndexV2} from "../core/subscriber-index-v2.js";
import {revokeSubscriberSessions} from "../core/subscriber-session-state.js";
const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();

export async function subscriberMailBridgeV2({env,db,cache,body}){
  const url=text(env.SUSCRIPTORES_RECOVERY_URL);
  if(!url)throw new Error("Servicio de correo de suscriptores no configurado.");

  const action=norm(body&&body.action||body&&body.accion);
  const allowed=new Set([
    "solicitar_recuperacion",
    "restablecer_clave",
    "solicitar_verificacion",
    "confirmar_verificacion"
  ]);
  if(!allowed.has(action))throw new Error("Acción de correo inválida.");

  const payload={
    action,
    mail:text(body&&body.mail||body&&body.email),
    codigo:text(body&&body.codigo||body&&body.code),
    clave_nueva:text(body&&body.clave_nueva||body&&body.nueva_clave||body&&body.clave)
  };
  payload.mail=norm(payload.mail);
  if(!payload.mail||!/^\S+@\S+\.\S+$/.test(payload.mail))throw new Error("Ingresá un mail válido.");
  const confirmation=["restablecer_clave","confirmar_verificacion"].includes(action);
  if(confirmation&&!/^\d{6}$/.test(payload.codigo))throw new Error("Ingresá el código de 6 números.");
  if(action==="restablecer_clave"&&payload.clave_nueva.length<6)throw new Error("La contraseña debe tener al menos 6 caracteres.");
  // Compatibilidad con ambos nombres usados por los puentes de recuperación.
  payload.nueva_clave=payload.clave_nueva;
  payload.serverSecret=text(env.SERVER_SECRET);

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(url,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),signal:controller.signal
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||typeof data.success!=="boolean")throw new Error("El servicio de correo no respondió correctamente.");
    if(!data.success||!confirmation)return data;

    // El puente confirma el código; Firestore recibe sólo el cambio necesario.
    const rows=await db.queryEqual("suscriptores","mail",payload.mail,5);
    const current=rows.find(s=>norm(s.mail)===payload.mail);
    if(!current)throw new Error("Cuenta no encontrada al confirmar el código.");
    const sid=text(current.suscriptor_id||current.id);
    const now=new Date().toISOString();
    const patch=action==="confirmar_verificacion"
      ?{email_verificado:true,email_verificado_fecha:now,actualizado_en:now}
      :{clave:payload.clave_nueva,actualizado_en:now};
    const changed=action==="confirmar_verificacion"?current.email_verificado!==true:text(current.clave)!==payload.clave_nueva;
    const saved=changed?await db.patch("suscriptores",sid,patch,{mustExist:true}):current;
    if(action==="restablecer_clave")await revokeSubscriberSessions(env,sid);
    await upsertSubscriberIndexV2({cache,subscriber:saved});
    return data;
  }catch(e){
    if(e.name==="AbortError")throw new Error("El servicio de correo demoró demasiado. Volvé a intentar.");
    throw e;
  }finally{clearTimeout(timer)}
}
