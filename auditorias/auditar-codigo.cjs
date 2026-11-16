#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),ts=require('typescript');
const ROOT=process.env.GLD_GPS_ROOT?path.resolve(process.env.GLD_GPS_ROOT):path.resolve(__dirname,'..');
const OUT='auditorias/transversal/AUDITORIA_AUTOMATICA.json',MD='auditorias/transversal/AUDITORIA_AUTOMATICA.md';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const files=()=>cp.execFileSync('git',['ls-files','-z','--','worker','plataforma'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(p=>/^(worker|plataforma)\/.*\.(?:js|cjs|mjs|html|txt)$/.test(p)&&fs.existsSync(path.join(ROOT,p))).sort();
const literal=n=>n&&(ts.isStringLiteralLike(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;
function fragments(file,raw){
 if(!file.endsWith('.html'))return [{src:raw,off:0}];
 const out=[],re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
 while((m=re.exec(raw)))if(!/\bsrc\s*=/.test(m[1]))out.push({src:m[2],off:raw.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1});
 return out;
}
function audit(){
 const sources=files(),issues=[],operations=[],defs=[],functions=[],requests=[],unresolved=[],sourceHashes={};
 const seen=new Set();
 function flag(rule,severity,evidence,reason,more={}){
  const id=sha(JSON.stringify([rule,evidence,reason])).slice(0,16);
  if(seen.has(id))return;seen.add(id);issues.push({id,rule,severity,evidence,reason,...more});
 }
 for(const file of sources){
  const raw=fs.readFileSync(path.join(ROOT,file),'utf8');sourceHashes[file]=sha(raw);
  for(const frag of fragments(file,raw)){
   const sf=ts.createSourceFile(file,frag.src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),stack=[];
   const loc=n=>({file,line:frag.off+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1});
   function fnName(n){
    if(n.name&&ts.isIdentifier(n.name))return n.name.text;
    const p=n.parent;
    if((ts.isVariableDeclaration(p)||ts.isPropertyAssignment(p))&&ts.isIdentifier(p.name))return p.name.text;
    if(ts.isBinaryExpression(p))return p.left.getText(sf).slice(0,120);
    return '<anon>';
   }
   function visit(n){
    const isFn=ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)||ts.isConstructorDeclaration(n);
    if(isFn){const name=fnName(n),at=loc(n);functions.push({name,...at,parent:stack.at(-1)||null});stack.push({name,...at});}
    if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)){
     const value=literal(n.initializer);if(value!==null)defs.push({name:n.name.text,value,...loc(n)});
    }
    if(ts.isCallExpression(n)||ts.isNewExpression(n)){
     const exp=n.expression,args=n.arguments||[],first=args[0],where=loc(n);
     const name=ts.isIdentifier(exp)?exp.text:ts.isPropertyAccessExpression(exp)?exp.name.text:null;
     const receiver=ts.isPropertyAccessExpression(exp)?exp.expression.getText(sf).slice(0,100):'';
     const parent=stack.at(-1);
     const op={...where,owner:parent?.name||'<global>',ownerLine:parent?.line||0,receiver,name,arg:literal(first),argExpr:first?.getText(sf).slice(0,140)||''};
     if(name&&/^(?:get|put|delete|list|patch|commit|query|listCollection|queryEqual|set|add|transaction|batch)$/.test(name)&&/^(?:cache|kv|db|reader|storage|firestore)\b/.test(receiver))
      operations.push({...op,operation:name});
     if((name==='fetch'&&ts.isIdentifier(exp))||['ghAdminRequest_','ghAdminRequestRaw143','api'].includes(name))
      requests.push({...op,requestKind:name,staticPath:literal(first)});
    }
    ts.forEachChild(n,visit);
    if(isFn)stack.pop();
   }
   visit(sf);
   for(const d of sf.parseDiagnostics)
    flag('sintaxis','alto',[{file,line:frag.off+sf.getLineAndCharacterOfPosition(d.start||0).line+1}],ts.flattenDiagnosticMessageText(d.messageText,' ').slice(0,140));
  }
 }
 const byName=new Map();
 for(const d of defs){if(!byName.has(d.name))byName.set(d.name,[]);byName.get(d.name).push(d);}
 for(const o of operations){
  if(o.arg!==null){o.key=o.arg;o.resolution='literal';}
  else if(/^[A-Za-z_$][\w$]*$/.test(o.argExpr)){
   const d=byName.get(o.argExpr)||[],local=d.filter(x=>x.file===o.file),vals=[...new Set((local.length?local:d).map(x=>x.value))];
   if(vals.length===1){o.key=vals[0];o.resolution='alias';}
   else {o.key=null;o.resolution='dinamico';}
  }else{o.key=null;o.resolution='dinamico';}
 }
 const writes=new Map(),reads=new Map(),catalogs={};
 for(const o of operations){
  if(o.key&&/territorio:|catalog|packet|index|admin:/.test(o.key)){
   if(!catalogs[o.key])catalogs[o.key]={readers:[],writers:[],deletes:[]};
   const v={file:o.file,line:o.line,owner:o.owner,operation:o.operation};
   if(['get','query','list'].includes(o.operation))catalogs[o.key].readers.push(v);
   else if(o.operation==='delete')catalogs[o.key].deletes.push(v);
   else catalogs[o.key].writers.push(v);
  }
  if(['put','set','patch','delete','commit'].includes(o.operation)){
   const id=o.file+':'+o.line;if(!writes.has(id))writes.set(id,[]);writes.get(id).push(o);
  }
  if(['get','query','list','listCollection'].includes(o.operation)&&o.key){
   const id=[o.file,o.owner,o.ownerLine,o.operation,o.key].join('|');
   if(!reads.has(id))reads.set(id,[]);reads.get(id).push(o);
  }
 }
 for(const ops of writes.values()){
  const keys=[...new Set(ops.map(o=>o.key).filter(Boolean))],related=keys.filter(x=>/territorio:|catalog|packet|public|admin/i.test(x));
  if(related.length>1)flag('escrituras_acopladas','alto',ops.map(o=>({file:o.file,line:o.line,operation:o.operation,key:o.key})),
    'Múltiples catálogos escritos en una misma sentencia: verificar redundancia y privacidad.',{keys:related});
  if(ops.length>1&&ops.some(o=>!o.key))unresolved.push({kind:'escritura_dinamica',file:ops[0].file,line:ops[0].line});
 }
 for(const ops of reads.values())if(new Set(ops.map(o=>o.line)).size>1)
  flag('lecturas_repetidas_candidatas','medio',ops.map(o=>({file:o.file,line:o.line,key:o.key})),
    'La misma función consulta más de una vez una clave: revisar condiciones, caché y coste.',{key:ops[0].key});
 const defsFn=new Map();
 for(const f of functions){
  if(f.name==='<anon>')continue;
  const id=[f.file,f.parent?.name||'<global>',f.name].join('|');
  if(!defsFn.has(id))defsFn.set(id,[]);defsFn.get(id).push(f);
 }
 for(const arr of defsFn.values())if(arr.length>1)
  flag('funciones_repetidas_candidatas','medio',arr.map(f=>({file:f.file,line:f.line,name:f.name})),
   'Nombre de función repetido en ámbito aparente: revisar reemplazos y versiones anteriores.');
 const worker=sources.filter(f=>f.startsWith('worker/')).map(f=>fs.readFileSync(path.join(ROOT,f),'utf8'));
 for(const r of requests.filter(x=>x.file.startsWith('plataforma/'))){
  if(!r.staticPath){unresolved.push({kind:'ruta_dinamica',file:r.file,line:r.line,expression:r.argExpr});continue;}
  if(r.staticPath.startsWith('/')&&!worker.some(s=>s.includes(r.staticPath)))
   flag('ruta_sin_coincidencia_literal','medio',[{file:r.file,line:r.line,path:r.staticPath}],
    'Ruta de interfaz sin coincidencia textual exacta en el Worker; requiere resolución dinámica.');
 }
 issues.sort((a,b)=>({alto:0,medio:1,bajo:2}[a.severity]-{alto:0,medio:1,bajo:2}[b.severity])||a.rule.localeCompare(b.rule)||a.id.localeCompare(b.id));
 const counts={files:sources.length,functions:functions.length,requests:requests.length,operations:operations.length,issues:issues.length,
  high:issues.filter(x=>x.severity==='alto').length,catalogs:Object.keys(catalogs).length,unresolved:unresolved.length};
 return {schema:1,generatedBy:'auditorias/auditar-codigo.cjs',warning:'Hallazgos candidatos, no fallos confirmados ni consumo facturado.',sourceHashes,counts,issues,catalogs,unresolved};
}
function markdown(r){
 const c=r.counts,lines=['# Auditoría transversal automática','','**Hallazgos candidatos, no reparaciones comprobadas.**','',
  'Archivos: '+c.files+'; funciones: '+c.functions+'; llamadas de red: '+c.requests+'; operaciones: '+c.operations+'.',
  'Hallazgos: '+c.issues+'; prioridad alta: '+c.high+'; catálogos: '+c.catalogs+'; conexiones por resolver: '+c.unresolved+'.','','## Hallazgos','','| Regla | Prioridad | Ubicaciones |','|---|---|---|'];
 for(const i of r.issues.slice(0,200))lines.push('| '+i.rule+' | '+i.severity+' | '+i.evidence.map(e=>e.file+':'+e.line).join(', ').replace(/\|/g,'/')+' |');
 lines.push('','## Catálogos y consumidores','','| Catálogo | Lecturas | Escrituras |','|---|---:|---:|');
 for(const [k,v] of Object.entries(r.catalogs).sort(([a],[b])=>a.localeCompare(b)))lines.push('| '+k+' | '+v.readers.length+' | '+v.writers.length+' |');
 return lines.join('\n')+'\n';
}
function render(r){return [[OUT,JSON.stringify(r,null,2)+'\n'],[MD,markdown(r)]];}
function main(){
 const mode=process.argv[2]||'--write',r=audit();
 if(mode==='--write'){for(const [p,s] of render(r)){fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),s);}}
 else if(mode==='--check'){for(const [p,s] of render(r))if(!fs.existsSync(path.join(ROOT,p))||fs.readFileSync(path.join(ROOT,p),'utf8')!==s)throw Error('Informe ausente u obsoleto: '+p);}
 else if(mode!=='--test')throw Error('Modo desconocido');
 if(!r.counts.files||!r.counts.functions||!r.counts.operations)throw Error('Análisis incompleto');
 console.log('AUDITOR PASS '+JSON.stringify(r.counts));
}
if(require.main===module)try{main();}catch(e){console.error('AUDITOR FAIL '+e.stack);process.exitCode=1;}
module.exports={audit,markdown};
