import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV10} from "./admin-v10.js";
import {pendingAllV3,resolvePendingV3} from "../modules/moderacion-general-v3.js";

const text=v=>String(v??"").trim();

function canModerate(auth){
  return ["SUPERADMIN_PRINCIPAL","SUPERADMIN","ADMIN_LOCAL"].includes(text(auth&&auth.rol).toUpperCase());
}

export async function routeAdminV11(ctx){
  const {path,request,env,db,cache}=ctx;

  if(path==="/superadmin/moderation/pending"&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!canModerate(auth))return json({success:false,message:"Permiso insuficiente."},403);
    return json(await pendingAllV3({db}));
  }

  if(path==="/superadmin/moderation/resolve"&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!canModerate(auth))return json({success:false,message:"Permiso insuficiente."},403);

    let body={};
    try{body=await request.json()}catch(_){}

    return json(await resolvePendingV3({
      db,cache,auth,
      tipo:text(body.tipo),
      id:text(body.id||body.evento_id||body.actividad_id||body.solicitud_id),
      decision:text(body.decision),
      nivel:text(body.nivel)
    }));
  }

  return routeAdminV10(ctx);
}
