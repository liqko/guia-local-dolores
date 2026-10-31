import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html=readFileSync('plataforma/granhermano.html','utf8');
const a=html.indexOf('const GH_CITY_EDIT_PENDING='),b=html.indexOf('function ghRenderTodo()',a);
assert(a>=0&&b>a,'Editor territorial encontrado');
const block=html.slice(a,b);
const calls=[],alerts=[],controls={
 ciuSelect:{value:'CITY-TEST',innerHTML:''},
 ciuQ:{value:''},
 ciudadDetalle:{innerHTML:'',textContent:''},
 ghCiudadNombre:{value:'General Belgrano'}
};
const original={ciudad_id:'CITY-TEST',ciudad_visible:'General Belgranno',nombre:'General Belgranno',ciudad:'General Belgranno',pais_id:'AR',provincia_id:'BA',activa:true};
const ctx={
 document:{getElementById:id=>controls[id]||null},
 GH_CITIES:[original],
 GH_PROVINCES:[{provincia_id:'BA',pais_id:'AR',nombre:'Buenos Aires'}],
 GH_COUNTRIES:[{pais_id:'AR',nombre:'Argentina'}],
 TERRITORY_API_ORIGIN:'https://worker.test',
 TOKEN:'test-token',
 ghNorm:s=>String(s).toLowerCase(),
 esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;'),
 alert:m=>alerts.push(m),
 confirm:()=>true,
 fetch:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({success:true,ciudad:JSON.parse(opts.body).item})};},
 Set,Promise
};
vm.createContext(ctx);
vm.runInContext(block,ctx);
ctx.ghRenderCiudades();
await ctx.ghGuardarCambioCiudad('nombre');
assert.equal(calls.length,1,'Editar requiere un solo PATCH');
assert.equal(calls[0].opts.method,'PATCH');
assert.equal(ctx.GH_CITIES[0].ciudad_visible,'General Belgrano');
assert.equal(JSON.parse(calls[0].opts.body).item.provincia_id,'BA');
assert.equal(JSON.parse(calls[0].opts.body).item.pais_id,'AR');
controls.ghCiudadNombre.value='General Belgrano';
await ctx.ghGuardarCambioCiudad('nombre');
assert.equal(calls.length,1,'Un guardado sin cambios no consume cuota');
await ctx.ghGuardarCambioCiudad('estado');
assert.equal(calls.length,2,'Desactivar requiere un solo PATCH');
assert.equal(ctx.GH_CITIES[0].activa,false);
await ctx.ghGuardarCambioCiudad('estado');
assert.equal(calls.length,3,'Reactivar requiere un solo PATCH');
assert.equal(ctx.GH_CITIES[0].activa,true);
assert.equal(alerts.length,0);
console.log('PASS editar ciudad, no-op sin consumo, desactivar/reactivar; tres solicitudes y ningún GET adicional');
