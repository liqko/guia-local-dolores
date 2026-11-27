import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../plataforma/sesion-persistente.js',import.meta.url),'utf8');
function fixture(replies,{pause=false,token=null}={}){
 const calls=[],delays=[],timers=new Map();let next=0;
 const window={fetch:async(input,options)=>{calls.push({input,options});const item=replies[Math.min(calls.length-1,replies.length-1)];return Response.json(item.body||{success:true},{status:item.status||200});},addEventListener(){},dispatchEvent(){}};
 const context={window,location:{href:'https://test.invalid/'},localStorage:{getItem:key=>key==='gld_suscriptor_token_v2'?token:null},URL,Headers,Request,Response,DOMException,CustomEvent:class{},atob,clearTimeout:id=>timers.delete(id),setTimeout(fn,delay){delays.push(delay);const id=++next;if(pause)timers.set(id,fn);else queueMicrotask(fn);return id;}};
 vm.runInNewContext(source,context);
 return{window,calls,delays,timers,setToken:value=>{token=value;}};
}
const pending={status:503,body:{code:'COMMERCE_COPY_PREPARING'}};
test('cerrar sesión o cambiar de cuenta durante la espera cancela el próximo GET',async()=>{
 const token=sid=>Buffer.from(JSON.stringify({typ:'GLD_SUBSCRIBER',sid})).toString('base64url')+'.firma';
 for(const changed of [null,token('B')]){
  const initial=token('A');
  const h=fixture([pending],{pause:true,token:initial});
  const result=h.window.fetch('https://login.liqkoargentina.workers.dev/commerce?action=anunciante',{headers:{Authorization:'Bearer '+initial}});
  for(let i=0;i<10&&!h.timers.size;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.timers.size,1);
  h.setToken(changed);
  h.timers.values().next().value();
  assert.equal((await result).status,503);
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
