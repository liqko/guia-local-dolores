import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// El editor territorial vive en Gran Hermano (administracion.html).
const html=readFileSync('plataforma/administracion.html','utf8');
const a=html.indexOf('const GH_CITY_EDIT_PENDING='),b=html.indexOf('function ghRenderTodo()',a);
assert(a>=0&&b>a,'Editor territorial encontrado');
const block=html.slice(a,b);
function setup({confirms=[],prompts=[],steps=[]}={}){
 const calls=[],alerts=[],controls={
  ciuSelect:{value:'CITY-TEST',innerHTML:''},
  ciuQ:{value:''},
  ciudadDetalle:{innerHTML:'',textContent:''},
  ghCiudadNombre:{value:'General Belgrano'},
  ghCiudadEstadoEdicion:{textContent:''}
 };
 const original={ciudad_id:'CITY-TEST',ciudad_visible:'General Belgranno',nombre:'General Belgranno',ciudad:'General Belgranno',pais_id:'AR',provincia_id:'BA',activa:true};
 const ctx={
  document:{getElementById:id=>controls[id]||null},
  GH_CITIES:[original],
  GH_PROVINCES:[{provincia_id:'BA',pais_id:'AR',nombre:'Buenos Aires'}],
  GH_COUNTRIES:[{pais_id:'AR',nombre:'Argentina'}],
  GH_ADMIN_ACCESS:{rol:'SUPERADMIN_PRINCIPAL'},
  TERRITORY_API_ORIGIN:'https://worker.test',
  TOKEN:'test-token',
  ghNorm:s=>String(s).toLowerCase(),
  esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;'),
  informarAltura:()=>{},ghInvalidarCatalogoPublicoCiudades:()=>{},
  alert:m=>alerts.push(m),
  confirm:()=>confirms.length?confirms.shift():true,
  prompt:()=>prompts.shift()??null,
  fetch:async(url,opts)=>{
   calls.push({url,opts});
   if(opts.method==='PATCH')return {ok:true,json:async()=>({success:true,ciudad:JSON.parse(opts.body).item})};
   const next=steps.shift();return {ok:next.status<400,json:async()=>next.body};
  },
  Set,Promise,Object,JSON,String,Error
 };
 vm.createContext(ctx);vm.runInContext(block,ctx);
 return {ctx,calls,alerts,controls};
}

// Edición, sin cambios y estado: validaciones funcionales y de consumo.
{
 const {ctx,calls,alerts}=setup();
 ctx.ghRenderCiudades();
 await ctx.ghGuardarCambioCiudad('nombre');
 assert.equal(calls.length,1,'Editar requiere un solo PATCH');
 assert.equal(calls[0].opts.method,'PATCH');
 assert.equal(ctx.GH_CITIES[0].ciudad_visible,'General Belgrano');
 assert.equal(JSON.parse(calls[0].opts.body).item.provincia_id,'BA');
 assert.equal(JSON.parse(calls[0].opts.body).item.pais_id,'AR');
 await ctx.ghGuardarCambioCiudad('nombre');
 assert.equal(calls.length,1,'Un guardado sin cambios no consume cuota');
 await ctx.ghGuardarCambioCiudad('estado');
 assert.equal(calls.length,2,'Desactivar requiere un solo PATCH');
 assert.equal(ctx.GH_CITIES[0].activa,false);
 await ctx.ghGuardarCambioCiudad('estado');
 assert.equal(calls.length,3,'Reactivar requiere un solo PATCH');
 assert.equal(ctx.GH_CITIES[0].activa,true);
 assert.equal(alerts.length,0);
 assert.ok(!calls.some(c=>(c.opts.method||'GET')==='GET'),'ningún GET adicional');
}
// Eliminación: suspensión, inventario y confirmación escrita; avanza por lotes hasta terminar.
{
 const plan={status:200,body:{success:true,plan_id:'PLAN-1',inventario:{'eventos.ciudad_id':2},conservados:{'solicitudes_soporte.ciudad_id':1}}};
 const {ctx,calls,alerts}=setup({prompts:['General Belgranno'],steps:[plan,{status:200,body:{success:true,pendiente:true,procesados:15}},{status:200,body:{success:true,eliminada:true}}]});
 await ctx.ghEliminarCiudad146();
 assert.deepEqual(calls.map(c=>c.opts.method+' '+c.url.replace('https://worker.test',''))
  ,['PATCH /superadmin/cities/CITY-TEST','POST /superadmin/cities/CITY-TEST/eliminacion','POST /superadmin/cities/CITY-TEST/eliminacion','POST /superadmin/cities/CITY-TEST/eliminacion']);
 assert.equal(JSON.parse(calls[1].opts.body).modo,'simular');
 assert.deepEqual(JSON.parse(calls[2].opts.body),{modo:'ejecutar',plan_id:'PLAN-1',confirmacion:'General Belgranno'});
 assert.equal(ctx.GH_CITIES.length,0);assert.match(alerts.at(-1),/Ciudad eliminada/);
}
// Nombre distinto: no se ejecuta; la ciudad queda suspendida y sin borrar.
{
 const {ctx,calls,alerts}=setup({prompts:['otra'],steps:[{status:200,body:{success:true,plan_id:'PLAN-1',inventario:{}}}]});
 await ctx.ghEliminarCiudad146();
 assert.equal(calls.length,2,'sólo suspensión e inventario');assert.match(alerts[0],/No se eliminó nada/);assert.equal(ctx.GH_CITIES.length,1);
}
// Cancelar en el inventario: tampoco se ejecuta.
{
 const {ctx,calls}=setup({confirms:[true,false],steps:[{status:200,body:{success:true,plan_id:'PLAN-1',inventario:{}}}]});
 await ctx.ghEliminarCiudad146();assert.equal(calls.length,2);
}
// Reintento tras una interrupción: continúa con el plan en curso.
{
 const {ctx,calls}=setup({prompts:['General Belgranno'],steps:[{status:409,body:{success:false,code:'CITY_DELETION_IN_PROGRESS',plan_id:'PLAN-9'}},{status:200,body:{success:true,eliminada:true}}]});
 ctx.GH_CITIES[0].activa=false;await ctx.ghEliminarCiudad146();
 assert.equal(calls.length,2,'sin nueva suspensión');assert.equal(JSON.parse(calls[1].opts.body).plan_id,'PLAN-9');assert.equal(ctx.GH_CITIES.length,0);
}
console.log('PASS editar ciudad, no-op sin consumo, desactivar/reactivar; eliminación con suspensión, inventario, confirmación escrita, lotes y reintento sobre administracion.html');
