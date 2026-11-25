#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const inventory=JSON.parse(fs.readFileSync('auditorias/transversal/INVENTARIO_INDEPENDIENTE.json','utf8'));
const tree=JSON.parse(fs.readFileSync('auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
const actions=tree.trees.map(t=>t.action);
const norm=e=>String(e||'').replace(/^['"]|['"]$/g,'').trim().toLowerCase();
const checks={
 event_listener:{
  source:inventory.entries.filter(x=>x.kind==='event_listener'),
  mapped:actions.filter(x=>x.kind==='listener'),
  key:x=>x.file+'|'+x.line+'|'+norm(x.event)+'|'+String(x.receiver||'').slice(0,130)
 },
 html_attribute:{
  source:inventory.entries.filter(x=>x.kind==='html_attribute'),
  mapped:actions.filter(x=>x.kind==='html_handler'),
  key:x=>x.file+'|'+x.line+'|'+norm(x.expression||x.handler).slice(0,60)
 },
 startup_call:{
  source:inventory.entries.filter(x=>x.kind==='startup_call'),
  mapped:tree.startupCalls||[],
  key:x=>x.file+'|'+x.line+'|'+String(x.callee||x.expression).slice(0,180)
 }
};
function findMissing(source,mapped,key){
 const indexed=new Map();
 for(const x of mapped){const k=key(x);indexed.set(k,(indexed.get(k)||0)+1);}
 const missing=[];
 for(const x of source){const k=key(x),num=indexed.get(k)||0;
  if(num)indexed.set(k,num-1);else missing.push(x);}
 return missing;
}
if(process.argv.includes('--self-test')){
 const check=checks.event_listener;
 const counts=new Map();
 for(const x of check.source)counts.set(check.key(x),(counts.get(check.key(x))||0)+1);
 const sample=check.source.find(x=>counts.get(check.key(x))===1&&check.mapped.filter(a=>check.key(a)===check.key(x)).length===1);
 if(!sample)throw Error('Sin listener único para probar detección');
 const mutant=check.mapped.filter(x=>check.key(x)!==check.key(sample));
 if(!findMissing(check.source,mutant,check.key).some(x=>check.key(x)===check.key(sample)))
   throw Error('El control no detectó una entrada eliminada deliberadamente');
 console.log('CRUCE_MUTANTE_RECHAZADO PASS '+JSON.stringify({file:sample.file,line:sample.line}));
 process.exit(0);
}
let failures=0;const summaries={};const allMissing=[];
for(const [kind,entry] of Object.entries(checks)){
 const missing=findMissing(entry.source,entry.mapped,entry.key);
 summaries[kind]={source:entry.source.length,mapped:entry.mapped.length,missing:missing.length};
 allMissing.push(...missing.map(x=>({kind,...x})));
 failures+=missing.length;
}
console.log('CRUCE_CATEGORIAS_INVENTARIO '+JSON.stringify({summary:summaries,missing:failures,examples:allMissing.slice(0,80)}));
if(process.argv.includes('--check')&&failures)process.exitCode=1;
