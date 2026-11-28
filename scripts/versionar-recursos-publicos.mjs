// Publicación de recursos inmutables: la revisión viaja en la URL del propio archivo.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
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
 const brand='/plataforma/assets/marca/';
 for(const [original,optimized] of [['logo-guia-local.png','logo-guia-local.webp'],['fondo-ciudad.jpg','fondo-ciudad.webp']]){
  const target=await publish(brand+optimized);
  files.delete(brand+optimized);
  files.set(brand+original,target);
 }
 const sharedPages=new Set(['inicio.html','login.html','administracion.html','suscriptores.html','empleo.html','pie.html']);
 const pages=[];
 for(const name of await readdir(join(stage,'plataforma'))){
  if(!name.endsWith('.html'))continue;
  const html=await readFile(join(stage,'plataforma',name),'utf8');
  if(sharedPages.has(name)||/\/plataforma\/(?:assets\/app\/[a-f0-9]+-)?paquete-ciudad\.js/.test(html))pages.push(name);
 }
 for(const page of pages){
  const file=join(stage,'plataforma',page);
  let html=await readFile(file,'utf8');
  if(page==='carcasa.html')html=html.replace(/url:'\.\/(anunciantes|empleo)\.html'/g,"url:'./$1'");
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["'](\/plataforma\/[^"'?]+\.js)(?:\?[^"']*)?["'][^>]*>/gi)];
  for(const [tag,source] of scripts){
   if(source.startsWith(prefix))continue;
   if(!files.has(source)){
    let script=await readFile(join(stage,source),'utf8');
    if(source==='/plataforma/marca-global.js')script=script.replace("footer.src='/plataforma/pie.html'","footer.src='/plataforma/pie'");
    for(const [original,replacement] of files)if(!original.endsWith('.js'))script=script.replaceAll(original,replacement);
    await publish(source,script);
   }
   html=html.replace(tag,tag.replace(/\bsrc=(["'])[^"']+\1/,'src="'+files.get(source)+'"'));
  }
  // Hoja autónoma: los recursos relativos se resolverían desde otra ruta al moverla.
  const stylesheet='/plataforma/empleo.css';
  if(page==='empleo.html'&&html.includes(stylesheet)){
   const css=await readFile(join(stage,stylesheet),'utf8');
   if(/\burl\s*\(|@import\b/i.test(css))throw Error('Revisar dependencias de empleo.css antes de versionarla.');
   const target=await publish(stylesheet,css);
   html=html.replace(/\bhref=(['"])\/plataforma\/empleo\.css(?:\?[^'"]*)?\1/g,'href="'+target+'"');
  }
  await writeFile(file,html);
 }
 return {pages,resources:files.size,files:Object.fromEntries(files)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log(JSON.stringify(await versionarRecursos(process.argv[2]||'hosting-public')));
}
