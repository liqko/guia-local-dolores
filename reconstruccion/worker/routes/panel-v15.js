import {json} from "../core/http.js";
import {routePanelV14} from "./panel-v14.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {farmSaveCycleV3} from "../modules/farmacias-v3.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}
const truthy=v=>v===true||v===1||["true","1","si","sí","x","activo","activa"].includes(text(v).toLowerCase());

async function allowedFarmCities({db,cache,aid}){
  const admin=await db.get("anunciantes_administracion",aid);
  if(!admin)return[];
  const root=admin.funcionalidades_config&&typeof admin.funcionalidades_config==="object"?admin.funcionalidades_config:{};
  const cfg=root.TURNOS_FARMA||root.FARMACIAS||root.turnos_farma||{};
  const all=truthy(cfg.todas_ciudades)||text(admin.turnos_farma)==="*";
  if(all){
    const territory=await cache.get("territorio:public:v1");
    return ((territory&&territory.ciudades)||[]).map(c=>text(c.ciudad_id||c.id)).filter(Boolean);
  }
  const arr=Array.isArray(cfg.ciudades)?cfg.ciudades:
    Array.isArray(admin.farmacias_ciudades)?admin.farmacias_ciudades:
    text(admin.turnos_farma).split(/[;,|]+/).map(text).filter(v=>v&&v!=="*");
  return [...new Set(arr.map(text).filter(Boolean))];
}

export async function routePanelV15(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/farmacias"&&request.method==="POST"){
    const clone=request.clone();
    const body=await bodyOf(clone);
    const action=actionOf(url,body);

    if(action==="guardar_ciclo"){
      const aid=aidOf(url,body);
      if(!aid)return json({success:false,message:"Falta advertiserId"},400);

      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);
      if(!sessionAllows(s,aid,"turnos_farma",{write:true})){
        return json({success:false,message:"No tenés permiso para modificar Farmacias de turno."},403);
      }

      return json(await farmSaveCycleV3({
        db,cache,advertiserId:aid,body,
        allowedCityIds:await allowedFarmCities({db,cache,aid})
      }));
    }
  }

  return routePanelV14(ctx);
}
