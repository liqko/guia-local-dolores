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
 const add=(kind,line,expression,extra={})=>entries.push({kind,file,line,expression:expression.slice(0,500),...extra,
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
    if(depth===0&&method!=='addEventListener')startupCalls.push({file,line:at,expression:text.slice(0,500),representedAsCall:location(at,['guarded_call'])});
    if(method==='fetch'||ts.isPropertyAccessExpression(target)&&/^(localStorage|sessionStorage|caches|indexedDB)\b/.test(target.expression.getText(sf)))effects.push({file,line:at,expression:text.slice(0,500),representedInAnyTree:location(at,['guarded_call','http','data'])});
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
 const text='<button onclick="save()">Guardar</button>\n<script>\nfunction save(){return fetch("/x")}\ndocument.addEventListener("click",save);\nbutton.onclick=()=>save();\nbutton.onchange=save;\nsave();\n</script>';
 const tree={action:{file:'plataforma/test.html',line:1,id:'test',handler:'save()'},counts:{},nodes:[]};
 const r=inspect(text,'plataforma/test.html',[tree]);
 assert.equal(r.entries.filter(x=>x.kind==='event_property'&&!x.representedAsEntry).length,2);
 assert.equal(r.entries.filter(x=>x.kind==='event_listener'&&!x.representedAsEntry).length,1);
 assert(r.startupCalls.some(x=>x.expression==='save()'&&!x.representedAsCall));
 assert.equal(r.entries.find(x=>x.kind==='html_attribute').representedAsEntry,true);
 assert.equal(inspect(text,'plataforma/test.html',[]).entries.find(x=>x.kind==='html_attribute').representedAsEntry,false);
 const workerText='const app_main_v35_default={\nasync fetch(request){return route(request)}\n};\nclass GldPublicCache119{\nasync fetch(request){return handle(request)}\n};\nGldPublicCache119.prototype.alarm=async function(){await repair()};\nexport {app_main_v35_default as default,GldPublicCache119};';
 const w=inspectWorker(workerText,'worker/test.txt',[]);
 assert.equal(w.boundaries.length,3);
 assert(w.boundaries.every(x=>!x.bodyRepresented));
 assert.equal(inspectWorker(workerText,'worker/test.txt',[{action:{file:'x',line:1},nodes:[{type:'function',file:'worker/test.txt',line:2,name:'fetch'}]}]).boundaries.filter(x=>x.bodyRepresented).length,1);
 assert.equal(coverageVerdict([{missingEntries:[],summary:{limitedTrees:1}}]),'INTEGRIDAD_NO_ACREDITADA');
 assert.equal(coverageVerdict([],w),'INTEGRIDAD_NO_ACREDITADA');
 console.log('INTEGRIDAD_USUARIO_SELF_TEST PASS: atributo omitido, listener omitido, propiedad onclick y arranque detectados');
}
function coverageVerdict(results,worker){
 return results.some(r=>r.missingEntries.length||r.summary.limitedTrees)||(worker&&worker.boundaries.some(x=>!x.bodyRepresented))?'INTEGRIDAD_NO_ACREDITADA':'SIN_OMISIONES_EN_EL_ALCANCE_INSPECCIONADO';
}
function inspectWorker(raw,file,trees){
 const sf=ts.createSourceFile(file,raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 assert.equal(sf.parseDiagnostics.length,0,'Worker no analizable');
 const nodes=trees.flatMap(t=>t.nodes).filter(n=>n.file===file),functions=new Set(nodes.filter(n=>n.type==='function').map(n=>n.line));
 const calls=new Set(nodes.filter(n=>['guarded_call','http','data'].includes(n.type)).map(n=>n.line));
 const boundaries=[],routeGates=[],effects=[];
 const line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
 function name(n){
  if(ts.isMethodDeclaration(n)){
   if(ts.isClassDeclaration(n.parent))return (n.parent.name?.text||'<class>')+'.'+n.name.getText(sf);
   if(ts.isObjectLiteralExpression(n.parent)&&ts.isVariableDeclaration(n.parent.parent))return n.parent.parent.name.getText(sf)+'.'+n.name.getText(sf);
  }
  if(ts.isFunctionExpression(n)&&ts.isBinaryExpression(n.parent))return n.parent.left.getText(sf);
  return null;
 }
 function walk(n,owner=null){
  const qualified=name(n);if(qualified)owner=qualified;
  if(['app_main_v35_default.fetch','GldPublicCache119.fetch','GldPublicCache119.prototype.alarm'].includes(qualified))
   boundaries.push({file,line:line(n),name:qualified,bodyRepresented:functions.has(line(n)),representedAsRoot:trees.some(t=>t.action.file===file&&t.action.line===line(n))});
  if(ts.isIfStatement(n)&&/(?:\bpath\b|\.pathname)/.test(n.expression.getText(sf))&&/(?:[=!]==?|\.startsWith\(|\.includes\(|\.match\()/.test(n.expression.getText(sf)))
   routeGates.push({file,line:line(n),owner,condition:n.expression.getText(sf),representedAtLine:nodes.some(x=>x.line===line(n))});
  if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
   const receiver=n.expression.expression.getText(sf),method=n.expression.name.text;
   if(/^(?:db|cache|kv)\b|\b(?:state|ctx)\.storage\b|\bthis\.(?:sql|query)\b/.test(receiver)&&/^(?:get|getVersioned|put|set|patch|delete|list|query|queryEqual|commitPatches|exec|setAlarm|deleteAlarm|transaction|run)$/.test(method))
    effects.push({file,line:line(n),owner,receiver,method,expression:n.getText(sf).slice(0,300),representedAtLine:calls.has(line(n))});
  }
  ts.forEachChild(n,c=>walk(c,owner));
 }
 walk(sf);
 return {file,sha256:sha(raw),boundaries,routeGates,effects,summary:{boundaries:boundaries.length,boundariesWithoutBody:boundaries.filter(x=>!x.bodyRepresented).length,routeGates:routeGates.length,routeGatesWithoutNode:routeGates.filter(x=>!x.representedAtLine).length,effectSites:effects.length,effectSitesWithoutNode:effects.filter(x=>!x.representedAtLine).length}};
}
function remaining(official,audit){
 assert(official&&audit,'Indicar checkout oficial y checkout de generador');
 const before=JSON.parse(fs.readFileSync(path.join(audit,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));
 const after=JSON.parse(fs.readFileSync(path.join(official,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));
 const files=['plataforma/login.html','plataforma/administracion.html'];
 const results=files.map(file=>{
  const raw=fs.readFileSync(path.join(official,file),'utf8'),r=inspect(raw,file,after.trees);
  const old=before.trees.filter(t=>t.action.file===file);
  r.sourceEqual=sha(fs.readFileSync(path.join(audit,file)))===sha(raw);
  r.missingEntries=r.entries.filter(x=>!x.representedAsEntry);
  r.summary={existingTrees:r.existingTrees,sourceEqual:r.sourceEqual,inspectedEntries:r.entries.length,missingEntries:r.missingEntries.length,limitedTrees:r.trees.filter(t=>t.limits.length).length,limitMarkers:r.trees.reduce((a,t)=>a+t.limits.length,0),unresolved:r.trees.reduce((a,t)=>a+t.unresolved.length,0),auditTrees:old.length};
  return r;
 });
 const file='worker/worker206.txt',worker=inspectWorker(fs.readFileSync(path.join(official,file),'utf8'),file,after.trees);
 worker.sourceEqual=sha(fs.readFileSync(path.join(audit,file)))===worker.sha256;
 const git=(cwd,ref)=>cp.execFileSync('git',['rev-parse',ref],{cwd,encoding:'utf8'}).trim();
 const sourceComparison=[...files,file].map(file=>({file,officialBlob:git(official,'HEAD:'+file),auditBlob:git(audit,'HEAD:'+file)}));
 const report={date:'2026-11-17',officialCommit:git(official,'HEAD'),auditCommit:git(audit,'HEAD'),generatorSha256:sha(fs.readFileSync(path.join(audit,'auditorias/arbol-estatico.cjs'))),verdict:coverageVerdict(results,worker),sourceComparison,generatedTotals:after.totals,
  scope:'Dos HTML principales y Worker oficial completos, mediante el generador vigente. Los cuerpos de scripts externos se rastrean cuando los árboles los alcanzan; este contraste no certifica todas las entradas de esos scripts.',
  limits:['Resultado estático: no prueba fallo funcional ni mide consumos.', 'Entradas HTML contrastadas por archivo y línea, no por ejecución en navegador. Las entradas no omitidas no acreditan todas las ramas.', 'El Worker tiene 3 fronteras de ejecución contrastadas: fetch exterior, fetch de Durable Object y alarma. No se certifica cada decisión, actor interno o desencadenante adicional.', 'Sitios de datos y puertas de ruta sin nodo son inventario para seguimiento, no prueba de código muerto ni conteo de operaciones ejecutadas.', 'La igualdad de fuente de Worker en GitHub no demuestra igualdad con el Worker instalado en Cloudflare.'],results,worker};
 const out=path.join(ROOT,'auditorias/transversal/INTEGRIDAD_RESTANTES_20261117.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 const lines=['# Comprobación de Anunciante, Gran Hermano y Worker','',`17/11/2026. Oficial: ${report.officialCommit}. Generador: ${report.auditCommit}.`,
  '', '**Resultado: integridad no acreditada; hay recorridos truncados y entradas de ejecución sin representación.**',
  '', '| Componente | Fuente de auditoría igual a oficial | Árboles del HTML oficial | Entradas omitidas detectadas | Árboles truncados |', '|---|---|---:|---:|---:|'];
 for(const r of results)lines.push(`| ${r.file} | ${r.sourceEqual?'Sí':'No'} | ${r.existingTrees} | ${r.missingEntries.length} | ${r.summary.limitedTrees} |`);
 lines.push(`| Worker | ${worker.sourceEqual?'Sí':'No'} | No es interfaz; se contrasta el servicio | ${worker.summary.boundariesWithoutBody} fronteras sin cuerpo en los árboles | Ver recorridos de interfaces |`,
  '', '## Comparación de fuentes','',...sourceComparison.map(x=>`- ${x.file}: oficial ${x.officialBlob}; auditoría ${x.auditBlob}.`),
  '', '## Entradas de Gran Hermano omitidas','');
 for(const r of results)for(const e of r.missingEntries)lines.push(`- ${e.file}:${e.line}: \`${e.expression.replace(/\s+/g,' ').replace(/`/g,"'").slice(0,200)}\`.`);
 lines.push('','## Fronteras del Worker','');
 for(const e of worker.boundaries)lines.push(`- ${e.file}:${e.line}: ${e.name}; cuerpo representado: ${e.bodyRepresented?'sí':'no'}; raíz representada: ${e.representedAsRoot?'sí':'no'}.`);
 lines.push('', 'El enlace de una petición HTTP a una función interna no representa por sí solo el manejador exterior con sus envolturas, ni la recepción del actor ni la recuperación por alarma.',
  '', '## Árboles truncados','');
 for(const r of results){lines.push(`### ${r.file}`,'');for(const t of r.trees.filter(t=>t.limits.length))lines.push(`- ${r.file}:${t.line}; ${t.id}; ${t.handler.replace(/`/g,"'")}; ${t.limits.length} marcadores de corte.`);lines.push('');}
 lines.push('## Alcance y límites','',report.scope,'',...report.limits.map(x=>'- '+x),
  '', '## Comprobación reproducible','', 'Se usó el mismo generador vigente en dos checkouts separados. Sus regresiones pasaron. El control independiente existente se amplió con --restantes; no se creó otro generador ni se modificó producto.',
  '', '`node auditorias/comprobar-integridad-usuario.cjs --restantes DIRECTORIO_OFICIAL DIRECTORIO_GENERADOR`',
  '', 'Siguiente acción: integrar estas evidencias en el generador único, cubrir asignaciones de eventos por referencia a función, quitar truncamientos y enlazar fronteras/actores/alarma antes de acreditar integridad.');
 fs.writeFileSync(out.replace('.json','.md'),lines.join('\n')+'\n');
 console.log(JSON.stringify({verdict:report.verdict,officialCommit:report.officialCommit,auditCommit:report.auditCommit,sourceComparison,results:results.map(r=>({file:r.file,...r.summary})),worker:{sourceEqual:worker.sourceEqual,...worker.summary,boundaries:worker.boundaries}},null,2));
}
function main(){
 if(process.argv.includes('--self-test'))return selfTest();
 if(process.argv[2]==='--restantes')return remaining(process.argv[3],process.argv[4]);
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
module.exports={inspect,inspectWorker,coverageVerdict};
