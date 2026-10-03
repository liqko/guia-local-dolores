import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV7} from "./admin-v7.js";
import {
  adminSearchAdvertisersV2,
  adminSearchSubscribersV2,
  adminAdvertiserDetailV2,
  adminSubscriberDetailV2
} from "../modules/superadmin-directorio-v2.js";
import {rebuildAdminIndexesV2} from "../core/admin-indexes-v2.js";

export async function routeAdminV8(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/superadmin/advertisers/search"&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    return json(await adminSearchAdvertisersV2({cache,url}));
  }

  let m=path.match(/^\/superadmin\/advertisers\/([^/]+)$/);
  if(m&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    return json(await adminAdvertiserDetailV2({db,id:decodeURIComponent(m[1])}));
  }

  if(path==="/superadmin/subscribers/search"&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    return json(await adminSearchSubscribersV2({cache,url}));
  }

  m=path.match(/^\/superadmin\/subscribers\/([^/]+)$/);
  if(m&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    return json(await adminSubscriberDetailV2({db,id:decodeURIComponent(m[1])}));
  }

  if(path==="/superadmin/directories/rebuild-cache"&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(String(auth.rol||"").trim().toUpperCase())){
      return json({success:false,message:"Permiso insuficiente."},403);
    }
    return json(await rebuildAdminIndexesV2({db,cache}));
  }

  return routeAdminV7(ctx);
}
