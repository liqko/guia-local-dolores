import {readFile,writeFile,mkdir,cp,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const pages=[
  'carcasa-territorio-v3.html','anunciantes-publico-v4.html','suscriptores-v3.html',
  'login-modular-v11.html','granhermano-v2.html','promos-public-v1.html',
  'eventos-public-v1.html','actividades-public-v1.html','farma-turnos-public-v1.html'
];
const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const productionHosts=new Set(['login.liqkoargentina.workers.dev','guialocal.ar','www.guialocal.ar','guialocaldolores.com.ar','www.guialocaldolores.com.ar']);
function origin(value){
  const u=new URL(value);
  if(u.protocol!=='https:' && !(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw new Error('Usar HTTPS o localhost.');
  if(productionHosts.has(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('Se requiere un origen de pruebas separado, sin ruta ni credenciales.');
  return u.origin;
}
export async function prepare({workerOrigin,siteOrigin,projectId,out}){
  workerOrigin=origin(workerOrigin);siteOrigin=origin(siteOrigin);
  if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId||''))throw new Error('Falta un ID válido del proyecto Firebase de pruebas.');
  out=resolve(out||'');
  if(out===source||source.startsWith(out+'/')||out.startsWith(source+'/'))throw new Error('La salida debe estar fuera de reconstruccion.');
  try{await lstat(out);throw new Error('La carpeta de salida ya existe. Elegir una carpeta nueva.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(resolve(out,'plataforma'),{recursive:true});
  const hashes={};
  const navigation={
    'suscriptores/':'suscriptores-v3.html','login-anunciantes/':'login-modular-v11.html',
    'eventos/':'eventos-public-v1.html','promos/':'promos-public-v1.html',
    'actividades/':'actividades-public-v1.html'
  };
  for(const page of pages){
    const original=await readFile(resolve(source,'plataforma',page),'utf8');
    let html=original.replaceAll('https://login.liqkoargentina.workers.dev',workerOrigin);
    for(const [route,target] of Object.entries(navigation))html=html.replaceAll('https://guialocal.ar/'+route,siteOrigin+'/'+target);
    html=html.replace(/https:\/\/(?:www\.)?(?:guialocal\.ar|guialocaldolores\.com\.ar)\/?/g,siteOrigin+'/carcasa-territorio-v3.html');
    if(/https:\/\/(?:login\.liqkoargentina\.workers\.dev|(?:www\.)?guialocal(?:dolores\.com)?\.ar)/.test(html))throw new Error('Referencia al entorno habitual: '+page);
    await writeFile(resolve(out,'plataforma',page),html);
    hashes[page]={source_sha256:createHash('sha256').update(original).digest('hex'),test_sha256:createHash('sha256').update(html).digest('hex')};
  }
  await cp(resolve(source,'worker'),resolve(out,'worker'),{recursive:true});
  // Entry exclusivo de pruebas: rechaza configuración incompleta antes de acceder a DB/KV.
  await writeFile(resolve(out,'worker','app-controlled-test.js'),`import app from './app-main-v35.js';
export default {async fetch(request,env){
  if(env.GLD_CONTROLLED_TEST!=='true'||env.FIREBASE_PROJECT_ID!==${JSON.stringify(projectId)}||!env.SERVER_SECRET||!env.FIREBASE_CLIENT_EMAIL||!env.FIREBASE_PRIVATE_KEY||!env.SUSCRIPTORES_RECOVERY_URL||!env.GLD_CACHE_KV){
    return new Response(JSON.stringify({success:false,message:'Entorno de pruebas incompleto o proyecto incorrecto.'}),{status:503,headers:{'Content-Type':'application/json'}});
  }
  const response=await app.fetch(request,env);
  const headers=new Headers(response.headers);headers.set('X-GLD-Controlled-Test','V38');
  return new Response(response.body,{status:response.status,headers});
}};
`);
  const manifest={candidate:'V37',workerOrigin,siteOrigin,projectId,entry:'worker/app-controlled-test.js',created_at:new Date().toISOString(),pages:hashes,
    required_bindings:['GLD_CACHE_KV'],required_variables:['GLD_CONTROLLED_TEST=true','FIREBASE_PROJECT_ID='+projectId,'FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','SERVER_SECRET','SUSCRIPTORES_RECOVERY_URL'],
    isolation_requirements:['Firebase de pruebas, con datos ficticios','Namespace KV exclusivo de pruebas','Secreto de sesión exclusivo de pruebas','Puente de correo de pruebas; no debe modificar cuentas de producción']};
  await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),opts={};
  const names={'--worker-origin':'workerOrigin','--site-origin':'siteOrigin','--project-id':'projectId','--out':'out'};
  for(let i=0;i<args.length;i+=2){if(!names[args[i]]||!args[i+1])throw new Error('Argumentos: --worker-origin URL --site-origin URL --project-id ID --out CARPETA');opts[names[args[i]]]=args[i+1];}
  if(!opts.out)throw new Error('Indicar --out.');
  const m=await prepare(opts);console.log('Preparadas '+Object.keys(m.pages).length+' pantallas y Worker de pruebas. No se desplegó ni se enviaron peticiones.');
}
