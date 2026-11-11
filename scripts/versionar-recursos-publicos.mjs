// Publicación de recursos inmutables: la revisión viaja en la URL del propio archivo.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function versionarRecursos(stage){
 const prefix='/plataforma/assets/app/';
 const files=new Map();
 await mkdir(join(stage,prefix),{recursive:true});
 async function publish(source,content){
  const bytes=content??await readFile(join(stage,source));
  const hash=createHash('sha256').update(bytes).digest('hex').slice(0,20);
  const target=prefix+hash+'-'+basename(source);
  await writeFile(join(stage,target),bytes);
  files.set(source,target);
  return target;
 }
 // Estos archivos forman la identidad de la carcasa. El contenido no se altera.
 for(const asset of ['/plataforma/assets/marca/logo-guia-local.png','/plataforma/assets/marca/fondo-ciudad.jpg'])await publish(asset);
 const pages=['carcasa.html','anunciantes.html','eventos.html'];
 for(const page of pages){
  const file=join(stage,'plataforma',page);
  let html=await readFile(file,'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["'](\/plataforma\/[^"'?]+\.js)(?:\?[^"']*)?["'][^>]*>/gi)];
  for(const [tag,source] of scripts){
   if(source.startsWith(prefix))continue;
   if(!files.has(source)){
    let script=await readFile(join(stage,source),'utf8');
    for(const [original,replacement] of files)if(!original.endsWith('.js'))script=script.replaceAll(original,replacement);
    await publish(source,script);
   }
   html=html.replace(tag,tag.replace(/\bsrc=(["'])[^"']+\1/,'src="'+files.get(source)+'"'));
  }
  await writeFile(file,html);
 }
 return {pages,resources:files.size,files:Object.fromEntries(files)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log(JSON.stringify(await versionarRecursos(process.argv[2]||'hosting-public')));
}
