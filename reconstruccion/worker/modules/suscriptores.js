/**
 * SUSCRIPTORES / SESIÓN DEL PANEL
 *
 * Objetivo:
 * - Login NO escribe ultimo_acceso: iniciar sesión es una lectura, no una mutación.
 * - Devuelve una sesión HMAC firmada y las autorizaciones mínimas.
 * - La sesión incluye anunciante/rol/permisos para validar acciones sin releer Firestore
 *   en cada clic. Expira y debe renovarse con un nuevo login.
 *
 * Compatibilidad: las claves existentes hoy están guardadas en texto en Firestore.
 * Este módulo conserva esa comparación para no romper cuentas; la migración a hash
 * se hará como tarea de seguridad separada.
 */

const C = {
  suscriptores:"suscriptores",
  relaciones:"suscriptor_anunciante",
  anunciantes:"anunciantes",
  admin:"anunciantes_administracion"
};

const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();

function truthy(v){
  if(v===true||v===1)return true;
  return ["true","1","si","sí","yes","x","activo","activa"].includes(norm(v));
}

function publicSubscriber(s){
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

function b64(input){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let bin="";bytes.forEach(x=>bin+=String.fromCharCode(x));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function b64decode(s){
  s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  const bin=atob(s), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(env,value){
  const secret=text(env.SERVER_SECRET);
  if(!secret)throw new Error("Falta SERVER_SECRET");
  const key=await crypto.subtle.importKey(
    "raw",new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]
  );
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}

async function issueSession(env,payload,hours=8){
  const now=Date.now();
  const body=b64(JSON.stringify({
    ...payload,
    iat:now,
    exp:now+hours*60*60*1000,
    typ:"GLD_SUBSCRIBER"
  }));
  return body+"."+await hmac(env,body);
}

export async function verifySubscriberSession(env,request){
  const auth=text(request.headers.get("Authorization"));
  if(!auth.toLowerCase().startsWith("bearer "))return{ok:false,message:"Sesión requerida"};
  const parts=auth.slice(7).trim().split(".");
  if(parts.length!==2)return{ok:false,message:"Sesión inválida"};
  const [body,sig]=parts;
  if(sig!==await hmac(env,body))return{ok:false,message:"Sesión inválida"};
  let p=null;try{p=JSON.parse(b64decode(body))}catch(_){}
  if(!p||p.typ!=="GLD_SUBSCRIBER"||!p.sid||!p.exp||Date.now()>Number(p.exp)){
    return{ok:false,message:"Sesión inválida o vencida"};
  }
  return{ok:true,...p};
}

function relationPermissions(rel,admin){
  const raw = text(rel.permisos) || text(admin&&admin.funcionalidades);
  return raw.split(/[;,|\n]/).map(x=>text(x).toUpperCase()).filter(Boolean);
}

export async function subscriberLogin({env,db,body}){
  const mail=norm(body.mail), clave=text(body.clave);
  if(!mail||!clave)return{success:false,message:"Falta mail o clave"};

  const matches=await db.queryEqual(C.suscriptores,"mail",mail,5);
  const sus=matches.find(x=>norm(x.mail)===mail);
  if(!sus || text(sus.clave)!==clave)return{success:false,message:"Mail o clave incorrectos"};
  if(sus.activo!==undefined&&sus.activo!==null&&sus.activo!==""&&!truthy(sus.activo)){
    return{success:false,message:"Suscriptor no activo"};
  }

  const sid=text(sus.suscriptor_id||sus.id);
  const relations=(await db.queryEqual(C.relaciones,"suscriptor_id",sid,100))
    .filter(r=>text(r.anunciante_id)&&truthy(r.activo));

  const enriched=await Promise.all(relations.map(async rel=>{
    const aid=text(rel.anunciante_id);
    const [advertiser,admin]=await Promise.all([
      db.get(C.anunciantes,aid),
      db.get(C.admin,aid)
    ]);
    return{
      suscriptor_id:sid,
      anunciante_id:aid,
      anunciante_nombre:text(rel.anunciante_nombre||(advertiser&&advertiser.nombre)||(admin&&admin.nombre)),
      rol:text(rel.rol).toUpperCase(),
      permisos:relationPermissions(rel,admin).join(", "),
      administracion:admin||{},
      activo:true
    };
  }));

  const tokenPayload={
    sid,
    auth:enriched.map(x=>({
      anunciante_id:x.anunciante_id,
      rol:x.rol,
      permisos:x.permisos
    }))
  };
  const token=await issueSession(env,tokenPayload);

  return{
    success:true,
    suscriptor:publicSubscriber(sus),
    anunciantes:enriched,
    token,
    expires_in_seconds:8*60*60,
    source:"firestore"
  };
}

export async function subscriberSession({env,request}){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)return{success:false,message:s.message,status:401};
  return{
    success:true,
    suscriptor_id:s.sid,
    autorizaciones:Array.isArray(s.auth)?s.auth:[],
    expires_at:s.exp
  };
}

export function sessionAllows(session,advertiserId,moduleName,{write=false}={}){
  if(!session||!session.ok)return false;
  const aid=text(advertiserId);
  const rel=(session.auth||[]).find(x=>text(x.anunciante_id)===aid);
  if(!rel)return false;

  const role=text(rel.rol).toUpperCase();
  if(!["PROPIETARIO","ADMINISTRADOR","MANAGER"].includes(role))return false;
  if(write&&moduleName==="modificar_datos"&&role==="MANAGER")return false;

  if(moduleName==="modificar_datos")return role==="PROPIETARIO"||role==="ADMINISTRADOR";

  const aliases={
    promos:["PROMOS"],
    eventos:["EVENTOS"],
    eventos_free:["EVENTOS_FREE","EV_FREE","EVFREE"],
    actividades:["ACTIVIDADES"],
    publicidad:["PUBLICIDAD"],
    turnos_farma:["TURNOS_FARMA","FARMACIAS","FARMACIA"],
    efemerides:["EFEMERIDES","EF LOCAL","EF GENERAL","EF_LOCAL","EF_GENERAL"]
  };
  const perms=new Set(text(rel.permisos).split(/[;,|\n]/).map(x=>text(x).toUpperCase()).filter(Boolean));
  return (aliases[moduleName]||[]).some(x=>perms.has(x));
}
