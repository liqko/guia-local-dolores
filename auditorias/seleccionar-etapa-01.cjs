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
// Las raíces no se eligen entre los 73 candidatos por contar solicitudes;
// se identifican por el evento de entrada funcional real, conservando su ID de árbol.
const rootRules=[
 {name:'Usuario · inicio en carcasa',interface:'Usuario',file:'plataforma/carcasa.html',handler:/^gldLoginSubscriber$/},
 {name:'Usuario · iniciar sesión',interface:'Usuario',file:'plataforma/suscriptores.html',handler:/^login$/},
 {name:'Anunciante · seleccionar anuncio',interface:'Anunciante',file:'plataforma/login.html',handler:/^callback@8513$/},
 {name:'Gran Hermano · abrir inicio',interface:'Gran Hermano',file:'plataforma/administracion.html',handler:/^ghGoView\('inicio'\)$/}
];
const roots=rootRules.map(rule=>{
 const list=selected.filter(x=>x.interface===rule.interface&&x.source.startsWith(rule.file+':')&&rule.handler.test(x.handler));
 if(list.length!==1)throw Error('Raíz ausente o ambigua: '+rule.name+' ('+list.length+')');
 return {name:rule.name,...list[0]};
});
// Entradas automáticas no representadas por botones. Comprobadas contra el texto
// real de los consumidores y diferenciadas de los árboles de clic.
const automatedContracts=[
 {name:'Usuario · restaurar sesión guardada',interface:'Usuario',file:'plataforma/suscriptores.html',
  steps:[['restauración local','loadStoredSession();'],['pintar sesión sin precargar favoritos','renderSession(false);'],['ciudades y mi guía','if(!redirigiendoDestino)loadCities().then(']],
  routeEvidence:'Carga de ciudades y favoritos condicionados; no afirmar un GET de sesión al arrancar'},
 {name:'Usuario · inicialización Carcasa',interface:'Usuario',file:'plataforma/carcasa.html',
  steps:[['montaje al cargar DOM',"document.addEventListener('DOMContentLoaded',gldWireSubscriberUi"],['inicializador','function gldWireSubscriberUi(){']],
  routeEvidence:'Interfaz principal, las solicitudes efectivas dependen de sus funciones llamadas'},
 {name:'Anunciante · restauración automática',interface:'Anunciante',file:'plataforma/login.html',
  steps:[['inicio al cargar DOM',"document.addEventListener('DOMContentLoaded', ()=>{"],['restaurar sesión','restaurarSesionSuscriptor_();'],['validar sesión','async function obtenerAutorizaciones_(){'],['obtener autorizaciones',"apiSuscriptores_({action:'session'})"],['abrir automáticamente','await seleccionarAnunciante_(relGuardada);'],['cargar ficha',"/commerce?action=anunciante&id="]],
  routeEvidence:'/suscriptores action=session condicionado y /commerce?action=anunciante al abrir ficha'},
 {name:'Gran Hermano · restaurar token y abrir Inicio',interface:'Gran Hermano',file:'plataforma/administracion.html',
  steps:[['guardado de token',"localStorage.getItem('gld_superadmin_token')"],['arranque condicionado','if(TOKEN) abrirApp();'],['abrir aplicación','async function abrirApp(prefetched=null){'],['consulta principal',"+'/superadmin/dashboard'"],['carga de pendientes',"ghRevisionUnificada(GH_DAILY_ENTRY195?.inbox||null)"]],
  routeEvidence:'GET /superadmin/dashboard con token conservado; bandeja reutiliza copia si existe'},
 {name:'Gran Hermano · inicio de sesión nuevo',interface:'Gran Hermano',file:'plataforma/administracion.html',
  steps:[['autenticar',"+'/superadmin/session/login'"],['abrir aplicación tras autenticar','await abrirApp();']],
  routeEvidence:'Rama auditada: POST /superadmin/session/login y luego GET /superadmin/dashboard. Main actual tiene reutilización de respuesta prefetched; diferencias de versiones deben conciliarse antes de corregir'}
];
const automated=automatedContracts.map(entry=>{
 const raw=fs.readFileSync(entry.file,'utf8'),lines=raw.split('\n'),events=[];
 for(const [label,needle] of entry.steps){
  const matches=[];
  for(let i=0;i<lines.length;i++)if(lines[i].includes(needle))matches.push(i+1);
  if(!matches.length)throw Error('Enlace automático ausente: '+entry.name+' -> '+label+' ['+needle+']');
  events.push({label,file:entry.file,lines:matches.slice(0,12),evidence:needle});
 }
 return {name:entry.name,interface:entry.interface,source:entry.file,
  events,routeEvidence:entry.routeEvidence,treeId:null,
  classification:'entrada_automatica_anclada_en_codigo_no_es_arbol_de_boton'};
});
const result={schema:1,stage:'01-acceso-y-carga-compartida',generatedFrom:source,
 sources:report.sourceHashes,totals:{allTrees:report.trees.length,selectedTrees:selected.length,
 byInterface:Object.fromEntries(domains.map(g=>[g.name,selected.filter(x=>x.interface===g.name).length])),roots:roots.length,automated:automated.length},
 notice:'Selección estática, no equivale a ejecución, a doble lectura ni a factura; solo delimita qué recorridos medir y probar',
 roots,automated,candidates:selected,rootDisclaimer:'Las raíces son entradas identificadas; autenticación automática y carga inicial sin botón requieren traza complementaria antes de afirmar cobertura completa',trees:selected};
const out='auditorias/transversal/ETAPA_01_ARBOL_SELECCIONADO.json';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log('ETAPA_01_SELECCIONADA '+JSON.stringify({totals:result.totals,roots,automated,entries:selected.map(x=>({interface:x.interface,treeId:x.treeId,source:x.source,handler:x.handler,routes:x.routes})).slice(0,80)}));
