import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV3} from "./admin-v3.js";
import {updateAdvertiserCommercialV2} from "../modules/superadmin-anunciantes-v2.js";
import {rebuildGuideAllV2} from "../core/guide-read-model-v2.js";

const text=v=>String(v??"").trim();

export async function routeAdminV4(ctx){
  const {path,request,env,db,cache}=ctx;

  let m=path.match(/^\/superadmin\/advertisers\/([^/]+)\/commercial$/);
  if(m&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    let body={};try{body=await request.json()}catch(_){}
    return json(await updateAdvertiserCommercialV2({
      db,cache,auth,
      advertiserId:decodeURIComponent(m[1]),
      payload:body&&body.payload&&typeof body.payload==="object"?body.payload:body
    }));
  }

  if(path==="/superadmin/guide/rebuild-cache"&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(text(auth.rol).toUpperCase())){
      return json({success:false,message:"Permiso insuficiente."},403);
    }
    return json(await rebuildGuideAllV2({db,cache}));
  }

  return routeAdminV3(ctx);
}
