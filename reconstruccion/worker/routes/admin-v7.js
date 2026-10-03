import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV6} from "./admin-v6.js";
import {rebuildAllReadModelsV2} from "../maintenance/rebuild-all-v2.js";

const text=v=>String(v??"").trim();

export async function routeAdminV7(ctx){
  const {path,request,env,db,cache}=ctx;

  if(path==="/superadmin/rebuild-all-cache"&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(text(auth.rol).toUpperCase())){
      return json({success:false,message:"Permiso insuficiente."},403);
    }
    return json(await rebuildAllReadModelsV2({env,request,db,cache}));
  }

  return routeAdminV6(ctx);
}
