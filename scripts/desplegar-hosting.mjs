import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readdir,readFile,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const site='sites/anunciantes-guialocal';
const api='https://firebasehosting.googleapis.com/v1beta1/';
const packageRoot='/plataforma/paquetes-ciudad/';
const manifestPath=packageRoot+'publicacion.json';

export function servingConfig({cleanUrls,headers=[],redirects=[],rewrites=[],...other}){
  if(Object.keys(other).some(key=>!['public','ignore'].includes(key)))throw Error('Configuración Hosting fuera del contrato del publicador.');
  return {
    cleanUrls,
    headers:headers.map(({source,headers})=>({glob:source,headers:Object.fromEntries(headers.map(({key,value})=>[key,value]))})),
    redirects:redirects.map(({source,destination,type})=>({glob:source,location:destination,statusCode:type})),
    rewrites:rewrites.map(({source,destination})=>({glob:source,path:destination})),
  };
}

async function stagePaths(stage,dir=''){
  const files=[];
  for(const entry of await readdir(join(stage,dir),{withFileTypes:true})){
    if(entry.name.startsWith('.')||entry.name==='node_modules')continue;
    const path=dir+'/'+entry.name;
    if(entry.isDirectory())files.push(...await stagePaths(stage,path));
    else if(entry.isFile())files.push(path);
    else throw Error('Archivo no publicable: '+path);
  }
  return files;
}

export async function deployHosting({stage,mode,token,read=fetch}){
  if(!['code','urgent'].includes(mode)||!token)throw Error('Falta modo o autorización de Hosting.');
  const call=async(path,{method='GET',body,bytes}={})=>{
    const url=new URL(path,api);
    if(!['firebasehosting.googleapis.com','upload-firebasehosting.googleapis.com'].includes(url.hostname)||url.protocol!=='https:')throw Error('Destino Hosting inválido.');
    const response=await read(url,{method,redirect:'error',signal:AbortSignal.timeout(90000),
      headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:bytes?{'Content-Type':'application/octet-stream'}:{})},
      ...(body?{body:JSON.stringify(body)}:bytes?{body:bytes}:{})});
    if(!response.ok)throw Error('Hosting: '+method+' '+url.pathname+' respondió '+response.status);
    return bytes?null:response.json();
  };
  const latest=async()=>{const release=(await call(site+'/channels/live/releases?pageSize=1')).releases?.[0];return release?.version?.name;};
  const active=await latest();
  if(!active?.startsWith(site+'/versions/'))throw Error('No se identificó la versión activa de Hosting.');
  const previous=new Map();
  let page='';
  do{
    const listed=await call(active+'/files?pageSize=1000&status=ACTIVE'+(page?'&pageToken='+encodeURIComponent(page):''));
    for(const {path,hash} of listed.files??[])previous.set(path,hash);
    page=listed.nextPageToken;
  }while(page);
  if(!previous.size)throw Error('Falta el inventario de hashes de la versión activa.');
  const staged=await stagePaths(stage);
  const changed=new Map(), result=new Map();
  const urgent=mode==='urgent';
  const files=staged;
  if(urgent&&files.some(path=>!path.startsWith(packageRoot)))throw Error('La publicación urgente incluye archivos ajenos a los paquetes.');
  if (urgent) for(const [path,hash] of previous) if(!path.startsWith(packageRoot))result.set(path,hash);
  if(!files.includes(manifestPath)){
    if(urgent)throw Error('Falta la edición urgente preparada.');
    if(previous.has(manifestPath))throw Error('El despliegue perdería el índice de paquetes vigente.');
  }else{
    const book=JSON.parse(await readFile(join(stage,manifestPath),'utf8'));
    const expected=new Set([manifestPath]);
    for(const {key,revision,deltas} of Object.values(book.manifest)){
      for(const path of [packageRoot+key+'/completo-'+revision+'.json',...deltas.map(from=>packageRoot+key+'/cambios-'+from+'-'+revision+'.json')]){
        expected.add(path);
        const hash=previous.get(path);
        if(hash)result.set(path,hash);
        else if(!files.includes(path))throw Error('Falta el archivo y su hash publicado: '+path);
      }
    }
    if(files.some(path=>path.startsWith(packageRoot)&&!expected.has(path)))throw Error('Archivo de paquete fuera del índice.');
  }
  for(const path of files){
    const bytes=gzipSync(await readFile(join(stage,path)));
    const hash=createHash('sha256').update(bytes).digest('hex');
    result.set(path,hash);
    changed.set(hash,bytes);
  }
  const config=urgent?(await call(active)).config:servingConfig(JSON.parse(await readFile('firebase.json','utf8')).hosting);
  if(!config)throw Error('Falta la configuración de la edición activa.');
  const {name}=await call(site+'/versions',{method:'POST',body:{config}});
  if(!name?.startsWith(site+'/versions/'))throw Error('Firebase devolvió una versión inválida.');
  const entries=[...result];
  for(let i=0;i<entries.length;i+=1000){
    const {uploadRequiredHashes=[],uploadUrl}=await call(name+':populateFiles',{
      method:'POST',body:{files:Object.fromEntries(entries.slice(i,i+1000))},
    });
    for(const hash of uploadRequiredHashes){
      if(!changed.has(hash))throw Error('Hosting no conserva un hash publicado: '+hash);
      await call(uploadUrl+'/'+hash,{method:'POST',bytes:changed.get(hash)});
    }
  }
  await call(name+'?updateMask=status',{method:'PATCH',body:{status:'FINALIZED'}});
  if(await latest()!==active)throw Error('Cambió Hosting durante la preparación; la edición nueva no se activó.');
  await call(site+'/channels/live/releases?versionName='+encodeURIComponent(name),{method:'POST',body:{}});
  return {previous:active,version:name};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const {GoogleAuth}=createRequire(import.meta.url)('google-auth-library');
  const credentials=JSON.parse(process.env.GLD_HOSTING_CREDENTIALS??'null');
  if(credentials?.type!=='service_account')throw Error('Faltan las credenciales del publicador.');
  const auth=new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/firebase.hosting']});
  const result=await deployHosting({stage:process.argv[2],mode:process.argv[3],token:await auth.getAccessToken()});
  console.log(JSON.stringify(result));
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'version='+result.version+'\nprevious='+result.previous+'\n');
}
