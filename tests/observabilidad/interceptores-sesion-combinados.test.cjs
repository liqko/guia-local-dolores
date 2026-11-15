const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const SESSION=fs.readFileSync('plataforma/sesion-persistente.js','utf8');
const PANEL=fs.readFileSync('plataforma/panel-administrativo155.js','utf8');
const WORKER='https://login.liqkoargentina.workers.dev';
function token(typ,sid){return Buffer.from(JSON.stringify({typ,sid,persistent:true,exp:null,rol:typ==='GLD_ADMIN'?'superadmin':undefined})).toString('base64url')+'.signature';}
function harness({adminPanel=false,replies=[]}={}){
 const store=new Map(),events=new Map(),calls=[];let next=0;const win={};
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 win.localStorage=storage;win.opener=adminPanel?{}:null;
 win.addEventListener=(name,cb)=>events.set(name,cb);
 win.removeEventListener=(name)=>events.delete(name);
 win.dispatchEvent=()=>{};
 win.fetch=async(input,options={})=>{
  const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));
  const url=typeof input==='string'?input:input.url;
  calls.push({url,method:options.method||(input.method||'GET'),auth:headers.get('Authorization'),headers});
  const item=replies[next++]||{status:200,body:{success:true}};
  return {status:item.status,ok:item.status>=200&&item.status<300,headers:new Headers(item.headers||{}),clone(){return this},async json(){return item.body}};
 };
 const document={documentElement:{dataset:{}},head:{appendChild(){}},createElement(){return {textContent:''}},addEventListener(name,cb){events.set('document:'+name,cb)}};
 const context={window:win,localStorage:storage,CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}},document,location:{href:'https://anunciantes-guialocal.web.app/plataforma/login.html'+(adminPanel?'?administracion=nonce1':''),origin:'https://anunciantes-guialocal.web.app'},URL,Headers,Request,Promise,Map,Set,Date,JSON,Error,DOMException,console,atob:s=>Buffer.from(s,'base64').toString(),setTimeout:cb=>{return 1},clearTimeout:()=>{},};
 // Avoid real time delays when testing finite retries.
 context.setTimeout=cb=>{queueMicrotask(cb);return 1};
 vm.runInNewContext(PANEL,context,{filename:'panel-administrativo155.js'});
 vm.runInNewContext(SESSION,context,{filename:'sesion-persistente.js'});
 return {context,win,events,calls,store,storage,token,fireGrant:(grant)=>events.get('message')?.({origin:context.location.origin,source:win.opener,data:{type:'gld-admin-panel155',nonce:'nonce1',grant}})};
}
const auth=(t)=>({headers:{Authorization:'Bearer '+t},method:'GET'});
test('una consulta normal de anunciante genera exactamente un fetch, sin cambiar credenciales',async()=>{
 const h=harness(),t=token('GLD_SUBSCRIBER','abc');
 h.storage.setItem('gld_suscriptor_token_v2',t);
 await h.win.fetch(WORKER+'/commerce',auth(t));
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].auth,'Bearer '+t);
});
test('panel autorizado usa su token aislado sin modificar el token personal guardado',async()=>{
 const h=harness({adminPanel:true}),user=token('GLD_SUBSCRIBER','personal'),grantToken=token('GLD_SUBSCRIBER','panel');
 h.storage.setItem('gld_suscriptor_token_v2',user);
 h.fireGrant({success:true,token:grantToken,relacion:{anunciante_id:'publicacion1'}});
 await h.win.fetch(WORKER+'/commerce',auth(user));
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].auth,'Bearer '+grantToken);
 assert.equal(h.storage.getItem('gld_suscriptor_token_v2'),user);
});
test('la ruta externa al Worker no agrega solicitudes ni tokens administrativos',async()=>{
 const h=harness({adminPanel:true}),t=token('GLD_SUBSCRIBER','abc');
 h.fireGrant({success:true,token:t,relacion:{anunciante_id:'a1'}});
 await h.win.fetch('https://anunciantes-guialocal.web.app/api',auth('otro'));
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].auth,'Bearer otro');
});
test('HTTP503 de preparación: hasta cinco reintentos GET y nunca POST',async()=>{
 const pending={status:503,body:{code:'COMMERCE_COPY_PREPARING'}};
 const h=harness({replies:[pending,pending,{status:200,body:{success:true}}]});
 await h.win.fetch(WORKER+'/commerce',{method:'GET'});
 assert.equal(h.calls.length,3);
 const post=harness({replies:[pending,{status:200,body:{success:true}}]});
 await post.win.fetch(WORKER+'/commerce',{method:'POST'});
 assert.equal(post.calls.length,1);
});
test('503 ajeno a preparación no provoca reintentos',async()=>{
 const h=harness({replies:[{status:503,body:{code:'OTRO_ERROR'}},{status:200,body:{}}]});
 await h.win.fetch(WORKER+'/commerce',{method:'GET'});
 assert.equal(h.calls.length,1);
});
test('el límite de cinco reintentos se aplica exclusivamente a GET con señal específica',async()=>{
 const pending={status:503,body:{code:'COMMERCE_COPY_PREPARING'}};
 const h=harness({replies:Array.from({length:8},()=>pending)});
 await h.win.fetch(WORKER+'/commerce',{method:'GET'});
 assert.equal(h.calls.length,6);
});
test('una respuesta de panel administrativo no debe sobrescribir la sesión personal',async()=>{
 const personal=token('GLD_SUBSCRIBER','personal');
 const concedido=token('GLD_SUBSCRIBER','administracion');
 const renovado=token('GLD_SUBSCRIBER','administracion-nuevo');
 const h=harness({adminPanel:true,replies:[{status:200,body:{success:true},headers:{'X-GLD-Session-Token':renovado,'X-GLD-Session-Kind':'subscriber'}}]});
 h.storage.setItem('gld_suscriptor_token_v2',personal);
 h.fireGrant({success:true,token:concedido,relacion:{anunciante_id:'a1'}});
 await h.win.fetch(WORKER+'/commerce',auth(personal));
 assert.equal(h.calls[0].auth,'Bearer '+concedido,'el panel usa su concesión');
 assert.equal(h.storage.getItem('gld_suscriptor_token_v2'),personal,'no debe sustituirse la credencial personal por la del panel');
});
test('renovación personal auténtica actualiza sólo su sesión',async()=>{
 const old=token('GLD_SUBSCRIBER','personal'),next=token('GLD_SUBSCRIBER','personal-renovado');
 const h=harness({replies:[{status:200,body:{success:true},headers:{'X-GLD-Session-Token':next,'X-GLD-Session-Kind':'subscriber'}}]});
 h.storage.setItem('gld_suscriptor_token_v2',old);
 await h.win.fetch(WORKER+'/commerce',auth(old));
 assert.equal(h.storage.getItem('gld_suscriptor_token_v2'),next);
});
