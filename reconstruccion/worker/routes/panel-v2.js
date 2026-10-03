import {json} from "../core/http.js";
import {subscriberLogin,subscriberSession,verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {
  getCommerceCatalogs,getEventosCatalogs,getActividadesCatalogs,getPublicidadCatalogs
} from "../core/catalogs.js";
import {
  commercePanelData,commerceSetDatos,commerceSetSedes,commerceSetRelacionesSede,commerceDeleteSede
} from "../modules/commerce-v2.js";
import {promosPanelDataV2,promoCreateV2,promoUpdateV2,promoDeleteV2} from "../modules/promos-v2.js";
import {eventosPanelData} from "../modules/eventos.js";
import {vipCreateV2,vipUpdateV2,vipPauseV2,eventDeleteV2} from "../modules/eventos-v2.js";
import {actividadesPanelData} from "../modules/actividades.js";
import {activitySaveV2,activityActionV2} from "../modules/actividades-v2.js";
import {publicidadPanelData} from "../modules/publicidad.js";
import {publicitySaveV2,publicityDeleteV2} from "../modules/publicidad-v2.js";
import {efemeridesPanelData} from "../modules/efemerides.js";
import {farmaciasPanelData} from "../modules/farmacias.js";
import {farmSaveCycleV2} from "../modules/farmacias-v2.js";
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

export async function routePanelV2({path,request,url,env,db,cache}){
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
    if(action==="anunciante")return json(await commercePanelData({db,advertiserId:aid,catalogs:await getCommerceCatalogs(cache)}));
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
    const auth=await requirePanel(env,request,aid,"promos",!["getpaneldata","getpromos"].includes(action));
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
      return json(await eventosPanelData({db,advertiserId:aid,catalogs:await getEventosCatalogs(cache),featureEnabled,cupo,enrichPrograms:null}));
    }
    const payload=body.payload&&typeof body.payload==="object"?body.payload:{};
    if(action==="createvipevent"){
      const advertiser=await db.get("anunciantes",aid);
      return json(await vipCreateV2({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS"),advertiser}));
    }
    if(action==="updatevipevent")return json(await vipUpdateV2({db,cache,advertiserId:aid,payload}));
    if(action==="pausevipevent")return json(await vipPauseV2({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS")}));
    if(action==="deletevipevent")return json(await eventDeleteV2({db,cache,advertiserId:aid,payload,level:"VIP"}));
    return json({success:false,message:"Operación FREE/programación pendiente de migración."},501);
  }

  if(path==="/actividades"&&request.method==="GET"&&actionOf(url)==="getpaneldata"){
    const aid=aidOf(url),auth=await requirePanel(env,request,aid,"actividades");
    if(auth.response)return auth.response;
    const catalogs=await getActividadesCatalogs(cache);
    return json(await actividadesPanelData({
      db,advertiserId:aid,categorias:catalogs.categorias,lugares:catalogs.lugares,
      featureAllowed:a=>featureEnabled(a,"ACTIVIDADES"),cupoMax:a=>cupo(a,"ACTIVIDADES")
    }));
  }
  if(path==="/actividades"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"actividades",true);if(auth.response)return auth.response;
    if(action==="guardar")return json(await activitySaveV2({db,cache,advertiserId:aid,body}));
    if(["renovar","pausar","reanudar","eliminar"].includes(action)){
      return json(await activityActionV2({db,cache,advertiserId:aid,action,activityId:text(body.actividad_id)}));
    }
    return null;
  }

  if(path==="/publicidad"&&request.method==="GET"&&actionOf(url)==="getpaneldata"){
    const aid=aidOf(url),auth=await requirePanel(env,request,aid,"publicidad");
    if(auth.response)return auth.response;
    const catalogs=await getPublicidadCatalogs(cache);
    return json(await publicidadPanelData({
      db,advertiserId:aid,catalogs,
      featureEnabled:a=>featureEnabled(a,"PUBLICIDAD"),
      configFromAdmin:a=>{
        const root=(a&&a.funcionalidades_config)||{};
        return root.PUBLICIDAD||{};
      },
      cambiosHoy:async()=>({usados:0,max:0}),enrichMany:null
    }));
  }
  if(path==="/publicidad"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"publicidad",true);if(auth.response)return auth.response;
    if(action==="guardar")return json(await publicitySaveV2({db,cache,advertiserId:aid,body}));
    if(action==="eliminar")return json(await publicityDeleteV2({db,cache,advertiserId:aid,publicityId:text(body.publicidad_id)}));
    return json({success:false,message:"actualizar_activos pendiente de migración."},501);
  }

  if(path==="/efemerides"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"efemerides",action!=="getpaneldata");if(auth.response)return auth.response;
    if(action==="getpaneldata"){
      const admin=await db.get("anunciantes_administracion",aid);
      const permisos=async()=>({
        efemerides_grl:truthy(admin&&admin.efemerides_grl),
        efemerides_provincial:truthy(admin&&admin.efemerides_provincial),
        efemerides_local:truthy(admin&&admin.efemerides_local),
        todas_provincias:truthy(admin&&admin.efemerides_todas_provincias),
        todas_ciudades:truthy(admin&&admin.efemerides_todas_ciudades),
        provincias:Array.isArray(admin&&admin.efemerides_provincias)?admin.efemerides_provincias:[],
        ciudades:Array.isArray(admin&&admin.efemerides_ciudades)?admin.efemerides_ciudades:[]
      });
      return json(await efemeridesPanelData({db,permisos,advertiserId:aid,canSee:()=>true}));
    }
    return json({success:false,message:"Mutaciones de Efemérides en migración."},501);
  }

  if(path==="/farmacias"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"turnos_farma",action!=="getpaneldata");if(auth.response)return auth.response;
    if(action==="getpaneldata"){
      return json(await farmaciasPanelData({db,advertiserId:aid,featureAllowed:a=>featureEnabled(a,"TURNOS_FARMA")||truthy(a&&a.turnos_farma)}));
    }
    if(action==="guardar_ciclo"){
      const admin=await db.get("anunciantes_administracion",aid);
      const territory=(await cache.get("territorio:public:v1"))||{};
      const allowed=Array.isArray(admin&&admin.farmacias_ciudades)&&admin.farmacias_ciudades.length
        ? admin.farmacias_ciudades.map(text)
        : (territory.ciudades||[]).map(c=>text(c.ciudad_id||c.id)).filter(Boolean);
      return json(await farmSaveCycleV2({db,cache,advertiserId:aid,body,allowedCityIds:allowed}));
    }
    return null;
  }

  return null;
}
