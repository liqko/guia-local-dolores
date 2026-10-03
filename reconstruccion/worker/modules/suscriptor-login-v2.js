/**
 * SUSCRIPTOR LOGIN V2
 * Login con verificación de correo + sesión HMAC autosuficiente.
 */
const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();
const truthy=v=>v===true||v===1||["true","1","si","sí","yes","x","activo","activa"].includes(norm(v));

function b64(input){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let bin="";bytes.forEach(x=>bin+=String.fromCharCode(x));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function hmac(env,value){
  const secret=text(env.SERVER_SECRET);
  if(!secret)throw new Error("Falta SERVER_SECRET");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}
async function issue(env,payload){
  const now=Date.now();
  const body=b64(JSON.stringify({...payload,iat:now,exp:now+8*60*60*1000,typ:"GLD_SUBSCRIBER"}));
  return body+"."+await hmac(env,body);
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
function perms(rel,admin){
  const raw=text(rel&&rel.permisos)||text(admin&&admin.funcionalidades);
  return raw.split(/[;,|\n]/).map(x=>text(x).toUpperCase()).filter(Boolean).join(", ");
}

export async function subscriberLoginV2({env,db,body}){
  const mail=norm(body&&body.mail),clave=text(body&&body.clave);
  if(!mail||!clave)return{success:false,message:"Falta mail o clave"};

  const matches=await db.queryEqual("suscriptores","mail",mail,5);
  const sus=matches.find(x=>norm(x.mail)===mail);
  if(!sus||text(sus.clave)!==clave)return{success:false,message:"Mail o clave incorrectos"};
  if(sus.activo!==undefined&&sus.activo!==null&&sus.activo!==""&&!truthy(sus.activo)){
    return{success:false,message:"Suscriptor no activo"};
  }
  if(sus.email_verificado===false||norm(sus.email_verificado)==="false"){
    return{success:false,message:"Primero verificá tu correo electrónico.",requiere_verificacion:true,mail:text(sus.mail||mail)};
  }

  const sid=text(sus.suscriptor_id||sus.id);
  const relations=(await db.queryEqual("suscriptor_anunciante","suscriptor_id",sid,100))
    .filter(r=>text(r.anunciante_id)&&truthy(r.activo));

  const enriched=await Promise.all(relations.map(async rel=>{
    const aid=text(rel.anunciante_id);
    const [advertiser,admin]=await Promise.all([
      db.get("anunciantes",aid),
      db.get("anunciantes_administracion",aid)
    ]);
    return {
      suscriptor_id:sid,
      anunciante_id:aid,
      anunciante_nombre:text(rel.anunciante_nombre||(advertiser&&advertiser.nombre)||(admin&&admin.nombre)),
      rol:text(rel.rol).toUpperCase(),
      permisos:perms(rel,admin),
      activo:true
    };
  }));

  const token=await issue(env,{
    sid,
    auth:enriched.map(x=>({
      anunciante_id:x.anunciante_id,
      anunciante_nombre:x.anunciante_nombre,
      rol:x.rol,
      permisos:x.permisos
    }))
  });

  return {
    success:true,
    suscriptor:publicSubscriber(sus),
    anunciantes:enriched,
    token,
    expires_in_seconds:8*60*60,
    source:"firestore"
  };
}
