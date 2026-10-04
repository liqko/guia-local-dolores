import {json} from "../core/http.js";
import {routePanelV3} from "./panel-v3.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {eventsPanelDataV2,checkFreeDuplicatesV2} from "../modules/eventos-panel-v2.js";
import {
  createEventV3,updateEventV3,pauseEventV3,deleteEventV3,duplicateVipV3
} from "../modules/eventos-v3.js";
import {publicidadPanelDataV2} from "../modules/publicidad-panel-v2.js";
import {publicitySaveV2} from "../modules/publicidad-v2.js";
import {publicityActiveChangeV3,publicityDeleteSafeV3,configFromAdmin} from "../modules/publicidad-v3.js";
import {farmaciasPanelDataV3} from "../modules/farmacias-panel-v3.js";
import {farmSaveCycleV2} from "../modules/farmacias-v2.js";

const text=v=>String(v??"").trim();
const truthy=v=>v===true||v===1||["true","1","si","sí","x","activo","activa"].includes(text(v).toLowerCase());

async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}
function featureEnabled(admin,name){
  const key=text(name).toUpperCase();
  const raw=Array.isArray(admin&&admin.funcionalidades)?admin.funcionalidades:text(admin&&admin.funcionalidades).split(/[;,|\n]/);
  const set=new Set(raw.map(x=>text(x).toUpperCase()).filter(Boolean));
  return set.has(key)||truthy(admin&&admin[key.toLowerCase()]);
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
async function allowedFarmCities({db,cache,aid}){
  const admin=await db.get("anunciantes_administracion",aid);
  const territory=(await cache.get("territorio:public:v1"))||{};
  const cfgRoot=admin&&admin.funcionalidades_config&&typeof admin.funcionalidades_config==="object"
    ? admin.funcionalidades_config
    : {};
  const cfg=cfgRoot.TURNOS_FARMA||cfgRoot.FARMACIAS||cfgRoot.turnos_farma||{};
  const all=truthy(cfg.todas_ciudades)||text(admin&&admin.turnos_farma)==="*";
  const ids=Array.isArray(cfg.ciudades)
    ? cfg.ciudades.map(text).filter(Boolean)
    : text(admin&&admin.turnos_farma).split(/[;,|]+/).map(text).filter(v=>v&&v!=="*");

  if(all||!ids.length){
    return (territory.ciudades||[]).map(c=>text(c.ciudad_id||c.id)).filter(Boolean);
  }
  return [...new Set(ids)];
}

export async function routePanelV4(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/events-new"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);

    const freeAction=action.includes("free");
    const moduleName=freeAction?"eventos_free":"eventos";
    const readActions=["getpaneldata","paneldata","bootstrap","geteventospanel","getvipevents","getfreeevents","checkfreeeventduplicates"];
    const auth=await requirePanel(env,request,aid,moduleName,!readActions.includes(action));
    if(auth.response)return auth.response;

    if(["getpaneldata","paneldata","bootstrap","geteventospanel"].includes(action)){
      return json(await eventsPanelDataV2({db,cache,advertiserId:aid,featureEnabled,cupo}));
    }

    const payload=body.payload&&typeof body.payload==="object"?body.payload:{};

    if(action==="getvipevents"||action==="getfreeevents"){
      const panel=await eventsPanelDataV2({db,cache,advertiserId:aid,featureEnabled,cupo});
      const rows=action==="getfreeevents"?panel.eventos_free:panel.eventos;
      return json({success:true,events:rows,eventos:rows,rows});
    }

    if(action==="checkfreeeventduplicates"){
      return json({success:true,duplicados:await checkFreeDuplicatesV2({db,payload})});
    }

    const creates=["createvipevent","createfreeevent","duplicatevipevent","duplicate"].includes(action);
    const admin=creates?await db.get("anunciantes_administracion",aid):null;
    const advertiser=creates?await db.get("anunciantes",aid):null;

    if(action==="createvipevent")return json(await createEventV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS"),advertiser,level:"VIP"}));
    if(action==="updatevipevent")return json(await updateEventV3({db,cache,advertiserId:aid,payload,level:"VIP"}));
    if(action==="pausevipevent")return json(await pauseEventV3({db,cache,advertiserId:aid,payload,max:async()=>cupo(await db.get("anunciantes_administracion",aid),"EVENTOS"),level:"VIP"}));
    if(action==="deletevipevent")return json(await deleteEventV3({db,cache,advertiserId:aid,payload,level:"VIP"}));
    if(action==="duplicatevipevent"||action==="duplicate")return json(await duplicateVipV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS"),advertiser}));

    if(action==="createfreeevent")return json(await createEventV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS_FREE"),advertiser,level:"FREE"}));
    if(action==="updatefreeevent")return json(await updateEventV3({db,cache,advertiserId:aid,payload,level:"FREE"}));
    if(action==="pausefreeevent")return json(await pauseEventV3({db,cache,advertiserId:aid,payload,max:async()=>cupo(await db.get("anunciantes_administracion",aid),"EVENTOS_FREE"),level:"FREE"}));
    if(action==="deletefreeevent")return json(await deleteEventV3({db,cache,advertiserId:aid,payload,level:"FREE"}));

    return null;
  }

  if(path==="/publicidad"&&request.method==="GET"&&actionOf(url)==="getpaneldata"){
    const aid=aidOf(url);
    const auth=await requirePanel(env,request,aid,"publicidad");
    if(auth.response)return auth.response;
    return json(await publicidadPanelDataV2({
      db,cache,advertiserId:aid,
      featureEnabled:a=>featureEnabled(a,"PUBLICIDAD"),
      configFromAdmin
    }));
  }

  if(path==="/publicidad"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"publicidad",true);
    if(auth.response)return auth.response;

    if(action==="guardar")return json(await publicitySaveV2({db,cache,advertiserId:aid,body}));
    if(action==="actualizar_activos")return json(await publicityActiveChangeV3({db,cache,advertiserId:aid,ids:body.publicidad_ids}));
    if(action==="eliminar")return json(await publicityDeleteSafeV3({db,cache,advertiserId:aid,publicityId:text(body.publicidad_id)}));
    return null;
  }

  if(path==="/farmacias"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"turnos_farma",action!=="getpaneldata");
    if(auth.response)return auth.response;
    const allowed=await allowedFarmCities({db,cache,aid});

    if(action==="getpaneldata"){
      return json(await farmaciasPanelDataV3({
        db,cache,advertiserId:aid,
        featureAllowed:a=>featureEnabled(a,"TURNOS_FARMA")||truthy(a&&a.turnos_farma),
        allowedCityIds:allowed
      }));
    }

    if(action==="guardar_ciclo"){
      return json(await farmSaveCycleV2({db,cache,advertiserId:aid,body,allowedCityIds:allowed}));
    }

    return null;
  }

  return routePanelV3(ctx);
}
