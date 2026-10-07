import {json} from "../core/http.js";
import {routePanelV9} from "./panel-v9.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {getCommerceCatalogs} from "../core/catalogs.js";
import {commercePanelDataV3,commerceSetDatosV3,commerceSetSedesV3,commerceDeleteSedeV3} from "../modules/commerce-v3.js";
import {patchGuideAdvertiserDataFromCacheV2,patchGuideAdvertiserSedesFromCacheV2} from "../core/commerce-cache-patch-v2.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}

async function requirePanel(env,request,aid,write=false){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)return{response:json({success:false,message:s.message},401)};
  if(!sessionAllows(s,aid,"modificar_datos",{write})){
    return{response:json({success:false,message:"No tenés permiso para esta operación."},403)};
  }
  return{session:s};
}

export async function routePanelV10(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/commerce"&&request.method==="GET"){
    const action=actionOf(url),aid=aidOf(url);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const auth=await requirePanel(env,request,aid,false);
    if(auth.response)return auth.response;

    if(action==="permisos_panel"){
      const admin=await (db.panelAdministration?db.panelAdministration(aid):db.get("anunciantes_administracion",aid));
      return json({success:!!admin,id:aid,administracion:admin||{}},admin?200:404);
    }
    if(action==="anunciante"){
      return json(await commercePanelDataV3({db,advertiserId:aid,catalogs:await getCommerceCatalogs(cache)}));
    }
    return null;
  }

  if(path==="/commerce"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const auth=await requirePanel(env,request,aid,true);
    if(auth.response)return auth.response;

    if(action==="set_datos"){
      const out=await commerceSetDatosV3({db,advertiserId:aid,body});
      if(out.updated){
        await patchGuideAdvertiserDataFromCacheV2({cache,advertiserId:aid,patch:out.patch||{}});
      }
      return json(out);
    }

    if(action==="set_sedes"){
      const out=await commerceSetSedesV3({db,cache,advertiserId:aid,body});
      if(out.updated){
        await patchGuideAdvertiserSedesFromCacheV2({cache,advertiserId:aid,savedSedes:out.changed_sedes||[]});
      }
      return json(out);
    }

    if(action==="delete_sede"){
      const out=await commerceDeleteSedeV3({db,advertiserId:aid,body});
      await patchGuideAdvertiserSedesFromCacheV2({cache,advertiserId:aid,deletedSedeId:out.sede_id});
      return json(out);
    }

    return null;
  }

  return routePanelV9(ctx);
}
