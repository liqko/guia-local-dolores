import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const html=readFileSync(resolve(root,'plataforma/login.html'),'utf8');
const worker=readFileSync(resolve(root,'worker/worker205.txt'),'utf8');
test('los seis formularios del panel conservan rutas de carga',()=>{
 for(const [name,path,action] of [
  ['Información','/commerce','action=anunciante'],
  ['Eventos','/events-new',"action:'getPanelData'"],
  ['Promociones','/promos',"action:'getPanelData'"],
  ['Actividades','/actividades','action=getpaneldata'],
  ['Publicidad','/publicidad','action=getpaneldata'],
  ['Farmacias','/farmacias',"action:'getPanelData'"],
 ]){
  assert.ok(html.includes(path),'HTML sin ruta '+name);
  assert.ok(html.includes(action),'HTML sin acción de carga '+name);
  assert.ok(worker.includes('"/'+path.slice(1)+'"'),'Worker sin ruta '+name);
 }
});
test('las vistas principales siguen presentes',()=>{
 for(const tab of ['modificar-datos','eventos','eventos-free','actividades','promos','publicidad','turnos-farma','efemerides']){
  assert.ok(html.includes('id="tab-'+tab+'"'),'Falta pestaña '+tab);
 }
});
test('permisos devuelve configuracion_funcionalidades al HTML',()=>{
 const begin=worker.indexOf('async function routePanelV10(ctx)');
 const end=worker.indexOf('// reconstruccion/worker/modules/promos-panel-v3.js',begin);
 assert.ok(begin>=0&&end>begin);
 const route=worker.slice(begin,end);
 assert.match(route,/action === "permisos_panel"/);
 assert.match(route,/configuracion_funcionalidades:packet\?\.configuracion_funcionalidades/);
 assert.match(html,/parametrosFuncionales170=j\.configuracion_funcionalidades/);
});
test('el paquete maestro conserva datos y parámetros sin listas fijas de campos',()=>{
 assert.match(worker,/async function commerceMaster205/);
 assert.match(worker,/const response=await commercePanelDataV3/);
 assert.match(worker,/response\.advertiser\.configuracion_funcionalidades=gldConfiguracionPanel205/);
 assert.match(worker,/return packet\.response/);
 for(const fn of ['eventsPanelDataV2','actividadesPanelData','promosPanelDataV2','publicidadPanelDataV2']){
  const ix=worker.indexOf('async function '+fn);
  assert.ok(ix>=0&&worker.slice(ix,ix+1000).includes('commerceMaster205'),fn+' no comparte el paquete');
 }
});
test('el paquete no se reconstruye si la copia existe',()=>{
 const begin=worker.indexOf('async function commerceMaster205(');
 const end=worker.indexOf('async function commerceMasterInvalidate205(',begin);
 assert.ok(begin>=0&&end>begin);
 const source=worker.slice(begin,end);
 assert.match(source,/if\(packet\?\.v===205&&packet\?\.response\?\.success===true\)return packet\.response/);
});

test('abrir un catálogo no hace escrituras KV aunque falte el parámetro general',async()=>{
 const begin=worker.indexOf('async function getCommerceCatalogs(cache)');
 const end=worker.indexOf('async function getEventosCatalogs(cache)',begin);
 assert.ok(begin>=0&&end>begin);
 const getCommerceCatalogs=new Function('KEYS',worker.slice(begin,end)+'return getCommerceCatalogs;')({commerce:'catalogs:commerce:v1'});
 const operations=[];
 const cache={
  get:async key=>{
   operations.push(['get',key]);
   if(key==='catalogs:commerce:v1')return {niveles_anunciante:[]};
   return {niveles_anunciante:[{nivel_id:'CONFIG_GENERAL_ANUNCIANTES',descripcion:500}]};
  },
  put:async key=>operations.push(['put',key])
 };
 const response=await getCommerceCatalogs(cache);
 assert.ok(response.niveles_anunciante.some(row=>row.nivel_id==='CONFIG_GENERAL_ANUNCIANTES'));
 assert.ok(!operations.some(([op])=>op==='put'),'Leer una configuración no debe escribir KV');
});
