import {json} from "../core/http.js";
import {routePanelV6} from "./panel-v6.js";
import {
  createSubscriberV2,getSubscriberProfileV2,updateSubscriberProfileV2,
  updateSubscriberCityV2,changeSubscriberPasswordV2,deleteSubscriberAccountV2,
  recoveryBridgeV2
} from "../modules/suscriptor-cuenta-v2.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}

export async function routePanelV7(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/suscriptores"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="perfil"||action==="suscriptor"){
      return json(await getSubscriberProfileV2({env,request,db}));
    }
  }

  if(path==="/suscriptores"&&request.method==="POST"){
    const body=await bodyOf(request);
    const action=text(body.action||body.accion||url.searchParams.get("action")).toLowerCase();

    if(action==="crear")return json(await createSubscriberV2({db,body}));
    if(action==="actualizar_perfil")return json(await updateSubscriberProfileV2({env,request,db,body}));
    if(action==="actualizar_ciudad")return json(await updateSubscriberCityV2({env,request,db,cache,body}));
    if(action==="cambiar_clave")return json(await changeSubscriberPasswordV2({env,request,db,body}));
    if(action==="eliminar_cuenta")return json(await deleteSubscriberAccountV2({env,request,db}));
    if(action==="solicitar_recuperacion"||action==="restablecer_clave"){
      return json(await recoveryBridgeV2({env,body}));
    }
  }

  return routePanelV6(ctx);
}
