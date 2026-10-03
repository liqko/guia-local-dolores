import {json} from "../core/http.js";
import {routePanelV12} from "./panel-v12.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {publicitySaveV4,publicityActiveChangeV4,publicityDeleteSafeV4} from "../modules/publicidad-v4.js";
import {configFromAdmin} from "../modules/publicidad-v3.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}

export async function routePanelV13(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/publicidad"&&request.method==="POST"){
    const clone=request.clone();
    const body=await bodyOf(clone);
    const action=actionOf(url,body);

    if(["guardar","actualizar_activos","eliminar"].includes(action)){
      const aid=aidOf(url,body);
      if(!aid)return json({success:false,message:"Falta advertiserId"},400);

      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);
      if(!sessionAllows(s,aid,"publicidad",{write:true})){
        return json({success:false,message:"No tenés permiso para modificar Publicidad."},403);
      }

      if(action==="guardar"){
        const admin=await db.get("anunciantes_administracion",aid);
        const cfg=configFromAdmin(admin||{});
        return json(await publicitySaveV4({
          db,cache,advertiserId:aid,body,
          config:{prioridad_id:text(cfg.prioridad_id)}
        }));
      }

      if(action==="actualizar_activos"){
        return json(await publicityActiveChangeV4({
          db,cache,advertiserId:aid,
          ids:Array.isArray(body.publicidad_ids)?body.publicidad_ids:[],
          configFromAdmin
        }));
      }

      if(action==="eliminar"){
        return json(await publicityDeleteSafeV4({
          db,cache,advertiserId:aid,
          publicityId:text(body.publicidad_id)
        }));
      }
    }
  }

  return routePanelV12(ctx);
}
