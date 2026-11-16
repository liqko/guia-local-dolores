#!/usr/bin/env node
'use strict';
// Árbol estático reproducible: interfaz → manejador → funciones → red/Worker → datos.
// Un enlace candidato no demuestra ejecución, persistencia ni éxito funcional.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),ts=require('typescript');
const ROOT=process.env.GLD_GPS_ROOT?path.resolve(process.env.GLD_GPS_ROOT):path.resolve(__dirname,'..');
const OUT='auditorias/transversal/ARBOL_ACCIONES.json',MD='auditorias/transversal/ARBOL_ACCIONES.md';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const literal=n=>n&&(ts.isStringLiteralLike(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;
const files=()=>cp.execFileSync('git',['ls-files','-z','--','worker','plataforma'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(p=>/^(worker|plataforma)\/.*\.(?:js|cjs|mjs|html|txt)$/.test(p)&&fs.existsSync(path.join(ROOT,p))).sort();
const name=n=>n&&ts.isIdentifier(n)?n.text:n&&ts.isPropertyAccessExpression(n)?n.name.text:null;
const methodOf=n=>ts.isCallExpression(n)?name(n.expression):null;
function parts(file,raw){
 if(!file.endsWith('.html'))return [{src:raw,off:0}];
 const out=[],re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
 while((m=re.exec(raw)))if(!/\bsrc\s*=/.test(m[1]))out.push({src:m[2],off:raw.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1});
 return out;
}
function scan(){
 const paths=files(),srcs=new Map(),allFns=[],allCalls=[],actions=[],endpoints=[],externalScripts=[],unresolved=[];
 const refs=new Map(),aliases=new Map(),routes=new Set(),symbolicRoutes=new Map();
 let astErrors=0;
 const point=(file,line)=>({file,line});
 for(const file of paths){
  const raw=fs.readFileSync(path.join(ROOT,file),'utf8');srcs.set(file,raw);
  if(file.endsWith('.html')){
   // Buttons and forms that declare handlers directly.
   const tags=/<(button|input|select|form|a)\b([^>]*?)>/gi;let t;
   while((t=tags.exec(raw))){
    const attr=t[2],event=/\bon(click|submit|change|input)\s*=\s*(['"])([\s\S]*?)\2/i.exec(attr);
    if(!event)continue;
    const id=/\bid\s*=\s*(['"])(.*?)\1/i.exec(attr);
    const label=/<button\b[^>]*>([\s\S]*?)<\/button>/i.exec(raw.slice(t.index));
    const line=raw.slice(0,t.index).split('\n').length;
    actions.push({id:sha(file+':'+line+':'+event[3]).slice(0,16),file,line,kind:'html_handler',
      element:t[1],elementId:id?.[2]||null,label:t[1]==='button'?label?.[1].replace(/<[^>]+>/g,'').trim().slice(0,80)||null:null,
      handler:event[3].slice(0,240),entry:null});
   }
   // Dynamic UI: onclick strings inside JS-generated markup. These are candidates, not guaranteed visible.
   const on=/\bon(click|submit|change)\s*=\s*(?:\\?['"])([\w$]+)\s*\(/g;let m;
   while((m=on.exec(raw))){
    const line=raw.slice(0,m.index).split('\n').length;
    if(actions.some(a=>a.line===line&&a.handler.includes(m[2])))continue;
    actions.push({id:sha(file+':'+line+':dynamic:'+m[2]).slice(0,16),file,line,kind:'generated_markup',
      element:'unknown',elementId:null,label:null,handler:m[2]+'(...)',entry:null});
   }
   for(const m of raw.matchAll(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/gi)){
    const url=m[2];let target;
    if(url.startsWith('/'))target=url.split(/[?#]/)[0].slice(1);
    else target=path.posix.normalize(path.posix.join(path.posix.dirname(file),url.split(/[?#]/)[0]));
    const matched=paths.includes(target);
    externalScripts.push({file,target,matched});
    if(!matched&&!/^https?:\/\//.test(url))unresolved.push({kind:'script_sin_fuente',file,line:raw.slice(0,m.index).split('\n').length,target});
   }
  }
  for(const frag of parts(file,raw)){
   if(!frag.src.trim())continue;
   const sf=ts.createSourceFile(file,frag.src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
   astErrors+=sf.parseDiagnostics.length;
   const line=n=>frag.off+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
   const fnStack=[];
   const sym=new Map();
   function functionName(n){
    if(n.name&&ts.isIdentifier(n.name))return n.name.text;
    const p=n.parent;
    if((ts.isVariableDeclaration(p)||ts.isPropertyAssignment(p)||ts.isPropertyDeclaration?.(p))&&ts.isIdentifier(p.name))return p.name.text;
    if(ts.isBinaryExpression(p))return p.left.getText(sf).slice(0,140);
    if(ts.isCallExpression(p))return 'callback@'+line(n);
    return 'anonymous@'+line(n);
   }
   function isFn(n){return ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n);}
   function staticValue(n){
    const l=literal(n);if(l!==null)return l;
    if(n&&ts.isIdentifier(n))return sym.get(n.text)||null;
    if(n&&ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken){
      const a=staticValue(n.left),b=staticValue(n.right);return a!==null&&b!==null?a+b:null;
    }
    if(n&&ts.isTemplateExpression(n)){
      let text=n.head.text;
      for(const span of n.templateSpans){const v=staticValue(span.expression);if(v===null)return null;text+=v+span.literal.text;}
      return text;
    }
    return null;
   }
   function visit(n){
    let entered=false;
    if(isFn(n)){
     const f={id:file+':'+line(n)+':'+functionName(n),file,line:line(n),name:functionName(n),
      parent:fnStack.at(-1)?.id||null,bodyStart:line(n.body||n),bodyEnd:frag.off+sf.getLineAndCharacterOfPosition(n.getEnd()).line+1};
     allFns.push(f);fnStack.push(f);entered=true;
    }
    if(ts.isPropertyAssignment(n)&&((ts.isIdentifier(n.name)&&n.name.text==='path')||literal(n.name)==='path')){
      const value=literal(n.initializer),owner=fnStack.at(-1)?.id;
      if(value&&owner){
        if(!symbolicRoutes.has(owner))symbolicRoutes.set(owner,new Set());
        symbolicRoutes.get(owner).add(value);
      }
    }
    if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)){
      const v=staticValue(n.initializer);if(v!==null)sym.set(n.name.text,v);
      if(v!==null){const k=file+':'+n.name.text,found=aliases.get(k)||[];found.push({value:v,line:line(n)});aliases.set(k,found);}
    }
    if(ts.isCallExpression(n)||ts.isNewExpression(n)){
     const target=n.expression,receiver=ts.isPropertyAccessExpression(target)?target.expression.getText(sf).slice(0,130):'';
     const method=name(target),args=n.arguments||[],arg0=args[0],first=staticValue(arg0),at=line(n);
     const expr=target.getText(sf).slice(0,180),owner=fnStack.at(-1)?.id||file+':<top-level>';
     const isFetch=(ts.isIdentifier(target)&&target.text==='fetch')||['ghAdminRequest_','ghAdminRequestRaw143','api'].includes(method);
     const dataOp=/^(get|put|set|add|patch|delete|list|query|commit|queryEqual|listCollection|setItem|removeItem)$/.test(method||'')&&/^(db|cache|kv|reader|storage|localStorage|sessionStorage|firestore)\b/.test(receiver);
     const call={id:file+':'+at+':'+allCalls.length,file,line:at,from:owner,method,receiver,expr,direct:ts.isIdentifier(target),
      arg:first,argExpr:arg0?.getText(sf).slice(0,160)||'',kind:isFetch?'http':dataOp?'data':'call',to:null,resolution:'pending'};
     allCalls.push(call);
     if(method==='addEventListener'&&args.length>=2){
      const h=args[1],handler=ts.isIdentifier(h)?h.text:ts.isArrowFunction(h)||ts.isFunctionExpression(h)?'callback@'+line(h):h.getText(sf).slice(0,130);
      actions.push({id:sha(file+':'+at+':listener').slice(0,16),file,line:at,kind:'listener',element:'dom',
        elementId:null,label:first||null,handler,entry:null});
     }
     if(isFetch){
      // Original expression retained: dynamic URLs must not be declared resolved.
      endpoints.push({callId:call.id,file,line:at,target:first,expression:call.argExpr,owner,
        status:first&&first.startsWith('/')?'static':'dynamic'});
     }
    }
    ts.forEachChild(n,visit);
    if(entered)fnStack.pop();
   }
   visit(sf);
  }
 }
 const byName=new Map(),byId=new Map(),byFile=new Map();
 for(const f of allFns){
  byId.set(f.id,f);const list=byName.get(f.name)||[];list.push(f);byName.set(f.name,list);
  const arr=byFile.get(f.file)||[];arr.push(f);byFile.set(f.file,arr);
 }
 const scriptDependencies=new Map();
 for(const s of externalScripts)if(s.matched){
   const a=scriptDependencies.get(s.file)||new Set();a.add(s.target);scriptDependencies.set(s.file,a);
 }
 const resolve=(name,file)=>{
  const candidates=byName.get(name)||[];
  const local=candidates.filter(f=>f.file===file&&f.parent===null);
  if(local.length===1)return {to:local[0].id,resolution:'static_file'};
  if(local.length>1)return {to:null,resolution:'ambiguous_local',candidates:local.length};
  const imported=scriptDependencies.get(file)||new Set();
  const shared=candidates.filter(f=>imported.has(f.file)&&f.parent===null);
  if(shared.length===1)return {to:shared[0].id,resolution:'static_import'};
  if(shared.length>1)return {to:null,resolution:'ambiguous_import',candidates:shared.length};
  return {to:null,resolution:candidates.length?'global_no_verificado':'unknown'};
 };
 for(const c of allCalls){
  if(c.kind!=='call'){c.resolution=c.kind==='http'?'external_http':'external_data';continue;}
  if(!c.method){c.resolution='computed';continue;}
  if(!c.direct&&!['window','globalThis'].includes(c.receiver)){
    c.resolution=c.receiver==='this'?'this_sin_analisis_de_clase':'external_method';continue;
  }
  // Only direct calls or global window calls may bind to a standalone function.
  // Searching every property method by name caused false cross-module paths.
  const candidates=byName.get(c.method)||[];
  let scope=c.from,lexical=null;
  while(scope&&!lexical){
    const matches=candidates.filter(f=>f.file===c.file&&f.parent===scope);
    if(matches.length===1)lexical={to:matches[0].id,resolution:'lexical_child'};
    else if(matches.length>1){lexical={to:null,resolution:'ambiguous_lexical'};break;}
    scope=byId.get(scope)?.parent||null;
  }
  Object.assign(c,lexical||resolve(c.method,c.file));
 }
 // Discover backend route conditions without mistaking string references for dispatches.
 const workerFiles=paths.filter(p=>p.startsWith('worker/'));
 const literalRoutes=[],regexRoutes=[];
 for(const file of workerFiles){
  const raw=srcs.get(file),lines=raw.split('\n');
  for(let i=0;i<lines.length;i++){
   const s=lines[i],match=[...s.matchAll(/['"](\/(?:superadmin|advertisers|login|api|public|guide|events|activities|territory|cities|countries|provinces)[^'"]*)['"]/g)];
   for(const m of match){if(m[1].length<180)literalRoutes.push({path:m[1],file,line:i+1});}
   for(const m of s.matchAll(/\/\^((?:\\\/|[^/])+?)\$?\//g)){
     try{const pattern=m[1].replace(/\\\//g,'/');regexRoutes.push({pattern,file,line:i+1});}catch(_){}
   }
  }
 }
 for(const ep of endpoints){
  const values=new Set();
  if(ep.target?.startsWith('/'))values.add(ep.target);
  // Resolve bounded alternatives of a selected configuration record, not a
  // made-up single outcome: e.g. spec.path selects country/province/city.
  if(!values.size&&/\.path\b/.test(ep.expression)){
    const prefix=ep.expression.match(/['"]([^'"]*\/(?:superadmin|api)\/?)['"]/);
    const choices=symbolicRoutes.get(ep.owner);
    if(prefix&&choices)for(const c of choices){
      if(c.startsWith('/')||c.includes('..'))continue;
      values.add(prefix[1]+c);
    }
  }
  ep.candidates=[...values].sort();
  if(!values.size){ep.status='dynamic_unresolved';continue;}
  ep.worker=[];
  for(const v of values){
    const direct=literalRoutes.filter(r=>r.path===v);
    const prefix=literalRoutes.filter(r=>v.startsWith(r.path+'/'));
    const regex=regexRoutes.filter(r=>{
      try{return new RegExp('^'+r.pattern+'
 const outCalls=new Map();
 for(const c of allCalls){const a=outCalls.get(c.from)||[];a.push(c);outCalls.set(c.from,a);}
 const httpById=new Map(endpoints.map(e=>[e.callId,e]));
 const trees=[];
 for(const action of actions){
  const match=/^\s*(?:return\s+)?(?:await\s+)?([\w$]+)/.exec(action.handler||'');
  const entry=match?.[1]||null;
  const resolved=entry?resolve(entry,action.file):{to:null,resolution:'handler_dinamico'};
  action.entry=resolved.to;action.resolution=resolved.resolution;
  const treeNodes=[],seen=new Set();
  const walk=(id,depth)=>{
    if(depth>26){treeNodes.push({type:'limit',from:id,reason:'depth_limit'});return;}
    if(seen.has(id)){treeNodes.push({type:'cycle',from:id});return;}
    seen.add(id);
    const fn=byId.get(id);if(!fn){treeNodes.push({type:'unresolved',from:id,reason:'missing_function'});return;}
    treeNodes.push({type:'function',id:fn.id,name:fn.name,file:fn.file,line:fn.line,depth});
    const calls=outCalls.get(id)||[];
    if(!calls.length)treeNodes.push({type:'terminal',from:id,reason:'sin_llamadas_detectadas',depth:depth+1});
    for(const c of calls){
      if(treeNodes.length>2400){treeNodes.push({type:'limit',from:id,reason:'node_limit'});break;}
      if(c.kind==='http'){
        const e=httpById.get(c.id);
        treeNodes.push({type:'http',from:id,file:c.file,line:c.line,target:e?.target||null,candidates:e?.candidates||[],routeStatus:e?.status||'unknown',worker:e?.worker||[],depth:depth+1});
        if(!e||!['backend_candidate','multi_backend_candidate'].includes(e.status))treeNodes.push({type:'unresolved',from:c.id,reason:'http_destino_no_demostrado'});
      }else if(c.kind==='data'){
        treeNodes.push({type:'data',from:id,file:c.file,line:c.line,operation:c.method,key:c.arg||c.argExpr,depth:depth+1});
      }else if(c.to){
        treeNodes.push({type:'edge',from:id,to:c.to,at:c.file+':'+c.line,resolution:c.resolution,depth:depth+1});
        walk(c.to,depth+2);
      }else if(['unknown','external_method'].includes(c.resolution)){
        // External standard DOM calls are expected; mark distinction from internal ambiguity.
        treeNodes.push({type:'external',from:id,method:c.method,at:c.file+':'+c.line,depth:depth+1});
      }else{
        treeNodes.push({type:'unresolved',from:id,reason:c.resolution,method:c.method,at:c.file+':'+c.line,depth:depth+1});
      }
    }
    seen.delete(id);
  };
  if(resolved.to)walk(resolved.to,0);
  else treeNodes.push({type:'unresolved',reason:resolved.resolution,handler:action.handler});
  const counts={functions:treeNodes.filter(x=>x.type==='function').length,
    http:treeNodes.filter(x=>x.type==='http').length,data:treeNodes.filter(x=>x.type==='data').length,
    unresolved:treeNodes.filter(x=>x.type==='unresolved').length,cycles:treeNodes.filter(x=>x.type==='cycle').length};
  trees.push({action,counts,nodes:treeNodes,status:counts.unresolved?'incompleto':'ramas_estaticas_identificadas_sin_prueba_funcional'});
 }
 const totals={files:paths.length,functions:allFns.length,calls:allCalls.length,buttons:actions.length,
  trees:trees.length,treesWithOpenBranches:trees.filter(t=>t.counts.unresolved).length,
  treesWithData:trees.filter(t=>t.counts.data).length,treesWithHttp:trees.filter(t=>t.counts.http).length,
  endpoints:endpoints.length,endpointsUnresolved:endpoints.filter(e=>!['backend_candidate','multi_backend_candidate'].includes(e.status)).length,astErrors};
 return {schema:1,sourceHashes:Object.fromEntries([...srcs.entries()].map(([p,s])=>[p,sha(s)])),totals,
  disclaimer:'Árbol estático: candidatos, no prueba de que el botón aparezca, se pulse, complete su función ni consume determinados recursos. Ramas pendientes explícitas.',
  trees,endpoints,unresolved};
}
function md(r){
 const t=r.totals,lines=['# Árbol automático de acciones','','**Resultado estático, NO prueba funcional.**','',
  'Archivos: '+t.files+'; botones/eventos detectados: '+t.buttons+'; árboles con ramas pendientes: '+t.treesWithOpenBranches+'.',
  'Funciones: '+t.functions+'; llamadas: '+t.calls+'; conexiones de red: '+t.endpoints+'; destinos de red pendientes: '+t.endpointsUnresolved+'.',
  '','## Árboles por acción','','| Interfaz y línea | Acción | Funciones | Datos | Red | Ramas pendientes |','|---|---|---:|---:|---:|---:|'];
 for(const a of r.trees){
  const e=a.action,c=a.counts;
  lines.push('| '+e.file+':'+e.line+' | '+(e.label||e.handler||'').replace(/[|\r\n]/g,' ').slice(0,65)+' | '+c.functions+' | '+c.data+' | '+c.http+' | '+c.unresolved+' |');
 }
 lines.push('','## Árbol de muestra: creación de territorio','','Se muestran solo ramas detectadas, no resultados de un test de navegador.','');
 const selected=r.trees.find(x=>/ghGuardarTerritorio/.test(x.action.handler||''))||r.trees.find(x=>/ciudad/i.test(x.action.handler||''));
 if(selected){
  lines.push('Acción: '+selected.action.file+':'+selected.action.line+' — '+selected.action.handler,'');
  for(const n of selected.nodes.slice(0,130)){
   const indent='  '.repeat(Math.min(n.depth||0,10));
   lines.push(indent+'- '+(n.type==='function'?n.name+' ('+n.file+':'+n.line+')':n.type==='data'?'DATOS '+n.operation+' '+n.key:n.type==='http'?'RED '+(n.target||'?')+' ['+n.routeStatus+']':n.type==='unresolved'?'PENDIENTE '+n.reason:n.type==='edge'?'↳ '+n.to:n.type+' '+(n.reason||'')));
  }
 }else lines.push('El generador no encontró un manejador de creación territorial; queda pendiente.');
 return lines.join('\n')+'\n';
}
function render(r){return [[OUT,JSON.stringify(r,null,2)+'\n'],[MD,md(r)]];}
function main(){
 const mode=process.argv[2]||'--write',r=scan();
 if(mode==='--write'){for(const [p,s] of render(r)){fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),s);}}
 else if(mode==='--check'){for(const [p,s] of render(r))if(!fs.existsSync(path.join(ROOT,p))||fs.readFileSync(path.join(ROOT,p),'utf8')!==s)throw Error('Árbol ausente u obsoleto: '+p);}
 else if(mode!=='--test')throw Error('Modo inválido');
 if(!r.totals.files||!r.totals.functions||!r.totals.calls)throw Error('Sin cobertura del código');
 console.log('ARBOL '+mode.toUpperCase()+' PASS '+JSON.stringify(r.totals));
}
if(require.main===module)try{main();}catch(e){console.error('ARBOL ERROR '+e.stack);process.exitCode=1;}
module.exports={scan,md};
).test(v);}catch(_){return false;}
    });
    for(const hit of [...direct,...regex,...prefix])ep.worker.push({...hit,target:v});
  }
  ep.worker=ep.worker.slice(0,30);
  ep.status=ep.worker.length?values.size>1?'multi_backend_candidate':'backend_candidate':'no_backend_match';
 }
 const outCalls=new Map();
 for(const c of allCalls){const a=outCalls.get(c.from)||[];a.push(c);outCalls.set(c.from,a);}
 const httpById=new Map(endpoints.map(e=>[e.callId,e]));
 const trees=[];
 for(const action of actions){
  const match=/^\s*(?:return\s+)?(?:await\s+)?([\w$]+)/.exec(action.handler||'');
  const entry=match?.[1]||null;
  const resolved=entry?resolve(entry,action.file):{to:null,resolution:'handler_dinamico'};
  action.entry=resolved.to;action.resolution=resolved.resolution;
  const treeNodes=[],seen=new Set();
  const walk=(id,depth)=>{
    if(depth>26){treeNodes.push({type:'limit',from:id,reason:'depth_limit'});return;}
    if(seen.has(id)){treeNodes.push({type:'cycle',from:id});return;}
    seen.add(id);
    const fn=byId.get(id);if(!fn){treeNodes.push({type:'unresolved',from:id,reason:'missing_function'});return;}
    treeNodes.push({type:'function',id:fn.id,name:fn.name,file:fn.file,line:fn.line,depth});
    const calls=outCalls.get(id)||[];
    if(!calls.length)treeNodes.push({type:'terminal',from:id,reason:'sin_llamadas_detectadas',depth:depth+1});
    for(const c of calls){
      if(treeNodes.length>2400){treeNodes.push({type:'limit',from:id,reason:'node_limit'});break;}
      if(c.kind==='http'){
        const e=httpById.get(c.id);
        treeNodes.push({type:'http',from:id,file:c.file,line:c.line,target:e?.target||null,routeStatus:e?.status||'unknown',worker:e?.worker||[],depth:depth+1});
        if(!e||!['literal_backend_candidate','prefix_backend_candidate'].includes(e.status))treeNodes.push({type:'unresolved',from:c.id,reason:'http_destino_no_demostrado'});
      }else if(c.kind==='data'){
        treeNodes.push({type:'data',from:id,file:c.file,line:c.line,operation:c.method,key:c.arg||c.argExpr,depth:depth+1});
      }else if(c.to){
        treeNodes.push({type:'edge',from:id,to:c.to,at:c.file+':'+c.line,resolution:c.resolution,depth:depth+1});
        walk(c.to,depth+2);
      }else if(['unknown','external_method'].includes(c.resolution)){
        // External standard DOM calls are expected; mark distinction from internal ambiguity.
        treeNodes.push({type:'external',from:id,method:c.method,at:c.file+':'+c.line,depth:depth+1});
      }else{
        treeNodes.push({type:'unresolved',from:id,reason:c.resolution,method:c.method,at:c.file+':'+c.line,depth:depth+1});
      }
    }
    seen.delete(id);
  };
  if(resolved.to)walk(resolved.to,0);
  else treeNodes.push({type:'unresolved',reason:resolved.resolution,handler:action.handler});
  const counts={functions:treeNodes.filter(x=>x.type==='function').length,
    http:treeNodes.filter(x=>x.type==='http').length,data:treeNodes.filter(x=>x.type==='data').length,
    unresolved:treeNodes.filter(x=>x.type==='unresolved').length,cycles:treeNodes.filter(x=>x.type==='cycle').length};
  trees.push({action,counts,nodes:treeNodes,status:counts.unresolved?'incompleto':'ramas_estaticas_identificadas_sin_prueba_funcional'});
 }
 const totals={files:paths.length,functions:allFns.length,calls:allCalls.length,buttons:actions.length,
  trees:trees.length,treesWithOpenBranches:trees.filter(t=>t.counts.unresolved).length,
  treesWithData:trees.filter(t=>t.counts.data).length,treesWithHttp:trees.filter(t=>t.counts.http).length,
  endpoints:endpoints.length,endpointsUnresolved:endpoints.filter(e=>!['literal_backend_candidate','prefix_backend_candidate'].includes(e.status)).length,astErrors};
 return {schema:1,sourceHashes:Object.fromEntries([...srcs.entries()].map(([p,s])=>[p,sha(s)])),totals,
  disclaimer:'Árbol estático: candidatos, no prueba de que el botón aparezca, se pulse, complete su función ni consume determinados recursos. Ramas pendientes explícitas.',
  trees,endpoints,unresolved};
}
function md(r){
 const t=r.totals,lines=['# Árbol automático de acciones','','**Resultado estático, NO prueba funcional.**','',
  'Archivos: '+t.files+'; botones/eventos detectados: '+t.buttons+'; árboles con ramas pendientes: '+t.treesWithOpenBranches+'.',
  'Funciones: '+t.functions+'; llamadas: '+t.calls+'; conexiones de red: '+t.endpoints+'; destinos de red pendientes: '+t.endpointsUnresolved+'.',
  '','## Árboles por acción','','| Interfaz y línea | Acción | Funciones | Datos | Red | Ramas pendientes |','|---|---|---:|---:|---:|---:|'];
 for(const a of r.trees){
  const e=a.action,c=a.counts;
  lines.push('| '+e.file+':'+e.line+' | '+(e.label||e.handler||'').replace(/[|\r\n]/g,' ').slice(0,65)+' | '+c.functions+' | '+c.data+' | '+c.http+' | '+c.unresolved+' |');
 }
 lines.push('','## Árbol de muestra: creación de territorio','','Se muestran solo ramas detectadas, no resultados de un test de navegador.','');
 const selected=r.trees.find(x=>/ghGuardarTerritorio/.test(x.action.handler||''))||r.trees.find(x=>/ciudad/i.test(x.action.handler||''));
 if(selected){
  lines.push('Acción: '+selected.action.file+':'+selected.action.line+' — '+selected.action.handler,'');
  for(const n of selected.nodes.slice(0,130)){
   const indent='  '.repeat(Math.min(n.depth||0,10));
   lines.push(indent+'- '+(n.type==='function'?n.name+' ('+n.file+':'+n.line+')':n.type==='data'?'DATOS '+n.operation+' '+n.key:n.type==='http'?'RED '+(n.target||'?')+' ['+n.routeStatus+']':n.type==='unresolved'?'PENDIENTE '+n.reason:n.type==='edge'?'↳ '+n.to:n.type+' '+(n.reason||'')));
  }
 }else lines.push('El generador no encontró un manejador de creación territorial; queda pendiente.');
 return lines.join('\n')+'\n';
}
function render(r){return [[OUT,JSON.stringify(r,null,2)+'\n'],[MD,md(r)]];}
function main(){
 const mode=process.argv[2]||'--write',r=scan();
 if(mode==='--write'){for(const [p,s] of render(r)){fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),s);}}
 else if(mode==='--check'){for(const [p,s] of render(r))if(!fs.existsSync(path.join(ROOT,p))||fs.readFileSync(path.join(ROOT,p),'utf8')!==s)throw Error('Árbol ausente u obsoleto: '+p);}
 else if(mode!=='--test')throw Error('Modo inválido');
 if(!r.totals.files||!r.totals.functions||!r.totals.calls)throw Error('Sin cobertura del código');
 console.log('ARBOL '+mode.toUpperCase()+' PASS '+JSON.stringify(r.totals));
}
if(require.main===module)try{main();}catch(e){console.error('ARBOL ERROR '+e.stack);process.exitCode=1;}
module.exports={scan,md};
