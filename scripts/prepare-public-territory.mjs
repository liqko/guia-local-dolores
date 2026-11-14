import {createHash} from 'node:crypto';
import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {githubIdentity,publicationCutoff,publicationRequest,requirePublication207} from './publicar-paquetes-ciudad.mjs';

const WORKER='https://login.liqkoargentina.workers.dev/territory/public';
const LIVE='https://anunciantes-guialocal.web.app/plataforma/territorio-cache.js';
const MARKER='/* GLD_TERRITORY_SNAPSHOT */ null;';
const revisionLine=/^\/\/ GLD_TERRITORY_REVISION ([a-f0-9]{64})$/m;

function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value===null||typeof value!=='object')return value;
 return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
}

function snapshot(received){
 const {paises,provincias,ciudades}=received??{};
 if(received?.success!==true||![paises,provincias,ciudades].every(Array.isArray)){
  throw Error('Catálogo público inválido.');
 }
 // El sello del servidor puede cambiar al reconstruir la misma lista.
 const data=canonical({success:true,version:received.version??1,paises,provincias,ciudades});
 return {data,revision:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}

async function readPublished(read){
 const response=await read(LIVE,{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('No se pudo comprobar el catálogo instalado (HTTP '+response.status+').');
 return response.text();
}

export async function preparePublicTerritory({file,read=fetch,scheduled=false,stageUnchanged=false,identity=githubIdentity,cutoff=publicationCutoff()}){
 const source=await readFile(file,'utf8');
 if(source.split(MARKER).length!==2)throw Error('Marcador de catálogo público ausente o duplicado.');
 let prepared;
 try{
  let received;
  if (scheduled) {
    received=await publicationRequest(read,'https://login.liqkoargentina.workers.dev/internal/city-books',{
      method:'POST',headers:{Authorization:'Bearer '+await identity(read),'Content-Type':'application/json'},
      body:JSON.stringify({op:'territory',cutoff})});
    requirePublication207(received,cutoff,'staged');
  } else {
    const response=await read(WORKER,{cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Catálogo público no disponible (HTTP '+response.status+').');
    received=await response.json();
  }
  prepared=snapshot(received);
 }catch(error){
  if(scheduled)throw error;
  // Un problema transitorio del catálogo no impide publicar el sitio con la copia anterior.
  const existing=await readPublished(read).catch(()=>null);
  const stored=existing?.match(/^const published = (\{.+\});$/m)?.[1];
  if(!stored)throw error;
  prepared=snapshot(JSON.parse(stored).data);
  if(prepared.revision!==revisionLine.exec(existing)?.[1])throw error;
  console.warn('Catálogo de origen temporalmente inaccesible. Se conserva el publicado.');
 }
 const {data,revision}=prepared;
 const changed=!scheduled||revisionLine.exec(await readPublished(read))?.[1]!==revision;
 if(!changed&&!stageUnchanged)return {changed:false,revision};
 const payload=JSON.stringify({revision,data}).replaceAll('<','\\u003c');
 await writeFile(file,'// GLD_TERRITORY_REVISION '+revision+'\n'+source.replace(MARKER,()=>payload+';'));
 return {changed,revision};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {changed,revision}=await preparePublicTerritory({file:process.argv[2],scheduled:process.argv.includes('--scheduled'),stageUnchanged:process.argv.includes('--stage-unchanged')});
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'changed='+changed+'\n');
 console.log(changed?'Catálogo preparado: '+revision:'El catálogo publicado sigue igual.');
}
