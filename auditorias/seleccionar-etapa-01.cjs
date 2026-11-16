#!/usr/bin/env node
'use strict';
// Selección reproducible a partir del árbol generado: no se eligen pantallas a mano.
// Etapa 1: accesos y cargas de datos existentes en las tres interfaces.
const fs=require('node:fs'),path=require('node:path');
const source='auditorias/transversal/ARBOL_ACCIONES.json';
if(!fs.existsSync(source))throw Error('Primero generar el árbol completo');
const report=JSON.parse(fs.readFileSync(source,'utf8'));
const domains=[
 {name:'Usuario',files:/^plataforma\/(?:suscriptores|carcasa|elegi-tu-ciudad|anunciantes)\.(?:html|js)$/,routes:/^\/suscriptores(?:$|[/?])/},
 {name:'Anunciante',files:/^plataforma\/(?:login|anunciantes)\.html$/,routes:/^\/(?:commerce|advertisers)(?:$|[/?])/},
 {name:'Gran Hermano',files:/^plataforma\/administracion\.html$/,routes:/^\/superadmin\/(?:dashboard|advertisers|roles)(?:$|[/?])/}
];
const selected=[],unmatched=[];
for(const group of domains){
 const trees=report.trees.filter(tree=>group.files.test(tree.action.file));
 for(const tree of trees){
  const matched=tree.nodes.filter(n=>n.type==='http'&&n.candidates?.some(p=>group.routes.test(p)));
  if(!matched.length)continue;
  const sites=[...new Map(matched.map(n=>[n.file+':'+n.line,{
   file:n.file,line:n.line,verb:n.verb,
   routes:n.candidates.filter(p=>group.routes.test(p))
  }])).values()];
  selected.push({interface:group.name,treeId:tree.action.id,source:tree.action.file+':'+tree.action.line,
   kind:tree.action.kind,elementId:tree.action.elementId,handler:tree.action.handler,
   routes:[...new Set(sites.flatMap(s=>s.routes))].sort(),sites});
 }
 if(!selected.some(a=>a.interface===group.name))unmatched.push(group.name);
}
if(unmatched.length)throw Error('No hay recorridos en '+unmatched.join(', '));
selected.sort((a,b)=>a.interface.localeCompare(b.interface)||a.source.localeCompare(b.source)||a.treeId.localeCompare(b.treeId));
const result={schema:1,stage:'01-acceso-y-carga-compartida',generatedFrom:source,
 sources:report.sourceHashes,totals:{allTrees:report.trees.length,selectedTrees:selected.length,
 byInterface:Object.fromEntries(domains.map(g=>[g.name,selected.filter(x=>x.interface===g.name).length]))},
 notice:'Selección estática, no equivale a ejecución, a doble lectura ni a factura; solo delimita qué recorridos medir y probar',
 trees:selected};
const out='auditorias/transversal/ETAPA_01_ARBOL_SELECCIONADO.json';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log('ETAPA_01_SELECCIONADA '+JSON.stringify({totals:result.totals,entries:selected.map(x=>({interface:x.interface,treeId:x.treeId,source:x.source,handler:x.handler,routes:x.routes})).slice(0,80)}));
