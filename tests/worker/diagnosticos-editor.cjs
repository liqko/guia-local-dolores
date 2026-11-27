'use strict';
// Diagnósticos del editor JavaScript de Cloudflare (TypeScript checkJs) sobre el Worker completo.
// Uso: node tests/worker/diagnosticos-editor.cjs [worker] [--comparar worker_anterior]
// Sin --comparar falla ante cualquier diagnóstico. Con --comparar separa históricos y nuevos y falla sólo por los nuevos.
const ts=require('typescript'),fs=require('fs'),os=require('os'),path=require('path');
const args=process.argv.slice(2),i=args.indexOf('--comparar');
const anterior=i>=0?args[i+1]:null,actual=args.find((a,k)=>!a.startsWith('--')&&(i<0||k!==i+1))||'worker/worker206.txt';
function diagnosticos(src){
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'gld-worker-')),'worker.mjs');fs.copyFileSync(src,file);
 const program=ts.createProgram([file],{allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,skipLibCheck:true});
 const sf=program.getSourceFile(file),lines=sf.text.split('\n');
 return ts.getPreEmitDiagnostics(program).filter(d=>d.file===sf).map(d=>{const {line}=sf.getLineAndCharacterOfPosition(d.start);return {linea:line+1,codigo:'TS'+d.code,mensaje:ts.flattenDiagnosticMessageText(d.messageText,' '),texto:lines[line].trim()};});
}
const clave=d=>[d.codigo,d.mensaje,d.texto].join('\u0000');
const nuevos=diagnosticos(actual),previos=anterior?diagnosticos(anterior):[];
const disponibles=new Map();for(const d of previos)disponibles.set(clave(d),(disponibles.get(clave(d))||0)+1);
const historicos=[],introducidos=[];
for(const d of nuevos){const n=disponibles.get(clave(d))||0;if(n){disponibles.set(clave(d),n-1);historicos.push(d);}else introducidos.push(d);}
console.log(JSON.stringify({worker:actual,diagnosticos:nuevos.length,...(anterior?{comparado_con:anterior,diagnosticos_anterior:previos.length,historicos:historicos.length}:{}),nuevos:introducidos.length}));
for(const d of introducidos)console.error(`NUEVO ${d.codigo} línea ${d.linea}: ${d.mensaje}\n  ${d.texto.slice(0,160)}`);
for(const d of historicos)console.log(`HISTÓRICO ${d.codigo} línea ${d.linea}: ${d.mensaje.slice(0,160)}`);
if(introducidos.length)process.exit(1);
console.log('PASS Worker completo sin diagnósticos nuevos del editor');
