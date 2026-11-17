#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const inv=JSON.parse(fs.readFileSync('auditorias/transversal/INVENTARIO_EVENTOS_DINAMICOS.json','utf8'));
const map=JSON.parse(fs.readFileSync('auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
const actions=map.trees.map(t=>t.action).filter(a=>['html_handler','generated_markup','listener','event_property'].includes(a.kind));
const canonical=s=>String(s||'').replace(/\\(["'])/g,'$1').replace(/\s+/g,'').toLowerCase();
const findings=[];
for(const item of inv.entries){
 const starts=canonical(item.handler).slice(0,36);
 const method=/([A-Za-z_$][\\w$]*)\\s*\\(/.exec(item.handler)?.[1]||null;
 const matches=actions.filter(a=>a.file===item.file&&(
  (Math.abs(a.line-item.line)<=2&&canonical(a.handler).includes(starts.slice(0,18)))||
  (canonical(a.handler).includes(starts)&&Math.abs(a.line-item.line)<=15)||
  (item.source==='concat'&&method&&Math.abs(a.line-item.line)<=60&&
    new RegExp('\\\\b'+method+'\\\\s*\\\\(').test(a.handler))
 ));
 const sorted=matches.sort((a,b)=>Math.abs(a.line-item.line)-Math.abs(b.line-item.line));
 findings.push({...item,represented:sorted.length>0,match:sorted[0]?{line:sorted[0].line,kind:sorted[0].kind,handler:sorted[0].handler}:null});
}
const missing=findings.filter(x=>!x.represented);
console.log('COBERTURA_DINAMICA '+JSON.stringify({total:findings.length,matched:findings.length-missing.length,missing:missing.length,uncertainConcat:inv.uncertain.length,examples:missing.slice(0,50)}));
if(process.argv.includes('--check')&&missing.length)process.exitCode=1;
