import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {routePanelV15} from '../../worker/routes/panel-v15.js';
import {routeAdminV11} from '../../worker/routes/admin-v11.js';
import worker from '../../worker/app-main-v35.js';
const clone=x=>x==null?x:structuredClone(x);
export function panelFixture(){
  const collections=new Map(),kv=new Map(),stats={reads:0,writes:0,queries:0,scans:0};
  const collection=c=>{if(!collections.has(c))collections.set(c,new Map());return collections.get(c)};
  const db={
    async get(c,id){stats.reads++;return clone(collection(c).get(id)||null)},
    async queryEqual(c,k,v,limit=1000){stats.queries++;return clone([...collection(c).values()].filter(x=>x[k]===v).slice(0,limit))},
    async patch(c,id,p,{mustExist=false}={}){if(mustExist&&!collection(c).has(id))throw new Error('Documento inexistente');stats.writes++;const row={id,...collection(c).get(id),...clone(p)};collection(c).set(id,row);return clone(row)},
    async delete(c,id){stats.writes++;collection(c).delete(id)},
    async listCollection(){stats.scans++;throw new Error('Scan global durante una acción normal')}
  };
  const cache={async get(k){return clone(kv.get(k)||null)},async put(k,v){kv.set(k,clone(v))}};
  const env={SERVER_SECRET:'solo-pruebas',GLD_CACHE_KV:{async get(k){return kv.has(k)?JSON.stringify(kv.get(k)):null},async put(k,v){kv.set(k,JSON.parse(v))}}};
  const sign=p=>{const b=Buffer.from(JSON.stringify({...p,exp:Date.now()+60000})).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url')};
  const subscriber=sign({sid:'SUB',typ:'GLD_SUBSCRIBER',auth:[{anunciante_id:'ADV',rol:'PROPIETARIO',permisos:'PROMOS;EVENTOS;EVENTOS_FREE;ACTIVIDADES;PUBLICIDAD;EFEMERIDES'}]});
  const admin=sign({sid:'ADM',rol:'SUPERADMIN_PRINCIPAL'});
  function seed(c,id,data){collection(c).set(id,{id,...clone(data)})}
  seed('anunciantes','ADV',{nombre:'Anunciante'});
  seed('anunciantes_administracion','ADV',{funcionalidades:['PROMOS','EVENTOS','EVENTOS_FREE','ACTIVIDADES','PUBLICIDAD','EFEMERIDES'],funcionalidades_config:{PROMOS:{cantidad:3},EVENTOS:{cantidad:3},EVENTOS_FREE:{cantidad:3},ACTIVIDADES:{cantidad:1},PUBLICIDAD:{guardadas_max:2,activas_max:1,cambios_activos_por_dia_max:4}},efemerides_local:true,efemerides_ciudades:['DOL','CAS']});
  kv.set('territorio:public:v1',{ciudades:[{ciudad_id:'DOL',provincia_id:'BA'},{ciudad_id:'CAS',provincia_id:'BA'}]});
  kv.set('catalogs:publicidad:v1',{ubicaciones:[{ubicacion_id:'UG',modulo:'GUIA'}]});
  kv.set('catalogs:promos:v1',{categorias:[{categoria_id:'CAT',nombre:'Gastronomía'}]});
  const event={nombre_evento:'Encuentro',categoria:'Cultura',ciudad_id:'DOL',fecha_desde:'2026-10-10',lugar_texto:'Plaza',direccion:'Centro',programacion:[{fecha:'2026-10-10',ciudad_id:'DOL',lugar_texto:'Plaza',direccion:'Centro'}]};
  const schedule=city=>({ciudad_id:city,tipo_lugar:'FISICO',lugar_texto:'Club',direccion:'Centro'});
  async function request(path,body,token=subscriber){
    const url=new URL('https://prueba.local'+path);
    const req=new Request(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({advertiserId:'ADV',...body})});
    const ctx={path:url.pathname,url,request:req,db,cache,env};
    return await (path.startsWith('/superadmin')?routeAdminV11(ctx):routePanelV15(ctx));
  }
  async function action(path,body,token){const r=await request(path,body,token);assert.ok(r,'Ruta sin respuesta');const out=await r.json();assert.equal(r.status,200,JSON.stringify(out));assert.equal(out.success,true,JSON.stringify(out));return out}
  async function publicRows(path,city,key){
    const before={...stats};
    const r=await worker.fetch(new Request(`https://prueba.local${path}${path.includes('?')?'&':'?'}ciudad_id=${city}`),env);
    const out=await r.json();assert.equal(r.status,200,JSON.stringify(out));assert.equal(out.success,true,JSON.stringify(out));assert.deepEqual(stats,before,'La consulta pública accedió a Firestore');return out[key];
  }
  return{db,cache,env,stats,seed,collection,action,request,publicRows,admin,event,schedule};
}
