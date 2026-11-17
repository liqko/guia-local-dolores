#!/usr/bin/env node
'use strict';
// Censo separado de elementos HTML que se fabrican mediante cadenas o plantillas JS.
// No importa ni llama al generador de árboles.
const fs=require('node:fs'),cp=require('node:child_process'),ts=require('typescript'),crypto=require('node:crypto');
const paths=cp.execFileSync('git',['ls-files','-z','--','plataforma'],{encoding:'utf8'})
 .split('\0').filter(p=>/^plataforma\/.*\.(?:html|js|cjs|mjs)$/.test(p)&&fs.existsSync(p));
const hashes={},entries=[],methods=[],uncertain=[];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const file of paths){
 const raw=fs.readFileSync(file,'utf8');hashes[file]=sha(raw);
 const fragments=[];if(file.endsWith('.html')){
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
  while((m=re.exec(raw)))if(!/\bsrc\s*=/.test(m[1]))fragments.push({text:m[2],offset:raw.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1});
 }else fragments.push({text:raw,offset:0});
 for(const frag of fragments){
  const sf=ts.createSourceFile(file,frag.text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if(sf.parseDiagnostics.length)throw Error('Error de lectura AST en '+file);
  const line=n=>frag.offset+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  function markup(n,str,kind){
   if(!/<[a-z]/i.test(str)||!/on(?:click|submit|change|input|keydown|keyup|load|error)\s*=/i.test(str))return;
   const tags=/<([a-z][\w:-]*)\b([^>]*?)>/gi;let tag;
   while((tag=tags.exec(str))){
    const attr=/\b(on(?:click|submit|change|input|keydown|keyup|load|error))\s*=\s*(["'])([\s\S]*?)\2/gi;let a;
    while((a=attr.exec(tag[2]))){
     const handler=a[3].trim().replace(/__DYNAMIC__/g,'?');
     const item={file,line:line(n),kind:'generated_html_event',source:kind,tag:tag[1].toLowerCase(),event:a[1].toLowerCase(),handler:handler.slice(0,180)};
     item.id=sha([file,item.line,item.event,item.handler].join('|')).slice(0,16);
     entries.push(item);
    }
   }
  }
  function visit(n){
   if(ts.isTemplateExpression(n)){
    const str=n.head.text+n.templateSpans.map(s=>'__DYNAMIC__'+s.literal.text).join('');
    markup(n,str,'template');
   }else if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))
    markup(n,n.text,'string');
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&
     ['setAttribute','insertAdjacentHTML','createElement','innerHTML'].includes(n.expression.name.text)){
    const arg0=n.arguments[0];
    if(n.expression.name.text==='setAttribute'&&arg0&&ts.isStringLiteral(arg0)&&/^on[a-z]+$/i.test(arg0.text)){
     const v=n.arguments[1];
     methods.push({file,line:line(n),kind:'setAttribute_event',event:arg0.text.toLowerCase(),handler:v?.getText(sf).slice(0,160)||''});
    }
   }
   if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&
     ts.isPropertyAccessExpression(n.left)&&n.left.name.text==='innerHTML'&&
     !ts.isStringLiteralLike(n.right)&&!ts.isTemplateExpression(n.right)){
     const src=n.right.getText(sf);
     if(/on(?:click|change|submit)\s*=/.test(src))uncertain.push({file,line:line(n),expression:src.slice(0,130)});
   }
   ts.forEachChild(n,visit);
  }visit(sf);
 }
}
const unique=[...new Map(entries.map(x=>[[x.file,x.line,x.event,x.handler].join('|'),x])).values()];
const report={schema:1,sourceHashes:hashes,counts:{files:paths.length,generatedEntries:unique.length,setAttributeEvents:methods.length,uncertain:uncertain.length},entries:unique,setAttributeEvents:methods,uncertain};
const mode=process.argv[2]||'--report';
if(mode==='--write'){
 fs.writeFileSync('auditorias/transversal/INVENTARIO_EVENTOS_DINAMICOS.json',JSON.stringify(report,null,2)+'\n');
}
console.log('INVENTARIO_DINAMICO '+JSON.stringify({counts:report.counts,entries:unique.slice(0,90),setAttributeEvents:methods.slice(0,30),uncertain:uncertain.slice(0,20)}));
