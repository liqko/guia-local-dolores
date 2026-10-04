import {routePanelV15} from '../../worker/routes/panel-v15.js';
import {routePublicV12} from '../../worker/routes/public-v12.js';
import {json} from '../../worker/core/http.js';
const clone=x=>x==null?x:structuredClone(x);
export function subscriberFixture(){
  const collections=new Map(),kv=new Map(),stats={reads:0,writes:0,deletes:0,queries:0};
  const collection=c=>{if(!collections.has(c))collections.set(c,new Map());return collections.get(c)};
  const db={async get(c,id){stats.reads++;return clone(collection(c).get(id)||null)},
    async queryEqual(c,k,v,limit=1000){stats.queries++;return clone([...collection(c).values()].filter(x=>x[k]===v).slice(0,limit))},
    async patch(c,id,p,{mustExist=false}={}){if(mustExist&&!collection(c).has(id))throw new Error('No existe documento');stats.writes++;const row={id,...collection(c).get(id),...clone(p)};collection(c).set(id,row);return clone(row)},
    async delete(c,id){stats.deletes++;collection(c).delete(id)},async listCollection(){throw new Error('Scan global no permitido')}};
  const cache={async get(k){return clone(kv.get(k)||null)},async put(k,v){kv.set(k,clone(v))}};
  const env={SERVER_SECRET:'solo-pruebas',SUSCRIPTORES_RECOVERY_URL:'https://correo.prueba.test/bridge',GLD_CACHE_KV:{async get(k){return kv.has(k)?JSON.stringify(kv.get(k)):null},async put(k,v){kv.set(k,JSON.parse(v))}}};
  kv.set('territorio:public:v1',{ciudades:[{ciudad_id:'DOL',ciudad_visible:'Dolores',provincia_visible:'Buenos Aires',pais_visible:'Argentina',provincia_id:'BA',pais_id:'AR'},{ciudad_id:'CAS',ciudad_visible:'Castelli',provincia_visible:'Buenos Aires',pais_visible:'Argentina',provincia_id:'BA',pais_id:'AR'}]});
  const mailRequests=[];
  // El doble del puente verifica códigos; no escribe Firestore ni envía correo real.
  async function mailFetch(url,options){
    if(String(url)!==env.SUSCRIPTORES_RECOVERY_URL)throw new Error('Red no autorizada en prueba: '+url);
    const p=JSON.parse(options.body);mailRequests.push(p);
    if(p.serverSecret!==env.SERVER_SECRET)throw new Error('Falta secreto del puente');
    const confirm=['confirmar_verificacion','restablecer_clave'].includes(p.action);
    return json({success:!confirm||p.codigo==='123456',message:confirm?(p.codigo==='123456'?'Código confirmado':'Código incorrecto'):'Código enviado'});
  }
  async function handle(request){
    const url=new URL(request.url),ctx={path:url.pathname,url,request,db,cache,env};
    try{return await routePublicV12(ctx)||await routePanelV15(ctx)||json({success:false,message:'Ruta no encontrada'},404)}catch(e){return json({success:false,message:e.message},400)}
  }
  async function api(body,token='',method='POST'){
    const url='https://prueba.test/suscriptores'+(method==='GET'?'?'+new URLSearchParams(body):'');
    const r=await handle(new Request(url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
    return {status:r.status,...await r.json()};
  }
  function seed(c,id,row){collection(c).set(id,{id,...clone(row)})}
  return{collections,kv,db,cache,env,stats,collection,seed,mailFetch,mailRequests,handle,api};
}
