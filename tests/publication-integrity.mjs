import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const pages=['anunciantes','actividades','login','suscriptores','carcasa'];
for(const page of pages){
 const path='plataforma/'+page+'.html';
 const html=fs.readFileSync(path,'utf8');
 assert.match(html.trimStart(),/^<(?:!doctype|html|head)\b/i,path+': inicio HTML inválido');
 assert.doesNotMatch(html,/Warning: truncated output|…\d+ tokens truncated…/i,path+': contenido recortado');
 assert.match(html,/<\/html>\s*$/i,path+': documento incompleto');
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
  if(match[1].trim())new vm.Script(match[1],{filename:path});
 }
}
new vm.Script(fs.readFileSync('plataforma/anunciantes-utilidades.js','utf8'));
console.log('PASS: documentos completos, sin avisos de truncamiento y scripts válidos.');
