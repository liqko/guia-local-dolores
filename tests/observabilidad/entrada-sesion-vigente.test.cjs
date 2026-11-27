const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const f='plataforma/entrada-recordada.js';
const encode=claims=>Buffer.from(JSON.stringify({typ:'GLD_SUBSCRIBER',sid:'A',...claims})).toString('base64url')+'.firma';
function browser(initial,fetch,profile){
 let token=initial;
 const store=new Map([['gld_ciudad_contexto','{"ciudad_id":"DOL"}']]);
 if(profile)store.set('gld_suscriptor_session_v2',JSON.stringify(profile));
 const window={};
 vm.runInNewContext(readFileSync(f,'utf8'),{
  window,atob,fetch,AbortController,setTimeout,clearTimeout,
  localStorage:{getItem:key=>key==='gld_suscriptor_token_v2'?token:store.get(key),setItem:(key,value)=>store.set(key,value)}
 });
 return {open:window.gldRecuperarEntradaV92,setToken:value=>{token=value;}};
}
test('una respuesta del token anterior no se aplica tras renovar el token de la misma cuenta',async()=>{
 let complete;
 const h=browser(encode({persistent:true,exp:null}),()=>new Promise(resolve=>{complete=resolve;}));
 const previous=h.open();
 h.setToken(encode({persistent:true,exp:null,version:2}));
 complete(Response.json({success:true,suscriptor:{suscriptor_id:'A',ciudad_predeterminada_id:'X'}}));
 assert.equal((await previous).recordada,false);
});
test('una cuenta rehabilitada recupera su ciudad solo después de confirmación del servidor',async()=>{
 const session=encode({persistent:true,exp:null});
 const inactive={suscriptor_id:'A',activo:false};
 const online=browser(session,async()=>Response.json({success:true,suscriptor:{suscriptor_id:'A',activo:true,ciudad_predeterminada_id:'X'}}),inactive);
 assert.equal((await online.open()).ciudad_id,'X');
 const unavailable=browser(session,async()=>new Response(null,{status:503}),inactive);
 assert.equal((await unavailable.open()).recordada,false);
});
test('sesión local vencida o mal formada mantiene selector sin consulta',async()=>{
 let calls=0;
 const h=browser(encode({exp:Date.now()-1}),async()=>{calls++;throw Error('sin red');});
 assert.equal((await h.open()).recordada,false);
 h.setToken('texto');
 assert.equal((await h.open()).recordada,false);
 assert.equal(calls,0);
});
test('la verificación pendiente se reutiliza y una respuesta tardía no restaura otra cuenta',async()=>{
 const calls=[];
 const h=browser(encode({persistent:true,exp:null}),()=>new Promise(resolve=>calls.push(resolve)));
 const first=h.open();
 assert.equal(h.open(),first);
 h.setToken(encode({sid:'B',persistent:true,exp:null}));
 const second=h.open();
 assert.equal(calls.length,2);
 calls[0](Response.json({success:true,suscriptor:{suscriptor_id:'A',ciudad_predeterminada_id:'X'}}));
 assert.equal((await first).recordada,false);
 calls[1](Response.json({success:true,suscriptor:{suscriptor_id:'B',ciudad_predeterminada_id:'Y'}}));
 assert.equal((await second).ciudad_id,'Y');
});

test('una denegación explícita o respuesta incoherente no reutiliza la ciudad local',async()=>{
 const session=encode({persistent:true,exp:null});
 for(const response of [
  new Response('denegada',{status:401}),
  Response.json({success:false}),
  Response.json({success:true,suscriptor:{suscriptor_id:'B'}})
 ]){
  const h=browser(session,async()=>response);
  assert.equal((await h.open()).recordada,false);
 }
 const offline=browser(session,async()=>{throw Error('sin conexión');});
 assert.equal((await offline.open()).ciudad_id,'DOL');
});
