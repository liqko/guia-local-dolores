import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {routeAdminV8} from "./admin-v8.js";
import {listAdminCatalogV2,saveAdminCatalogV2} from "../modules/superadmin-catalogos-v2.js";

const text=v=>String(v??"").trim();

function canManageCatalogs(auth){
  return ["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(text(auth&&auth.rol).toUpperCase());
}

export async function routeAdminV9(ctx){
  const {path,request,url,env,db,cache}=ctx;

  let m=path.match(/^\/superadmin\/catalogs\/([^/]+)$/);

  if(m&&request.method==="GET"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);

    return json(await listAdminCatalogV2({
      cache,
      tipo:decodeURIComponent(m[1]),
      cityId:text(url.searchParams.get("ciudad_id"))
    }));
  }

  if(m&&request.method==="POST"){
    const auth=await verifyAdmin(env,request);
    if(!auth.ok)return json({success:false,message:auth.message},401);
    if(!canManageCatalogs(auth))return json({success:false,message:"Permiso insuficiente."},403);

    let body={};
    try{body=await request.json()}catch(_){}

    return json(await saveAdminCatalogV2({
      db,
      cache,
      tipo:decodeURIComponent(m[1]),
      item:body&&body.item&&typeof body.item==="object"?body.item:body,
      cityId:text(body.ciudad_id||url.searchParams.get("ciudad_id"))
    }));
  }

  return routeAdminV8(ctx);
}
