import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV5} from "./admin-v5.js";
import {pendingAllV2,resolvePendingV2} from "../modules/moderacion-general-v2.js";
import {rebuildEfemeridesAllV3} from "../core/efemerides-read-model-v2.js";

const text=v=>String(v??"").trim();

function canModerate(auth){
  const role=text(auth&&auth.rol).toUpperCase();
  return ["SUPERADMIN_PRINCIPAL","SUPERADMIN","ADMIN_LOCAL"].includes(role);
}

export async function routeAdminV6(ctx){
  const {path,request,env,db,cache}=ctx;

  if(path==="/superadmin/efemerides/rebuild-cache"&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(text(auth.rol).toUpperCase())){
      return json({success:false,message:"Permiso insuficiente."},403);
    }
    return json(await rebuildEfemeridesAllV3({db,cache}));
  }

  if(path==="/superadmin/moderation/pending"&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!canModerate(auth))return json({success:false,message:"Permiso insuficiente."},403);
    return json(await pendingAllV2({db}));
  }

  if(path==="/superadmin/moderation/resolve"&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!canModerate(auth))return json({success:false,message:"Permiso insuficiente."},403);

    let body={};
    try{body=await request.json()}catch(_){}

    return json(await resolvePendingV2({
      db,
      cache,
      auth,
      tipo:text(body.tipo),
      id:text(body.id||body.evento_id||body.actividad_id||body.solicitud_id),
      decision:text(body.decision),
      nivel:text(body.nivel)
    }));
  }

  return routeAdminV5(ctx);
}
