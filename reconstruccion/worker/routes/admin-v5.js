import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV4} from "./admin-v4.js";
import {
  updateAdvertiserProfileV2,
  updateAdvertiserSedeRelationsV2
} from "../modules/superadmin-anunciantes-profile-v2.js";

export async function routeAdminV5(ctx){
  const {path,request,env,db,cache}=ctx;

  let m=path.match(/^\/superadmin\/advertisers\/([^/]+)\/profile$/);
  if(m&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    let body={};try{body=await request.json()}catch(_){}
    return json(await updateAdvertiserProfileV2({
      db,cache,auth,
      advertiserId:decodeURIComponent(m[1]),
      payload:body&&body.payload&&typeof body.payload==="object"?body.payload:body
    }));
  }

  m=path.match(/^\/superadmin\/advertisers\/([^/]+)\/sedes\/relations$/);
  if(m&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    let body={};try{body=await request.json()}catch(_){}
    return json(await updateAdvertiserSedeRelationsV2({
      db,cache,auth,
      advertiserId:decodeURIComponent(m[1]),
      sedes:Array.isArray(body.sedes)?body.sedes:[]
    }));
  }

  return routeAdminV4(ctx);
}
