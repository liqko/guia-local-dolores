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
 const paths=files(),srcs=new Map(),allFns=[],allCalls=[],actions=[],endpoints=[],externalScripts=[],unresolved=[],terminals=[],dispatchRules=[];
 const refs=new Map(),aliases=new Map(),routes=new Set(),symbolicRoutes=new Map(),actionRoutes=new Map(),scopeDefinitions=new Map(),exportAliases=[],regexRoutes=[],regexBindings=new Map(),iifeExports=new Map(),promiseResolverExports=[];
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
   // Posición AST única: varias funciones pueden comenzar en la misma línea.
   const functionId=n=>file+':'+line(n)+':'+n.getStart(sf)+':'+functionName(n);
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
      if(file.startsWith('worker/')){
        const cond=n.expression.getText(sf),scope=fnStack.at(-1)?.id||file+':<top-level>';
        for(const [key,routeLine] of regexBindings){
          if(!key.startsWith(scope+'|'))continue;
          const variable=key.slice(scope.length+1);
          const mentioned=new RegExp('\\b'+variable+'\\b').test(cond);
          const negated=new RegExp('!\\s*'+variable+'\\b').test(cond);
          if(!mentioned||negated)continue;
          const targets=regexRoutes.filter(x=>x.file===file&&x.line===routeLine);
          const calls=new Set();let returned=false;
          const inspect=x=>{
            if(ts.isCallExpression(x)&&ts.isIdentifier(x.expression))calls.add(x.expression.text);
            if(ts.isReturnStatement(x)||ts.isThrowStatement(x))returned=true;
            ts.forEachChild(x,inspect);
          };
          inspect(n.thenStatement);
          for(const target of targets){
            target.handlers=[...new Set([...(target.handlers||[]),...calls])];
            target.inlineTerminal ||=returned;
            target.guard=cond.slice(0,240);
          }
        }
        const condition=n.expression.getText(sf);
        const routePattern=/(?:\bpath\b|\.pathname)\s*===?\s*['"]([^'"]+)['"]/g;
        const routeMatches=[...condition.matchAll(routePattern)].map(m=>m[1]).filter(x=>x.startsWith('/'));
        const verbMatch=/(?:request2|request)\.method\s*===?\s*['"](GET|POST|PATCH|DELETE|PUT)['"]/.exec(condition);
        if(routeMatches.length){
          const callees=new Set();let inlineResponse=false;
          const collect=x=>{
            if(ts.isCallExpression(x)&&ts.isIdentifier(x.expression))callees.add(x.expression.text);
            if(ts.isReturnStatement(x)||ts.isThrowStatement(x))inlineResponse=true;
            ts.forEachChild(x,collect);
          };
          collect(n.thenStatement);
          for(const route of routeMatches)dispatchRules.push({path:route,verb:verbMatch?.[1]||null,
            file,line:line(n),callNames:[...callees],inlineResponse,guard:condition.slice(0,240)});
        }
      }
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
     const f={id:functionId(n),file,line:line(n),name:functionName(n),objectOwner,
      promiseExecutor:ts.isNewExpression(n.parent)&&n.parent.expression.getText(sf)==='Promise',
      methodByBody:!!n.body&&/method\s*:\s*body\s*\?\s*['"]POST['"]\s*:\s*['"]GET['"]/.test(n.body.getText(sf)),
      parent:fnStack.at(-1)?.id||null,params:(n.parameters||[]).map(p=>{
        const destructured=ts.isObjectBindingPattern(p.name);
        return {name:destructured?null:p.name?.getText(sf)||null,
          members:destructured?p.name.elements.map(e=>({
            name:e.name.getText(sf),property:e.propertyName?.getText(sf)||e.name.getText(sf)
          })):[],
          defaultExpression:p.initializer?.getText(sf)||null};
      }),bodyStart:line(n.body||n),bodyEnd:frag.off+sf.getLineAndCharacterOfPosition(n.getEnd()).line+1};
     allFns.push(f);fnStack.push(f);entered=true;
    }
    if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&
       ts.isIdentifier(n.left)&&ts.isCallExpression(n.right)&&
       file.startsWith('worker/')&&n.right.expression.getText(sf)==='path.match'&&
       n.right.arguments?.length&&ts.isRegularExpressionLiteral(n.right.arguments[0])){
      const scope=fnStack.at(-1)?.id||file+':<top-level>';
      regexBindings.set(scope+'|'+n.left.text,line(n.right));
    }
    if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&
      ts.isPropertyAccessExpression(n.left)&&n.left.expression.getText(sf)==='window'){
      const alias=n.left.name.text;
      let target=null;
      if(ts.isPropertyAccessExpression(n.right)&&n.right.expression.getText(sf)==='window')
        target=n.right.name.text;
      else if(ts.isIdentifier(n.right))target=n.right.text;
      if(target)exportAliases.push({file,alias,target,line:line(n),scope:fnStack.at(-1)?.id||null});
      const executing=fnStack.at(-1);
      if(target&&executing?.promiseExecutor&&executing.params.some(p=>p.name===target))
        promiseResolverExports.push({file,alias,target,line:line(n)});
    }
    if(ts.isPropertyAssignment(n)&&((ts.isIdentifier(n.name)&&n.name.text==='path')||literal(n.name)==='path')){
      const value=literal(n.initializer),owner=fnStack.at(-1)?.id;
      if(value&&owner){
        if(!symbolicRoutes.has(owner))symbolicRoutes.set(owner,new Set());
        symbolicRoutes.get(owner).add(value);
      }
    }
    if(ts.isVariableDeclaration(n)&&ts.isObjectBindingPattern(n.name)&&n.initializer){
      const initializer=n.initializer,callee=ts.isCallExpression(initializer)?
        (ts.isParenthesizedExpression(initializer.expression)?initializer.expression.expression:initializer.expression):null;
      if(callee&&isFn(callee)){
        for(const element of n.name.elements){
          const local=element.name.getText(sf),exportedName=element.propertyName?.getText(sf)||local;
          const matches=[];
          const find=x=>{
            if(ts.isFunctionDeclaration(x)&&x.name?.text===exportedName)matches.push(x);
            ts.forEachChild(x,find);
          };
          find(callee.body);
          if(matches.length===1)iifeExports.set(file+'|'+local,{
            to:functionId(matches[0]),file,line:line(element),exportedName});
        }
      }
    }
    if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)){
      const scope=fnStack.at(-1)?.id||file+':<top-level>';
      const init=n.initializer;
      if(file.startsWith('worker/')&&init&&ts.isCallExpression(init)&&
         init.expression.getText(sf)==='path.match'&&init.arguments?.length&&
         ts.isRegularExpressionLiteral(init.arguments[0]))
        regexBindings.set(scope+'|'+n.name.text,line(init));
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
     if(file.startsWith('worker/')&&method==='match'&&receiver==='path'&&
        arg0&&ts.isRegularExpressionLiteral(arg0)){
       const code=arg0.getText(sf),end=code.lastIndexOf('/');
       if(end>0)regexRoutes.push({pattern:code.slice(1,end),flags:code.slice(end+1),file,line:at});
     }
     const isFetch=(ts.isIdentifier(target)&&target.text==='fetch')||['ghAdminRequest_','ghAdminRequestRaw143','api'].includes(method);
     const dataOp=/^(get|put|set|add|patch|delete|list|query|commit|queryEqual|listCollection|setItem|removeItem)$/.test(method||'')&&/^(db|cache|kv|reader|storage|localStorage|sessionStorage|firestore)\b/.test(receiver);
     const invoked=ts.isParenthesizedExpression(target)?target.expression:target;
     const immediateId=isFn(invoked)?functionId(invoked):null;
     const call={id:file+':'+at+':'+allCalls.length,file,line:at,from:owner,method,receiver,expr,direct:ts.isIdentifier(target),immediateId,
      arg:first,argExpr:arg0?.getText(sf).slice(0,160)||'',guards:[...guardStack],
      args:args.slice(0,8).map(x=>({
        value:staticValue(x),expression:x.getText(sf).slice(0,200),
        objectProps:ts.isObjectLiteralExpression(x)?x.properties.flatMap(p=>{
          if(!ts.isPropertyAssignment(p)&&!ts.isShorthandPropertyAssignment(p))return [];
          const property=name(p.name)||literal(p.name),value=ts.isPropertyAssignment(p)?p.initializer:p.name;
          return [{property,expression:value.getText(sf).slice(0,180),
            callbackId:(ts.isArrowFunction(value)||ts.isFunctionExpression(value))?
              functionId(value):null}];
        }):null
      })),
      kind:isFetch?'http':dataOp?'data':'call',to:null,resolution:'pending'};
     allCalls.push(call);
     if(method==='addEventListener'&&args.length>=2){
      const h=args[1],handler=ts.isIdentifier(h)?h.text:ts.isArrowFunction(h)||ts.isFunctionExpression(h)?'callback@'+line(h):h.getText(sf).slice(0,130);
      const isCallback=ts.isArrowFunction(h)||ts.isFunctionExpression(h);
      const entryId=isCallback?functionId(h):null;
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
        if(method==='api'&&options&&ts.isObjectLiteralExpression(options)){
          for(const prop of options.properties)if(ts.isPropertyAssignment(prop)&&name(prop.name)==='method')
            verb=staticValue(prop.initializer);
        }
      }
      endpoints.push({callId:call.id,file,line:at,target:first,expression:call.argExpr,owner,requestKind:method,apiBase:sym.get('API')||null,verb,
        payloadObject:!!options&&ts.isObjectLiteralExpression(options),
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
 const resolve=(name,file,seenAliases=new Set())=>{
  const iifeAlias=iifeExports.get(file+'|'+name);
  if(iifeAlias)return {to:iifeAlias.to,resolution:'destructured_iife_export',source:{file:iifeAlias.file,line:iifeAlias.line}};
  const candidates=[...(byName.get(name)||[]),...(byName.get('window.'+name)||[]),...(byName.get('globalThis.'+name)||[])];
  const local=candidates.filter(f=>f.file===file&&f.parent===null);
  if(local.length===1)return {to:local[0].id,resolution:'static_file'};
  if(local.length>1)return {to:null,resolution:'ambiguous_local',candidates:local.length};
  const imported=scriptDependencies.get(file)||new Set();
  const shared=candidates.filter(f=>imported.has(f.file)&&f.parent===null);
  if(shared.length===1)return {to:shared[0].id,resolution:'static_import'};
  const exported=candidates.filter(f=>(f.name==='window.'+name||f.name==='globalThis.'+name)&&
    (f.file===file||imported.has(f.file)));
  if(exported.length===1)return {to:exported[0].id,resolution:'explicit_window_export'};
  // A function deliberately assigned to window is callable after its enclosing
  // initializer runs. Preserve this as a conditional edge, NOT a proven runtime call.
  const hostsForExport=scriptHosts.get(file)||new Set();
  const visibleExports=new Set([file,...imported]);
  for(const host of hostsForExport){visibleExports.add(host);for(const dep of scriptDependencies.get(host)||[])visibleExports.add(dep);}
  const assignedExports=candidates.filter(f=>(f.name==='window.'+name||f.name==='globalThis.'+name)&&visibleExports.has(f.file));
  if(assignedExports.length===1)return {to:assignedExports[0].id,resolution:'conditional_global_assignment'};
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
  const visible=new Set([file,...imported]);
  for(const h of hosts){visible.add(h);for(const src of scriptDependencies.get(h)||[])visible.add(src);}
  const matchingAliases=exportAliases.filter(a=>a.alias===name&&visible.has(a.file));
  if(matchingAliases.length===1&&!seenAliases.has(name)){
    const exportedAlias=matchingAliases[0];
    const direct=(byName.get(exportedAlias.target)||[]).filter(f=>
      f.file===exportedAlias.file&&f.parent===exportedAlias.scope);
    if(direct.length===1)return {to:direct[0].id,resolution:'exported_nested_window_function',
      source:{file:exportedAlias.file,line:exportedAlias.line}};
    const further=new Set(seenAliases);further.add(name);
    const next=resolve(matchingAliases[0].target,file,further);
    if(next.to)return {...next,resolution:'explicit_window_alias'};
  }
  return {to:null,resolution:candidates.length?'global_no_verificado':'unknown'};
 };
 const callbackTargets=new Map();
 for(const call of allCalls){
   if(!call.direct||!call.method)continue;
   const fns=(byName.get(call.method)||[]).filter(f=>f.file===call.file&&!f.parent);
   if(fns.length!==1)continue;
   const callee=fns[0];
   for(let p=0;p<(callee.params||[]).length;p++){
     const param=callee.params[p],props=call.args?.[p]?.objectProps||[];
     for(const member of param.members||[]){
       const matches=props.filter(x=>x.property===member.property);
       for(const property of matches){
         let id=property.callbackId;
         if(!id&&/^[\w$]+$/.test(property.expression)){
           const matches=(byName.get(property.expression)||[]).filter(f=>f.file===call.file);
           if(matches.length===1)id=matches[0].id;
         }
         if(!id||!byId.has(id))continue;
         const key=callee.id+'|'+member.name,a=callbackTargets.get(key)||new Set();
         a.add(id);callbackTargets.set(key,a);
       }
     }
   }
 }
 for(const c of allCalls){
  if(c.kind!=='call'){c.resolution=c.kind==='http'?'external_http':'external_data';continue;}
  if(!c.method){
    if(c.immediateId&&byId.has(c.immediateId)){c.to=c.immediateId;c.resolution='immediate_callback_ast';continue;}
    const nested=(byFile.get(c.file)||[]).filter(f=>f.line===c.line&&(f.name.startsWith('callback@')||f.name.startsWith('iife@')));
    if(nested.length===1){c.to=nested[0].id;c.resolution='immediate_callback';continue;}
    c.resolution='computed';continue;
  }
  if(c.direct){
    const ownerFn=byId.get(c.from);
    const isParam=(ownerFn?.params||[]).some(p=>(p.members||[]).some(m=>m.name===c.method));
    if(isParam){
      const refs=[...(callbackTargets.get(c.from+'|'+c.method)||[])];
      if(refs.length===1){c.to=refs[0];c.resolution='destructured_parameter_callback';continue;}
      if(refs.length>1){c.alternatives=refs;c.resolution='destructured_callback_alternatives';continue;}
      c.resolution='callback_parameter_unbounded';continue;
    }
  }
  if(!c.direct&&['window','globalThis'].includes(c.receiver)){
    const hosts=scriptHosts.get(c.file)||new Set();
    const exportedResolvers=promiseResolverExports.filter(p=>p.alias===c.method&&
      (p.file===c.file||hosts.has(p.file)));
    if(exportedResolvers.length===1){c.resolution='promise_resolver_export';c.promiseSource=exportedResolvers[0];continue;}
    const native=new Set(['open','scrollTo','confirm','prompt','alert','addEventListener','removeEventListener',
      'matchMedia','dispatchEvent','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout',
      'setInterval','clearInterval','postMessage','focus','print','fetch','getComputedStyle']);
    if(native.has(c.method)){c.resolution='browser_native';continue;}
    const lookup=resolve(c.method,c.file);
    if(lookup.to){Object.assign(c,lookup);continue;}
    c.resolution='window_function_not_in_sources';continue;
  }
  if(!c.direct&&['apply','call'].includes(c.method)&&/^[\w$]+$/.test(c.receiver)){
    const lookup=resolve(c.receiver,c.file);
    if(lookup.to){c.to=lookup.to;c.resolution='call_apply_function';continue;}
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
   // Global variables declared by the HTML that imports this script are visible
   // to it at runtime. Include those declarations, but never guess a host.
   const hosts=scriptHosts.get(file)||new Set();
   if(hosts.size===1){
     const host=[...hosts][0];
     for(const def of scopeDefinitions.get(host+':<top-level>')||[])
       if(!(def.name in definitions))definitions[def.name]=def.expression;
   }
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
 for(const rule of dispatchRules){
   const valid=rule.callNames.filter(n=>(byName.get(n)||[]).some(f=>f.file===rule.file&&!f.parent)||iifeExports.has(rule.file+'|'+n));
   rule.handlers=[...new Set(valid)];
   rule.inlineTerminal=rule.inlineResponse&&!valid.length;
   delete rule.callNames;
 }
 const literalRoutes=[];
 for(const file of workerFiles){
  const raw=srcs.get(file),lines=raw.split('\n');
  for(let i=0;i<lines.length;i++){
   const s=lines[i],match=/(?:\bpath\b|\.pathname)/.test(s)?[...s.matchAll(/['"](\/[^'"]*)['"]/g)]:[];
   const routeVerb=/(?:request2|request)\.method\s*===?\s*['"](GET|POST|PATCH|DELETE|PUT)['"]/.exec(s)?.[1]||null;
    const routeHandler=/\breturn\s+(?:await\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(s)?.[1]||null;
    for(const m of match)if(m[1].length<180)literalRoutes.push({path:m[1],file,line:i+1,verb:routeVerb,
      handler:/\bpath\s*===?\s*['"]/.test(s)?routeHandler:null});
   // Worker regular expressions are extracted from syntax nodes above.
  }
 }
 for(const ep of endpoints){
  // Infer method from the wrapper's actual source expression, not from its name.
  if(ep.requestKind==='api'){
    const helpers=allFns.filter(fn=>fn.file===ep.file&&fn.name==='api'&&fn.methodByBody);
    if(helpers.length===1)ep.verb=ep.payloadObject?'POST':'GET';
  }
  const values=new Set();
  const env=makeEnvironment(ep.owner,ep.file,ep.line);
  if(!ep.apiBase&&['ghAdminRequest_','ghAdminRequestRaw143'].includes(ep.requestKind)){
    const globalBase=resolveExpression('API',env.ctx,env.definitions);
    if(globalBase.complete&&globalBase.values.length===1)ep.apiBase=globalBase.values[0];
    // A script-level API origin can be outside the function's lexical environment.
    if(!ep.apiBase){
      const declaration=/\b(?:const|let|var)\s+API\s*=\s*(['"])(https?:\/\/[^'"\s]+)\1/.exec(srcs.get(ep.file)||'');
      if(declaration)ep.apiBase=declaration[2];
    }
  }
  const symbolic=resolveExpression(ep.expression,env.ctx,env.definitions);
  for(const value of symbolic.values){
    if(value.startsWith('/'))values.add(value);
    else if(/^https?:\/\//.test(value))try{values.add(new URL(value).pathname);}catch(_){}
  }
  ep.symbolic={complete:symbolic.complete,unknown:symbolic.unknown.slice(0,24)};
  if(!symbolic.complete)ep.partiallyUnknown=true;
  // Reconstruct alternatives of a common fetch wrapper using its real callers.
  const wrapper=byId.get(ep.owner);
  let callersComplete=false;
  if(ep.requestKind==='fetch'&&wrapper?.params?.some(p=>p.name==='path')&&
      /\bpath\b/.test(ep.expression)&&wrapper.name!=='<anon>'){
    const callers=allCalls.filter(c=>c.file===ep.file&&c.method===wrapper.name&&
      c.from!==ep.owner&&c.direct);
    if(callers.length){
      callersComplete=true;
      const argIndex=wrapper.params.findIndex(p=>p.name==='path');
      for(const caller of callers){
        const argument=caller.args?.[argIndex];
        const ctx=makeEnvironment(caller.from,caller.file,caller.line);
        const passed=argument?.expression?
          resolveExpression(argument.expression,ctx.ctx,ctx.definitions):
          {values:[],complete:false};
        if(!passed.complete||!passed.values.length)callersComplete=false;
        for(const pathValue of passed.values){
          const parsed=resolveExpression(ep.expression,{...env.ctx,path:pathValue},env.definitions);
          if(!parsed.complete||!parsed.values.length)callersComplete=false;
          for(const v of parsed.values){
            if(v.startsWith('/'))values.add(v);
            else if(/^https?:\/\//.test(v))try{values.add(new URL(v).pathname);}catch(_){}
          }
        }
      }
      ep.callerEvidence={wrapper:wrapper.name,count:callers.length,
        complete:callersComplete,resolvedValues:values.size};
    }
  }
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
  // Administrative helpers receive paths relative to the explicit /superadmin
  // API origin. Apply that base to EVERY derived alternative, not just literals.
  if(['ghAdminRequest_','ghAdminRequestRaw143'].includes(ep.requestKind)&&ep.apiBase){
    try{
      const basePath=new URL(ep.apiBase).pathname.replace(/\/$/,'');
      if(basePath&&basePath!=='/'){
        const prefixed=[...values].map(v=>v.startsWith(basePath+'/')?v:v.startsWith('/')?basePath+v:v);
        values.clear();for(const v of prefixed)values.add(v);
        ep.wrapperBaseEvidence={base:ep.apiBase,pathPrefix:basePath};
      }
    }catch(_){}
  }
  // Query strings and fragments do not participate in matching the Worker path.
  const matchPaths=new Set([...values].map(v=>v.startsWith('/')?v.split(/[?#]/)[0]:v));
  ep.candidates=[...matchPaths].sort();
  ep.queryTemplates=[...values].filter(v=>v.includes('?')).slice(0,16);
  ep.partial=(ep.target===null&&values.size>0&&!symbolic.complete&&!callersComplete)||ep.actionPartial===true;
  ep.requireDynamicRemainder=ep.actionPartial===true||ep.partial&&!(/['"`]([^'"`]+)['"`]\s*$/.test(ep.expression));
  // External services: cite the source function or the environment key.
  if(ep.file.startsWith('worker/')&&/\bbase\s*\(\s*env\s*\)/.test(ep.expression)){
    const code=srcs.get(ep.file)||'';
    const defined=/function\s+base\s*\(\s*env\s*\)\s*\{[\s\S]{0,260}?return\s+[\x60'"](https?:\/\/[^\x60'"]+)/.exec(code);
    if(defined){
      ep.status='external_service_http';
      ep.externalHosts=[new URL(defined[1]).host];
      ep.externalUrlTemplate=defined[1];
      ep.runtimeFields=['env.FIREBASE_PROJECT_ID'];
      ep.externalEvidence='worker_base_function';
      continue;
    }
  }
  if(ep.file.startsWith('worker/')&&ep.expression.trim()==='url'){
    const fields=(scopeDefinitions.get(ep.owner)||[])
      .filter(d=>d.name==='url'&&d.line<=ep.line)
      .map(d=>/\benv\.([A-Z][A-Z0-9_]*_URL)\b/.exec(d.expression)?.[1])
      .filter(Boolean);
    if(fields.length===1){
      ep.status='external_configured_service';
      ep.externalConfiguration='env.'+fields[0];
      ep.externalEvidence='worker_scope_variable';
      ep.runtimeHostUnverified=true;
      continue;
    }
  }
  if(ep.file.startsWith('worker/')&&[ep.target,...symbolic.values].some(v=>typeof v==='string'&&/^https?:\/\//.test(v))){
    ep.status='external_service_http';
    ep.externalHosts=[...new Set([ep.target,...symbolic.values].filter(v=>typeof v==='string'&&/^https?:\/\//.test(v)).map(v=>{
      try{return new URL(v).host;}catch(_){return 'dynamic_host';}
    }))];
    continue;
  }
  if(!values.size&&/\b(?:sw|descubrir-sw)\.js$/.test(ep.file)&&ep.expression==='request'){
    ep.status='browser_forwarded_request';continue;
  }
  if(!values.size){ep.status='dynamic_unresolved';continue;}
  ep.worker=[];
  for(const v of matchPaths){
    const direct=literalRoutes.filter(r=>r.path===v);
    const prefix=literalRoutes.filter(r=>v.startsWith(r.path+'/'));
    const analyzed=dispatchRules.filter(r=>r.path===v&&(!ep.verb||!r.verb||ep.verb===r.verb));
    // A dynamic route has a known dispatch pattern even when the ID is unknown.
    // Substitute a sentinel ONLY for matching; never claim the ID was resolved.
    const candidateForRegex=v.replace(/:[A-Za-z_][\w$]*(?=\/|$)/g,'__AUDIT_UNKNOWN_ID__');
    // A trailing slash can be the known prefix of a dynamic final segment.
    // This validates a possible Worker dispatch, not the unknown ID.
    const candidateTest=ep.partial&&v.endsWith('/')?
      candidateForRegex+'__AUDIT_UNKNOWN_ID__':candidateForRegex;
    const regex=regexRoutes.filter(r=>{
      try{return new RegExp('^'+r.pattern+String.fromCharCode(36)).test(candidateTest);}catch(_){return false;}
    });
    if(candidateTest!==v)ep.partial=true;
    for(const hit of [...analyzed,...direct,...regex,...prefix]){
      if(ep.verb&&hit.verb&&ep.verb!==hit.verb)continue;
      ep.worker.push({...hit,target:v});
    }
  }
  ep.worker=ep.worker.slice(0,30);
  ep.status=ep.worker.length?(ep.partial?'partial_backend_candidate':matchPaths.size>1?'multi_backend_candidate':'backend_candidate'):'no_backend_match';
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
        const matched=e?.worker||[],handlers=[...new Set(matched.flatMap(x=>[...(x.handlers||[]),...(x.handler?[x.handler]:[])]))];
        for(const handler of handlers){
          const builtins=new Set(['decodeURIComponent','encodeURIComponent','parseInt','parseFloat',
            'isFinite','isNaN','String','Number','Boolean','BigInt','Array','Object','Date',
            'Error','TypeError','RangeError','Map','Set','WeakMap','WeakSet']);
          const topLevel=(byName.get(handler)||[]).filter(f=>f.file.startsWith('worker/')&&!f.parent);
          const aliasIds=[...new Set(matched.map(x=>iifeExports.get(x.file+'|'+handler)?.to).filter(Boolean))];
          const aliased=aliasIds.length===1?byId.get(aliasIds[0]):null;
          const found=topLevel.length?topLevel:aliased?[aliased]:[];
          if(!found.length&&builtins.has(handler)){treeNodes.push({type:'builtin_call',from:c.id,handler,depth:depth+2});continue;}
          if(found.length!==1){treeNodes.push({type:'unresolved',from:c.id,reason:'backend_handler_ambiguo',handler});continue;}
          treeNodes.push({type:'backend_candidate',from:c.id,handler,at:found[0].file+':'+found[0].line,depth:depth+2});
          walk(found[0].id,depth+3);
        }
        if(e&&['external_service_http','browser_forwarded_request'].includes(e.status)){
          treeNodes.push({type:'external_http',from:c.id,reason:e.status,hosts:e.externalHosts||[],depth:depth+2});
        }else if(!matched.length&&e?.status==='no_backend_match'&&
          e.symbolic?.complete&&e.candidates?.length&&!e.partial){
          treeNodes.push({type:'possible_missing_worker_route',from:c.id,file:c.file,line:c.line,
            candidates:e.candidates,reason:'sin_despacho_en_fuente_worker_analizada',depth:depth+2});
        }else if(!e||!matched.length)treeNodes.push({type:'unresolved',from:c.id,reason:'http_destino_no_demostrado'});
        else if(!handlers.length){
          if(matched.some(x=>x.inlineTerminal))treeNodes.push({type:'backend_inline_return',from:c.id,
            reason:'el_despachador_retorna_respuesta_sin_funcion_auxiliar'});
          else treeNodes.push({type:'unresolved',from:c.id,reason:'backend_dispatch_sin_funcion_identificada'});
        }
        if(e?.requireDynamicRemainder){
          const covered=e.candidates?.length&&e.candidates.every(v=>
            matched.some(w=>w.target===v&&w.pattern));
          if(covered)treeNodes.push({type:'route_parameter',from:c.id,
            unknownValue:true,matchedPatterns:matched.filter(w=>w.pattern).map(w=>({file:w.file,line:w.line,pattern:w.pattern})),
            reason:'ruta_parametrizada_con_despacho_identificado'});
          else treeNodes.push({type:'unresolved',from:c.id,reason:'sufijo_de_ruta_dinamico'});
        }
      }else if(c.kind==='data'){
        treeNodes.push({type:'data',from:id,file:c.file,line:c.line,operation:c.method,key:c.arg||c.argExpr,depth:depth+1});
      }else if(c.resolution==='promise_resolver_export'){
        treeNodes.push({type:'promise_resolved',from:id,file:c.file,line:c.line,
          exportedFrom:c.promiseSource,depth:depth+1});
      }else if(c.to){
        treeNodes.push({type:'edge',from:id,to:c.to,at:c.file+':'+c.line,resolution:c.resolution,depth:depth+1});
        walk(c.to,depth+2);
      }else if(c.alternatives?.length){
        for(const to of c.alternatives){
          treeNodes.push({type:'edge',from:id,to,at:c.file+':'+c.line,
            resolution:'callback_alternativa_segun_llamador',depth:depth+1});
          walk(to,depth+2);
        }
      }else if(['unknown','external_method','browser_native'].includes(c.resolution)){
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
    possibleMissingRoutes:treeNodes.filter(x=>x.type==='possible_missing_worker_route').length,
    externalObjects:treeNodes.filter(x=>x.type==='external_object').length,
    cycles:treeNodes.filter(x=>x.type==='cycle').length};
  trees.push({action,counts,nodes:treeNodes,status:counts.unresolved?'incompleto':counts.missingHandlers?'posible_manejador_ausente':'ramas_estaticas_identificadas_sin_prueba_funcional'});
 }
 const totals={files:paths.length,functions:allFns.length,calls:allCalls.length,buttons:actions.length,
  trees:trees.length,treesWithOpenBranches:trees.filter(t=>t.counts.unresolved).length,
  treesWithData:trees.filter(t=>t.counts.data).length,treesWithHttp:trees.filter(t=>t.counts.http).length,
  treesWithMissingHandlers:trees.filter(t=>t.counts.missingHandlers).length,
  treesWithPossibleMissingRoutes:trees.filter(t=>t.counts.possibleMissingRoutes).length,
  endpoints:endpoints.length,
  endpointsExternal:endpoints.filter(e=>e.status==='external_service_http').length,
  endpointsBrowserForwarded:endpoints.filter(e=>e.status==='browser_forwarded_request').length,
  endpointsUnresolved:endpoints.filter(e=>!['backend_candidate','multi_backend_candidate',
    'partial_backend_candidate','external_service_http','browser_forwarded_request'].includes(e.status)).length,
  astErrors};
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
 lines.push('','## Rutas sin despacho identificado en el Worker (posibles fallas)','','| Archivo y línea | Destino solicitado |','|---|---|');
 const failures=new Map();
 for(const tree of r.trees)for(const node of tree.nodes)if(node.type==='possible_missing_worker_route'){
   const k=node.file+':'+node.line;
   if(!failures.has(k))failures.set(k,node);
 }
 for(const n of failures.values())lines.push('| '+n.file+':'+n.line+' | '+n.candidates.join(', ').replace(/\\|/g,'/')+' |');
 lines.push('','## Botones con función ausente en las fuentes rastreadas','','| Archivo y línea | Función |','|---|---|');
 const missing=new Map();
 for(const tree of r.trees)for(const node of tree.nodes)if(node.type==='missing_handler'){
   const k=node.file+':'+node.line+':'+node.method;
   if(!missing.has(k))missing.set(k,node);
 }
 for(const n of missing.values())lines.push('| '+n.file+':'+n.line+' | '+n.method+' |');
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
