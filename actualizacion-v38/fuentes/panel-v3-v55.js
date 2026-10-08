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
import {
  createEventV3,updateEventV3,pauseEventV3,deleteEventV3,duplicateVipV3
} from "../modules/eventos-v3.js";
import {actividadesPanelData} from "../modules/actividades.js";
import {activitySaveV2,activityActionV2} from "../modules/actividades-v2.js";
import {publicidadPanelData} from "../modules/publicidad.js";
import {publicitySaveV2} from "../modules/publicidad-v2.js";
import {publicityActiveChangeV3,publicityDeleteSafeV3,configFromAdmin} from "../modules/publicidad-v3.js";
import {efemeridesPanelData} from "../modules/efemerides.js";
import {efemSaveV2,efemToggleV2,efemDeleteV2} from "../modules/efemerides-v2.js";
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
function efemPermisos(admin){
  const a=admin||{},raw=Array.isArray(a.funcionalidades)?a.funcionalidades:text(a.funcionalidades).split(/[;,|\n]/);
  const flags=new Set(raw.map(v=>text(v).toUpperCase()));
  const root=a.funcionalidades_config||{},local=root.EFEMERIDES_LOCAL||{},prov=root.EFEMERIDES_PROVINCIAL||{};
  return {
    efemerides_grl:truthy(a.efemerides_grl)||flags.has('EF GENERAL')||flags.has('EFEMERIDES_GENERAL')||flags.has('EFEMERIDES_GRL'),
    efemerides_provincial:truthy(a.efemerides_provincial)||flags.has('EF PROVINCIAL')||flags.has('EFEMERIDES_PROVINCIAL'),
    efemerides_local:truthy(a.efemerides_local)||flags.has('EF LOCAL')||flags.has('EFEMERIDES_LOCAL'),
    todas_provincias:truthy(a.efemerides_todas_provincias)||truthy(prov.todas_provincias),
    todas_ciudades:truthy(a.efemerides_todas_ciudades)||truthy(local.todas_ciudades),
    provincias:(Array.isArray(prov.provincias)?prov.provincias:Array.isArray(a.efemerides_provincias)?a.efemerides_provincias:[]).map(text),
    ciudades:(Array.isArray(local.ciudades)?local.ciudades:Array.isArray(a.efemerides_ciudades)?a.efemerides_ciudades:[]).map(text)
  };
}

export async function routePanelV3({path,request,url,env,db,cache}){
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
    const auth=await requirePanel(env,request,aid,"modificar_datos");if(auth.response)return auth.response;
    if(action==="permisos_panel"){
      const admin=await (db.panelAdministration?db.panelAdministration(aid):db.get("anunciantes_administracion",aid));
      return json({success:!!admin,id:aid,administracion:admin||{}},admin?200:404);
    }
    if(action==="anunciante")return json(await commercePanelData({db,advertiserId:aid,catalogs:await getCommerceCatalogs(cache)}));
    return null;
  }

  if(path==="/commerce"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    if(!aid)return json({success:false,message:"Falta advertiserId"},400);
    const auth=await requirePanel(env,request,aid,"modificar_datos",true);if(auth.response)return auth.response;
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
    const auth=await requirePanel(env,request,aid,"promos",!["getpaneldata","getpromos"].includes(action));if(auth.response)return auth.response;
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
    const freeAction=action.includes("free");
    const moduleName=freeAction?"eventos_free":"eventos";
    const readActions=["getpaneldata","paneldata","bootstrap","geteventospanel","getvipevents","getfreeevents"];
    const auth=await requirePanel(env,request,aid,moduleName,!readActions.includes(action));if(auth.response)return auth.response;
    const admin=await db.get("anunciantes_administracion",aid);

    if(["getpaneldata","paneldata","bootstrap","geteventospanel"].includes(action)){
      return json(await eventosPanelData({db,advertiserId:aid,catalogs:await getEventosCatalogs(cache),featureEnabled,cupo,enrichPrograms:null}));
    }

    const payload=body.payload&&typeof body.payload==="object"?body.payload:{};
    const advertiser=await db.get("anunciantes",aid);

    if(action==="createvipevent")return json(await createEventV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS"),advertiser,level:"VIP"}));
    if(action==="updatevipevent")return json(await updateEventV3({db,cache,advertiserId:aid,payload,level:"VIP"}));
    if(action==="pausevipevent")return json(await pauseEventV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS"),level:"VIP"}));
    if(action==="deletevipevent")return json(await deleteEventV3({db,cache,advertiserId:aid,payload,level:"VIP"}));
    if(action==="duplicatevipevent"||action==="duplicate")return json(await duplicateVipV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS"),advertiser}));

    if(action==="createfreeevent")return json(await createEventV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS_FREE"),advertiser,level:"FREE"}));
    if(action==="updatefreeevent")return json(await updateEventV3({db,cache,advertiserId:aid,payload,level:"FREE"}));
    if(action==="pausefreeevent")return json(await pauseEventV3({db,cache,advertiserId:aid,payload,max:cupo(admin,"EVENTOS_FREE"),level:"FREE"}));
    if(action==="deletefreeevent")return json(await deleteEventV3({db,cache,advertiserId:aid,payload,level:"FREE"}));

    return null;
  }

  if(path==="/actividades"&&request.method==="GET"&&actionOf(url)==="getpaneldata"){
    const aid=aidOf(url),auth=await requirePanel(env,request,aid,"actividades");if(auth.response)return auth.response;
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
    const aid=aidOf(url),auth=await requirePanel(env,request,aid,"publicidad");if(auth.response)return auth.response;
    const catalogs=await getPublicidadCatalogs(cache);
    const admin=await db.get("anunciantes_administracion",aid);
    return json(await publicidadPanelData({
      db,advertiserId:aid,catalogs,
      featureEnabled:a=>featureEnabled(a,"PUBLICIDAD"),
      configFromAdmin,
      cambiosHoy:async()=>{
        const cfg=configFromAdmin(admin||{}),fecha=new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
        const c=await db.get("publicidad_cambios",aid+"_"+fecha);
        const usados=Number(c&&c.usados||0),max=Number(cfg.cambios_activos_por_dia_max||0);
        return{usados,max,disponibles:max>0?Math.max(0,max-usados):0};
      },
      enrichMany:null
    }));
  }
  if(path==="/publicidad"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"publicidad",true);if(auth.response)return auth.response;
    if(action==="guardar"){
      const admin=await db.get("anunciantes_administracion",aid);
      return json(await publicitySaveV2({
        db,cache,advertiserId:aid,body,
        config:configFromAdmin(admin||{})
      }));
    }
    if(action==="actualizar_activos")return json(await publicityActiveChangeV3({db,cache,advertiserId:aid,ids:body.publicidad_ids}));
    if(action==="eliminar")return json(await publicityDeleteSafeV3({db,cache,advertiserId:aid,publicityId:text(body.publicidad_id)}));
    return null;
  }

  if(path==="/efemerides"&&request.method==="POST"){
    const body=await bodyOf(request),action=actionOf(url,body),aid=aidOf(url,body);
    const auth=await requirePanel(env,request,aid,"efemerides",action!=="getpaneldata");if(auth.response)return auth.response;
    const readAction=["getpaneldata","paneldata","bootstrap","listar","listar_admin","list"].includes(action);
    const readDb=readAction&&db.panelReadDb?db.panelReadDb():db;
    const admin=await readDb.get("anunciantes_administracion",aid),permisos=efemPermisos(admin||{});
    if(["getpaneldata","paneldata","bootstrap","listar","listar_admin","list"].includes(action)){
      return json(await efemeridesPanelData({db,permisos:async()=>permisos,advertiserId:aid,canSee:()=>true}));
    }
    if(action==="guardar"||action==="save")return json(await efemSaveV2({db,cache,advertiserId:aid,body,permisos}));
    if(action==="activar"||action==="desactivar"){
      const id=text(body.efemeride_id||body.id||(body.payload&&(body.payload.efemeride_id||body.payload.id)));
      return json(await efemToggleV2({db,cache,id,activo:action==="activar",permisos}));
    }
    if(action==="eliminar"||action==="delete"){
      const id=text(body.efemeride_id||body.id||(body.payload&&(body.payload.efemeride_id||body.payload.id)));
      return json(await efemDeleteV2({db,cache,id,permisos}));
    }
    return null;
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
