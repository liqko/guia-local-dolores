'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const login=fs.readFileSync('plataforma/login.html','utf8');
const external=fs.readFileSync('plataforma/publicidad-panel147.js','utf8');
const cut=(from,to)=>{const x=login.indexOf(from),y=login.indexOf(to,x);assert(x>=0&&y>x,from);return login.slice(x,y)};
test('reclamar: formulario propio transmite un solo POST con la ciudad validada',async()=>{
 const code=cut('async function enviarReclamoAnunciante155(){','\nfunction abrirSolicitudAnunciante_(');
 const fields={'alta-reclamo-ciudad155':'DOL','alta-reclamo-id155':'A1','alta-reclamo-motivo155':'Tengo documentación que acredita la titularidad.'};
 const btn={disabled:false},calls=[],panels=[];
 const ctx={sesionSuscriptor:{suscriptor_id:'S1'},gldSubscriberToken:'token',
 claimResults155:[{id:'A1',nombre:'Prueba',ciudad_ids:['DOL']}],
 whatsappContextoCuenta_:()=>({mail:'',whatsapp:''}),
 document:{getElementById:id=>id==='btnEnviarReclamoAnunciante155'?btn:{value:fields[id]||''}},
 apiSuscriptores_:async p=>{calls.push(p);return{success:true,message:'Enviado'};},
 mostrarPanel:x=>panels.push(x),alert:()=>{}};
 vm.createContext(ctx);vm.runInContext(code+'\nthis.run=enviarReclamoAnunciante155',ctx);
 await ctx.run();assert.equal(calls.length,1);assert.equal(calls[0].action,'solicitar_anunciante');
 assert.equal(calls[0].modo,'RECLAMAR');assert.equal(calls[0].anunciante_id,'A1');
 assert.equal(calls[0].ciudad,'DOL');
 assert.deepEqual(panels,['seleccionar-anunciante']);assert.equal(btn.disabled,false);
 assert.match(login,/async function enviarSolicitudAnunciante_\(\)\{[\s\S]*?const modo='CREAR'/);
});
test('solicitud compartida: POST /suscriptores una sola vez',async()=>{
 const code=cut('async function apiSuscriptores_(payload){','/* ====================== INIT ====================== */');
 const requests=[],ctx={SUSCRIPTORES_URL:'https://test.example/suscriptores',gldAuthHeaders_:h=>h,fetch:async(url,options)=>{
 requests.push({url,options});return{ok:true,status:200,text:async()=>JSON.stringify({success:true})};}};
 vm.createContext(ctx);vm.runInContext(code+'\nthis.run=apiSuscriptores_',ctx);
 const result=await ctx.run({action:'solicitar_anunciante'});
 assert.equal(result.success,true);assert.equal(requests.length,1);
 assert.equal(requests[0].url,'https://test.example/suscriptores');assert.equal(requests[0].options.method,'POST');
});
test('tags: si el perfil está cargado no hace ninguna recarga',async()=>{
 let reads=0,updates=0;const btn={disabled:false},notice={textContent:''},result={value:''};
 const ctx={window:{gldLoadCommerceProfileForTags147:async()=>{reads++;return true;}},
 document:{getElementById:id=>({'pub-tags-perfil':btn,'pub-tags-perfil-notice':notice,'pub-tags':result})[id],
 querySelector:()=>({value:'azul, rojo'})},pubTags107:v=>v.split(',').map(x=>x.trim()),pubUiTags107:()=>updates++};
 vm.createContext(ctx);vm.runInContext(external,ctx);await ctx.pubTagsPerfil147();
 assert.equal(reads,0);assert.equal(updates,1);assert.equal(result.value,'azul, rojo');assert.equal(btn.disabled,false);
});
test('tags: si falta el perfil lo carga una vez',async()=>{
 let reads=0,ready=false;const btn={disabled:false},notice={textContent:''},result={value:''};
 const ctx={window:{gldLoadCommerceProfileForTags147:async()=>{reads++;ready=true;return true;}},
 document:{getElementById:id=>({'pub-tags-perfil':btn,'pub-tags-perfil-notice':notice,'pub-tags':result})[id],
 querySelector:()=>ready?{value:'verde, local'}:null},pubTags107:v=>v.split(',').map(x=>x.trim()),pubUiTags107:()=>{}};
 vm.createContext(ctx);vm.runInContext(external,ctx);await ctx.pubTagsPerfil147();
 assert.equal(reads,1);assert.equal(result.value,'verde, local');assert.equal(btn.disabled,false);
});
