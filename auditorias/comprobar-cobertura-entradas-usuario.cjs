#!/usr/bin/env node
'use strict';
// Independent check of JavaScript on* event-property entries against the tree inventory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const files=['plataforma/suscriptores.html','plataforma/carcasa.html'];
const report=JSON.parse(fs.readFileSync('auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
let found=0,total=0;const perFile={};
for(const file of files){
 const source=fs.readFileSync(file,'utf8'),events=[],re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
 while((m=re.exec(source))){
  if(/\bsrc\s*=/.test(m[1]))continue;
  const offset=source.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1;
  const ast=ts.createSourceFile(file,m[2],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal(ast.parseDiagnostics.length,0,'Syntax error in '+file);
  const visit=n=>{
   if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(n.left)&&
     /^on(?:click|change|submit|input|blur|focus|keydown|keyup)$/.test(n.left.name.text)&&
     (ts.isArrowFunction(n.right)||ts.isFunctionExpression(n.right))){
     const line=offset+ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1;
     events.push({file,line,receiver:n.left.expression.getText(ast),event:n.left.name.text});
   }
   ts.forEachChild(n,visit);
  };visit(ast);
 }
 const mapped=report.trees.filter(t=>t.action.file===file&&t.action.kind==='event_property').map(t=>t.action);
 const missed=events.filter(e=>!mapped.some(a=>a.line===e.line&&a.receiver===e.receiver&&a.event===e.event));
 const spurious=mapped.filter(a=>!events.some(e=>e.line===a.line&&e.receiver===a.receiver&&e.event===a.event));
 assert.deepEqual(missed,[],'Event-property actions missing: '+file);
 assert.deepEqual(spurious,[],'Event-property actions invented: '+file);
 perFile[file]={sourceEvents:events.length,mappedActions:mapped.length,missing:missed.length,spurious:spurious.length};
 found+=mapped.length;total+=events.length;
}
const mandatory=[
 ['plataforma/suscriptores.html',926],['plataforma/suscriptores.html',930],
 ['plataforma/suscriptores.html',974],['plataforma/suscriptores.html',975],
 ['plataforma/suscriptores.html',976],['plataforma/carcasa.html',1555],
 ['plataforma/carcasa.html',1564],['plataforma/carcasa.html',1606]
];
for(const [file,line] of mandatory)assert(report.trees.some(t=>t.action.file===file&&t.action.line===line&&t.action.kind==='event_property'),
 'Originally missing action still absent: '+file+':'+line);
console.log('INTEGRIDAD_COBERTURA_EVENT_PROPERTY PASS '+JSON.stringify({total,mapped:found,knownEight:mandatory.length,perFile}));
