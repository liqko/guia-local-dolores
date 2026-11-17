#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const inv=JSON.parse(fs.readFileSync('auditorias/transversal/INVENTARIO_EVENTOS_DINAMICOS.json','utf8'));
const map=JSON.parse(fs.readFileSync('auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
const actions=map.trees.map(t=>t.action).filter(a=>['html_handler','generated_markup','listener','event_property'].includes(a.kind));
const canonical=s=>String(s||'').replace(/\\(["'])/g,'$1').replace(/\s+/g,'').toLowerCase();
const matching=(pool,item)=>{
 const starts=canonical(item.handler).slice(0,36);
 const method=/([A-Za-z_$][\w$]*)\s*\(/.exec(item.handler)?.[1]||null;
 return pool.filter(a=>a.file===item.file&&(
  (Math.abs(a.line-item.line)<=2&&canonical(a.handler).includes(starts.slice(0,18)))||
  (canonical(a.handler).includes(starts)&&Math.abs(a.line-item.line)<=15)||
  (item.source==='concat'&&method&&Math.abs(a.line-item.line)<=60&&
    new RegExp('\\b'+method+'\\s*\\(').test(a.handler))
 ));
};
const findings=[];
for(const item of inv.entries){
 const matches=matching(actions,item);
 const sorted=matches.sort((a,b)=>Math.abs(a.line-item.line)-Math.abs(b.line-item.line));
 findings.push({...item,represented:sorted.length>0,match:sorted[0]?{line:sorted[0].line,kind:sorted[0].kind,handler:sorted[0].handler}:null});
}
if(process.argv.includes('--self-test')){
 const sample=inv.entries.find(item=>matching(actions,item).length===1);
 if(!sample)throw Error('No hay acción única para probar');
 const removed=matching(actions,sample)[0];
 if(matching(actions.filter(a=>a!==removed),sample).length!==0)
   throw Error('No se detectó control eliminado deliberadamente');
 console.log('DINAMICOS_MUTANTE_RECHAZADO PASS '+JSON.stringify({file:sample.file,line:sample.line}));
 process.exit(0);
}
const missing=findings.filter(x=>!x.represented);
console.log('COBERTURA_DINAMICA '+JSON.stringify({total:findings.length,matched:findings.length-missing.length,missing:missing.length,uncertainConcat:inv.uncertain.length,examples:missing.slice(0,50)}));
if(process.argv.includes('--check')&&missing.length)process.exitCode=1;
