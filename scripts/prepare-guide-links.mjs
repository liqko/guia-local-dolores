import {appendFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const WORKER='https://login.liqkoargentina.workers.dev';
const HOSTING='https://anunciantes-guialocal.web.app';
const TYPES={
 events:{path:'/events-new',lists:['events','data'],fields:[
  'nombre_evento','nombre','fecha_desde','fechaDesde','fecha_desde_iso','fecha','fecha_hasta','fechaHasta','fecha_hasta_iso','pausado',
  'organizador','organizador_principal','partner','partner2','partner3','partner4','partner5','partner6',
  'coorganizador','coorganizador2','coorganizador3','coorganizador4','coorganizador5','coorganizador6',
  'co_organizador','co_organizador2','coorganizador_principal',
  'auspiciante','auspiciante2','auspiciante3','auspiciante4','auspiciante5','auspiciante6','auspicia','auspicia2','sponsor','sponsor2','sponsor3'
 ]},
 promos:{path:'/promos',lists:['promos','data','rows'],fields:[
  'promo_id','anunciante_id','id_comercio','comercio_id','id_anunciante','anunciante','nombre','comercio',
  'promo','sede_id','ciudad_id','desde','hasta','aprobado','pausado'
 ]},
 activities:{path:'/actividades',action:'publicas',lists:['actividades'],fields:['actividad_id','anunciante_id']}
};
const filename=city=>Buffer.from(city).toString('base64url')+'.json';

export function projectGuideLinks(city,packets){
 const output={version:1,city};
 for(const [type,{lists,fields}] of Object.entries(TYPES)){
  const payload=packets[type];
  const rows=lists.map(key=>payload?.[key]).find(Array.isArray);
  if(payload?.success!==true||!rows||payload.ciudad_id&&payload.ciudad_id!==city)throw Error('Catálogo inválido: '+type+' · '+city);
  output[type]=rows.map(row=>Object.fromEntries(fields
    .filter(key=>Object.hasOwn(row,key)&&['string','number','boolean'].includes(typeof row[key]))
    .map(key=>[key,row[key]])));
 }
 return output;
}

function validSnapshot(packet,city){
 return packet?.version===1&&packet.city===city&&Object.keys(TYPES).every(key=>Array.isArray(packet[key]));
}

async function loadPrior(city,read){
 const response=await read(HOSTING+'/plataforma/guia-enlaces/'+filename(city),{signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(response.status===404)return null;
 if(!response.ok)throw Error('No se pudo comprobar enlaces publicados: '+city);
 const packet=await response.json();
 if(!validSnapshot(packet,city))throw Error('Enlaces publicados inválidos: '+city);
 return packet;
}

async function loadFromSource(city,read){
 const entries=await Promise.all(Object.entries(TYPES).map(async ([type,def])=>{
  const url=new URL(def.path,WORKER);
  url.searchParams.set('ciudad_id',city);
  if(def.action)url.searchParams.set('action',def.action);
  const response=await read(url.href,{signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok)throw Error('No se pudo preparar '+type+' · '+city+' (HTTP '+response.status+').');
  return [type,await response.json()];
 }));
 return projectGuideLinks(city,Object.fromEntries(entries));
}

export async function prepareGuideLinks({territoryFile,directory,read=fetch,scheduled=false}){
 const source=await readFile(territoryFile,'utf8');
 const published=source.match(/^const published = (\{.+\});$/m)?.[1];
 if(!published)throw Error('Falta el catálogo de ciudades para preparar enlaces.');
 const cities=[...new Set(JSON.parse(published).data.ciudades.map(c=>String(c.ciudad_id||c.id||'').trim()).filter(Boolean))];
 await mkdir(directory,{recursive:true});
 let changed=false;
 for(const city of cities){
  let prior;
  try{prior=await loadPrior(city,read);}catch(error){if(scheduled)throw error;console.warn(error.message);}
  let snapshot=prior;
  if(scheduled||!snapshot){
   try{snapshot=await loadFromSource(city,read);}catch(error){
    if(scheduled)throw error;
    // En un despliegue común, esta ciudad puede usar sus rutas públicas habituales.
    console.warn(error.message);
   }
  }
  if(!snapshot)continue;
  const encoded=JSON.stringify(snapshot);
  if(!prior||encoded!==JSON.stringify(prior))changed=true;
  await writeFile(join(directory,filename(city)),encoded+'\n');
 }
 return {changed,cities:cities.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await prepareGuideLinks({territoryFile:process.argv[2],directory:process.argv[3],scheduled:process.argv.includes('--scheduled')});
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'changed='+result.changed+'\n');
 console.log('Enlaces de Guía preparados para '+result.cities+' ciudades.');
}
