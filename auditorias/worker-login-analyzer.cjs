'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const esbuild = require('esbuild');
const source = 'worker/worker176_adicionales_valores.txt';
const text = fs.readFileSync(source, 'utf8');
const tmp = '/tmp/guialocal-worker176-audit.js';
fs.writeFileSync(tmp, text);
const baseOptions = {
  allowJs: true, checkJs: false, noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.None,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.webworker.d.ts'],
  skipLibCheck: true,
  noImplicitAny: false, strict: false,
  allowSyntheticDefaultImports: true
};
function runTS(checkJs) {
 const opts = {...baseOptions,checkJs};
 const program = ts.createProgram([tmp], opts);
 const all = ts.getPreEmitDiagnostics(program);
 return all.map(d => {
  const pos=d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : null;
  return {code:d.code,category:ts.DiagnosticCategory[d.category],line:pos?pos.line+1:null,col:pos?pos.character+1:null,
          message:ts.flattenDiagnosticMessageText(d.messageText,' ')};
 });
}
function grouped(diagnostics) {
 const m=new Map();
 for(const d of diagnostics) {const key=d.category+':TS'+d.code;let x=m.get(key);if(!x)m.set(key,x={code:d.code,category:d.category,count:0,exampleLines:[],example:''});x.count++;if(x.exampleLines.length<8)x.exampleLines.push(d.line);if(!x.example)x.example=d.message.slice(0,260);}
 return [...m.values()].sort((a,b)=>b.count-a.count||a.code-b.code);
}
async function go(){
 const output={generatedAt:new Date().toISOString(),source,bytes:Buffer.byteLength(text),lines:text.split('\n').length};
 output.syntax={};
 try {await esbuild.transform(text,{loader:'js',target:'es2022',format:'iife',logLevel:'silent'});output.syntax.esbuild='OK';}
 catch(e){output.syntax.esbuild=e.errors||String(e);}
 output.noCheckJs=runTS(false);
 output.checkJs=runTS(true);
 output.summary={
   noCheckJs:{count:output.noCheckJs.length,groups:grouped(output.noCheckJs)},
   checkJs:{count:output.checkJs.length,groups:grouped(output.checkJs)}
 };
 output.protected={
  posiciones:(text.match(/\\bposiciones\\b/g)||[]).length,
  excepcion_cupo:(text.match(/\\bexcepcion_cupo\\b/g)||[]).length,
  cache:(text.match(/\\bcache\\b/gi)||[]).length
 };
 fs.writeFileSync('worker-diagnostics.json',JSON.stringify(output,null,2));
 console.log('SOURCE',JSON.stringify({bytes:output.bytes,lines:output.lines,protected:output.protected}));
 console.log('ESBUILD',JSON.stringify(output.syntax));
 console.log('NO_CHECK_JS_COUNT',output.noCheckJs.length);
 console.log('CHECK_JS_COUNT',output.checkJs.length);
 console.log('CHECK_JS_GROUPS',JSON.stringify(output.summary.checkJs.groups));
 console.log('NO_CHECK_JS_GROUPS',JSON.stringify(output.summary.noCheckJs.groups));
 console.log('CHECK_JS_FIRST_60',JSON.stringify(output.checkJs.slice(0,60)));
 console.log('REPORT: worker-diagnostics.json');
}
go().catch(e=>{console.error(e);process.exitCode=1;});
