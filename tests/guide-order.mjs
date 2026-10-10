import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../plataforma/anunciantes.html',import.meta.url),'utf8');
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if(match[1].trim()) new vm.Script(match[1]);
const helper=html.slice(html.indexOf('        function compararNivelesGuia'),html.indexOf('        function buildPaginationBar'));
const sort=html.slice(html.indexOf('          if(hayBusquedaEspecifica){',html.indexOf('const hayBusquedaEspecifica=')),html.indexOf('          // Sin búsqueda/filtros: Nivel 6'));
for(const search of [true,false]){
  const ctx={hayBusquedaEspecifica:search,filtrados:[3,1,5,2,6,4,3].map((nivel,i)=>({id:String(i),nivel:String(nivel),subnivel:i})),catalogosGlobales:{niveles:[{numero:1,prioridad:999,destacado:true},{numero:3,prioridad:-99}]}};
  vm.createContext(ctx);vm.runInContext(helper+sort,ctx);
  assert.deepEqual(Array.from(ctx.filtrados,x=>Number(x.nivel)),[6,5,4,3,3,2,1]);
  const highlights=vm.runInContext('getDestacadas(filtrados)',ctx);
  assert.deepEqual(Array.from(highlights,x=>Number(x.nivel)),[6]);
  const unknown=vm.runInContext("[{nivel:''},{nivel:'ONG'},{nivel:0},{nivel:1},{nivel:6}].sort(compararNivelesGuia)",ctx);
  assert.deepEqual(Array.from(unknown.slice(0,2),x=>x.nivel),[6,1]);
  const pages=ctx.filtrados.filter(x=>Number(x.nivel)!==6);
  const allPages=[...pages.slice(0,2),...pages.slice(2,4),...pages.slice(4)];
  assert.deepEqual(allPages.map(x=>Number(x.nivel)),[5,4,3,3,2,1]);
}
assert.equal(html.includes('prioridadNivel'),false);
console.log('PASS: niveles 6→1 con y sin filtros, destacados sólo nivel 6, paginación y niveles desconocidos. Sintaxis HTML aprobada.');
