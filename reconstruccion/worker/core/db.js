/**
 * Firestore REST — primitivas sin efectos laterales.
 * Ninguna función invalida caches, reconstruye proyecciones ni descubre dependencias.
 */
const tokenCache={token:"",expiresAt:0,pending:null};

function text(v){return String(v??"").trim();}
function b64url(input){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let binary=""; bytes.forEach(x=>binary+=String.fromCharCode(x));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function pemBuffer(pem){
  const clean=String(pem||"").replace(/\\n/g,"\n")
    .replace("-----BEGIN PRIVATE KEY-----","")
    .replace("-----END PRIVATE KEY-----","").replace(/\s+/g,"");
  const bin=atob(clean); const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return bytes.buffer;
}
async function newToken(env){
  const project=text(env.FIREBASE_PROJECT_ID), email=text(env.FIREBASE_CLIENT_EMAIL), privateKey=text(env.FIREBASE_PRIVATE_KEY);
  if(!project||!email||!privateKey) throw new Error("Faltan credenciales Firebase.");
  const now=Math.floor(Date.now()/1000);
  const head=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const payload=b64url(JSON.stringify({
    iss:email,
    scope:"https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud:"https://oauth2.googleapis.com/token",
    iat:now,exp:now+3600
  }));
  const unsigned=head+"."+payload;
  const key=await crypto.subtle.importKey("pkcs8",pemBuffer(privateKey),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const jwt=unsigned+"."+b64url(new Uint8Array(sig));
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.access_token) throw new Error("No se pudo obtener token Google.");
  tokenCache.token=j.access_token;
  tokenCache.expiresAt=Date.now()+Math.max(60,Number(j.expires_in||3600)-120)*1000;
  return tokenCache.token;
}
async function token(env){
  if(tokenCache.token&&Date.now()<tokenCache.expiresAt) return tokenCache.token;
  if(tokenCache.pending) return tokenCache.pending;
  tokenCache.pending=newToken(env);
  try{return await tokenCache.pending;}finally{tokenCache.pending=null;}
}
function base(env){
  const project=text(env.FIREBASE_PROJECT_ID);
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
}
function fromFs(v){
  if(v==null)return null;
  if("stringValue"in v)return v.stringValue;
  if("booleanValue"in v)return v.booleanValue;
  if("integerValue"in v)return Number(v.integerValue);
  if("doubleValue"in v)return Number(v.doubleValue);
  if("timestampValue"in v)return v.timestampValue;
  if("nullValue"in v)return null;
  if("arrayValue"in v)return ((v.arrayValue&&v.arrayValue.values)||[]).map(fromFs);
  if("mapValue"in v)return fieldsFromFs((v.mapValue&&v.mapValue.fields)||{});
  return null;
}
function fieldsFromFs(fields){const o={};for(const[k,v]of Object.entries(fields||{}))o[k]=fromFs(v);return o;}
function toFs(v){
  if(v==null)return{nullValue:null};
  if(Array.isArray(v))return{arrayValue:{values:v.map(toFs)}};
  if(typeof v==="boolean")return{booleanValue:v};
  if(typeof v==="number")return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(typeof v==="object"){const fields={};for(const[k,x]of Object.entries(v))if(x!==undefined)fields[k]=toFs(x);return{mapValue:{fields}};}
  return{stringValue:String(v)};
}
function docToJs(doc,id=""){if(!doc)return null;return{id:id||String(doc.name||"").split("/").pop(),...fieldsFromFs(doc.fields||{})};}
async function request(env,path,{method="GET",body=null,allow404=false}={}){
  const r=await fetch(base(env)+"/"+path,{method,headers:{Authorization:"Bearer "+await token(env),...(body!==null?{"Content-Type":"application/json"}:{})},...(body!==null?{body:JSON.stringify(body)}:{})});
  if(allow404&&r.status===404)return null;
  const raw=await r.text(); let j=null; try{j=raw?JSON.parse(raw):null}catch(_){}
  if(!r.ok)throw new Error(`Firestore ${method} ${path}: ${r.status} ${raw.slice(0,250)}`);
  return j;
}
export function createDb(env){
  return {
    async get(collection,id){
      const d=await request(env,`${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,{allow404:true});
      return docToJs(d,id);
    },
    async patch(collection,id,patch){
      const clean={};for(const[k,v]of Object.entries(patch||{}))if(v!==undefined)clean[k]=v;
      const qs=new URLSearchParams();Object.keys(clean).forEach(k=>qs.append("updateMask.fieldPaths",k));
      const fields={};for(const[k,v]of Object.entries(clean))fields[k]=toFs(v);
      const d=await request(env,`${encodeURIComponent(collection)}/${encodeURIComponent(id)}?${qs}`,{method:"PATCH",body:{fields}});
      return docToJs(d,id);
    },
    async queryEqual(collection,field,value,limit=1000){
      const project=text(env.FIREBASE_PROJECT_ID);
      const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents:runQuery`;
      const r=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+await token(env),"Content-Type":"application/json"},body:JSON.stringify({structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:field},op:"EQUAL",value:toFs(value)}},limit:Number(limit)}})});
      const rows=await r.json().catch(()=>[]);
      if(!r.ok)throw new Error(`Firestore query ${collection}.${field}: ${r.status}`);
      return (Array.isArray(rows)?rows:[]).filter(x=>x.document).map(x=>docToJs(x.document));
    }
  };
}
