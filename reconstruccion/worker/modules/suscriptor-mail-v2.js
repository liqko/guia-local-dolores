const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();

export async function subscriberMailBridgeV2({env,body}){
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

  const r=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data)throw new Error("El servicio de correo no respondió correctamente.");
  return data;
}
