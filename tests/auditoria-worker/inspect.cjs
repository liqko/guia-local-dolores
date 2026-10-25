const path=require('node:path');
const auditDirectory=process.env.GLD_AUDIT_OUTPUT;
if(!auditDirectory)throw Error('Set GLD_AUDIT_OUTPUT to a temporary output directory');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const babel=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright/lib/transform/babelBundle.js'));
const source=fs.readFileSync(process.env.GLD_AUDIT_SOURCE||path.join(__dirname,'../../worker/base-observado136.mjs'),'utf8');
const ast=babel.babelParse(source,'worker.mjs');
const functions=[],insertions=[],scopes=new Map(),fallbacks=[];
babel.traverse(ast,{
 FunctionDeclaration(p){
  const n=p.node,name=n.id.name;
  functions.push({name,line:n.loc.start.line,scope:p.scope.parent.uid});
  const key=p.scope.parent.uid+':'+name;
  if(!scopes.has(key))scopes.set(key,[]);scopes.get(key).push(n.loc.start.line);
  insertions.push({pos:n.body.start+1,text:'globalThis.__workerAuditCalls.push('+JSON.stringify({name,line:n.loc.start.line})+');'});
 },
 ReturnStatement(p){const a=p.node.argument;if(a?.type==='CallExpression'&&a.callee.type==='Identifier'&&/^route(?:Public|Admin|Panel)V/.test(a.callee.name)){const parent=p.getFunctionParent();fallbacks.push({from:parent.node.id?.name,to:a.callee.name,line:p.node.loc.start.line});}}
});
let instrumented=source;
for(const i of insertions.sort((a,b)=>b.pos-a.pos))instrumented=instrumented.slice(0,i.pos)+i.text+instrumented.slice(i.pos);
fs.writeFileSync(path.join(auditDirectory,'guia-worker-instrumentado-20261025.mjs'),instrumented);
const inventory={sha256:crypto.createHash('sha256').update(source).digest('hex'),functionDeclarations:functions.length,sameScopeDuplicateNames:[...scopes].filter(([,v])=>v.length>1),families:Object.fromEntries(['Public','Panel','Admin'].map(kind=>[kind,functions.filter(f=>new RegExp('^route'+kind+'V').test(f.name))])),fallbacks};
fs.writeFileSync(path.join(auditDirectory,'worker-inventory-20261025.json'),JSON.stringify(inventory,null,2));
const packet={version:1,paises:[{pais_id:'AR',nombre:'Argentina',activo:true}],provincias:[{provincia_id:'P',pais_id:'AR',nombre:'Provincia',activo:true}],ciudades:[{ciudad_id:'A',pais_id:'AR',provincia_id:'P',ciudad_visible:'Ciudad A',activa:true},{ciudad_id:'B',pais_id:'AR',provincia_id:'P',ciudad_visible:'Ciudad B',activa:true}]};
const secret='only-local-audit-not-a-production-secret';
function token(role){const body=Buffer.from(JSON.stringify({sid:'local-fixture',rol:role,ciudades:['A'],permisos:{},persistent:true,sv:0})).toString('base64url');return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');}
async function scenario(worker,name,path,{role,missing=false,kvError=false,authorization}={}){
 const kvCalls=[],reports=[];
 const kv={async get(key){kvCalls.push({method:'get',key});if(kvError&&key.startsWith('territorio:'))throw Error('local injected KV failure');return !missing&&key.startsWith('territorio:')?JSON.stringify(packet):null;},async put(){throw Error('Unexpected write during read');},async delete(){throw Error('Unexpected delete during read');}};
 const env={GLD_CACHE_KV:kv,GLD_PUBLIC_CACHE:{idFromName(){throw Error("Unexpected DO access in territory audit");}},SERVER_SECRET:secret};
 globalThis.__workerAuditCalls=[];
 const priorLog=console.log,priorFetch=globalThis.fetch;
 console.log=x=>{try{reports.push(JSON.parse(x));}catch{}};
 globalThis.fetch=async()=>{throw Error('External network forbidden in audit');};
 let response,body;
 try{response=await worker.fetch(new Request('https://local.invalid'+path,{headers:authorization?{Authorization:authorization}:role?{Authorization:'Bearer '+token(role)}:{}}),env);body=await response.json();}finally{console.log=priorLog;globalThis.fetch=priorFetch;}
 const calls=globalThis.__workerAuditCalls;
 const counts={};for(const c of calls)counts[c.name]=(counts[c.name]||0)+1;
 const consumption=response.headers.get('X-GLD-Consumption');
 return {name,status:response.status,body,kvCalls,verifyAdminCalls:counts.verifyAdmin||0,hmacCalls:counts.hmac||0,counts,trace:calls.filter(c=>/^route|verifyAdmin|territory|saveCity|hmac$/.test(c.name)),consumption:consumption?JSON.parse(decodeURIComponent(consumption)):null,network:'blocked; local fixtures only'};
}
(async()=>{
 globalThis.__workerAuditCalls=[];
 const worker=(await import(pathToFileURL(path.join(auditDirectory,'guia-worker-instrumentado-20261025.mjs')))).default;
 const cases=[];
 for(const [name,path,options] of [
  ['public-catalog','/territory/public',{}],
  ['public-missing-catalog','/territory/public',{missing:true}],
  ['admin-principal-catalog','/superadmin/territory',{role:'SUPERADMIN_PRINCIPAL'}],
  ['admin-local-catalog','/superadmin/territory',{role:'ADMIN_LOCAL'}],
  ['admin-no-session','/superadmin/territory',{}],
  ['admin-invalid-session','/superadmin/territory',{authorization:'Bearer invalid.invalid'}],
  ['admin-missing-catalog','/superadmin/territory',{role:'SUPERADMIN_PRINCIPAL',missing:true}],
  ['admin-kv-failure','/superadmin/territory',{role:'SUPERADMIN_PRINCIPAL',kvError:true}]
 ])cases.push(await scenario(worker,name,path,options));
 fs.writeFileSync(path.join(auditDirectory,'worker-actions-20261025.json'),JSON.stringify({inventory,cases},null,2));
 console.log(JSON.stringify({inventory:{sha256:inventory.sha256,functions:inventory.functionDeclarations,sameScopeDuplicateNames:inventory.sameScopeDuplicateNames,families:Object.fromEntries(Object.entries(inventory.families).map(([k,v])=>[k,v.length]))},cases:cases.map(c=>({name:c.name,status:c.status,kvGet:c.kvCalls.length,verifyAdminCalls:c.verifyAdminCalls,hmacCalls:c.hmacCalls,cities:c.body.ciudades?.map(x=>x.ciudad_id),routes:c.trace.filter(x=>x.name.startsWith('route')).map(x=>x.name)}))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
