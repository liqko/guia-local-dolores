#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const files=['plataforma/login.html','plataforma/administracion.html'];
const report=JSON.parse(fs.readFileSync('auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
const all=[],summary={};
for(const file of files){
 const src=fs.readFileSync(file,'utf8'),actions=report.trees.filter(t=>t.action.file===file).map(t=>t.action);
 let findings=[],checked=0,parseErrors=0;
 const fragments=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
 while((m=fragments.exec(src))){
  if(/\bsrc\s*=/.test(m[1]))continue;
  const offset=src.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1;
  const sf=ts.createSourceFile(file,m[2],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);parseErrors+=sf.parseDiagnostics.length;
  const line=n=>offset+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  const visit=n=>{
   if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&
      ts.isPropertyAccessExpression(n.left)&&/^on(?:click|change|submit|input|blur|focus|keydown|keyup)$/.test(n.left.name.text)&&
      (ts.isArrowFunction(n.right)||ts.isFunctionExpression(n.right))){
     checked++;const loc=line(n);
     if(!actions.some(a=>a.kind==='event_property'&&a.line===loc&&a.event===n.left.name.text))
       findings.push({kind:'event_property',line:loc,example:n.getText(sf).slice(0,140)});
   }
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='addEventListener'&&n.arguments.length>=2){
     checked++;const loc=line(n);
     if(!actions.some(a=>a.kind==='listener'&&a.line===loc))
       findings.push({kind:'event_listener',line:loc,example:n.getText(sf).slice(0,140)});
   }
   ts.forEachChild(n,visit);
  };visit(sf);
 }
 const sanitized=src.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,t=>t.replace(/[^\n]/g,' '));
 const tags=/<([a-z][\w:-]*)\b([^>]*?)>/gi;
 while((m=tags.exec(sanitized))){
  const tag=m[1],attrs=m[2],attr=/\b(on(?:click|change|submit|input|blur|focus|keydown|keyup))\s*=\s*(['"])([\s\S]*?)\2/gi;
  let hit;
  while((hit=attr.exec(attrs))){
   checked++;const loc=sanitized.slice(0,m.index).split('\n').length;
   if(!actions.some(a=>a.kind==='html_handler'&&a.line===loc&&a.handler?.includes(hit[3].slice(0,60))))
     findings.push({kind:'html_attribute',line:loc,tag,event:hit[1],example:hit[3].slice(0,150)});
  }
 }
 assert.equal(parseErrors,0,'JS parse errors: '+file);
 summary[file]={checked,actions:actions.length,missing:findings.length};
 all.push(...findings.map(x=>({file,...x})));
}
console.log('COBERTURA_TRES_CONJUNTOS_UI '+JSON.stringify({summary,missing:all.length,findings:all.slice(0,120)}));
if(all.length)process.exitCode=1;
