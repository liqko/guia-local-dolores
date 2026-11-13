import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
// Execute the actual functions of the HTML currently published by this repo.
// No network, credentials, or production data are used by this client test.
const html=await readFile(new URL('../../plataforma/administracion.html',import.meta.url),'utf8');
const block=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,start);return html.slice(a,b);};
const source=[block('function ghTerritoryApply195(j){','\nfunction ghDetalleEvento'),block('const GH_CITY_EDIT_PENDING=','async function ghEliminarCiudad146'),block('const GH_VIEW_GRUPOS=','function ghTerrId_'),block('function ghSelectConfig(name){',"document.getElementById('ghCotizarNombre')"),block('function ghTerrId_','const GH_TERRITORY_PENDING=')].join('\n');
function fixture(territory={paises:[{pais_id:'AR',nombre:'Argentina'}],provincias:[{provincia_id:'BA',pais_id:'AR',nombre:'Buenos Aires'}],ciudades:[{ciudad_id:'DOL',nombre:'Dolores',ciudad_visible:'Dolores',pais_id:'AR',provincia_id:'BA',activa:true},{ciudad_id:'CHA',nombre:'Chascomús',pais_id:'AR',provincia_id:'BA',activa:false}]}){
 const nodes=new Map(),requests=[],alerts=[];const get=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',innerHTML:'',textContent:'',style:{},dataset:{},hidden:false,classList:{toggle(){}},setAttribute(){}});return nodes.get(id);};
 const context={GH_DAILY_ENTRY195:{territory},GH_CITIES:[],GH_COUNTRIES:[],GH_PROVINCES:[],GH_ADMIN_ACCESS:{rol:'SUPERADMIN_PRINCIPAL'},TOKEN:'test-only',TERRITORY_API_ORIGIN:'https://fixture.invalid',GH_CATALOGOS:[],GH_CATALOG_CACHE:{},CSS:{escape:x=>x},
  ghNavRead:()=>({cfg:'territorio'}),ghNavWrite(){},informarAltura(){},ghNorm:v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;'),alert:m=>alerts.push(m),confirm:()=>false,window:{scrollTo(){}},
  document:{getElementById:get,querySelector:s=>s==='#ghTabs [data-gh-submenu="administracion"]'?{querySelector:()=>null,querySelectorAll:()=>[{dataset:{view:'configuracion'},hidden:false,style:{}}]}:s.startsWith('#cfgTabs [data-cfg=')?{dataset:{cfg:'territorio'}}:s==='#cfgTabs .active'?{dataset:{cfg:'territorio'}}:null,querySelectorAll:()=>[]},
  fetch:async(...args)=>{requests.push(args);throw Error('Unexpected network request');}
 };
 const ctx=vm.createContext(context);vm.runInContext(source,ctx);return {ctx,nodes,requests,alerts,get,async settle(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}};
}
test('abrir Administración y Configuración/Territorio usa la edición del ingreso sin nuevas llamadas',async()=>{
 const h=fixture();h.ctx.ghElegirGrupo('administracion');await h.settle();h.ctx.ghGoView('configuracion');await h.settle();
 assert.equal(h.requests.length,0);assert.equal(h.ctx.GH_CITIES.length,2);assert.match(h.get('ciuSelect').innerHTML,/Dolores/);assert.match(h.get('ciuSelect').innerHTML,/Chascomús/);
});
test('volver veinte veces y pulsar Actualizar reutiliza los mismos datos sin fetch',async()=>{
 const h=fixture();
 for(let i=0;i<20;i++){h.ctx.ghSelectConfig('territorio');await h.settle();}
 const line=html.match(/document\.getElementById\('btnCiudadesRefresh'\)\.onclick=(async function\(\)\{[^\n]+\});/)?.[1];assert(line,'Use the actual button handler');
 await vm.runInContext('('+line+')()',h.ctx);assert.equal(h.requests.length,0);assert.equal(h.ctx.GH_CITIES.length,2);
});
test('buscar con acentos y seleccionar ciudad sólo opera sobre la lista cargada',async()=>{
 const h=fixture();await h.ctx.ghCargarCiudades();h.get('ciuQ').value='chascomus';h.ctx.ghRenderCiudades();assert.match(h.get('ciuSelect').innerHTML,/Chascomús/);assert.doesNotMatch(h.get('ciuSelect').innerHTML,/Dolores/);
 h.get('ciuQ').value='';h.get('ciuSelect').value='DOL';h.ctx.ghRenderCiudades();assert.match(h.get('ciudadDetalle').innerHTML,/Argentina/);assert.match(h.get('ciudadDetalle').innerHTML,/Buenos Aires/);assert.match(h.get('ciudadDetalle').innerHTML,/Dolores/);assert.equal(h.requests.length,0);
});
test('edición diaria válida vacía no se interpreta como falta de datos que exige recargar',async()=>{
 const h=fixture({paises:[],provincias:[],ciudades:[]});await h.ctx.ghCargarCiudades();h.ctx.ghGoView('configuracion');await h.settle();assert.equal(h.requests.length,0);assert.equal(h.ctx.GH_CITIES.length,0);
});
test('abrir formularios de país, provincia y ciudad no crea registros; cancelar tampoco',async()=>{
 const h=fixture();await h.ctx.ghCargarCiudades();for(const kind of ['pais','provincia','ciudad']){
  h.ctx.ghNuevoTerritorio(kind);assert.match(h.get('territorioAlta').innerHTML,/Cancelar/);const cancel=h.get('territorioAlta').innerHTML.match(/onclick="(document\.getElementById\('territorioAlta'\)[^"]+)"/)?.[1];assert(cancel);vm.runInContext(cancel,h.ctx);assert.equal(h.get('territorioAlta').innerHTML,'');
 }assert.equal(h.requests.length,0);
});
test('guardar nombre sin cambios y cancelar una desactivación no envía escrituras',async()=>{
 const h=fixture();await h.ctx.ghCargarCiudades();h.get('ciuSelect').value='DOL';h.get('ghCiudadNombre').value='Dolores';await h.ctx.ghGuardarCambioCiudad('nombre');await h.ctx.ghGuardarCambioCiudad('estado');assert.equal(h.requests.length,0);assert.equal(h.ctx.GH_CITIES[0].activa,true);
});
