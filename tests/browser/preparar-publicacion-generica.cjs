// Copia aislada de respuestas públicas actuales; no escribe en los servicios de origen.
const {readFile,writeFile}=require('node:fs/promises');
const {join}=require('node:path');
module.exports=async function prepare(stage,fromLive,city){
 const {legacySchema}=require('../../plataforma/paquete-ciudad.js');
 const {prepareCityBooks}=await import('../../scripts/preparar-paquete-ciudad.mjs');
 const publication=JSON.parse((await fromLive('/plataforma/paquetes-ciudad/publicacion.json')).body);
 const entry=publication.manifest[city];
 const old=JSON.parse((await fromLive('/plataforma/paquetes-ciudad/'+entry.key+'/completo-'+entry.revision+'.json')).body);
 const counts={workerRequests:0};
 async function api(path){counts.workerRequests++;const r=await fetch('https://login.liqkoargentina.workers.dev'+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Fuente de ensayo '+path+' HTTP '+r.status);const j=await r.json();if(j.success!==true)throw Error('Fuente pública incompleta');return j;}
 const qs=encodeURIComponent(city);
 const [calendar,catalog,adsEvents,adsActivities]=await Promise.all([
  api('/efemerides?action=calendario&ciudad_id='+qs),api('/empleo/catalogo'),api('/publicidad?action=publicas&modulo=EVENTOS&ciudad_id='+qs),api('/publicidad?action=publicas&modulo=ACTIVIDADES&ciudad_id='+qs)
 ]);
 const jobs=[];let page=1;
 while(true){const j=await api('/empleo/publicas?ciudad_id='+qs+'&pagina='+page++);jobs.push(...j.rows);if(jobs.length>=j.total)break;if(page>1000||!j.rows.length)throw Error('Paginación de ensayo incompleta');}
 const schema={...(old.schema||legacySchema()),
  ephemerides:{field:'efemerides',id:'efemeride_id',metadata:[]},
  employment:{field:'rows',id:'empleo_id',metadata:['ciudad_id','areas']},
  ads_eventos:{field:'publicidades',id:'publicidad_id',metadata:[],family:'ads',context:'EVENTOS'},
  ads_actividades:{field:'publicidades',id:'publicidad_id',metadata:[],family:'ads',context:'ACTIVIDADES'}
 };
 const additions={ephemerides:{success:true,efemerides:calendar.efemerides},employment:{success:true,rows:jobs,ciudad_id:city,areas:catalog.areas},ads_eventos:{success:true,publicidades:adsEvents.publicidades},ads_actividades:{success:true,publicidades:adsActivities.publicidades}};
 const changes=Object.fromEntries(Object.entries(additions).map(([name,module])=>{const {[schema[name].field]:rows,success,...metadata}=module;return [name,{upsert:rows,remove:[],metadata}];}));
 const source=await readFile('plataforma/territorio-cache.js','utf8');
 const live=(await fromLive('/plataforma/territorio-cache.js')).body.toString();
 const published=live.match(/^const published = (\{.*\});$/m)?.[1];
 if(!published)throw Error('Falta catálogo publicado para el ensayo');
 await writeFile(join(stage,'plataforma/territorio-cache.js'),source.replace('/* GLD_TERRITORY_SNAPSHOT */ null',()=>published));
 await prepareCityBooks({initial:[old],batches:[{city,from:old.revision,revision:old.revision+1,schema,changes}]},stage);
 return {old,counts,modules:Object.keys(schema),scope:'Datos públicos reales obtenidos una vez para una candidata aislada; no es un corte real ni facturación del visitante.'};
};
