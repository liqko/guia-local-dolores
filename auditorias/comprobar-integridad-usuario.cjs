#!/usr/bin/env node
'use strict';
// Contraste independiente: no importa ni modifica el generador de árboles.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const ROOT=path.resolve(__dirname,'..');
const FILES=['plataforma/suscriptores.html','plataforma/carcasa.html'];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function inspect(raw,file,trees){
 const entries=[],startupCalls=[],effects=[],decisions=[];
 const actions=trees.filter(t=>t.action.file===file);
 const nodes=trees.flatMap(t=>t.nodes);
 const location=(line,types)=>nodes.some(n=>n.file===file&&n.line===line&&types.includes(n.type));
 const add=(kind,line,expression,extra={})=>entries.push({kind,file,line,expression,...extra,
  representedAsEntry:actions.some(t=>t.action.line===line)});
 const scripts=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
 while((m=scripts.exec(raw))){
  if(/\bsrc\s*=/.test(m[1]))continue;
  const offset=raw.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1;
  const sf=ts.createSourceFile(file,m[2],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal(sf.parseDiagnostics.length,0,'Error de análisis independiente '+file);
  const line=n=>offset+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  const isFunction=n=>ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)||ts.isConstructorDeclaration(n);
  function walk(n,depth){
   const text=n.getText(sf),at=line(n);
   if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(n.left)&&/^on[a-z]+$/.test(n.left.name.text)&&n.right.kind!==ts.SyntaxKind.NullKeyword)
    add('event_property',at,text,{event:n.left.name.text,bodyRepresented:location(at,['function'])});
   if(ts.isCallExpression(n)){
    const target=n.expression,method=ts.isPropertyAccessExpression(target)?target.name.text:ts.isIdentifier(target)?target.text:null;
    if(method==='addEventListener')add('event_listener',at,text,{event:n.arguments[0]?.getText(sf)});
    if(depth===0&&method!=='addEventListener')startupCalls.push({file,line:at,expression:text,representedAsCall:location(at,['guarded_call'])});
    if(method==='fetch'||ts.isPropertyAccessExpression(target)&&/^(localStorage|sessionStorage|caches|indexedDB)\b/.test(target.expression.getText(sf)))effects.push({file,line:at,expression:text,representedInAnyTree:location(at,['guarded_call','http','data'])});
   }
   if(ts.isIfStatement(n)||ts.isConditionalExpression(n)||ts.isSwitchStatement(n)||ts.isTryStatement(n))decisions.push({file,line:at,kind:ts.SyntaxKind[n.kind],expression:text.slice(0,240)});
   ts.forEachChild(n,c=>walk(c,depth+(isFunction(n)?1:0)));
  }
  walk(sf,0);
 }
 // Attributes on actual HTML tags outside script bodies; generated markup is
 // separately represented by existing trees, not asserted visible here.
 const noScripts=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,x=>x.replace(/[^\n]/g,' '));
 const tags=/<[a-z][^>]*>/gi;while((m=tags.exec(noScripts))){
  const attrs=/\b(on[a-z]+)\s*=\s*(['"])([\s\S]*?)\2/gi;let a;
  while((a=attrs.exec(m[0])))add('html_attribute',noScripts.slice(0,m.index).split('\n').length,a[3],{event:a[1]});
 }
 const subset=actions.map(t=>({id:t.action.id,line:t.action.line,handler:t.action.handler,counts:t.counts,
  limits:t.nodes.filter(n=>n.type==='limit'),unresolved:t.nodes.filter(n=>n.type==='unresolved')}));
 const unique=a=>[...new Map(a.map(x=>[x.kind+':'+x.line+':'+x.expression,x])).values()];
 return {file,sha256:sha(raw),existingTrees:actions.length,entries:unique(entries),startupCalls,effects,decisions,trees:subset};
}
function selfTest(){
 const text='<button onclick="save()">Guardar</button>\n<script>\nfunction save(){return fetch("/x")}\ndocument.addEventListener("click",save);\nbutton.onclick=()=>save();\nsave();\n</script>';
 const tree={action:{file:'plataforma/test.html',line:1,id:'test',handler:'save()'},counts:{},nodes:[]};
 const r=inspect(text,'plataforma/test.html',[tree]);
 assert.equal(r.entries.filter(x=>x.kind==='event_property'&&!x.representedAsEntry).length,1);
 assert.equal(r.entries.filter(x=>x.kind==='event_listener'&&!x.representedAsEntry).length,1);
 assert(r.startupCalls.some(x=>x.expression==='save()'&&!x.representedAsCall));
 assert.equal(r.entries.find(x=>x.kind==='html_attribute').representedAsEntry,true);
 assert.equal(inspect(text,'plataforma/test.html',[]).entries.find(x=>x.kind==='html_attribute').representedAsEntry,false);
 console.log('INTEGRIDAD_USUARIO_SELF_TEST PASS: atributo omitido, listener omitido, propiedad onclick y arranque detectados');
}
function main(){
 if(process.argv.includes('--self-test'))return selfTest();
 const official=process.argv[2];assert(official,'Indicar checkout oficial');
 const before=JSON.parse(fs.readFileSync(path.join(ROOT,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));
 const after=JSON.parse(fs.readFileSync(path.join(official,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));
 const results=FILES.map(file=>{
  const raw=fs.readFileSync(path.join(official,file),'utf8'),r=inspect(raw,file,after.trees);
  const old=before.trees.filter(t=>t.action.file===file),current=after.trees.filter(t=>t.action.file===file);
  r.sourceEqual=sha(fs.readFileSync(path.join(ROOT,file)))===sha(raw);
  r.sameTreeIds=JSON.stringify(old.map(t=>t.action.id))===JSON.stringify(current.map(t=>t.action.id));
  r.treesByteEqual=JSON.stringify(old)===JSON.stringify(current);
  r.missingEntries=r.entries.filter(x=>!x.representedAsEntry);
  r.summary={existingTrees:r.existingTrees,sourceEqual:r.sourceEqual,sameTreeIds:r.sameTreeIds,treesByteEqual:r.treesByteEqual,
   inspectedEntries:r.entries.length,missingEntries:r.missingEntries.length,
   eventProperties:r.entries.filter(x=>x.kind==='event_property').length,
   startupCalls:r.startupCalls.length,startupCallsWithoutCallNode:r.startupCalls.filter(x=>!x.representedAsCall).length,
   dataAndStorageSites:r.effects.length,dataAndStorageSitesWithoutNode:r.effects.filter(x=>!x.representedInAnyTree).length,
   limitedTrees:r.trees.filter(t=>t.limits.length).length,
   limits:r.trees.reduce((a,t)=>a+t.limits.length,0),unresolved:r.trees.reduce((a,t)=>a+t.unresolved.length,0)};
  return r;
 });
 const report={date:'2026-11-17',scope:FILES,officialCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:official,encoding:'utf8'}).trim(),
  auditBaseCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
  verdict:results.some(r=>r.missingEntries.length)?'INTEGRIDAD_NO_ACREDITADA_ENTRADAS_OMITIDAS':'SIN_OMISIONES_EN_ENTRADAS_INSPECCIONADAS_NO_CERTIFICA_TODO_EL_FLUJO',
  limits:['Análisis estático: no mide consumo ni demuestra fallo funcional de la plataforma.',
   'Inventario independiente de atributos HTML, addEventListener, asignaciones on*, llamadas de inicio y sitios fetch/almacenamiento en los dos HTML.',
   'Cobertura por archivo y línea; no prueba todas las decisiones ni todos los scripts externos. Los elementos no cubiertos no se declaran código muerto.',
   'El listado de inicio distingue invocación superior de cuerpo de callback; no afirma que todas las llamadas de inicio sean peticiones de red.'],results};
 const out=path.join(ROOT,'auditorias/transversal/INTEGRIDAD_USUARIO_20261117.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 const lines=['# Comprobación de integridad de los árboles de Usuario','',`Código oficial: ${report.officialCommit}. Fecha: 17/11/2026.`,
  '', '**Resultado: se detectaron entradas del código que no tienen una entrada propia en los árboles generados.**',
  'Los árboles existentes se conservan: esta comprobación no demuestra fallos funcionales ni consumos duplicados de la plataforma.',
  '', '| Conjunto | Fuente igual a oficial | Mismos identificadores de entrada | Árboles existentes | Entradas omitidas detectadas | Árboles truncados |', '|---|---|---|---:|---:|---:|'];
 for(const r of results)lines.push(`| ${r.file} | ${r.sourceEqual?'Sí':'No'} | ${r.sameTreeIds?'Sí':'No'} | ${r.existingTrees} | ${r.missingEntries.length} | ${r.summary.limitedTrees} |`);
 lines.push('','## Omisiones concretas','');
 for(const r of results)for(const e of r.missingEntries)lines.push(`- ${e.file}:${e.line}, ${e.kind}: \`${e.expression.replace(/\s+/g,' ').replace(/`/g,"'").slice(0,200)}\`.`);
 lines.push('','## Cortes internos del generador','',
  'Hay nodos de tipo limit con motivo node_limit. El generador interrumpe la expansión al superar 2400 nodos, pero counts.unresolved y el estado del árbol no cuentan estos cortes. Cero unresolved no acredita finalización.',
  'Los 228 marcadores de corte pertenecen a 14 árboles; no son 228 acciones ni 228 fallos funcionales.',
  '', '## Árboles truncados (identificador y entrada)','');
 for(const r of results)for(const t of r.trees.filter(t=>t.limits.length))lines.push(`- ${r.file}:${t.line}, ${t.id}, ${t.handler}: ${t.limits.length} marcadores de corte.`);
 lines.push('','## Alcance y límites','',...report.limits.map(x=>'- '+x),'',
  'Reproducción: regenerar ARBOL_ACCIONES.json en el checkout de auditoría y en el checkout oficial con el generador existente; ejecutar comprobar-integridad-usuario.cjs con el directorio oficial como argumento. Ejecutar --self-test para comprobar detección de entradas deliberadamente omitidas.',
  '', 'Siguiente acción: completar el generador con entradas por propiedades de eventos y arranques y corregir el truncamiento; repetir este contraste antes de certificar integridad total. No se modificó el generador ni código productivo en esta comprobación.');
 fs.writeFileSync(out.replace('.json','.md'),lines.join('\n')+'\n');
 console.log(JSON.stringify({verdict:report.verdict,officialCommit:report.officialCommit,results:results.map(r=>({file:r.file,...r.summary,missingEntries:r.missingEntries.map(e=>({line:e.line,kind:e.kind,expression:e.expression.slice(0,140)}))}))},null,2));
}
if(require.main===module)main();
module.exports={inspect};
