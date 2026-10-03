import {json} from "../core/http.js";
import {subscriberLogin,subscriberSession,verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {getCommerceCatalogs,getEventosCatalogs} from "../core/catalogs.js";
import {commercePanelData,commerceSetDatos,commerceSetSedes,commerceSetRelacionesSede,commerceDeleteSede} from "../modules/commerce-v2.js";
import {promosPanelDataV2,promoCreateV2,promoUpdateV2,promoDeleteV2} from "../modules/promos-v2.js";
import {eventosPanelData} from "../modules/eventos.js";
import {vipCreateV2,vipUpdateV2,vipPauseV2,eventDeleteV2} from "../modules/eventos-v2.js";
import {syncGuideAdvertiser} from "../core/guide-read-model.js";

const text=v=>String(v??"").trim();
const truthy=v=>v===true||v===1||["true","1","si","sí","x","activo","activa"].includes(text(v).toLowerCase());

async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}

function featureEnabled(admin,name){
  const key=text(name).toUpperCase();
  const raw=Array.isArray(admin&&admin.funcionalidades)?admin.funcionalidades:text(admin&&admin.funcionalidades).split(/[;,|\n]/);
  const set=new Set(raw.map(x=>text(x).toUpperCase()).filter(Boolean));
  if(set.has(key))return true;
  return truthy(admin&&admin[key.toLowerCase()]);
}
function cupo(admin,name){
  const key=text(name).toUpperCase();
  const cfg=(admin&&admin.funcionalidades_config&&admin.funcionalidades_config[key])||{};
  for(const v of [cfg.cantidad,cfg.cupo,cfg.max,cfg.maximo,admin&&admin[key.toLowerCase()+"_cant"]]){
    const n=Number(v);if(Number.isFinite(n)&&n>=0)return Math.floor(n);
  }
  return 0;
}
async function requirePanel(env,request,aid,moduleName,write=false){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)return{response:json({success:false,message:s.message},401)};
  if(aid&&!sessionAllows(s,aid,moduleName,{write})){
    return{response:json({success:false,message:"No tenés permiso para esta operación."},403)};
  }
  return{session:s};
}

export async function routePanel({path,request,url,env,db,cache}){
  if(path==="/suscriptores"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body);
    if(action==="login")return json(await subscriberLogin({env,db,body}));
    if(action==="session"){
      const out=await subscriberSession({env,request});
      return json(out,out.status||200);
    }
    return null;
  }

  if(path==="/commerce"&&request.method==="GET"){
    const action=actionOf(url),aid=aidOf(url);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const auth=await requirePanel(env,request,aid,"modificar_datos");
    if(auth.response)return auth.response;

    if(action==="permisos_panel"){
      const admin=await db.get("anunciantes_administracion",aid);
      return json({success:!!admin,id:aid,administracion:admin||{}},admin?200:404);
    }
    if(action==="anunciante"){
      return json(await commercePanelData({db,advertiserId:aid,catalogs:await getCommerceCatalogs(cache)}));
    }
    return null;
  }

  if(path==="/commerce"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const auth=await requirePanel(env,request,aid,"modificar_datos",true);
    if(auth.response)return auth.response;

    if(action==="set_datos"){
      const out=await commerceSetDatos({db,advertiserId:aid,body});
      await syncGuideAdvertiser({db,cache,advertiserId:aid});
      return json(out);
    }
    if(action==="set_sedes"){
      const old=await db.queryEqual("anunciantes_sedes","anunciante_id",aid);
      const oldCities=[...new Set(old.map(x=>text(x.ciudad_id)).filter(Boolean))];
      const out=await commerceSetSedes({db,advertiserId:aid,body});
      await syncGuideAdvertiser({db,cache,advertiserId:aid,affectedCityIds:oldCities});
      return json(out);
    }
    if(action==="set_relaciones_sede"){
      const out=await commerceSetRelacionesSede({db,advertiserId:aid,body});
      await syncGuideAdvertiser({db,cache,advertiserId:aid});
      return json(out);
    }
    if(action==="delete_sede"){
      const out=await commerceDeleteSede({db,advertiserId:aid,body});
      await syncGuideAdvertiser({db,cache,advertiserId:aid});
      return json(out);
    }
    return null;
  }

  if(path==="/promos"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const write=!["getpaneldata","getpromos"].includes(action);
    const auth=await requirePanel(env,request,aid,"promos",write);
    if(auth.response)return auth.response;
    const cupoFromAdmin=a=>cupo(a,"PROMOS");

    if(action==="getpaneldata")return json(await promosPanelDataV2({db,cache,advertiserId:aid,cupoFromAdmin}));
    if(action==="createpromo")return json(await promoCreateV2({db,cache,advertiserId:aid,body,cupoFromAdmin}));
    if(action==="updatepromo")return json(await promoUpdateV2({db,cache,advertiserId:aid,body,cupoFromAdmin}));
    if(action==="deletepromo")return json(await promoDeleteV2({db,cache,advertiserId:aid,body}));
    return null;
  }

  if(path==="/events-new"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const moduleName=action.includes("free")?"eventos_free":"eventos";
    const write=!["getpaneldata","paneldata","bootstrap","geteventospanel","getvipevents","getfreeevents"].includes(action);
    const auth=await requirePanel(env,request,aid,moduleName,write);
    if(auth.response)return auth.response;

    const admin=await db.get("anunciantes_administracion",aid);
    if(["getpaneldata","paneldata","bootstrap","geteventospanel"].includes(action)){
      const catalogs=await getEventosCatalogs(cache);
      return json(await eventosPanelData({db,advertiserId:aid,catalogs,featureEnabled,cupo,enrichPrograms:null}));
    }

    const payload=body.payload&&typeof body.payload==="object"?body.payload:{};
    if(action==="createvipevent"){
      const advertiser=await db.get("anunciantes",aid);
      return json(await vipCreateV2({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS"),advertiser}));
    }
    if(action==="updatevipevent")return json(await vipUpdateV2({db,cache,advertiserId:aid,payload}));
    if(action==="pausevipevent")return json(await vipPauseV2({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS")}));
    if(action==="deletevipevent")return json(await eventDeleteV2({db,cache,advertiserId:aid,payload,level:"VIP"}));

    return json({success:false,message:"La operación FREE o programación todavía está en migración."},501);
  }

  return null;
}
