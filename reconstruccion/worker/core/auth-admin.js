/**
 * Token administrativo HMAC, verificación estateless: 0 Firestore.
 */
function text(v){return String(v??"").trim();}
function b64(input){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let binary="";bytes.forEach(x=>binary+=String.fromCharCode(x));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function b64decode(s){
  s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  const bin=atob(s);const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(env,value){
  const secret=text(env.SERVER_SECRET);
  if(!secret)throw new Error("Falta SERVER_SECRET");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}
export async function verifyAdmin(env,request){
  const auth=text(request.headers.get("Authorization"));
  if(!auth.toLowerCase().startsWith("bearer "))return{ok:false,message:"Sesión de administrador requerida"};
  const parts=auth.slice(7).trim().split(".");
  if(parts.length!==2)return{ok:false,message:"Sesión inválida"};
  const [body,sig]=parts;
  if(sig!==await hmac(env,body))return{ok:false,message:"Sesión inválida"};
  let p=null;try{p=JSON.parse(b64decode(body))}catch(_){}
  if(!p||!p.sid||!p.exp||Date.now()>Number(p.exp))return{ok:false,message:"Sesión inválida o vencida"};
  const rol=text(p.rol).toUpperCase();
  if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN","ADMIN_LOCAL"].includes(rol))return{ok:false,message:"Rol administrativo no habilitado"};
  return{ok:true,sid:text(p.sid),rol};
}
