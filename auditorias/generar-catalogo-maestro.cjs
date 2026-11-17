#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const base='auditorias/transversal/';
const read=name=>JSON.parse(fs.readFileSync(base+name+'.json','utf8'));
const map=read('ARBOL_ACCIONES'),inventory=read('INVENTARIO_INDEPENDIENTE'),dynamic=read('INVENTARIO_EVENTOS_DINAMICOS'),gps=read('MAPA_GPS_GENERADO');
const fingerprint=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const norm=s=>String(s||'').replace(/^['"]|['"]$/g,'').trim().toLowerCase();
const canonical=s=>String(s||'').replace(/\\(["'])/g,'$1').replace(/\s+/g,'').toLowerCase();
const iface=file=>file.startsWith('worker/')?'Worker':file.includes('administracion')?'Gran Hermano':file.includes('login')?'Anunciante':'Compartida o pendiente de clasificar';
const actions=map.trees.map((tree,i)=>{
 const a=tree.action,n=tree.nodes||[],counts=tree.counts||{};
 const limits=n.filter(x=>['unresolved','limit','missing_handler','missing_worker_route_in_source','possible_missing_worker_route'].includes(x.type));
 return {id:'AUD-'+String(i+1).padStart(5,'0'),key:fingerprint([a.file,a.line,a.kind,a.handler||a.event||''].join('|')),interface:iface(a.file),start:{...a},status:'pendiente_de_auditoria',mapStatus:tree.status,counts,limitations:limits,files:[...new Set([a.file,...n.map(x=>x.file).filter(Boolean)])],network:n.filter(x=>x.type==='http'),data:n.filter(x=>x.type==='data'),checks:{duplicaciones:'pendiente',codigo_obsoleto_y_parches:'pendiente',errores:'pendiente',consumos_reales:'no_medidos'}};
});
// These are real source entry points, but no event tree certifies their traversal.
for(const entry of inventory.entries.filter(e=>['startup_call','worker_entry'].includes(e.kind))){
 actions.push({id:'AUD-'+String(actions.length+1).padStart(5,'0'),key:entry.id,interface:iface(entry.file),start:{...entry},status:'pendiente_de_auditoria',mapStatus:'entrada_sin_arbol_propio',counts:{},limitations:[{type:'unresolved',reason:'recorrido_de_entrada_pendiente'}],files:[entry.file],network:[],data:[],checks:{consumos_reales:'no_medidos'}});
}
function matchSource(e,units){
 return units.filter(u=>{const a=u.start;if(a.file!==e.file||a.line!==e.line)return false;
 if(['startup_call','worker_entry'].includes(e.kind))return a.id===e.id;
 if(e.kind==='event_property')return a.kind===e.kind&&a.event===e.event&&a.receiver===e.receiver;
 if(e.kind==='event_listener')return a.kind==='listener'&&norm(a.event)===norm(e.event)&&String(a.receiver||'').slice(0,130)===String(e.receiver||'').slice(0,130);
 if(e.kind==='html_attribute')return a.kind==='html_handler'&&norm(a.handler).slice(0,60)===norm(e.expression).slice(0,60);
 return false;
 }).map(u=>u.id);
}
function matchDynamic(e,units){
 const starts=canonical(e.handler).slice(0,36),method=/([A-Za-z_$][\w$]*)\s*\(/.exec(e.handler)?.[1];
 return units.filter(u=>{const a=u.start;if(a.file!==e.file||!['html_handler','generated_markup','listener','event_property'].includes(a.kind))return false;
 return (Math.abs(a.line-e.line)<=2&&canonical(a.handler).includes(starts.slice(0,18)))||(canonical(a.handler).includes(starts)&&Math.abs(a.line-e.line)<=15)||(e.source==='concat'&&method&&Math.abs(a.line-e.line)<=60&&new RegExp('\\b'+method+'\\s*\\(').test(a.handler));
 }).map(u=>u.id);
}
const sourceCoverage=inventory.entries.map(e=>({...e,units:matchSource(e,actions)}));
const dynamicCoverage=dynamic.entries.map(e=>({...e,candidateUnits:matchDynamic(e,actions),classification:'coincidencia_estatica_candidata_no_prueba_de_aparicion'}));
const functionSites=new Map(),operationSites=new Map();
for(let i=0;i<map.trees.length;i++)for(const n of map.trees[i].nodes){
 if(n.type==='function'){const key=[n.file,n.line,n.name].join('|');if(!functionSites.has(key))functionSites.set(key,new Set());functionSites.get(key).add(actions[i].id);}
 if(['http','data'].includes(n.type)){const key=[n.type,n.file,n.line,n.operation||n.verb||'',n.key||n.target||''].join('|');if(!operationSites.has(key))operationSites.set(key,{...n,units:new Set()});operationSites.get(key).units.add(actions[i].id);}
}
const functions=gps.functions.map(f=>({...f,units:[...(functionSites.get([f.file,f.line,f.name].join('|'))||[])],classification:functionSites.has([f.file,f.line,f.name].join('|'))?'funcion_presente_en_arbol':'sin_enlace_a_arbol_no_implica_codigo_muerto'}));
const byFunction=new Map(functions.map(f=>[f.id,f]));
const effects=gps.calls.filter(c=>c.effect).map(c=>({...c,units:byFunction.get(c.from)?.units||[],classification:'efecto_candidato_AST_no_consumo_medido'}));
const sourceMismatches=[];
for(const [name,hashes] of Object.entries({inventory:inventory.sources,dynamic:dynamic.sourceHashes,gps:gps.hashes}))for(const [file,hash] of Object.entries(hashes||{}))if(map.sourceHashes[file]!==hash)sourceMismatches.push({name,file});
const missingSources=sourceCoverage.filter(e=>!e.units.length),missingDynamic=dynamicCoverage.filter(e=>!e.candidateUnits.length);
const catalog={schema:2,type:'catalogo_maestro_de_comprobaciones_pendientes',baseline:{branch:process.env.GITHUB_REF_NAME||'audit/transversal-consumos-20261115',revision:process.env.GLD_CATALOG_REVISION||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes:map.sourceHashes},disclaimer:'Cobertura de las categorías estáticas detectadas, no certificación universal ni prueba funcional. Los arranques y fronteras Worker aún requieren recorridos propios. No inferir consumos reales.',totals:{units:actions.length,staticTrees:map.trees.length,addedEntrypoints:actions.length-map.trees.length,sourceEntries:sourceCoverage.length,sourceEntriesUnlinked:missingSources.length,dynamicCandidates:dynamicCoverage.length,dynamicCandidatesUnlinked:missingDynamic.length,treeUnitsWithLimitations:actions.slice(0,map.trees.length).filter(a=>a.limitations.length).length,functions:functions.length,functionsWithoutEventTree:functions.filter(f=>!f.units.length).length,distinctTreeOperationSites:operationSites.size,effectCandidates:effects.length,networkUnresolved:map.totals.endpointsUnresolved},coverage:{sourceMismatches,sourceEntries:sourceCoverage,dynamicEntries:dynamicCoverage},functions,effects,operationSites:[...operationSites.values()].map(x=>({...x,units:[...x.units]})),uncataloguedCandidates:{deadEnds:map.deadEnds||[],unresolved:map.unresolved||[],dynamicConstructors:dynamic.uncertain||[],setAttributeEvents:dynamic.setAttributeEvents||[]},entries:actions};
function validate(c){
 const ids=new Set(c.entries.map(x=>x.id));
 if(!ids.size||ids.size!==c.entries.length)throw Error('Unidades ausentes o IDs duplicados');
 if(c.coverage.sourceMismatches.length)throw Error('Fuentes incompatibles');
 const functionKeys=xs=>xs.map(f=>[f.file,f.line,f.name,f.parent].join('|')).sort();
 if(JSON.stringify(functionKeys(c.functions))!==JSON.stringify(functionKeys(gps.functions)))throw Error('Inventario de funciones incompleto');
 if(c.effects.length!==gps.calls.filter(c=>c.effect).length)throw Error('Inventario de efectos incompleto');
 for(const e of c.coverage.sourceEntries)if(!e.units.length||e.units.some(id=>!ids.has(id)))throw Error('Entrada fuente sin unidad: '+e.file+':'+e.line);
 for(const e of c.coverage.dynamicEntries)if(!e.candidateUnits.length||e.candidateUnits.some(id=>!ids.has(id)))throw Error('Entrada dinámica sin candidato: '+e.file+':'+e.line);
 return true;
}
if(process.argv.includes('--self-test')){
 validate(catalog);
 const orphan=structuredClone(catalog);orphan.entries=orphan.entries.filter(x=>x.id!==sourceCoverage.find(x=>x.units.length===1).units[0]);
 let rejected=false;try{validate(orphan);}catch{rejected=true;}if(!rejected)throw Error('No detecta unidad eliminada');
 const omitted=structuredClone(catalog);omitted.coverage.sourceEntries[0].units=[];
 rejected=false;try{validate(omitted);}catch{rejected=true;}if(!rejected)throw Error('No detecta enlace eliminado');
 const noFunction=structuredClone(catalog);noFunction.functions.pop();
 rejected=false;try{validate(noFunction);}catch{rejected=true;}if(!rejected)throw Error('No detecta función eliminada');
 console.log('CATALOGO_MUTANTES_RECHAZADOS PASS unidad_eliminada enlace_eliminado funcion_eliminada');
}
if(process.argv.includes('--check'))validate(catalog);
if(process.argv.includes('--write')){
 fs.writeFileSync(base+'CATALOGO_MAESTRO.json',JSON.stringify(catalog,null,2)+'\n');
 fs.writeFileSync(base+'CATALOGO_MAESTRO.md',['# Catálogo maestro — cobertura estática parcial','','Revisión: '+catalog.baseline.revision,'',...Object.entries(catalog.totals).map(([k,v])=>'- '+k+': '+v),'','Los candidatos dinámicos pueden enlazar varias unidades. No se suman como acciones nuevas. Las operaciones se agrupan por sitio de código, sin multiplicarlas por cantidad de árboles. Funciones sin árbol no equivalen a código muerto.','', '**Pendiente:** completar los recorridos truncados y los arranques/entradas Worker; clasificar consumidores de archivos compartidos; comprobar comportamiento y consumo.','','| ID | Interfaz preliminar | Archivo y línea | Mapa |','|---|---|---|---|',...actions.map(x=>'| '+x.id+' | '+x.interface+' | '+x.start.file+':'+x.start.line+' | '+x.mapStatus+' |'),''].join('\n'));
}
console.log('CATALOGO_MAESTRO '+JSON.stringify({revision:catalog.baseline.revision,totals:catalog.totals,missingSources:missingSources.slice(0,10),missingDynamic:missingDynamic.slice(0,10),sourceMismatches}));
