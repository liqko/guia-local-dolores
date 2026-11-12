// Revisión de JavaScript como lo interpreta el editor, sin copiar el Worker a otro archivo.
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const filename=path.resolve('worker/editor-virtual.js');
const text=fs.readFileSync('worker/worker190_roles_multiples_sobre_189.txt','utf8');
const options={allowJs:true,checkJs:true,noEmit:true,noImplicitAny:false,skipLibCheck:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,lib:['lib.es2022.d.ts','lib.webworker.d.ts']};
const host=ts.createCompilerHost(options),read=host.readFile,exists=host.fileExists,get=host.getSourceFile;
host.readFile=f=>f===filename?text:read(f);host.fileExists=f=>f===filename||exists(f);
host.getSourceFile=(f,language,onError,newFile)=>f===filename?ts.createSourceFile(f,text,language,true,ts.ScriptKind.JS):get(f,language,onError,newFile);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([filename],options,host));
for(const d of diagnostics)console.error((d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:'')+': '+ts.flattenDiagnosticMessageText(d.messageText,' '));
console.log('TypeScript '+ts.version+': '+diagnostics.length+' diagnósticos de JavaScript en Worker '+(text.match(/WORKER (\d+)/)?.[1]||'desconocido'));
process.exitCode=diagnostics.length?1:0;
