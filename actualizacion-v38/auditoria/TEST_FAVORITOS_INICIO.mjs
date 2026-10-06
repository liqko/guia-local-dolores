import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../plataforma/suscriptores.html',import.meta.url),'utf8');
const render=html.slice(html.indexOf('function renderSession('),html.indexOf('async function login()'));
const start=html.match(/renderSession\(false\);\s*loadCities\(\)\.then\(\(\)=>\{[\s\S]*?\}\);/)[0];
function setup(){
 let resolveCities;let favoriteLoads=0;
 const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}},textContent:''});return nodes.get(id)};
 const ctx={sesionSuscriptor:{suscriptor_id:'test',nombre:'Test'},el,fillCities(){},renderMiGuia(){favoriteLoads++},actualizarLinksAyuda_(){},cargarComerciosAutorizados_(){},loadCities:()=>new Promise(resolve=>resolveCities=resolve)};
 vm.createContext(ctx);vm.runInContext(render+start,ctx);
 return {ctx,resolve:()=>resolveCities(),count:()=>favoriteLoads};
}
let x=setup();assert.equal(x.count(),0);x.resolve();await Promise.resolve();assert.equal(x.count(),1,'Una carga tras ciudades');
x=setup();x.ctx.sesionSuscriptor=null;x.resolve();await Promise.resolve();assert.equal(x.count(),0,'Salir durante arranque evita cargar favoritos');
x=setup();x.resolve();await Promise.resolve();vm.runInContext('renderSession()',x.ctx);assert.equal(x.count(),2,'Actualización explícita mantiene carga');
const saveCity=html.slice(html.indexOf('async function saveCity()'),html.indexOf('function showDeleteAccountBox()'));
assert.doesNotMatch(saveCity,/renderMiGuia\(/,'saveSession ya actualiza la vista al guardar ciudad');
for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
console.log('Favoritos: una carga inicial, cero si cerró sesión antes, guardado de ciudad sin segunda carga y sintaxis válida.');
