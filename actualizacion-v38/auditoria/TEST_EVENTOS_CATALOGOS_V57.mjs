import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../../plataforma/login.html',import.meta.url),'utf8');
const fn=html.slice(html.indexOf('function eventFormCatalogs_('),html.indexOf('async function loadEventosPanelData(){'));
const ctx=vm.createContext({sesion:{id:'A'}});vm.runInContext(fn,ctx);
ctx.data={advertiser:{id:'A',nombre:'Comercio'},categorias:[{categoria_id:'C',nombre:'Cultura'},'Deportes',{nombre:'Oculta',activo:false}],lugares:[{id:'L',nombre:'Teatro',ciudad_id:'D'},{sede_id:'S',anunciante_id:'A',nombre_sede:'',ciudad_id:'D'}]};
ctx.territorio={ciudades:[{ciudad_id:'D',ciudad_visible:'Dolores'}]};
const prepared=vm.runInContext('eventFormCatalogs_(data,territorio)',ctx);
assert.deepEqual(Array.from(prepared.categorias),['Cultura','Deportes']);
assert.equal(prepared.ciudades[0].ciudad_visible,'Dolores');assert.equal(prepared.lugares[0].lugar_id,'L');assert.equal(prepared.lugares[1].tipo,'sede');assert.equal(prepared.lugares[1].nombre_visible,'Comercio');
assert.match(html,/id="evf-descripcion"[^>]*maxlength="200"/);
const free=html.slice(html.indexOf('async function loadEventosFreePanelData(){'),html.indexOf('function cancelEventEdit()'));
assert.match(free,/getFreeEventsPanelData/);assert.match(free,/fillFreeEventCatalogs_\(catalog\)/);
console.log('PASS: categorías por nombre, ciudades territoriales, lugares y sedes normalizados; Free límite200 y entrada común.');

