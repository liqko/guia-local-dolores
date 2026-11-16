#!/usr/bin/env node
'use strict';
// Árbol estático reproducible: interfaz → manejador → funciones → red/Worker → datos.
// Un enlace candidato no demuestra ejecución, persistencia ni éxito funcional.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),ts=require('typescript');
const {resolveExpression}=require('./resolver-expresiones.cjs');
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
 const paths=files(),srcs=new Map(),allFns=[],allCalls=[],actions=[],endpoints=[],externalScripts=[],unresolved=[],terminals=[];
 const refs=new Map(),aliases=new Map(),routes=new Set(),symbolicRoutes=new Map(),actionRoutes=new Map(),scopeDefinitions=new Map();
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
   const fnStack=[],guardStack=[];
   const sym=new Map();
   function functionName(n){
    if(n.name&&ts.isIdentifier(n.name))return n.name.text;
    const p=n.parent;
    if((ts.isVariableDeclaration(p)||ts.isPropertyAssignment(p)||ts.isPropertyDeclaration?.(p))&&ts.isIdentifier(p.name))return p.name.text;
    if(ts.isBinaryExpression(p))return p.left.getText(sf).slice(0,140);
    if(ts.isCallExpression(p))return 'callback@'+line(n);
    if(ts.isParenthesizedExpression(p)&&ts.isCallExpression(p.parent))return 'iife@'+line(n);
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
    if(ts.isIfStatement(n)){
      visit(n.expression);
      const guard=n.expression.getText(sf).slice(0,240);
      guardStack.push(guard);visit(n.thenStatement);guardStack.pop();
      if(n.elseStatement){guardStack.push('NOT ('+guard+')');visit(n.elseStatement);guardStack.pop();}
      return;
    }
    if(ts.isConditionalExpression(n)){
      visit(n.condition);
      const guard=n.condition.getText(sf).slice(0,240);
      guardStack.push(guard);visit(n.whenTrue);guardStack.pop();
      guardStack.push('NOT ('+guard+')');visit(n.whenFalse);guardStack.pop();
      return;
    }
    if(ts.isSwitchStatement(n)){
      visit(n.expression);
      const discriminant=n.expression.getText(sf).slice(0,160);
      for(const clause of n.caseBlock.clauses){
        const guard=ts.isCaseClause(clause)?discriminant+' === '+clause.expression.getText(sf):'default('+discriminant+')';
        guardStack.push(guard);for(const item of clause.statements)visit(item);guardStack.pop();
      }
      return;
    }
    if(ts.isReturnStatement(n)||ts.isThrowStatement(n)){
      terminals.push({from:fnStack.at(-1)?.id||file+':<top-level>',file,line:line(n),
        kind:ts.isReturnStatement(n)?'return':'throw',expression:n.expression?.getText(sf).slice(0,180)||'',
        guards:[...guardStack]});
    }
    let entered=false;
    if(isFn(n)){
     let objectOwner=null,ownerNode=n.parent;
     if(ts.isPropertyAssignment(ownerNode)||ts.isMethodDeclaration(ownerNode))ownerNode=ownerNode.parent;
     if(ts.isObjectLiteralExpression(ownerNode)){
       const declaration=ownerNode.parent;
       if(ts.isVariableDeclaration(declaration)&&ts.isIdentifier(declaration.name))objectOwner=declaration.name.text;
       else if(ts.isPropertyAssignment(declaration)&&ts.isIdentifier(declaration.name))objectOwner=declaration.name.text;
     }
     const f={id:file+':'+line(n)+':'+functionName(n),file,line:line(n),name:functionName(n),objectOwner,
      parent:fnStack.at(-1)?.id||null,params:(n.parameters||[]).map(p=>({
        name:p.name?.getText(sf)||null,defaultExpression:p.initializer?.getText(sf)||null
      })),bodyStart:line(n.body||n),bodyEnd:frag.off+sf.getLineAndCharacterOfPosition(n.getEnd()).line+1};
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
      const scope=fnStack.at(-1)?.id||file+':<top-level>';
      if(n.initializer){
        const arr=scopeDefinitions.get(scope)||[];
        arr.push({name:n.name.text,expression:n.initializer.getText(sf),line:line(n)});
        scopeDefinitions.set(scope,arr);
      }
      if(n.name.text==='routes'&&n.initializer&&ts.isObjectLiteralExpression(n.initializer)){
        const scope=fnStack.at(-1)?.id,table=new Map();
        for(const p of n.initializer.properties)if(ts.isPropertyAssignment(p)){
          const key=name(p.name)||literal(p.name);
          const value=staticValue(p.initializer);
          if(key&&value?.startsWith('/'))table.set(key,{path:value,partial:false});
          else if(key){
            const first=/['"`](\/[^'"`]*)['"`]/.exec(p.initializer.getText(sf));
            if(first)table.set(key,{path:first[1],partial:true});
          }
        }
        if(scope&&table.size)actionRoutes.set(scope,table);
      }
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
      arg:first,argExpr:arg0?.getText(sf).slice(0,160)||'',guards:[...guardStack],
      args:args.slice(0,8).map(x=>({value:staticValue(x),expression:x.getText(sf).slice(0,160)})),
      kind:isFetch?'http':dataOp?'data':'call',to:null,resolution:'pending'};
     allCalls.push(call);
     if(method==='addEventListener'&&args.length>=2){
      const h=args[1],handler=ts.isIdentifier(h)?h.text:ts.isArrowFunction(h)||ts.isFunctionExpression(h)?'callback@'+line(h):h.getText(sf).slice(0,130);
      const isCallback=ts.isArrowFunction(h)||ts.isFunctionExpression(h);
      const entryId=isCallback?file+':'+line(h)+':'+functionName(h):null;
      actions.push({id:sha(file+':'+at+':listener').slice(0,16),file,line:at,kind:'listener',element:'dom',
        elementId:null,label:first||null,handler,entry:null,entryId,context:owner});
     }
     if(isFetch){
      // Original expression retained: dynamic URLs must not be declared resolved.
      let verb=null;
      const options=args[1];
      if(method==='fetch'){
        if(!options)verb='GET';
        else if(ts.isObjectLiteralExpression(options)){
          verb='GET';
          for(const prop of options.properties)if(ts.isPropertyAssignment(prop)&&name(prop.name)==='method')
            verb=staticValue(prop.initializer);
        }
      }else if(['ghAdminRequest_','ghAdminRequestRaw143','api'].includes(method)){
        verb=args.length<3?'GET':staticValue(args[2]);
      }
      endpoints.push({callId:call.id,file,line:at,target:first,expression:call.argExpr,owner,requestKind:method,apiBase:sym.get('API')||null,verb,
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
 const scriptDependencies=new Map(),scriptHosts=new Map();
 for(const s of externalScripts)if(s.matched){
   const a=scriptDependencies.get(s.file)||new Set();a.add(s.target);scriptDependencies.set(s.file,a);
   const b=scriptHosts.get(s.target)||new Set();b.add(s.file);scriptHosts.set(s.target,b);
 }
 const resolve=(name,file)=>{
  const candidates=[...(byName.get(name)||[]),...(byName.get('window.'+name)||[]),...(byName.get('globalThis.'+name)||[])];
  const local=candidates.filter(f=>f.file===file&&f.parent===null);
  if(local.length===1)return {to:local[0].id,resolution:'static_file'};
  if(local.length>1)return {to:null,resolution:'ambiguous_local',candidates:local.length};
  const imported=scriptDependencies.get(file)||new Set();
  const shared=candidates.filter(f=>imported.has(f.file)&&f.parent===null);
  if(shared.length===1)return {to:shared[0].id,resolution:'static_import'};
  if(shared.length>1)return {to:null,resolution:'ambiguous_import',candidates:shared.length};
  // Shared global names on a host HTML page are concrete script dependencies.
  const hosts=scriptHosts.get(file)||new Set();
  if(hosts.size){
    const pool=new Set();
    for(const host of hosts){pool.add(host);for(const dep of scriptDependencies.get(host)||[])pool.add(dep);}
    const hosted=candidates.filter(f=>pool.has(f.file)&&f.parent===null);
    if(hosted.length===1)return {to:hosted[0].id,resolution:'static_host_page'};
    if(hosted.length>1)return {to:null,resolution:'ambiguous_host_page',candidates:hosted.length};
  }
  return {to:null,resolution:candidates.length?'global_no_verificado':'unknown'};
 };
 for(const c of allCalls){
  if(c.kind!=='call'){c.resolution=c.kind==='http'?'external_http':'external_data';continue;}
  if(!c.method){
    const nested=(byFile.get(c.file)||[]).filter(f=>f.line===c.line&&(f.name.startsWith('callback@')||f.name.startsWith('iife@')));
    if(nested.length===1){c.to=nested[0].id;c.resolution='immediate_callback';continue;}
    c.resolution='computed';continue;
  }
  if(!c.direct&&['window','globalThis'].includes(c.receiver)){
    const lookup=resolve(c.method,c.file);
    if(lookup.to){Object.assign(c,lookup);continue;}
    c.resolution='browser_global_or_dynamic';continue;
  }
  if(!c.direct){
    // Object literal methods are resolvable from their receiver's declaration.
    const matched=(byName.get(c.method)||[]).filter(f=>f.file===c.file&&f.objectOwner===c.receiver);
    if(matched.length===1){c.to=matched[0].id;c.resolution='static_object_method';continue;}
    if(matched.length>1){c.resolution='ambiguous_object_method';c.candidates=matched.map(f=>f.id);continue;}
    c.resolution=c.receiver==='this'?'this_sin_analisis_de_clase':'external_method';continue;
  }
  // Only direct calls or global window calls may bind to a standalone function.
  // Searching every property method by name caused false cross-module paths.
  const candidates=byName.get(c.method)||[];
  let scope=c.from,lexical=null;
  const visitedScopes=new Set();
  while(scope&&!lexical&&!visitedScopes.has(scope)){
    visitedScopes.add(scope);
    const matches=candidates.filter(f=>f.file===c.file&&f.parent===scope);
    if(matches.length===1)lexical={to:matches[0].id,resolution:'lexical_child'};
    else if(matches.length>1){lexical={to:null,resolution:'ambiguous_lexical'};break;}
    scope=byId.get(scope)?.parent||null;
  }
  Object.assign(c,lexical||resolve(c.method,c.file));
 }

 // Análisis interprocedimental acotado: reúne valores posibles de argumentos
 // y los propaga a parámetros sin ejecutar funciones ni elegir ramas.
 const possibleParams=new Map();
 for(const f of allFns){
   const slots=new Map();
   for(const p of f.params||[])if(p.name){
     const d=p.defaultExpression?resolveExpression(p.defaultExpression):null;
     slots.set(p.name,new Set(d?.values||[]));
   }
   possibleParams.set(f.id,slots);
 }
 const makeEnvironment=(ownerId,file,beforeLine)=>{
   const definitions={},ctx={};
   const global=scopeDefinitions.get(file+':<top-level>')||[];
   for(const def of global)if(def.line<=beforeLine)definitions[def.name]=def.expression;
   for(const [key,route] of actionRoutes.get(ownerId)||[])if(route.path&&!route.partial)
     definitions['routes.'+key]=JSON.stringify(route.path);
   let cur=ownerId;const visited=new Set();
   while(cur&&!visited.has(cur)){
     visited.add(cur);
     const fn=byId.get(cur);
     for(const def of scopeDefinitions.get(cur)||[])if(def.line<=beforeLine&&!(def.name in definitions))
       definitions[def.name]=def.expression;
     const slots=possibleParams.get(cur);
     for(const [param,values] of slots||[])if(values.size&&!(param in ctx))
       ctx[param]={values:[...values],complete:values.size<64,unknown:[]};
     cur=fn?.parent||null;
   }
   return {ctx,definitions};
 };
 const candidateFunction=c=>{
   if(c.to)return byId.get(c.to)||null;
   if(!c.direct||!c.method)return null;
   const candidates=(byName.get(c.method)||[]).filter(f=>f.file===c.file&&!f.parent);
   return candidates.length===1?candidates[0]:null;
 };
 for(let iteration=0;iteration<7;iteration++){
   let changed=false;
   for(const c of allCalls){
     const callee=candidateFunction(c);if(!callee)continue;
     const {ctx,definitions}=makeEnvironment(c.from,c.file,c.line);
     const slots=possibleParams.get(callee.id);
     for(let k=0;k<Math.min(8,callee.params.length,c.args.length);k++){
       const p=callee.params[k];if(!p.name)continue;
       const arg=c.args[k],v=resolveExpression(arg.expression,ctx,definitions);
       const dest=slots.get(p.name)||new Set();
       for(const value of v.values)if(dest.size<64&&!dest.has(value)){dest.add(value);changed=true;}
       slots.set(p.name,dest);
     }
   }
   if(!changed)break;
 }
 // Discover backend route conditions without mistaking string references for dispatches.
 const workerFiles=paths.filter(p=>p.startsWith('worker/'));
 const literalRoutes=[],regexRoutes=[];
 for(const file of workerFiles){
  const raw=srcs.get(file),lines=raw.split('\n');
  for(let i=0;i<lines.length;i++){
   const s=lines[i],match=/(?:\bpath\b|\.pathname)/.test(s)?[...s.matchAll(/['"](\/[^'"]*)['"]/g)]:[];
   const routeVerb=/(?:request2|request)\.method\s*===?\s*['"](GET|POST|PATCH|DELETE|PUT)['"]/.exec(s)?.[1]||null;
    const routeHandler=/\breturn\s+(?:await\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(s)?.[1]||null;
    for(const m of match)if(m[1].length<180)literalRoutes.push({path:m[1],file,line:i+1,verb:routeVerb,
      handler:/\bpath\s*===?\s*['"]/.test(s)?routeHandler:null});
   const p=s.indexOf('path.match(/');
   if(p>=0){
     const fragment=s.slice(p+'path.match(/'.length);
     const end=fragment.lastIndexOf('/)');
     if(end>=0)regexRoutes.push({pattern:fragment.slice(0,end).replace(/\\\//g,'/'),file,line:i+1});
   }
  }
 }
 for(const ep of endpoints){
  const values=new Set();
  const env=makeEnvironment(ep.owner,ep.file,ep.line);
  const symbolic=resolveExpression(ep.expression,env.ctx,env.definitions);
  for(const value of symbolic.values){
    if(value.startsWith('/'))values.add(value);
    else if(/^https?:\/\//.test(value))try{values.add(new URL(value).pathname);}catch(_){}
  }
  ep.symbolic={complete:symbolic.complete,unknown:symbolic.unknown.slice(0,24)};
  if(!symbolic.complete)ep.partiallyUnknown=true;
  if(ep.requestKind==='api'&&ep.target&&!ep.target.startsWith('/')){
    const f=allFns.find(x=>x.file===ep.file&&x.name==='api'&&!x.parent);
    const selected=f&&actionRoutes.get(f.id)?.get(ep.target);
    if(selected){
      const base=ep.apiBase;
      let prefix='/superadmin';
      if(base)try{prefix=new URL(base).pathname.replace(/\/$/,'');}catch(_){}
      values.add(prefix+selected.path);
      ep.actionResolution=selected.partial?'action_table_prefix':'action_table_literal';
      ep.actionPartial=selected.partial;
    }
  }
  if(ep.target?.startsWith('/'))values.add(ep.target);
  else if(typeof ep.target==='string'&&/^https?:\/\//.test(ep.target)){
    try{values.add(new URL(ep.target).pathname);}catch(_){}
  }
  // Wrapper calls are appended to the API base declared in the same source.
  if(ep.target?.startsWith('/')&&['ghAdminRequest_','ghAdminRequestRaw143'].includes(ep.requestKind)&&ep.apiBase){
    try{const u=new URL(ep.apiBase);values.clear();values.add(u.pathname.replace(/\/$/,'')+ep.target);}catch(_){}
  }
  // Resolve bounded alternatives of a selected configuration record, not a
  // made-up single outcome: e.g. spec.path selects country/province/city.
  if(/\.path\b/.test(ep.expression)){
    const prefix=ep.expression.match(/['"]([^'"]*\/(?:superadmin|api)\/?)['"]/);
    const choices=symbolicRoutes.get(ep.owner);
    if(prefix&&choices)for(const c of choices){
      if(c.startsWith('/')||c.includes('..'))continue;
      values.add(prefix[1]+c);
    }
  }
  // Recognize constant API paths inside concatenated expressions; only treat
  // the exact known segment as a candidate, never invent variable suffixes.
  if(!values.size&&ep.expression){
    const pathSegments=[...ep.expression.matchAll(/['"`](\/(?:superadmin|advertisers|api|public|events|activities|login|territory|countries|cities|provinces)[^'"`]*)['"`]/g)];
    for(const m of pathSegments){
      const v=m[1];if(v.length<180)values.add(v);
    }
  }
  ep.candidates=[...values].sort();
  ep.partial=(ep.target===null&&values.size>0&&!symbolic.complete)||ep.actionPartial===true;
  ep.requireDynamicRemainder=ep.actionPartial===true||ep.partial&&!(/['"`]([^'"`]+)['"`]\s*$/.test(ep.expression));
  if(!values.size){ep.status='dynamic_unresolved';continue;}
  ep.worker=[];
  for(const v of values){
    const direct=literalRoutes.filter(r=>r.path===v);
    const prefix=literalRoutes.filter(r=>v.startsWith(r.path+'/'));
    const regex=regexRoutes.filter(r=>{
      try{return new RegExp('^'+r.pattern+String.fromCharCode(36)).test(v);}catch(_){return false;}
    });
    for(const hit of [...direct,...regex,...prefix]){
      if(ep.verb&&hit.verb&&ep.verb!==hit.verb)continue;
      ep.worker.push({...hit,target:v});
    }
  }
  ep.worker=ep.worker.slice(0,30);
  ep.status=ep.worker.length?(ep.partial?'partial_backend_candidate':values.size>1?'multi_backend_candidate':'backend_candidate'):'no_backend_match';
 }
 const outCalls=new Map(),outTerminals=new Map();
 for(const c of allCalls){const a=outCalls.get(c.from)||[];a.push(c);outCalls.set(c.from,a);}
 for(const t of terminals){const a=outTerminals.get(t.from)||[];a.push(t);outTerminals.set(t.from,a);}
 const httpById=new Map(endpoints.map(e=>[e.callId,e]));
 const trees=[];
 for(const action of actions){
  const match=/^\s*(?:return\s+)?(?:await\s+)?([\w$]+)/.exec(action.handler||'');
  const entry=match?.[1]||null;
  let resolved=action.entryId?{to:action.entryId,resolution:'callback_directo'}:
    entry?resolve(entry,action.file):{to:null,resolution:'handler_dinamico'};
  if(!resolved.to&&action.kind==='listener'&&entry&&action.context){
    // Resolve nested callback variable where the event listener is declared.
    let scope=action.context;const visited=new Set();
    while(scope&&!visited.has(scope)){
      visited.add(scope);
      const found=(byName.get(entry)||[]).filter(f=>f.file===action.file&&f.parent===scope);
      if(found.length===1){resolved={to:found[0].id,resolution:'callback_lexico'};break;}
      scope=byId.get(scope)?.parent||null;
    }
  }
  action.entry=resolved.to;action.resolution=resolved.resolution;
  const treeNodes=[],seen=new Set();
  const walk=(id,depth)=>{
    if(depth>26){treeNodes.push({type:'limit',from:id,reason:'depth_limit'});return;}
    if(seen.has(id)){treeNodes.push({type:'cycle',from:id});return;}
    seen.add(id);
    const fn=byId.get(id);if(!fn){treeNodes.push({type:'unresolved',from:id,reason:'missing_function'});return;}
    treeNodes.push({type:'function',id:fn.id,name:fn.name,file:fn.file,line:fn.line,depth});
    const calls=outCalls.get(id)||[],ends=outTerminals.get(id)||[];
    for(const t of ends)treeNodes.push({type:t.kind,from:id,file:t.file,line:t.line,
      expression:t.expression,guards:t.guards,depth:depth+1});
    if(!calls.length&&!ends.length)treeNodes.push({type:'terminal',from:id,reason:'sin_llamadas_ni_retorno_explicito',depth:depth+1});
    for(const c of calls){
      treeNodes.push({type:'guarded_call',from:id,file:c.file,line:c.line,guards:c.guards,
        method:c.method,kind:c.kind,depth:depth+1});
      if(treeNodes.length>2400){treeNodes.push({type:'limit',from:id,reason:'node_limit'});break;}
      if(c.kind==='http'){
        const e=httpById.get(c.id);
        treeNodes.push({type:'http',from:id,file:c.file,line:c.line,target:e?.target||null,verb:e?.verb||null,candidates:e?.candidates||[],routeStatus:e?.status||'unknown',worker:e?.worker||[],depth:depth+1});
        const matched=e?.worker||[],handlers=[...new Set(matched.map(x=>x.handler).filter(Boolean))];
        for(const handler of handlers){
          const found=(byName.get(handler)||[]).filter(f=>f.file.startsWith('worker/')&&!f.parent);
          if(found.length!==1){treeNodes.push({type:'unresolved',from:c.id,reason:'backend_handler_ambiguo',handler});continue;}
          treeNodes.push({type:'backend_candidate',from:c.id,handler,at:found[0].file+':'+found[0].line,depth:depth+2});
          walk(found[0].id,depth+3);
        }
        if(!e||!matched.length)treeNodes.push({type:'unresolved',from:c.id,reason:'http_destino_no_demostrado'});
        else if(!handlers.length)treeNodes.push({type:'unresolved',from:c.id,reason:'backend_dispatch_sin_funcion_identificada'});
        if(e?.requireDynamicRemainder)treeNodes.push({type:'unresolved',from:c.id,reason:'sufijo_de_ruta_dinamico'});
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
  const scanInline=()=>{
    const raw=String(action.handler||'').replace(/\\'/g,"'");
    const sf=ts.createSourceFile('handler.js','function __handler(event){'+raw+'}',ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    if(sf.parseDiagnostics.length){
      treeNodes.push({type:'unresolved',reason:'handler_dinamico_no_analizable',handler:raw.slice(0,180)});
      return;
    }
    let found=0;
    const walkInline=n=>{
      if(ts.isCallExpression(n)){
        const target=n.expression;
        if(ts.isIdentifier(target)){
          found++;
          const resolved=resolve(target.text,action.file);
          const browserBuiltins=new Set(['alert','confirm','prompt','setTimeout','clearTimeout','setInterval','clearInterval','encodeURIComponent','decodeURIComponent','String','Number','Boolean','parseInt','parseFloat','isNaN','fetch']);
          if(resolved.to){
            treeNodes.push({type:'edge',from:action.id,to:resolved.to,resolution:'handler_inline',depth:0});
            walk(resolved.to,1);
          }else if(browserBuiltins.has(target.text)){
            treeNodes.push({type:'external',from:action.id,method:target.text,depth:0});
          }else{
            treeNodes.push({type:'missing_handler',from:action.id,method:target.text,
              file:action.file,line:action.line,reason:'sin_definicion_en_fuentes_rastreadas',depth:0});
          }
        }else if(ts.isPropertyAccessExpression(target)){
          found++;
          const method=target.name.text,receiver=target.expression.getText(sf);
          const builtins=['window','document','history','location','event','this','console','navigator','localStorage','sessionStorage','JSON','Date','Math','CSS','crypto','performance'];
          const options=(byName.get(method)||[]).filter(f=>f.objectOwner===receiver&&
            (f.file===action.file||[...(scriptDependencies.get(action.file)||[])].includes(f.file)));
          if(options.length===1){
            treeNodes.push({type:'edge',from:action.id,to:options[0].id,resolution:'handler_method_object',depth:0});
            walk(options[0].id,1);
          }else if(builtins.includes(receiver)||receiver.startsWith('document.')||receiver.startsWith('this.')||receiver.startsWith('event.')){
            treeNodes.push({type:'external',from:action.id,method:receiver+'.'+method,depth:0});
          }else{
            treeNodes.push({type:'external_object',from:action.id,method:receiver+'.'+method,
              note:'referencia_objeto_debe_comprobarse_en_runtime',depth:0});
          }
        }
      }
      ts.forEachChild(n,walkInline);
    };
    walkInline(sf);
    if(!found)treeNodes.push({type:'terminal',from:action.id,reason:'handler_sin_llamadas',depth:0});
  };
  if(resolved.to)walk(resolved.to,0);
  else scanInline();
  const counts={functions:treeNodes.filter(x=>x.type==='function').length,
    http:treeNodes.filter(x=>x.type==='http').length,data:treeNodes.filter(x=>x.type==='data').length,
    unresolved:treeNodes.filter(x=>x.type==='unresolved').length,
    missingHandlers:treeNodes.filter(x=>x.type==='missing_handler').length,
    externalObjects:treeNodes.filter(x=>x.type==='external_object').length,
    cycles:treeNodes.filter(x=>x.type==='cycle').length};
  trees.push({action,counts,nodes:treeNodes,status:counts.unresolved?'incompleto':counts.missingHandlers?'posible_manejador_ausente':'ramas_estaticas_identificadas_sin_prueba_funcional'});
 }
 const totals={files:paths.length,functions:allFns.length,calls:allCalls.length,buttons:actions.length,
  trees:trees.length,treesWithOpenBranches:trees.filter(t=>t.counts.unresolved).length,
  treesWithData:trees.filter(t=>t.counts.data).length,treesWithHttp:trees.filter(t=>t.counts.http).length,
  treesWithMissingHandlers:trees.filter(t=>t.counts.missingHandlers).length,
  endpoints:endpoints.length,endpointsUnresolved:endpoints.filter(e=>!['backend_candidate','multi_backend_candidate','partial_backend_candidate'].includes(e.status)).length,astErrors};
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
