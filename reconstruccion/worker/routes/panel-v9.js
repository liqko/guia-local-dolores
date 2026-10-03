import {json} from "../core/http.js";
import {routePanelV8} from "./panel-v8.js";
import {verifySubscriberSession} from "../modules/suscriptores.js";
import {deleteSubscriberAccountSecureV2} from "../modules/suscriptor-delete-v2.js";
import {removeSubscriberIndexV2} from "../core/subscriber-index-v2.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}

export async function routePanelV9(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/suscriptores"&&request.method==="POST"){
    const clone=request.clone();
    const body=await bodyOf(clone);
    const action=text(body.action||body.accion||url.searchParams.get("action")).toLowerCase();

    if(action==="eliminar_cuenta"){
      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);

      const out=await deleteSubscriberAccountSecureV2({env,request,db,body});
      if(out.success){
        await removeSubscriberIndexV2({cache,subscriberId:text(s.sid)});
      }
      return json(out);
    }
  }

  return routePanelV8(ctx);
}
