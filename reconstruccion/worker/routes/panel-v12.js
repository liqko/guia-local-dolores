import {json} from "../core/http.js";
import {routePanelV11} from "./panel-v11.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {activitySaveV3,activityActionV3} from "../modules/actividades-v3.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}

export async function routePanelV12(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/actividades"&&request.method==="POST"){
    const clone=request.clone();
    const body=await bodyOf(clone);
    const action=actionOf(url,body);

    if(["guardar","renovar","pausar","reanudar","eliminar"].includes(action)){
      const aid=aidOf(url,body);
      if(!aid)return json({success:false,message:"Falta advertiserId"},400);

      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);
      if(!sessionAllows(s,aid,"actividades",{write:true})){
        return json({success:false,message:"No tenés permiso para modificar Actividades."},403);
      }

      if(action==="guardar"){
        return json(await activitySaveV3({db,cache,advertiserId:aid,body}));
      }

      return json(await activityActionV3({
        db,cache,advertiserId:aid,action,
        activityId:text(body.actividad_id||body.id||(body.payload&&(body.payload.actividad_id||body.payload.id)))
      }));
    }
  }

  return routePanelV11(ctx);
}
