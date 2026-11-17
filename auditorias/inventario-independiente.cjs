#!/usr/bin/env node
'use strict';
// Censo independiente: fuentes oficiales => entradas. No usa arbol-estatico.cjs.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),ts=require('typescript'),crypto=require('node:crypto');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=cp.execFileSync('git',['ls-files','-z','--','plataforma','worker/worker206.txt'],{encoding:'utf8'}).split('\0').filter(p=>/^(plataforma\/.*\.(?:html|js|cjs|mjs)|worker\/worker206\.txt)$/.test(p)&&fs.existsSync(p)).sort();
const reportPath='auditorias/transversal/ARBOL_ACCIONES.json';
const arr=[],sourceHashes={};
const add=(file,line,kind,expression,extra={})=>arr.push({id:sha([file,line,kind,expression].join('|')).slice(0,16),file,line,kind,expression:expression.slice(0,250),...extra});
function collect(file,raw){
 const html=file.endsWith('.html');
 if(html){
  const noScript=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,x=>x.replace(/[^\n]/g,' '));
  const tags=/<([a-z][\w:-]*)\b([^>]*?)>/gi;let tag;
  while((tag=tags.exec(noScript))){
   const at=noScript.slice(0,tag.index).split('\n').length,events=/\b(on[a-z]+)\s*=\s*(['"])([\s\S]*?)\2/gi;let event;
   while((event=events.exec(tag[2])))add(file,at,'html_attribute',event[3],{event:event[1].toLowerCase(),tag:tag[1].toLowerCase()});
  }
 }
 const pieces=[];
 if(html){
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
  while((m=re.exec(raw)))if(!/\bsrc\s*=/.test(m[1]))
   pieces.push({text:m[2],offset:raw.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1});
 }else pieces.push({text:raw,offset:0});
 for(const frag of pieces){
  const sf=ts.createSourceFile(file,frag.text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if(sf.parseDiagnostics.length)throw Error('Error AST '+file);
  const loc=n=>frag.offset+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  let ownerDepth=0;
  const isFn=n=>ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n);
  function visit(n){
   if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(n.left)&&
      /^on[a-z]+$/i.test(n.left.name.text)&&n.right.kind!==ts.SyntaxKind.NullKeyword)
     add(file,loc(n),'event_property',n.left.getText(sf)+'='+n.right.getText(sf).slice(0,200),
       {event:n.left.name.text.toLowerCase(),receiver:n.left.expression.getText(sf).slice(0,130),handlerMode:isFn(n.right)?'inline':'reference'});
   if(!html&&file.startsWith('worker/')&&ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(n.left)&&['fetch','alarm'].includes(n.left.name.text)&&/\.prototype$/.test(n.left.expression.getText(sf))&&isFn(n.right))
     add(file,loc(n),'worker_entry',n.left.getText(sf),{owner:n.left.expression.getText(sf).replace(/\.prototype$/,''),method:n.left.name.text});
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='addEventListener')
     add(file,loc(n),'event_listener',n.getText(sf).slice(0,220),
       {event:n.arguments[0]?.getText(sf).slice(0,80)||'',receiver:n.expression.expression.getText(sf).slice(0,130)});
   if(!html&&file.startsWith('worker/')&&ts.isMethodDeclaration(n)&&['fetch','alarm'].includes(n.name.getText(sf))){
     const owner=ts.isClassDeclaration(n.parent)?n.parent.name?.text:ts.isObjectLiteralExpression(n.parent)?'object':null;
     add(file,loc(n),'worker_entry',n.name.getText(sf),{owner,method:n.name.getText(sf)});
   }
   if(html&&ownerDepth===0&&ts.isCallExpression(n)&&
     (ts.isIdentifier(n.expression)||ts.isPropertyAccessExpression(n.expression))&&n.expression.getText(sf)!=='addEventListener')
     add(file,loc(n),'startup_call',n.getText(sf).slice(0,180),{callee:n.expression.getText(sf).slice(0,180)});
   const enters=isFn(n);if(enters)ownerDepth++;
   ts.forEachChild(n,visit);
   if(enters)ownerDepth--;
  }
  visit(sf);
 }
}
for(const file of sources){const raw=fs.readFileSync(file,'utf8');sourceHashes[file]=sha(raw);collect(file,raw);}
const inventory={schema:1,kind:'censo_independiente_de_entradas',sources:sourceHashes,totals:{entries:arr.length,byKind:Object.fromEntries([...new Set(arr.map(a=>a.kind))].map(k=>[k,arr.filter(a=>a.kind===k).length]))},entries:arr};
const target=process.argv[2]||'--report';
if(target==='--self-test'){
 const names=arr.filter(a=>a.file==='plataforma/administracion.html'&&a.kind==='event_property'&&a.handlerMode==='reference');
 for(const line of [740,3955,3956,3957])if(!names.some(a=>a.line===line))throw Error('Falta entrada nombrada GH en línea '+line);
 const roots=arr.filter(a=>a.kind==='worker_entry');if(!roots.some(r=>r.method==='alarm')||roots.filter(r=>r.method==='fetch').length<1)throw Error('Faltan entradas del Worker');
 console.log('INVENTARIO_INDEPENDIENTE_SELF_TEST PASS '+JSON.stringify({namedEventsGH:names.length,workerEntryRoots:roots.length}));process.exit(0);
}
const tree=JSON.parse(fs.readFileSync(reportPath,'utf8'));const mapped=tree.trees.map(t=>t.action);
const byKind={};
const missing=[];
for(const item of arr){
 // Only compare classes with explicit tree representation: the startup and
 // Worker entries remain separate until the tree generator defines their roots.
 if(item.kind==='event_property'){
  const same=mapped.some(a=>a.file===item.file&&a.line===item.line&&a.kind==='event_property'&&a.event===item.event&&a.receiver===item.receiver);
  if(!same)missing.push(item);
 }else if(item.kind==='worker_entry'){
  const roots=tree.workerEntrypoints||[];
  if(!roots.some(x=>x.file===item.file&&x.line===item.line&&x.method===item.method))missing.push(item);
 }
}
for(const x of arr)byKind[x.kind]=(byKind[x.kind]||0)+1;
console.log('INVENTARIO_INDEPENDIENTE '+JSON.stringify({sources:sourceHashes,totals:inventory.totals,missingCount:missing.length,missing:missing.slice(0,40)}));
if(target==='--check'&&missing.length)process.exitCode=1;
else if(target==='--write')fs.writeFileSync('auditorias/transversal/INVENTARIO_INDEPENDIENTE.json',JSON.stringify(inventory,null,2)+'\n');
