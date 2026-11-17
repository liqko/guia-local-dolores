#!/usr/bin/env node
'use strict';
/* GPS de código: grafo AST reproducible. Enlaces inferidos = candidatos, nunca ejecución comprobada. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),ts=require('typescript');
const ROOT=process.env.GLD_GPS_ROOT?path.resolve(process.env.GLD_GPS_ROOT):path.resolve(__dirname,'..');
const OUTPUT='auditorias/transversal/MAPA_GPS_GENERADO.json',SUMMARY='auditorias/transversal/MAPA_GPS_GENERADO.md';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const lit=n=>n&&(ts.isStringLiteralLike(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;
const nodeName=n=>!n?null:ts.isIdentifier(n)?n.text:ts.isPropertyAccessExpression(n)?n.name.text:ts.isElementAccessExpression(n)?lit(n.argumentExpression):null;
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const tracked=()=>cp.execFileSync('git',['ls-files','-z','--','worker','plataforma'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(p=>/^(worker|plataforma)\/.*\.(?:js|cjs|mjs|html|txt)$/i.test(p)&&fs.existsSync(path.join(ROOT,p))).sort();
function fragments(file,s){
 if(!/\.html$/i.test(file))return [{source:s,offset:0}];
 const list=[];let m;const re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
 while((m=re.exec(s)))if(!/\bsrc\s*=/.test(m[1]))list.push({source:m[2],offset:m.index+m[0].indexOf('>')+1});
 return list;
}
function scan(){
 const files=tracked(),hashes={},functions=[],calls=[],routes=[],events=[],imports=[],syntax=[],unresolved=[];
 let lines=0,scripts=0;
 const issue=(kind,at,expr)=>unresolved.push({kind,at,expression:String(expr||'').slice(0,140)});
 for(const file of files){
  const raw=read(file);hashes[file]=sha(raw);lines+=raw.split('\n').length;
  if(/\.html$/i.test(file)){
   for(const m of raw.matchAll(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/gi)){
    const src=m[2],target=path.posix.normalize(path.posix.join(path.posix.dirname(file),src.split(/[?#]/)[0]));
    const known=files.includes(target);imports.push({file,src,target,known});
    if(!known&&!/^https?:\/\//.test(src))issue('script_no_rastreado',file,src);
   }
   for(const m of raw.matchAll(/\bon(?:click|submit|change|input|load)\s*=\s*(['"])([\s\S]*?)\1/gi)){
    events.push({file,line:raw.slice(0,m.index).split('\n').length,kind:'html',handler:m[2].slice(0,140)});
   }
  }
  for(const frag of fragments(file,raw)){
   if(!frag.source.trim())continue;scripts++;
   const sf=ts.createSourceFile(file,frag.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
   const offset=raw.slice(0,frag.offset).split('\n').length-1;
   const loc=n=>file+':'+(offset+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1);
   const stack=[];
   function fn(n){
    if(ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n))return nodeName(n.name)||'constructor';
    if(ts.isFunctionExpression(n)||ts.isArrowFunction(n)){
     if(n.name)return n.name.text;
     const p=n.parent;
     if(ts.isVariableDeclaration(p)||ts.isPropertyAssignment(p))return nodeName(p.name);
     if(ts.isBinaryExpression(p))return p.left.getText(sf).slice(0,120);
     if(ts.isCallExpression(p))return 'callback@'+loc(n);
    }
    return null;
   }
   const isFn=n=>ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n);
   function walk(n){
    let opened=false;
    if(isFn(n)){
     const name=fn(n)||'anonymous@'+loc(n),id=loc(n)+':'+name;
     functions.push({id,name,file,line:Number(loc(n).split(':').pop()),parent:stack.at(-1)||null});
     stack.push(id);opened=true;
    }
    const from=stack.at(-1)||file+':<top-level>';
    if(ts.isCallExpression(n)||ts.isNewExpression(n)){
     const exp=n.expression,expr=exp.getText(sf).slice(0,160),method=nodeName(exp);
     const receiver=ts.isPropertyAccessExpression(exp)?exp.expression.getText(sf).slice(0,100):'';
     const args=n.arguments||[],arg0=lit(args[0]),at=loc(n);
     let effect=null;
     if(/^(?:db|cache|kv|storage|firestore|localStorage|sessionStorage|indexedDB|caches)\b/i.test(receiver))effect='almacenamiento';
     else if(/^(?:fetch|ghAdminRequest_|ghAdminRequestRaw143|api)$/.test(method||''))effect='red';
     else if(/^(?:env\.|DO|durable)/i.test(receiver))effect='servicio';
     calls.push({id:at+':'+calls.length,from,at,expr,method,receiver,arg0,effect,to:null,resolution:'pending'});
     if(method==='addEventListener')events.push({file,line:Number(at.split(':').pop()),kind:'listener',event:arg0,handler:args[1]?args[1].getText(sf).slice(0,140):''});
     if(['fetch','ghAdminRequest_','ghAdminRequestRaw143','api'].includes(method)&&!arg0)issue('ruta_dinamica',at,expr);
    }
    if(ts.isStringLiteralLike(n)&&(n.text==='/'||/^\/(?!\/)[A-Za-z0-9_/-]+(?:\?[^\s]*)?$/.test(n.text))&&n.text.length<220)routes.push({path:n.text,at:loc(n),owner:from});
    ts.forEachChild(n,walk);
    if(opened)stack.pop();
   }
   walk(sf);
   for(const diag of sf.parseDiagnostics){
    const p=sf.getLineAndCharacterOfPosition(diag.start||0);
    syntax.push({file,line:offset+p.line+1,message:ts.flattenDiagnosticMessageText(diag.messageText,' ').slice(0,130)});
    issue('sintaxis',file+':'+(offset+p.line+1),diag.code);
   }
  }
 }
 const names=new Map();
 for(const f of functions)names.set(f.name,(names.get(f.name)||[]).concat(f));
 for(const c of calls){
  const found=names.get(c.method)||[],own=found.filter(f=>f.file===c.at.slice(0,c.at.lastIndexOf(':')));
  if(own.length===1){c.to=own[0].id;c.resolution='candidate_local';}
  else if(!own.length&&found.length===1){c.to=found[0].id;c.resolution='candidate_global';}
  else if(found.length>1){c.resolution='ambiguous';c.candidates=found.length;issue('llamada_ambigua',c.at,c.expr);}
  else if(c.effect)c.resolution='external_effect';
  else if(!c.method||c.expr.includes('[')){c.resolution='dynamic';issue('llamada_dinamica',c.at,c.expr);}
  else c.resolution='external_or_unmapped';
 }
 const paths=new Map();for(const r of routes)paths.set(r.path,(paths.get(r.path)||[]).concat(r));
 const routeMap=[...paths.entries()].map(([url,refs])=>{
  const worker=refs.filter(x=>x.at.startsWith('worker/')),interfaces=refs.filter(x=>x.at.startsWith('plataforma/'));
  return {path:url,worker,interfaces,status:worker.length&&interfaces.length?'coincidencia_literal_no_probada':'sin_enlace_interfaz_worker'};
 }).sort((a,b)=>a.path.localeCompare(b.path));
 const stats={files:files.length,lines,scripts,functions:functions.length,calls:calls.length,candidates:calls.filter(c=>c.to).length,effects:calls.filter(c=>c.effect).length,routes:routeMap.length,sharedRoutes:routeMap.filter(x=>x.status==='coincidencia_literal_no_probada').length,events:events.length,unresolved:unresolved.length,syntax:syntax.length};
 return {schema:1,generator:'auditorias/generar-mapa-gps.cjs',hashes,stats,warning:'Todas las conexiones por nombre o ruta literal son candidatas, no pruebas de ejecución. Unresolved no equivale a ruta cubierta.',functions,calls,routeMap,events,imports,syntax,unresolved};
}
function summary(r){
 const s=r.stats;
 const lines=['# GPS de rutas — automático','','**ANÁLISIS NO CERTIFICADO.** Los enlaces son candidatos; no acreditan pruebas funcionales.','',
 'Fuentes: '+s.files+'; líneas: '+s.lines+'; scripts: '+s.scripts+'.',
 'Funciones: '+s.functions+'; llamadas: '+s.calls+'; enlaces candidatos: '+s.candidates+'.',
 'Rutas: '+s.routes+'; coincidencias entre Worker e interfaces: '+s.sharedRoutes+'.',
 'Eventos: '+s.events+'; operaciones externas: '+s.effects+'; incidencias no resueltas: '+s.unresolved+'; errores de sintaxis: '+s.syntax+'.',
 '','## Rutas encontradas','','| Ruta | Worker | Interfaz | Clasificación |','|---|---:|---:|---|'];
 for(const x of r.routeMap)lines.push('| '+x.path.replace(/\|/g,'/')+' | '+x.worker.length+' | '+x.interfaces.length+' | '+x.status+' |');
 lines.push('','## Primeras 100 conexiones sin resolver','','| Tipo | Ubicación | Expresión |','|---|---|---|');
 for(const x of r.unresolved.slice(0,100))lines.push('| '+x.kind+' | '+x.at+' | '+x.expression.replace(/\|/g,'/')+' |');
 lines.push('','El archivo JSON conserva el grafo completo y todas las incidencias sin resolver.');
 return lines.join('\n')+'\n';
}
function render(r){return [[OUTPUT,JSON.stringify(r,null,2)+'\n'],[SUMMARY,summary(r)]];}
function write(r){for(const [p,data] of render(r)){const dest=path.join(ROOT,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);}}
function main(){
 const mode=process.argv[2]||'--write',r=scan();
 if(mode==='--test'){
  if(!r.stats.files||!r.stats.functions||!r.stats.calls||Object.keys(r.hashes).length!==r.stats.files)throw Error('Cobertura incompleta en prueba');
  if(r.calls.some(c=>c.resolution==='pending'))throw Error('Llamada sin clasificar');
  console.log('GPS TEST PASS '+JSON.stringify(r.stats));
 }else if(mode==='--write'){write(r);console.log('GPS WRITTEN '+JSON.stringify(r.stats));}
 else if(mode==='--check'){
  for(const [p,data] of render(r))if(!fs.existsSync(path.join(ROOT,p))||fs.readFileSync(path.join(ROOT,p),'utf8')!==data)throw Error('Mapa ausente u obsoleto: '+p);
  console.log('GPS CHECK PASS '+JSON.stringify(r.stats));
 }else throw Error('Modo desconocido: '+mode);
}
if(require.main===module)try{main();}catch(e){console.error('GPS FAIL: '+e.stack);process.exitCode=1;}
module.exports={scan,summary};
