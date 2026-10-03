import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV9} from "./admin-v9.js";
import {superadminLoginV2} from "../modules/superadmin-session-v2.js";
import {superadminDashboardV2} from "../modules/superadmin-dashboard-v2.js";

export async function routeAdminV10(ctx){
  const {path,request,env,db,cache}=ctx;

  if(path==="/superadmin/session/login"&&request.method==="POST"){
    let body={};try{body=await request.json()}catch(_){}
    const out=await superadminLoginV2({env,db,body});
    return json(out,out.success?200:401);
  }

  if(path==="/superadmin/dashboard"&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    return json(await superadminDashboardV2({cache}));
  }

  return routeAdminV9(ctx);
}
