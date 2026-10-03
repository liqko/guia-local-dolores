/**
 * SESION GRAN HERMANO V2
 * Login por consulta indexada de mail; sesión HMAC sin lectura Firestore posterior.
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

  let rows=await db.queryEqual("superadmins","mail",mail,5);
  if(!rows.length&&original&&original!==mail){
    rows=await db.queryEqual("superadmins","mail",original,5);
  }

  const admin=rows.find(a=>norm(a.mail)===mail);
  if(!admin||text(admin.clave)!==clave){
    return{success:false,message:"Mail o clave incorrectos"};
  }
  if(!truthy(admin.activo)){
    return{success:false,message:"Administrador no activo"};
  }

  const role=text(admin.rol||"SUPERADMIN").toUpperCase();
  if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN","ADMIN_LOCAL"].includes(role)){
    return{success:false,message:"Esta cuenta no está habilitada para Gran Hermano"};
  }

  const sid=text(admin.id||admin.superadmin_id);
  if(!sid)return{success:false,message:"Administrador sin ID válido"};

  const token=await issue(env,{sid,rol:role,nombre:text(admin.nombre),mail:text(admin.mail)});

  return{
    success:true,
    token,
    admin:{
      id:sid,
      nombre:text(admin.nombre),
      mail:text(admin.mail),
      rol:role,
      activo:true
    },
    expires_in_seconds:8*60*60
  };
}
