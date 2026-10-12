import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function node(){let content='';return {style:{},children:[],dataset:{},set textContent(v){content=v;this.children=[];},get textContent(){return content;},append(x){this.children.push(x);},prepend(){},click(){this.result=this.onclick?.();}};}
const button=node(),status=node(),banner=node();banner.querySelector=q=>q==='button'?button:status;
const local=new Map(),session=new Map();let mode='AGE_UNKNOWN',calls=[];
const store=m=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
const window={fetch:async(input,init)=>{calls.push({input,init});return Response.json({success:false,code:mode,message:mode});}};
const context=vm.createContext({window,Headers,Request,URL,document:{querySelector:()=>null,querySelectorAll:()=>[],createElement:tag=>tag==='aside'?banner:node(),body:{append(){}}},localStorage:store(local),sessionStorage:store(session),location:{href:'https://anunciantes-guialocal.web.app/plataforma/eventos.html',reload(){}},confirm:()=>true,MutationObserver:class{observe(){}}});
vm.runInContext(fs.readFileSync(new URL('../plataforma/contenido-adulto.js',import.meta.url),'utf8'),context);
window.GLD_ADULT.open();await button.result;assert.equal(calls.length,0);assert.equal(status.children[0].href,'https://guialocal.ar/suscriptores/?vista=login');
local.set('gld_suscriptor_token_v2','USER');window.GLD_ADULT.open();await button.result;assert.match(status.children[0].href,/vista=mi-guia&seccion=datos/);assert.equal(status.children[0].target,'_top');
mode='UNDERAGE';window.GLD_ADULT.open();await button.result;assert.equal(status.children.length,0);
session.set('gld_adult_access_v67','ADULT');
await window.fetch(new Request('https://login.liqkoargentina.workers.dev/superadmin/dashboard',{headers:{Authorization:'Bearer ADMIN','X-Test':'original'}}),{headers:{'X-Test':'override'}});
let h=calls.at(-1).init.headers;assert.equal(h.get('Authorization'),'Bearer ADMIN');assert.equal(h.get('X-Test'),'override');assert.equal(h.has('X-GLD-Adult-Token'),false);
await window.fetch('https://login.liqkoargentina.workers.dev/events-new?ciudad_id=D');h=calls.at(-1).init.headers;assert.equal(h.get('Authorization'),'Bearer USER');assert.equal(h.get('X-GLD-Adult-Token'),'ADULT');
console.log('PASS +18: login personal, acceso a Mis datos, menor sin enlace para eludir edad y cabeceras/autorización existentes conservadas.');
