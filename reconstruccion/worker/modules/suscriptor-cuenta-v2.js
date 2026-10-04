/**
 * CUENTA SUSCRIPTOR V2
 * Perfil y preferencias con sesión firmada.
 * Registro/login conservan clave en texto sólo por compatibilidad con los datos existentes.
 * Recuperación de clave usa un único puente externo de correo configurado en
 * SUSCRIPTORES_RECOVERY_URL; el Worker sincroniza sólo los campos confirmados.
 */
import {verifySubscriberSession} from "./suscriptores.js";
import {revokeSubscriberSessions} from "../core/subscriber-session-state.js";

const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();
const truthy=v=>v===true||v===1||["true","1","si","sí","x","activo","activa"].includes(norm(v));

async function session(env,request){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)throw new Error(s.message||"Sesión inválida.");
  return s;
}
function publicProfile(s){
  return {
    suscriptor_id:text(s.suscriptor_id||s.id),
    nombre:text(s.nombre),
    mail:text(s.mail),
    whatsapp:text(s.whatsapp),
    tipo_usuario:text(s.tipo_usuario),
    ciudad_origen_id:text(s.ciudad_origen_id),
    ciudad_predeterminada_id:text(s.ciudad_predeterminada_id),
    activo:s.activo
  };
}

export async function createSubscriberV2({db,body}){
  const mail=norm(body&&body.mail),clave=text(body&&body.clave),nombre=text(body&&body.nombre);
  if(!mail||!clave||!nombre)throw new Error("Faltan nombre, mail o clave.");

  const exists=await db.queryEqual("suscriptores","mail",mail,5);
  if(exists.some(x=>norm(x.mail)===mail))throw new Error("Ya existe una cuenta con ese mail.");

  const id="SUS-"+crypto.randomUUID().replace(/-/g,"").slice(0,18).toUpperCase();
  const now=new Date().toISOString();
  const doc={
    suscriptor_id:id,
    nombre,
    mail,
    clave,
    whatsapp:text(body.whatsapp),
    tipo_usuario:text(body.tipo_usuario||"RESIDENTE").toUpperCase(),
    ciudad_origen_id:text(body.ciudad_origen_id),
    ciudad_predeterminada_id:text(body.ciudad_predeterminada_id||body.ciudad_origen_id),
    activo:true,
    creado_en:now,
    actualizado_en:now
  };
  const saved=await db.patch("suscriptores",id,doc);
  return{success:true,suscriptor:publicProfile(saved)};
}

export async function getSubscriberProfileV2({env,request,db}){
  const s=await session(env,request);
  const doc=await db.get("suscriptores",text(s.sid));
  if(!doc)throw new Error("Suscriptor no encontrado.");
  if(doc.activo!==undefined&&!truthy(doc.activo))throw new Error("Suscriptor no activo.");
  return{success:true,suscriptor:publicProfile(doc)};
}

export async function updateSubscriberProfileV2({env,request,db,body}){
  const s=await session(env,request);
  const allowed=["nombre","whatsapp","tipo_usuario","ciudad_origen_id"];
  const patch={actualizado_en:new Date().toISOString()};
  for(const key of allowed){
    if(Object.prototype.hasOwnProperty.call(body||{},key))patch[key]=text(body[key]);
  }
  if(Object.keys(patch).length===1)return{success:true,updated:false};
  const saved=await db.patch("suscriptores",text(s.sid),patch,{mustExist:true});
  return{success:true,suscriptor:publicProfile(saved)};
}

export async function updateSubscriberCityV2({env,request,db,cache,body}){
  const s=await session(env,request);
  const city=text(body&&body.ciudad_id||body&&body.ciudad_predeterminada_id);
  if(!city)throw new Error("Falta ciudad_id.");

  const territory=await cache.get("territorio:public:v1");
  if(!territory||(territory.ciudades||[]).every(c=>text(c.ciudad_id||c.id)!==city)){
    throw new Error("La ciudad indicada no existe o no está activa.");
  }

  const saved=await db.patch("suscriptores",text(s.sid),{
    ciudad_predeterminada_id:city,
    actualizado_en:new Date().toISOString()
  },{mustExist:true});

  return{success:true,suscriptor:publicProfile(saved)};
}

export async function changeSubscriberPasswordV2({env,request,db,body}){
  const s=await session(env,request);
  const actual=text(body&&body.clave_actual||body&&body.actual);
  const nueva=text(body&&body.clave_nueva||body&&body.nueva_clave||body&&body.clave);
  if(!actual||!nueva)throw new Error("Faltan clave actual o nueva clave.");
  if(nueva.length<6)throw new Error("La contraseña debe tener al menos 6 caracteres.");

  const doc=await db.get("suscriptores",text(s.sid));
  if(!doc)throw new Error("Suscriptor no encontrado.");
  if(text(doc.clave)!==actual)throw new Error("La clave actual no coincide.");

  await db.patch("suscriptores",text(s.sid),{
    clave:nueva,
    actualizado_en:new Date().toISOString()
  },{mustExist:true});
  await revokeSubscriberSessions(env,s.sid);
  return{success:true,message:"Clave actualizada. Volvé a ingresar."};
}

export async function deleteSubscriberAccountV2({env,request,db}){
  const s=await session(env,request);
  const sid=text(s.sid);

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
  return{success:true,deleted:true,suscriptor_id:sid};
}

export async function recoveryBridgeV2({env,body}){
  const url=text(env.SUSCRIPTORES_RECOVERY_URL);
  if(!url)throw new Error("Recuperación de contraseña no configurada.");

  const action=norm(body&&body.action||body&&body.accion);
  if(!["solicitar_recuperacion","restablecer_clave"].includes(action)){
    throw new Error("Acción de recuperación inválida.");
  }

  const payload={
    action,
    mail:text(body&&body.mail||body&&body.email),
    codigo:text(body&&body.codigo||body&&body.code),
    nueva_clave:text(body&&body.nueva_clave||body&&body.clave_nueva||body&&body.clave)
  };

  const r=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data)throw new Error("El servicio de recuperación no respondió correctamente.");
  return data;
}
