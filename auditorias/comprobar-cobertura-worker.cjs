#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const file='worker/worker206.txt',source=fs.readFileSync(file,'utf8');
const gps=JSON.parse(fs.readFileSync('auditorias/transversal/MAPA_GPS_GENERADO.json','utf8'));
const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
assert.equal(sf.parseDiagnostics.length,0,'El Worker no se pudo analizar.');
const lit=n=>n&&ts.isStringLiteralLike(n)?n.text:null;
const loc=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
const pathExpr=n=>n&&/^(?:path|ctx\.path|url\.pathname|ctx\.url\.pathname|pathname|requestPath|request2\.url\.pathname)$/.test(n.getText(sf));
const gates=[],patterns=[],conditional=[];
function visit(n){
 if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(n.operatorToken.kind)){
  const val=pathExpr(n.left)?lit(n.right):pathExpr(n.right)?lit(n.left):null;
  if(val?.startsWith('/'))gates.push({path:val,line:loc(n),kind:'compare'});
 }
 if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
  const x=n.expression;
  if(x.name.text==='includes'&&n.arguments.length===1&&pathExpr(n.arguments[0])&&ts.isArrayLiteralExpression(x.expression))
   for(const item of x.expression.elements){const v=lit(item);if(v?.startsWith('/'))gates.push({path:v,line:loc(item),kind:'includes'});}
  if(x.name.text==='match'&&pathExpr(x.expression))patterns.push({line:loc(n),expression:n.getText(sf).slice(0,130)});
 }
 ts.forEachChild(n,visit);
}
visit(sf);
const tree=JSON.parse(fs.readFileSync('auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
const known=tree.workerRouteInventory?.regexRoutes||[];
const missingPatterns=patterns.filter(p=>!known.some(r=>r.file===file&&r.line===p.line));
const missing=gates.filter(g=>!gps.routeMap.some(route=>route.path===g.path&&route.worker.some(w=>w.at.startsWith(file+':'))));
const unique=[...new Set(gates.map(g=>g.path))];
const sourceHash=gps.hashes[file];
assert(sourceHash,'GPS no contiene el Worker');
console.log('COBERTURA_WORKER_RUTAS '+JSON.stringify({literalGateSites:gates.length,uniqueLiteralRoutes:unique.length,regexRouteSites:patterns.length,missingLiteralRoutes:missing.slice(0,35),mappedRegexRoutes:known.length,missingRegexRoutes:missingPatterns}));
assert(gates.length>0,'No se identificaron rutas del Worker');
assert.equal(missing.length,0,'Rutas literales de Worker omitidas por el mapa');
assert.equal(missingPatterns.length,0,'Rutas dinámicas no inventariadas en Worker');
