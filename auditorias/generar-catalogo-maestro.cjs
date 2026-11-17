#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const map=JSON.parse(fs.readFileSync('auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
const inventory=JSON.parse(fs.readFileSync('auditorias/transversal/INVENTARIO_INDEPENDIENTE.json','utf8'));
const dynamic=JSON.parse(fs.readFileSync('auditorias/transversal/INVENTARIO_EVENTOS_DINAMICOS.json','utf8'));
const fingerprint=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const actions=map.trees.map((tree,i)=>{
 const a=tree.action,n=tree.nodes||[],counts=tree.counts||{};
 const limits=n.filter(x=>x.type==='unresolved'||/limit|truncad|incomplet/i.test(x.reason||''));
 const sources=[...new Set([a.file,...n.map(x=>x.file).filter(Boolean)])];
 const http=n.filter(x=>x.type==='http').map(x=>({file:x.file,line:x.line,path:x.target||null,status:x.routeStatus||null}));
 const data=n.filter(x=>x.type==='data').map(x=>({file:x.file,line:x.line,operation:x.operation||null,key:x.key||null}));
 const id='AUD-'+String(i+1).padStart(5,'0');
 return {id,key:fingerprint([a.file,a.line,a.kind,a.handler||a.event||''].join('|')),interface:a.file.includes('administracion')?'Gran Hermano':a.file.includes('login')?'Anunciante':'Usuario u otro módulo (verificar)',start:{file:a.file,line:a.line,kind:a.kind,handler:a.handler||null},status:'pendiente_de_auditoria',mapStatus:tree.status,counts,limitations:limits.slice(0,30),files:sources,network:http,data,checks:{duplicaciones:'pendiente',codigo_obsoleto_y_parches:'pendiente',errores:'pendiente',consumos_reales:'no_medidos'}};
});
const mapped=new Set(actions.map(x=>x.start.file+'|'+x.start.line+'|'+x.start.kind));
const catalog={
 schema:1,type:'catalogo_maestro_de_comprobaciones_pendientes',
 baseline:{branch:process.env.GITHUB_REF_NAME||'audit/transversal-consumos-20261115',revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes:map.sourceHashes},
 disclaimer:'Catálogo automático inicial sobre fuente congelada; no acredita cobertura total ni funcionamiento. No ejecutar contra producción ni inferir consumos de este JSON.',
 totals:{units:actions.length,sourceEntries:inventory.entries.length,dynamicCandidates:dynamic.entries.length,staticTrees:map.trees.length,truncatedOrUnresolved:actions.filter(x=>x.counts.unresolved||x.limitations.length).length,networkUnresolved:map.totals.endpointsUnresolved},
 uncataloguedCandidates:{workerEntrypoints:map.workerEntrypoints||[],deadEnds:map.deadEnds||[],unresolved:(map.unresolved||[]).slice(0,200)},
 entries:actions
};
if(process.argv.includes('--write')){
 fs.writeFileSync('auditorias/transversal/CATALOGO_MAESTRO.json',JSON.stringify(catalog,null,2)+'\n');
 fs.writeFileSync('auditorias/transversal/CATALOGO_MAESTRO.md',[
 '# Catálogo maestro de comprobaciones — versión fija',
 '','Revisión de referencia: '+catalog.baseline.revision,'',
 'Unidades iniciales: **'+actions.length+'**. Candidatos fuente independientes: '+inventory.entries.length+
 '. Eventos dinámicos: '+dynamic.entries.length+'. No equivalen necesariamente a unidades distintas.',
 '','**NO certificado completo:** entradas automáticas del Worker, cortes y destinos sin resolver se muestran como pendientes en JSON.',
 '','| ID | Interfaz preliminar | Archivo y línea | Estado | Ramas sin resolver |',
 '|---|---|---|---|---:|',
 ...actions.map(x=>'| '+x.id+' | '+x.interface+' | '+x.start.file+':'+x.start.line+' | '+x.status+' | '+(x.counts.unresolved||0)+' |'),
 ''].join('\n'));
}
console.log('CATALOGO_MAESTRO '+JSON.stringify({revision:catalog.baseline.revision,totals:catalog.totals}));
if(process.argv.includes('--check')&&!actions.length)process.exitCode=1;
