/**
 * SESION GRAN HERMANO V2
 * Credenciales del suscriptor y permiso administrativo por ID; sin barridos.
 * Mantiene compatibilidad con clave en texto existente.
 */
const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();

function b64(input){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let binary="";bytes.forEach(x=>binary+=String.fromCharCode(x));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
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
async function issue(env,payload){
  const body=b64(JSON.stringify({
    ...payload,
    iat:Date.now(),
    exp:Date.now()+8*60*60*1000
  }));
  return body+"."+await hmac(env,body);
}
function truthy(v){
  if(v===true||v===1)return true;
  return ["true","1","si","sí","yes","x","activo","activa"].includes(norm(v));
}

export async function superadminLoginV2({env,db,body}){
  const original=text(body&&body.mail);
  const mail=norm(original);
  const clave=text(body&&body.clave);

  if(!mail||!clave)return{success:false,message:"Falta mail o clave"};

  let rows=await db.queryEqual("suscriptores","mail",mail,5);
  if(!rows.length&&original&&original!==mail){
    rows=await db.queryEqual("suscriptores","mail",original,5);
  }

  const sus=rows.find(a=>norm(a.mail)===mail);
  if(!sus||text(sus.clave)!==clave){
    return{success:false,message:"Mail o clave incorrectos"};
  }
  if(sus.activo!==""&&sus.activo!==null&&sus.activo!==undefined&&!truthy(sus.activo)){
    return{success:false,message:"Suscriptor no activo"};
  }
  const sid=text(sus.suscriptor_id||sus.id);
  if(!sid)return{success:false,message:"Suscriptor sin ID válido"};
  let admin=await db.get("superadmins",sid);
  if(!admin){
    const permisos=await db.queryEqual("superadmins","suscriptor_id",sid,5);
    admin=permisos.find(a=>text(a.suscriptor_id)===sid);
  }
  if(!admin)return{success:false,message:"Esta cuenta no tiene acceso a este panel"};
  if(!truthy(admin.activo)){
    return{success:false,message:"Administrador no activo"};
  }

  const role=text(admin.rol||"SUPERADMIN").toUpperCase();
  if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN","ADMIN_LOCAL"].includes(role)){
    return{success:false,message:"Esta cuenta no está habilitada para Gran Hermano"};
  }

  const nombre=text(sus.nombre||admin.nombre);
  const token=await issue(env,{sid,rol:role,nombre,mail:text(sus.mail)});

  return{
    success:true,
    token,
    admin:{
      id:sid,
      suscriptor_id:sid,
      nombre,
      mail:text(sus.mail),
      rol:role,
      activo:true,
      ciudades:Array.isArray(admin.ciudades)?admin.ciudades:[],
      permisos:admin.permisos&&typeof admin.permisos==="object"?admin.permisos:{}
    },
    expires_in_seconds:8*60*60
  };
}
