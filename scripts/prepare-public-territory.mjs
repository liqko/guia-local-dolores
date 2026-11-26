import {createHash} from 'node:crypto';
import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

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
function publishedSnapshot(source){
 const stored=source?.match(/^const published = (\{.+\});$/m)?.[1];
 if(!stored)throw Error('Falta el catálogo territorial instalado.');
 const prepared=snapshot(JSON.parse(stored).data);
 if(prepared.revision!==revisionLine.exec(source)?.[1])throw Error('Catálogo territorial instalado inválido.');
 return prepared;
}

export async function preparePublicTerritory({file,read=fetch,scheduled=false,stageUnchanged=false,preserve=false}){
 const source=await readFile(file,'utf8');
 if(source.split(MARKER).length!==2)throw Error('Marcador de catálogo público ausente o duplicado.');
 let prepared,existing;
 if(preserve){
  existing=await readPublished(read);
  prepared=publishedSnapshot(existing);
 }else{
  try{
   const response=await read(WORKER,{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Catálogo público no disponible (HTTP '+response.status+').');
   prepared=snapshot(await response.json());
  }catch(error){
   if(scheduled)throw error;
   // En un push se puede conservar el catálogo instalado si falla el origen.
   existing=await readPublished(read).catch(()=>null);
   try{prepared=publishedSnapshot(existing);}catch{throw error;}
   console.warn('Catálogo de origen temporalmente inaccesible. Se conserva el publicado.');
  }
 }
 const {data,revision}=prepared;
 // En push se prepara la copia aunque no cambie; el indicador debe reflejar el cambio real.
 // Si no se puede leer Hosting durante un push, conservar el comportamiento de arranque.
 const installed=existing??await readPublished(read).catch(error=>{if(scheduled)throw error;return null;});
 const changed=revisionLine.exec(installed??'')?.[1]!==revision;
 if(!changed&&scheduled&&!stageUnchanged)return {changed:false,revision};
 const payload=JSON.stringify({revision,data}).replaceAll('<','\\u003c');
 await writeFile(file,'// GLD_TERRITORY_REVISION '+revision+'\n'+source.replace(MARKER,()=>payload+';'));
 return {changed,revision};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {changed,revision}=await preparePublicTerritory({file:process.argv[2],scheduled:process.argv.includes('--scheduled'),
  stageUnchanged:process.argv.includes('--stage-unchanged'),preserve:process.argv.includes('--preserve')});
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'changed='+changed+'\n');
 console.log(changed?'Catálogo preparado: '+revision:'El catálogo publicado sigue igual.');
}
