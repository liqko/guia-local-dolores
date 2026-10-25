const path=require('node:path');
const auditDirectory=process.env.GLD_AUDIT_OUTPUT;
if(!auditDirectory)throw Error('Set GLD_AUDIT_OUTPUT to a temporary output directory');
const fs=require('node:fs'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const secret='local-audit-only';
const initial={version:1,paises:[{pais_id:'AR',nombre:'Argentina',activo:true}],provincias:[{provincia_id:'P',pais_id:'AR',nombre:'Provincia',activo:true}],ciudades:[]};
function token(role='SUPERADMIN_PRINCIPAL'){const body=Buffer.from(JSON.stringify({sid:'local-fixture',rol:role,ciudades:['A'],permisos:{},persistent:true,sv:0})).toString('base64url');return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');}
function city(id,name=id){return {ciudad_id:id,ciudad_visible:name,pais_id:'AR',provincia_id:'P',activa:true};}
const saved=[];
async function scenario(worker,name,{repeat=false,partial=false,concurrent=false,role='SUPERADMIN_PRINCIPAL'}={}){
 const kvMap=new Map(['territorio:admin:v1','territorio:public:v1'].map(k=>[k,JSON.stringify(initial)]));
 const documents=new Map(),calls=[],responses=[],barriers=new Map();
 const kv={
  async get(key){calls.push({service:'kv',method:'get',key});const value=kvMap.get(key)||null;
   if(concurrent&&key.startsWith('territorio:')){if(!barriers.has(key))barriers.set(key,[]);const waiting=barriers.get(key);await new Promise(resolve=>{waiting.push(resolve);if(waiting.length===2)waiting.forEach(fn=>fn());});}
   return value;
  },
  async put(key,value){calls.push({service:'kv',method:'put',key});if(partial&&key==='territorio:public:v1')throw Error('local injected public packet write failure');kvMap.set(key,value);},
  async delete(key){calls.push({service:'kv',method:'delete',key});kvMap.delete(key);}
 };
 const env={GLD_CACHE_KV:kv,GLD_PUBLIC_CACHE:{idFromName(){throw Error("Unexpected DO access in territory audit");}},SERVER_SECRET:secret,FIREBASE_PROJECT_ID:'local-fixture',FIREBASE_CLIENT_EMAIL:'fixture@local.invalid',FIREBASE_PRIVATE_KEY:privateKey};
 const priorLog=console.log,priorFetch=globalThis.fetch,priorJson=Request.prototype.json;
 let jsonParses=0;Request.prototype.json=async function(){jsonParses++;return priorJson.call(this);};
 const reports=[];globalThis.__workerAuditCalls=[];
 console.log=x=>{try{reports.push(JSON.parse(x));}catch{}};
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(typeof url==='string'?url:url.url);
  if(u.hostname==='oauth2.googleapis.com'){calls.push({service:'mock-oauth',method:'POST'});return Response.json({access_token:'local-only',expires_in:3600});}
  if(u.hostname==='firestore.googleapis.com'&&options.method==='PATCH'){
   const document={name:u.origin+u.pathname,fields:JSON.parse(options.body).fields,updateTime:new Date().toISOString()};
   documents.set(u.pathname,document);calls.push({service:'mock-firestore',method:'PATCH',path:u.pathname});return Response.json(document);
  }
  throw Error('External network forbidden; unhandled local request '+u.hostname+' '+(options.method||'GET'));
 };
 async function send(item,method='POST'){const r=await worker.fetch(new Request('https://local.invalid'+(method==='PATCH'?'/superadmin/cities/'+item.ciudad_id:'/superadmin/cities/create'),{method,headers:{Authorization:'Bearer '+token(role),'Content-Type':'application/json'},body:JSON.stringify({item})}),env);responses.push({status:r.status,body:await r.json(),consumption:JSON.parse(decodeURIComponent(r.headers.get('X-GLD-Consumption')))});}
 try{if(concurrent)await Promise.all([send(city('A')),send(city('B'))]);else{await send(city('A'));if(repeat)await send(city('A'),'PATCH');}}finally{console.log=priorLog;globalThis.fetch=priorFetch;Request.prototype.json=priorJson;}
 const counts={};for(const c of globalThis.__workerAuditCalls)counts[c.name]=(counts[c.name]||0)+1;
 const result={name,responses,calls,counts,jsonParses,firestoreDocuments:[...documents.values()].map(d=>d.fields.ciudad_id.stringValue),adminCities:JSON.parse(kvMap.get('territorio:admin:v1')).ciudades.map(c=>c.ciudad_id),publicCities:JSON.parse(kvMap.get('territorio:public:v1')).ciudades.map(c=>c.ciudad_id),environment:'entire Worker; simulated KV/Firestore/OAuth; no external network; no production billing claim'};
 saved.push(result);
 return {name,jsonParses,status:responses.map(r=>r.status),kvGet:calls.filter(c=>c.service==='kv'&&c.method==='get').length,kvPut:calls.filter(c=>c.service==='kv'&&c.method==='put').length,firestorePatch:calls.filter(c=>c.service==='mock-firestore').length,verifyAdminCalls:counts.verifyAdmin||0,firestoreDocuments:result.firestoreDocuments,adminCities:result.adminCities,publicCities:result.publicCities};
}
(async()=>{
 globalThis.__workerAuditCalls=[];const worker=(await import(pathToFileURL(path.join(auditDirectory,'guia-worker-instrumentado-20261025.mjs')))).default;
 const output=[];
 for(const [name,options]of [['create-city',{}],['repeat-identical-save',{repeat:true}],['local-admin-denied',{role:'ADMIN_LOCAL'}],['public-write-failure',{partial:true}],['concurrent-two-cities',{concurrent:true}]])output.push(await scenario(worker,name,options));
 fs.writeFileSync(path.join(auditDirectory,'worker-mutations-20261025.json'),JSON.stringify(saved,null,2));console.log(JSON.stringify(output,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
