'use strict';
const fs=require('node:fs');
const ts=require('typescript');
const esbuild=require('esbuild');
const vm=require('node:vm');
const originalPath='auditorias/worker177_base_snapshot.txt';
const fixedPath='auditorias/worker177_diagnosticos_corregidos.txt';
const original=fs.readFileSync(originalPath,'utf8');
const fixed=fs.readFileSync(fixedPath,'utf8');
const changes=[
 ['quota({ db, advertiserId, cupoFromAdmin, excludeId: id4 })','quota({ db, cache, advertiserId, cupoFromAdmin, excludeId: id4 })'],
 ['/** @param {any} admin */\nfunction gldValidarDescripcionFree167(descripcion,policy){','/** @param {any} descripcion @param {any} policy */\nfunction gldValidarDescripcionFree167(descripcion,policy){'],
 ['async function publicitySaveV4({db,cache,advertiserId,body,config={}}){','/** @param {{db: any, cache: any, advertiserId: any, body: any, config?: {excepcion_cupo?: boolean, posiciones?: number, [key: string]: any}}} options */\nasync function publicitySaveV4({db,cache,advertiserId,body,config={}}){'],
 ["advertiserId:aid,cupoFromAdmin:a=>cupo(a,'PROMOS'),excludeId:id});","advertiserId:aid,cache,cupoFromAdmin:a=>cupo(a,'PROMOS'),excludeId:id});"]
];
function exactPatches(){
 let simulated=original;
 for(const [from,to] of changes){
  if(simulated.split(from).length!==2)throw Error('Expected exactly one occurrence of patch source '+from);
  simulated=simulated.replace(from,to);
 }
 if(simulated!==fixed)throw Error('Unexpected differences beyond the four surgical patches');
 return true;
}
const flags={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
 moduleResolution:ts.ModuleResolutionKind.Node10,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.webworker.d.ts'],
 skipLibCheck:true,noImplicitAny:false,strict:false};
function diagnose(file,checkJs,extra={}){
 const prog=ts.createProgram([file],{...flags,checkJs,...extra});
 return ts.getPreEmitDiagnostics(prog).map(d=>{
  const pos=d.file&&d.start!=null?d.file.getLineAndCharacterOfPosition(d.start):null;
  return {code:d.code,category:ts.DiagnosticCategory[d.category],line:pos?pos.line+1:null,
   col:pos?pos.character+1:null,message:ts.flattenDiagnosticMessageText(d.messageText,' ')};
 });
}
function groups(diags){const map=new Map();for(const d of diags){const k=d.category+':TS'+d.code;
 const g=map.get(k)||{code:d.code,category:d.category,count:0,lines:[],sample:d.message};
 g.count++;if(g.lines.length<12)g.lines.push(d.line);map.set(k,g);}return [...map.values()].sort((a,b)=>b.count-a.count);}
function occurrences(s,phrase){return s.split(phrase).length-1;}
function lineStats(s){const code=s.replace(/\/\*[\s\S]*?\*\//g,'');return {chars:s.length,bytes:Buffer.byteLength(s),lines:s.split('\n').length,
 protected:{posiciones:occurrences(code,'posiciones'),excepcion_cupo:occurrences(code,'excepcion_cupo'),cache:occurrences(code,'cache')}};}
async function syntax(s){try{await esbuild.transform(s,{loader:'js',target:'es2022',format:'iife',logLevel:'silent'});return {ok:true};}
 catch(e){return {ok:false,errors:e.errors||String(e)};}}
function extractFunction(s,name){const src=ts.createSourceFile('worker.js',s,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
 let found;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name){found=s.slice(n.getStart(src),n.end);return;}ts.forEachChild(n,visit);}visit(src);
 if(!found)throw Error('Function not found '+name);return found;}
async function mockQuota(){
 const src=extractFunction(original,'quota');
 const calls={cacheReads:0,dbGets:0,dbQueries:0,dbWrites:0};
 const fakeCache={get:async()=>{calls.cacheReads++;return {reglas:{}};}};
 const db={get:async()=>{calls.dbGets++;return {funcionalidades_config:{PROMOS:{}}};},
 queryEqual:async()=>{calls.dbQueries++;return [{id:'one',pausado:false}]}};
 const ctx={gldFuncPacket166:async cache=>cache.get('config'),gldFuncRules166:()=>({activas_max:3}),gldValorParticular168:()=>6,cupoGuardado:n=>n*2,text29:x=>String(x||''),paused:x=>!!x.pausado};
 vm.runInNewContext(src+'\nthis.quotaTest=quota;',ctx);
 let missingCacheError='';
 try{await ctx.quotaTest({db,advertiserId:'sample',cupoFromAdmin:()=>3,excludeId:'other'});}
 catch(e){missingCacheError=String(e.message);}
 if(!missingCacheError.includes('get'))throw Error('Missing cache unexpectedly did not fail');
 calls.cacheReads=0;calls.dbGets=0;calls.dbQueries=0;
 const fixedCall=await ctx.quotaTest({db,cache:fakeCache,advertiserId:'sample',cupoFromAdmin:()=>3,excludeId:'other'});
 if(fixedCall.max!==3||fixedCall.active!==1||calls.cacheReads!==1||calls.dbGets!==1||calls.dbQueries!==1||calls.dbWrites!==0)throw Error('Mock quota regression failed');
 return {missingCacheError,fixedCall:{max:fixedCall.max,active:fixedCall.active},calls};
}
async function publicityRegression(){
 const source=extractFunction(original,'publicitySaveV4');
 const results=[];
 for(const [label,positions,exceptionAllowed,shouldReject] of [
  ['withinLimit',2,false,false],['overLimit',5,false,true],['exceptionAllowed',5,true,false]
 ]){
  const counts={packetReads:0,saveCalls:0,dbWrites:0};
  const packet={reglas:{PUBLICIDAD:{admite_excepciones:true,posiciones_max:3}}};
  const fakeCache={get:async()=>{counts.packetReads++;return packet;}};
  const db={};
  const ctx={gldFuncPacket166:async cache=>cache.get('func'),gldFuncRules166:p=>p.reglas.PUBLICIDAD,
   publicitySaveMonthlyV101:async args=>{counts.saveCalls++;return {success:true,positions:args.config.posiciones};},
   httpError:(msg,status)=>Object.assign(new Error(msg),{status})};
  vm.runInNewContext(source+'\\nthis.fn=publicitySaveV4;',ctx);
  let code=0,result;
  try{result=await ctx.fn({db,cache:fakeCache,advertiserId:'TEST',body:{},config:{posiciones:positions,excepcion_cupo:exceptionAllowed}});}
  catch(e){code=e.status||500;}
  if(shouldReject ? !(code===409&&counts.saveCalls===0):!(code===0&&counts.saveCalls===1&&result.success))throw Error('Publicidad regression failed '+label);
  if(counts.packetReads!==1||counts.dbWrites!==0)throw Error('Publicidad consumption regression failed '+label);
  results.push({label,expectedReject:shouldReject,actualStatus:code||200,counts});
 }
 return results;
}
async function main(){
 const report={source:{original:originalPath,fixed:fixedPath},exactFourPatches:exactPatches(),
  original:lineStats(original),fixed:lineStats(fixed),syntax:{original:await syntax(original),fixed:await syntax(fixed)}};
 report.diagnostics={};
 for(const [name,contents] of [['before',original],['after',fixed]]){
  const file='/tmp/gld-audit-'+name+'.js';fs.writeFileSync(file,contents);
  const check=diagnose(file,true),noCheck=diagnose(file,false);
  report.diagnostics[name]={checkJsCount:check.length,noCheckJsCount:noCheck.length,groups:groups(check),all:check};
 }
 report.additionalProfiles={};
 for(const [label,opts] of [
  ['noUnused',{noUnusedLocals:true,noUnusedParameters:true}],
  ['strict',{strict:true}],
  ['legacyTarget',{target:ts.ScriptTarget.ES5,lib:['lib.es5.d.ts','lib.dom.d.ts']}],
  ['noSkipLibCheck',{skipLibCheck:false}]
 ]){
  const f='/tmp/gld-audit-before.js';const diagnostics=diagnose(f,true,opts);
  report.additionalProfiles[label]={count:diagnostics.length,groups:groups(diagnostics),first20:diagnostics.slice(0,20)};
 }
 report.regression={quotaCache:await mockQuota(),publicity:await publicityRegression(),
   quotaCallsitesCorrect:fixed.includes('quota({ db, cache, advertiserId, cupoFromAdmin, excludeId: id4 })')&&fixed.includes("advertiserId:aid,cache,cupoFromAdmin:a=>cupo(a,'PROMOS'),excludeId:id});"),
   apiCodePreserved:report.exactFourPatches,
   protectedReferencesExpected:report.original.protected.posiciones===report.fixed.protected.posiciones&&report.original.protected.excepcion_cupo===report.fixed.protected.excepcion_cupo&&report.fixed.protected.cache===report.original.protected.cache+2
 };
 fs.writeFileSync('worker-diagnostics.json',JSON.stringify(report,null,2));
 for(const key of ['source','exactFourPatches','original','fixed','syntax','diagnostics','additionalProfiles','regression']){
  const val=key==='additionalProfiles'?Object.fromEntries(Object.entries(report.additionalProfiles).map(([k,v])=>[k,{count:v.count,groups:v.groups.slice(0,15),first20:v.first20.slice(0,5)}])):key==='diagnostics'?Object.fromEntries(Object.entries(report.diagnostics).map(([k,v])=>[k,{checkJsCount:v.checkJsCount,noCheckJsCount:v.noCheckJsCount,groups:v.groups,all:v.all}])):report[key];
  console.log(key.toUpperCase(),JSON.stringify(val));
 }
 if(!report.syntax.original.ok||!report.syntax.fixed.ok||report.diagnostics.after.checkJsCount||!report.regression.protectedReferencesExpected)throw Error('Audit gate failed');
}
main().catch(e=>{console.error('AUDIT_FAILURE',e.stack||String(e));process.exitCode=1;});
