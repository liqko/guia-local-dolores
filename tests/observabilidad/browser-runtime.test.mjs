// JavaScript integration only; no real browser or provider quota is simulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../../plataforma/telemetria.js',import.meta.url),'utf8');
function runtime(parentPage='/plataforma/inicio'){
  const handlers={},winhandlers={},storage=new Map(),requests=[],batches=[];
  let observer;
  const location={origin:'https://anunciantes-guialocal.web.app',hostname:'anunciantes-guialocal.web.app',pathname:'/plataforma/inicio'};
  const native=async(input,options)=>{
    const req=input instanceof Request?input:new Request(String(input),options);
    if(req.url.includes('/telemetry/events')){batches.push(...JSON.parse(await req.text()).rows);return Response.json({success:true});}
    requests.push({url:req.url,method:req.method,headers:req.headers,body:await req.text()});return Response.json({success:true});
  };
  const context={console,crypto,URL,Request,Headers,Response,location,parent:{location:{pathname:parentPage}},
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),get length(){return storage.size;},key:i=>[...storage.keys()][i]},
    performance:{now:()=>10,setResourceTimingBufferSize(){},getEntriesByType:()=>[{transferSize:3247,encodedBodySize:3000,duration:200}]},
    PerformanceObserver:class{constructor(callback){observer=callback;}observe(){}},
    document:{addEventListener:(k,fn)=>handlers[k]=fn,visibilityState:'visible'},setTimeout:()=>1,clearTimeout(){},
    fetch:native,addEventListener:(k,fn)=>winhandlers[k]=fn};
  context.window=context;vm.runInNewContext(script,context);
  const event=(kind,id,tag='BUTTON')=>handlers[kind]({target:{closest:()=>({id,tagName:tag,getAttribute:()=>null,closest:()=>null})}});
  return {context,event,requests,batches,resource:entries=>observer({getEntries:()=>entries}),error:e=>winhandlers.error(e)};
}
test('capture preserves API URL, POST body and original caller headers',async()=>{
  const r=runtime();r.event('click','entrar');
  await r.context.fetch('https://login.liqkoargentina.workers.dev/commerce',{method:'POST',headers:{Authorization:'Bearer retained'},body:'{"action":"save_ficha"}'});
  await r.context.gldTelemetry.flush();
  assert.equal(r.requests.length,1);assert.equal(r.requests[0].url,'https://login.liqkoargentina.workers.dev/commerce');assert.equal(r.requests[0].method,'POST');assert.equal(r.requests[0].body,'{"action":"save_ficha"}');assert.equal(r.requests[0].headers.get('Authorization'),'Bearer retained');
  assert.ok(r.requests[0].headers.get('X-GLD-Trace').endsWith(';usuario'));
  assert.ok(!JSON.stringify(r.batches).includes('retained'));
});
test('click with no backend is still recorded, without sending entered values',async()=>{
  const r=runtime();r.event('input','buscarCiudad','INPUT');r.event('click','entrar');await r.context.gldTelemetry.flush();
  assert.equal(r.requests.length,0);assert.ok(r.batches.some(x=>x.action==='buscar_ciudad'));assert.ok(r.batches.some(x=>x.action==='ingresar_ciudad'));
  assert.ok(r.batches.every(x=>x.value===undefined));
});
test('cross-origin zero transfer is unknown while measurable local resources retain bytes',async()=>{
  const r=runtime();r.resource([{name:'https://res.cloudinary.com/public.png',startTime:0,transferSize:0,encodedBodySize:0,duration:100,initiatorType:'img'},{name:r.context.location.origin+'/script.js',startTime:0,transferSize:2048,encodedBodySize:1900,duration:10,initiatorType:'script'}]);await r.context.gldTelemetry.flush();
  const res=r.batches.filter(x=>x.kind==='resource');assert.equal(res.find(x=>x.host==='res.cloudinary.com').transfer_bytes,null);assert.ok(res.some(x=>x.transfer_bytes===2048));
});
test('errors are recorded without raw messages or user content',async()=>{
  const r=runtime();r.error({message:'private text',lineno:12});await r.context.gldTelemetry.flush();assert.ok(r.batches.some(x=>x.kind==='runtime_error'&&x.line===12));assert.ok(!JSON.stringify(r.batches).includes('private text'));
});
test('frames inherit administrator context without creating another interface',async()=>{
  const r=runtime('/plataforma/granhermano.html');await r.context.fetch('https://login.liqkoargentina.workers.dev/territory/public');assert.ok(r.requests[0].headers.get('X-GLD-Trace').endsWith(';administrador'));
});
test('the telemetry transport does not recursively measure itself',async()=>{
  const r=runtime();await r.context.gldTelemetry.flush();assert.equal(r.requests.length,0);assert.ok(r.batches.length>0);assert.ok(!r.batches.some(x=>x.path==='/telemetry/events'));
});
