import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../plataforma/sesion-persistente.js',import.meta.url),'utf8');
function fixture(replies,{pause=false,token=null}={}){
 const calls=[],delays=[],timers=new Map();let next=0;
 const window={fetch:async(input,options)=>{calls.push({input,options});const item=await replies[Math.min(calls.length-1,replies.length-1)];return Response.json(item.body||{success:true},{status:item.status||200,headers:item.headers});},addEventListener(){},dispatchEvent(){}};
 const context={window,location:{href:'https://test.invalid/'},localStorage:{getItem:key=>key==='gld_suscriptor_token_v2'?token:null},URL,Headers,Request,Response,DOMException,CustomEvent:class{},atob,clearTimeout:id=>timers.delete(id),setTimeout(fn,delay){delays.push(delay);const id=++next;if(pause)timers.set(id,fn);else queueMicrotask(fn);return id;}};
 vm.runInNewContext(source,context);
 return{window,calls,delays,timers,setToken:value=>{token=value;},getToken:()=>token};
}
const pending={status:503,body:{code:'COMMERCE_COPY_PREPARING'}};
const token=(sid,signature='firma')=>Buffer.from(JSON.stringify({typ:'GLD_SUBSCRIBER',sid})).toString('base64url')+'.'+signature;
test('un 200 tardío no entrega la ficha ni instala el token anterior',async()=>{
 for(const replacement of [null,token('B'),token('A','renovada')]){
  const initial=token('A');
  let deliver;
  const h=fixture([new Promise(resolve=>{deliver=resolve;})],{token:initial});
  const request=h.window.fetch('https://login.liqkoargentina.workers.dev/commerce?action=anunciante',{headers:{Authorization:'Bearer '+initial}});
  h.setToken(replacement);
  deliver({body:{advertiser:{id:'A'}},headers:{'X-GLD-Session-Token':token('A','tardia'),'X-GLD-Session-Kind':'subscriber'}});
  await assert.rejects(request,{name:'AbortError'});
  assert.equal(h.getToken(),replacement);
  assert.equal(h.calls.length,1);
 }
});

test('la ficha no escribe en el panel si la cuenta cambia mientras se carga el territorio',async()=>{
 const html=readFileSync(new URL('../../plataforma/login.html',import.meta.url),'utf8');
 const start=html.indexOf('async function loadCommerceUI()');
 const end=html.indexOf('// Perfil publicitario:',start);
 assert.ok(start>=0&&end>start);
 let finishTerritory;
 const writes=[];
 const box={innerHTML:''};
 const context={sesion:{id:'A'},document:{getElementById:()=>box},WORKER_ORIGIN:'https://worker.invalid',gldAuthHeaders_:()=>({}),
  fetch:async()=>Response.json({advertiser:{id:'A',redes_web_comunes_disponible:true}}),
  SUSCRIPTOR_TOKEN_KEY:'token',gldPanelStorage:{getItem:()=>token('A'),setItem:(...args)=>writes.push(args)},
  gldTerritoryPublic_:()=>new Promise(resolve=>{finishTerritory=resolve;}),commerceSharedNetworksAvailable:false};
 const load=vm.runInNewContext(html.slice(start,end)+'\nloadCommerceUI',context);
 const request=load();
 for(let i=0;i<10&&!finishTerritory;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof finishTerritory,'function');
 context.sesion={id:'B'};
 box.innerHTML='Ficha B';
 finishTerritory({ciudades:[]});
 assert.equal(await request,false);
 assert.equal(box.innerHTML,'Ficha B');
 assert.deepEqual(writes,[]);
 assert.equal(context.commerceSharedNetworksAvailable,false);
});
test('cerrar sesión o cambiar de cuenta durante la espera cancela el próximo GET',async()=>{
 for(const changed of [null,token('B')]){
  const initial=token('A');
  const h=fixture([pending],{pause:true,token:initial});
  const result=h.window.fetch('https://login.liqkoargentina.workers.dev/commerce?action=anunciante',{headers:{Authorization:'Bearer '+initial}});
  for(let i=0;i<10&&!h.timers.size;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.timers.size,1);
  h.setToken(changed);
  h.timers.values().next().value();
  await assert.rejects(result,{name:'AbortError'});
  assert.equal(h.calls.length,1);
 }
});
test('una lectura espera la preparación y recibe la ficha sin repetir escrituras',async()=>{
 const h=fixture([pending,pending,{body:{success:true,advertiser:{id:'A'}}}]);
 const response=await h.window.fetch('https://login.liqkoargentina.workers.dev/commerce?action=anunciante');
 assert.equal(response.status,200);assert.equal((await response.json()).advertiser.id,'A');assert.equal(h.calls.length,3);assert.deepEqual(h.delays,[1000,2000]);
});
test('las escrituras y los errores ajenos a preparación no se reintentan',async()=>{
 for(const [options,reply]of [[{method:'POST',body:'{}'},pending],[{}, {status:503,body:{code:'OTHER_ERROR'}}]]){
  const h=fixture([reply]);assert.equal((await h.window.fetch('https://login.liqkoargentina.workers.dev/commerce',options)).status,503);assert.equal(h.calls.length,1);assert.equal(h.delays.length,0);
 }
});
test('la espera termina al cancelar la navegación',async()=>{
 const h=fixture([pending],{pause:true}),controller=new AbortController();
 const promise=h.window.fetch('https://login.liqkoargentina.workers.dev/commerce',{signal:controller.signal});
 for(let i=0;i<10&&!h.timers.size;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.timers.size,1);controller.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(h.timers.size,0);assert.equal(h.calls.length,1);
});
test('la espera está acotada y una lectura normal no agrega solicitudes',async()=>{
 const h=fixture([pending]);assert.equal((await h.window.fetch('https://login.liqkoargentina.workers.dev/commerce')).status,503);assert.equal(h.calls.length,6);assert.equal(h.delays.length,5);
 const normal=fixture([{}]);assert.equal((await normal.window.fetch('https://login.liqkoargentina.workers.dev/commerce')).status,200);assert.equal(normal.calls.length,1);assert.equal(normal.delays.length,0);
});
