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
  key:x=>x.file+'|'+x.line
 }
};
let failures=0;const summaries={};const allMissing=[];
for(const [kind,entry] of Object.entries(checks)){
 const indexed=new Map();for(const x of entry.mapped){const k=entry.key(x);indexed.set(k,(indexed.get(k)||0)+1);}
 const missing=[];for(const x of entry.source){const k=entry.key(x),num=indexed.get(k)||0;if(num)indexed.set(k,num-1);else missing.push(x);}
 summaries[kind]={source:entry.source.length,mapped:entry.mapped.length,missing:missing.length};
 allMissing.push(...missing.map(x=>({kind,...x})));
 failures+=missing.length;
}
console.log('CRUCE_CATEGORIAS_INVENTARIO '+JSON.stringify({summary:summaries,missing:failures,examples:allMissing.slice(0,80)}));
if(process.argv.includes('--check')&&failures)process.exitCode=1;
