const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');const {webcrypto}=require('node:crypto');
const code=fs.readFileSync('plataforma/publicacion-pedidos.js','utf8');const values=new Map();
const storage={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
function load(store=storage){const context={URL,TextEncoder,crypto:webcrypto,sessionStorage:store,location:{href:'https://test.invalid/'}};context.window=context;vm.runInNewContext(code,context);return context.GLD_PUBLICATION_REQUEST143;}
(async()=>{
 let api=load(),calls=0,seen=[],done;const wait=new Promise(r=>done=r),body={action:'createpromo',advertiserId:'A',payload:{promo:'Texto'}};
 const send=async b=>{calls++;seen.push(b.operation_id);await wait;return {status:503,json:{code:'PUBLICATION_SYNC_PENDING'}}};
 const first=api.run('/promos',body,send),second=api.run('/promos',body,send);await new Promise(r=>setTimeout(r,20));done();await Promise.all([first,second]);assert.equal(calls,1);assert.equal(values.size,1);
 api=load();await api.run('/promos',body,async b=>{seen.push(b.operation_id);return{status:200,json:{success:true}}});assert.equal(seen[0],seen[1]);assert.equal(values.size,0);
 await api.run('/promos',body,async b=>{seen.push(b.operation_id);return{status:200,json:{success:true}}});assert.notEqual(seen[1],seen[2]);console.log('PASS repeated click sends one request; uncertain operation survives reload; next intended operation receives new ID');
 const unavailable=load({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},get length(){throw Error('blocked')}});const ids=[];
 await unavailable.run('/promos',body,async b=>{ids.push(b.operation_id);return {status:503,json:{}}});await unavailable.run('/promos',body,async b=>{ids.push(b.operation_id);return{status:200,json:{success:true}}});assert.equal(ids[0],ids[1]);console.log('PASS unavailable browser storage retains pending identity in memory');
 const request={action:'guardar',request_key:'00000000-0000-4000-8000-000000000001',advertiserId:'A'};await api.run('/publicidad',request,async b=>{assert.equal(b.operation_id,request.request_key);return{status:200,json:{success:true}}});
 await api.run('/promos',{action:'getPanelData'},async b=>{assert.equal(b.operation_id,undefined);return{status:200,json:{success:true}}});assert(api.eligible('/events-new',{action:'createvipevent'}));assert(!api.eligible('/events-new',{action:'getPanelData'}));console.log('PASS existing Publicidad draft ID respected; reads and other modules untouched');
 const {Script}=vm;for(const file of ['plataforma/login.html','plataforma/granhermano.html']){const html=fs.readFileSync(file,'utf8');for(const[,attrs,js]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(attrs)&&!/type=["'](?:application\/ld\+json|module)/.test(attrs))new Script(js,{filename:file});assert(html.includes('/plataforma/publicacion-pedidos.js?v=145'));}console.log('PASS advertiser and Gran Hermano scripts parse with publication helper');
})().catch(e=>{console.error(e);process.exitCode=1});
