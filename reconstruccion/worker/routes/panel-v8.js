import {json} from "../core/http.js";
import {routePanelV7} from "./panel-v7.js";
import {verifySubscriberSession} from "../modules/suscriptores.js";
import {subscriberLoginV2} from "../modules/suscriptor-login-v2.js";
import {createSubscriberV3} from "../modules/suscriptor-registro-v3.js";
import {subscriberMailBridgeV2} from "../modules/suscriptor-mail-v2.js";
import {
  updateSubscriberProfileV2,
  updateSubscriberCityV2,
  deleteSubscriberAccountV2
} from "../modules/suscriptor-cuenta-v2.js";
import {upsertSubscriberIndexV2,removeSubscriberIndexV2} from "../core/subscriber-index-v2.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.clone().json()}catch(_){return{}}}

export async function routePanelV8(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/suscriptores"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();

    if(action==="anunciantes_autorizados"){
      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);
      return json({
        success:true,
        anunciantes:(Array.isArray(s.auth)?s.auth:[]).map(x=>({
          anunciante_id:text(x.anunciante_id),
          anunciante_nombre:text(x.anunciante_nombre),
          rol:text(x.rol),
          permisos:text(x.permisos),
          activo:true
        })),
        source:"session"
      });
    }
  }

  if(path==="/suscriptores"&&request.method==="POST"){
    const body=await bodyOf(request);
    const action=text(body.action||body.accion||url.searchParams.get("action")).toLowerCase();

    if(action==="login"){
      const out=await subscriberLoginV2({env,db,body});
      return json(out,out.success?200:401);
    }

    if(action==="crear"){
      const out=await createSubscriberV3({db,body});
      if(out.success&&out.suscriptor){
        await upsertSubscriberIndexV2({cache,subscriber:out.suscriptor});
      }
      return json(out);
    }

    if(action==="solicitar_recuperacion"||
       action==="restablecer_clave"||
       action==="solicitar_verificacion"||
       action==="confirmar_verificacion"){
      return json(await subscriberMailBridgeV2({env,db,cache,body}));
    }

    if(action==="actualizar_perfil"){
      const out=await updateSubscriberProfileV2({env,request,db,body});
      if(out.success&&out.suscriptor){
        await upsertSubscriberIndexV2({cache,subscriber:out.suscriptor});
      }
      return json(out);
    }

    if(action==="actualizar_ciudad"){
      const out=await updateSubscriberCityV2({env,request,db,cache,body});
      if(out.success&&out.suscriptor){
        await upsertSubscriberIndexV2({cache,subscriber:out.suscriptor});
      }
      return json(out);
    }

    if(action==="eliminar_cuenta"){
      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);
      const sid=text(s.sid);
      const out=await deleteSubscriberAccountV2({env,request,db});
      if(out.success)await removeSubscriberIndexV2({cache,subscriberId:sid});
      return json(out);
    }
  }

  return routePanelV7(ctx);
}
