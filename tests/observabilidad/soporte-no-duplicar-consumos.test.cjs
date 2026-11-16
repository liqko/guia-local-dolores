'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const login=fs.readFileSync('plataforma/login.html','utf8');
const marker='async function enviarSoporteV73_(){';
const begin=login.indexOf(marker),end=login.indexOf('\nlet claimSearchSequence155=',begin);
assert(begin>=0&&end>begin,'No se encontró el envío efectivo de soporte en el código');
const src=login.slice(begin,end);
test('enviar solicitud registra y muestra su seguimiento, sin recargar notificaciones ni repetir soporte/mine',async()=>{
 const order=[],input={value:'Consulta de prueba',dataset:{}},
       msg={textContent:''},button={disabled:false};
 const elements={'soporte-msg':msg,'btnEnviarSoporte':button,'soporte-detalle':input,
  'soporte-revision-contexto':{hidden:false}};
 const ctx={document:{getElementById:id=>elements[id]},window:{GLD_NOTIFICATIONS102:{
  reset(){order.push('invalidar');},
  load(){order.push('peticion_innecesaria');throw Error('No debe recargarse');}
 }},sesion:{id:'A1'},
 registrarSolicitudSoporteV73_:async()=>{order.push('guardar');return {success:true};},
 mostrarSeccionSoporte_:()=>{order.push('seccion');},
 cargarMisSolicitudesV74_:async()=>{order.push('listar');return [];},
 alert:()=>{order.push('aviso');}};
 vm.createContext(ctx);
 vm.runInContext(src+'\nthis.send=enviarSoporteV73_;',ctx);
 await ctx.send();
 assert.deepEqual(order,['guardar','seccion','listar','invalidar','aviso']);
 assert.equal(button.disabled,false);
 assert.equal(input.value,'');
 assert.match(msg.textContent,/registrada/);
});
test('un guardado fallido no invalida ni recarga notificaciones',async()=>{
 const order=[],msg={textContent:''},button={disabled:false},input={value:'Error de prueba',dataset:{}};
 const ctx={document:{getElementById:id=>({
  'soporte-msg':msg,'btnEnviarSoporte':button,'soporte-detalle':input,
  'soporte-revision-contexto':{hidden:false}})[id]},
 window:{GLD_NOTIFICATIONS102:{reset(){order.push('invalidar');},load(){order.push('consulta');}}},
 registrarSolicitudSoporteV73_:async()=>{throw Error('Fallo esperado');},
 mostrarSeccionSoporte_:()=>{},cargarMisSolicitudesV74_:async()=>{},
 alert:()=>{order.push('aviso');}};
 vm.createContext(ctx);vm.runInContext(src+'\nthis.send=enviarSoporteV73_;',ctx);
 await ctx.send();
 assert.deepEqual(order,[]);
 assert.equal(button.disabled,false);
 assert.match(msg.textContent,/Fallo esperado/);
});
test('el módulo real consulta notificaciones únicamente al abrirlo luego de invalidar',async()=>{
 const source=fs.readFileSync('plataforma/notificaciones.js','utf8');
 const ids=new Map(),requests=[];
 const element=id=>{if(!ids.has(id))ids.set(id,{textContent:'',dataset:{},replaceChildren(){},append(){}});return ids.get(id);};
 const ctx={window:{},sesion:{id:'A1',nombre:'Negocio'},
 sesionSuscriptor:{suscriptor_id:'S1'},document:{
  getElementById:element,querySelectorAll:()=>[],addEventListener(){}},
 localStorage:{getItem:()=>null,setItem(){}},
 mostrarPanel:()=>{},soporteFetchV74_:async path=>{
  requests.push(path);return{success:true,results:[],revisiones:[]};
 }};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 ctx.window.GLD_NOTIFICATIONS102.reset();
 assert.equal(requests.length,0,'Invalidar no debe generar ninguna consulta');
 ctx.window.GLD_NOTIFICATIONS102.open();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,2,'Primera apertura hace las dos consultas necesarias');
 ctx.window.GLD_NOTIFICATIONS102.open();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,2,'Reapertura reutiliza resultados');
 ctx.window.GLD_NOTIFICATIONS102.reset();
 ctx.window.GLD_NOTIFICATIONS102.open();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,4,'Después de una nueva solicitud, vuelve a consultar al abrir');
});
