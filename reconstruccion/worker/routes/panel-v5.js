import {json} from "../core/http.js";
import {routePanelV4} from "./panel-v4.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {
  commercePanelData,commerceSetDatos,commerceSetSedes,commerceSetRelacionesSede,commerceDeleteSede
} from "../modules/commerce-v2.js";
import {getCommerceCatalogs} from "../core/catalogs.js";
import {syncGuideAdvertiserV2} from "../core/guide-read-model-v2.js";
import {syncAdvertiserIndexV2} from "../core/admin-indexes-v2.js";

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

export async function routePanelV5(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/commerce"&&request.method==="GET"){
    const action=actionOf(url),aid=aidOf(url);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const auth=await requirePanel(env,request,aid,false);if(auth.response)return auth.response;

    if(action==="permisos_panel"){
      const admin=await (db.panelAdministration?db.panelAdministration(aid):db.get("anunciantes_administracion",aid));
      return json({success:!!admin,id:aid,administracion:admin||{}},admin?200:404);
    }
    if(action==="anunciante"){
      return json(await commercePanelData({
        db,advertiserId:aid,catalogs:await getCommerceCatalogs(cache)
      }));
    }
    return null;
  }

  if(path==="/commerce"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const auth=await requirePanel(env,request,aid,true);if(auth.response)return auth.response;

    if(action==="set_datos"){
      const out=await commerceSetDatos({db,advertiserId:aid,body});
      await Promise.all([
        syncGuideAdvertiserV2({db,cache,advertiserId:aid}),
        syncAdvertiserIndexV2({db,cache,advertiserId:aid})
      ]);
      return json(out);
    }

    if(action==="set_sedes"){
      const previous=await db.queryEqual("anunciantes_sedes","anunciante_id",aid,500);
      const previousCities=[...new Set(previous.map(x=>text(x.ciudad_id)).filter(Boolean))];
      const out=await commerceSetSedes({db,advertiserId:aid,body});
      await Promise.all([
        syncGuideAdvertiserV2({db,cache,advertiserId:aid,affectedCityIds:previousCities}),
        syncAdvertiserIndexV2({db,cache,advertiserId:aid})
      ]);
      return json(out);
    }

    if(action==="set_relaciones_sede"){
      const out=await commerceSetRelacionesSede({db,advertiserId:aid,body});
      await syncGuideAdvertiserV2({db,cache,advertiserId:aid});
      return json(out);
    }

    if(action==="delete_sede"){
      const sedeId=text(body.sede_id);
      const sede=sedeId?await db.get("anunciantes_sedes",sedeId):null;
      const previousCities=sede&&text(sede.ciudad_id)?[text(sede.ciudad_id)]:[];
      const out=await commerceDeleteSede({db,advertiserId:aid,body});
      await syncGuideAdvertiserV2({db,cache,advertiserId:aid,affectedCityIds:previousCities});
      return json(out);
    }

    return null;
  }

  return routePanelV4(ctx);
}
