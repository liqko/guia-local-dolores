import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import worker from '../worker/WORKER_COMPLETO_V87.js';
const env={SERVER_SECRET:'ui-test',GLD_CACHE_KV:{get:async()=>null,put:async()=>{},delete:async()=>{},list:async()=>({keys:[],list_complete:true})}};
const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url');};
const principal=sign({sid:'S',sv:0,rol:'SUPERADMIN_PRINCIPAL',persistent:true,exp:null}),legacy=sign({sid:'S',sv:0,typ:'GLD_SUBSCRIBER',auth:[],exp:Date.now()+60000});
const log=console.log;console.log=()=>{};
function surface(gh=false){
 const events={},nodes=[];
 class Node{constructor(tag){this.tagName=tag;this.children=[];this.style={};this.listeners={};nodes.push(this);}appendChild(n){this.children.push(n);n.parent=this;return n;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.removed=true;}addEventListener(k,v){this.listeners[k]=v;}setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}}
 const body=new Node('body'),app=new Node('div');app.id='app';body.appendChild(app);
 const document={body,currentScript:{hasAttribute:()=>gh,getAttribute:()=>gh?'#app':null},createElement:tag=>new Node(tag),getElementById:id=>nodes.find(n=>n.id===id&&!n.removed),querySelector:selector=>selector==='#app'?app:null,addEventListener(){}};
 const window={document,fetch:async(input,options)=>worker.fetch(new Request(input,options),env),parent:null,addEventListener:(k,v)=>(events[k]??=[]).push(v),dispatchEvent:e=>{for(const f of events[e.type]||[])f(e);}};window.parent=window;
 const context=vm.createContext({window,document,location:{origin:'https://anunciantes-guialocal.web.app',href:'https://anunciantes-guialocal.web.app/'+(gh?'gh':'visitor'),pathname:gh?'/gh':'/visitor'},localStorage:storage,sessionStorage:storage,URL,Headers,Request,Date,Map,Set,Promise,atob,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Event:class{constructor(type){this.type=type;}},console});
 for(const name of ['sesion-persistente.js','consumo-v44.js'])vm.runInContext(fs.readFileSync('plataforma/'+name,'utf8'),context,{filename:name});
 return {context,window,document,nodes,events};
}
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
try{
 const visitor=surface();await settle();assert.equal(visitor.nodes.some(n=>n.tagName==='details'),false);await visitor.window.fetch('https://login.liqkoargentina.workers.dev/');assert.equal(store.has('gld_consumo_admin_v87'),false);
 storage.setItem('gld_superadmin_token',principal);storage.setItem('gld_suscriptor_token_v2',legacy);storage.setItem('gld_suscriptor_session_v2',JSON.stringify({suscriptor_id:'S'}));storage.setItem('gld_ciudad_contexto',JSON.stringify({ciudad_id:'DOL',pais_id:'ARG',provincia_id:'BUE'}));
 const gh=surface(true);gh.window.gldConsumoAdminV68(principal);await settle();await gh.document.getElementById('gld-diagnostics-toggle').onclick();assert.ok(store.get('gld_diagnostic_capability_v87'));assert.ok(gh.nodes.some(n=>n.tagName==='details'&&!n.removed));assert.ok(gh.nodes.some(n=>n.textContent==='Probar visitante'));
 const activeVisitor=surface();await settle();await activeVisitor.window.fetch('https://login.liqkoargentina.workers.dev/');assert.equal(JSON.parse(store.get('gld_consumo_admin_v87')).length,1);
 for(let i=0;i<2;i++)await activeVisitor.window.fetch('https://login.liqkoargentina.workers.dev/suscriptores',{method:'POST',headers:{Authorization:'Bearer '+legacy,'Content-Type':'application/json'},body:JSON.stringify({action:'session'})});
 assert.equal(JSON.parse(Buffer.from(store.get('gld_suscriptor_token_v2').split('.')[0],'base64url')).persistent,true);
 const reopened=surface();await settle();assert.equal(JSON.parse(storage.getItem('gld_ciudad_contexto')).ciudad_id,'DOL');assert.ok(reopened.nodes.some(n=>n.tagName==='details'));
 await gh.document.getElementById('gld-diagnostics-toggle').onclick();assert.equal(store.has('gld_diagnostic_capability_v87'),false);
 storage.setItem('gld_diagnostic_capability_v87','forged');const forged=surface();await settle();assert.equal(forged.nodes.some(n=>n.tagName==='details'),false);
 const original=store.get('gld_suscriptor_token_v2');const broken=surface();broken.window.fetch=async()=>{throw Error('offline');};try{await broken.window.fetch('https://login.liqkoargentina.workers.dev/suscriptores');}catch{}assert.equal(store.get('gld_suscriptor_token_v2'),original);
 // Exercise the real restoration function with a transport failure and then with a confirmed 401.
 const html=fs.readFileSync('plataforma/login.html','utf8'),start=html.indexOf('  async function restaurarSesionSuscriptor_()'),end=html.indexOf('  restaurarSesionSuscriptor_();',start);
 const ctx=vm.createContext({localStorage:storage,document:broken.document,SUSCRIPTOR_SESSION_KEY:'gld_suscriptor_session_v2',SUSCRIPTOR_TOKEN_KEY:'gld_suscriptor_token_v2',SUSCRIPTOR_AUTHS_KEY:'auths',hideGlobalBlocking_(){},showGlobalBlocking_(){},mostrarPanel(){},limpiarContextoAnunciante_(){},guardarSesionSuscriptor_:v=>{if(!v)storage.removeItem('gld_suscriptor_session_v2');},abrirCuentaAutorizada_:async()=>{throw new Error('offline');},sesionSuscriptor:null,gldSubscriberToken:'',autorizacionesAnunciante:[],htmlEscape:String});vm.runInContext(html.slice(start,end),ctx);await ctx.restaurarSesionSuscriptor_();assert.ok(store.has('gld_suscriptor_session_v2'));assert.equal(storage.getItem('gld_suscriptor_token_v2'),original);
 ctx.abrirCuentaAutorizada_=async()=>{throw Object.assign(new Error('revoked'),{status:401});};await ctx.restaurarSesionSuscriptor_();assert.equal(store.has('gld_suscriptor_token_v2'),false);assert.equal(JSON.parse(store.get('gld_ciudad_contexto')).ciudad_id,'DOL');
 log('PASS simulated UI: public monitor absent; server-validated opt-in; shared visitor measurements; new-window restoration; token upgrade; forged capability rejected; temporary recovery failure preserves session; confirmed revocation clears session but keeps city.');
}finally{console.log=log;}
