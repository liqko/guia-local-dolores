import {createDb} from "./core/db.js";
import {createCache} from "./core/cache.js";
import {cors,json} from "./core/http.js";
import {verifyAdmin} from "./core/auth-admin.js";
import {
  rebuildCatalogs,
  getCommerceCatalogs,
  getPromosCatalogs,
  getEventosCatalogs,
  getActividadesCatalogs,
  getPublicidadCatalogs
} from "./core/catalogs.js";
import {territoryPublic,territoryAdmin,saveCountry,saveProvince,saveCity,rebuildTerritory} from "./modules/territory.js";
import {subscriberLogin,subscriberSession,verifySubscriberSession,sessionAllows} from "./modules/suscriptores.js";
import {commercePanelData} from "./modules/commerce.js";
import {promosPanelData} from "./modules/promos.js";
import {eventosPanelData} from "./modules/eventos.js";
import {actividadesPanelData} from "./modules/actividades.js";
import {publicidadPanelData} from "./modules/publicidad.js";
import {efemeridesPanelData} from "./modules/efemerides.js";
import {farmaciasPanelData} from "./modules/farmacias.js";

const clean=p=>{p=String(p||"/").replace(/\/+/g,"/");return p.length>1&&p.endsWith("/")?p.slice(0,-1):p;};
const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x","activo","activa"].includes(text(v).toLowerCase());

async function readJson(request){
  try{return await request.json();}catch(_){return{};}
}
function actionOf(url,body={}){
  return text(body.action||body.accion||url.searchParams.get("action")).toLowerCase();
}
function advertiserIdOf(url,body={}){
  return text(body.advertiserId||body.advertiser_id||body.id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"));
}
async function requireSubscriber(env,request,advertiserId,moduleName,{write=false}={}){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)return {response:json({success:false,message:s.message},401)};
  if(advertiserId&&!sessionAllows(s,advertiserId,moduleName,{write})){
    return {response:json({success:false,message:"No tenés permiso para esta operación."},403)};
  }
  return {session:s};
}
function featureEnabled(admin,name){
  const n=text(name).toUpperCase();
  const raw=Array.isArray(admin&&admin.funcionalidades)
    ? admin.funcionalidades
    : text(admin&&admin.funcionalidades).split(/[;,|\n]/);
  const set=new Set(raw.map(x=>text(x).toUpperCase()).filter(Boolean));
  if(set.has(n))return true;
  if(n==="EVENTOS_FREE")return bool(admin&&admin.eventos_free);
  if(n==="EVENTOS")return bool(admin&&admin.eventos);
  return bool(admin&&admin[n.toLowerCase()]);
}
function cupo(admin,name){
  const n=text(name).toUpperCase();
  const root=admin&&admin.funcionalidades_config&&typeof admin.funcionalidades_config==="object"?admin.funcionalidades_config:{};
  const cfg=root[n]&&typeof root[n]==="object"?root[n]:{};
  for(const v of [cfg.cantidad,cfg.cupo,cfg.max,cfg.maximo,admin&&admin[n.toLowerCase()+"_cant"]]){
    const num=Number(v); if(Number.isFinite(num)&&num>=0)return Math.floor(num);
  }
  return 0;
}

export default{
  async fetch(request,env){
    try{
      if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
      const url=new URL(request.url);
      const p=clean(url.pathname);
      const db=createDb(env),cache=createCache(env);

      if(p==="/")return json({success:true,app:"Guía Local reconstrucción modular",version:"3"});

      // TERRITORIO
      if(p==="/territory/public"&&request.method==="GET")return territoryPublic({cache});
      if(p==="/superadmin/territory"&&request.method==="GET")return territoryAdmin({env,request,cache});
      if(p==="/superadmin/territory/rebuild-cache"&&request.method==="POST")return rebuildTerritory({env,request,db,cache});
      if(p==="/superadmin/countries/create"&&request.method==="POST")return saveCountry({env,request,db,cache});
      if(p==="/superadmin/provinces/create"&&request.method==="POST")return saveProvince({env,request,db,cache});
      if(p==="/superadmin/cities/create"&&request.method==="POST")return saveCity({env,request,db,cache});

      let m=p.match(/^\/superadmin\/countries\/([^/]+)$/);
      if(m&&request.method==="PATCH")return saveCountry({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
      m=p.match(/^\/superadmin\/provinces\/([^/]+)$/);
      if(m&&request.method==="PATCH")return saveProvince({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
      m=p.match(/^\/superadmin\/cities\/([^/]+)$/);
      if(m&&request.method==="PATCH")return saveCity({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});

      if(p==="/superadmin/catalogs/rebuild-cache"&&request.method==="POST"){
        const a=await verifyAdmin(env,request);
        if(!a.ok)return json({success:false,message:a.message},401);
        if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(a.rol))return json({success:false,message:"Permiso insuficiente"},403);
        return json(await rebuildCatalogs({db,cache}));
      }

      // SESION SUSCRIPTOR / PANEL
      if(p==="/suscriptores"&&request.method==="POST"){
        const body=await readJson(request);
        const action=actionOf(url,body);
        if(action==="login")return json(await subscriberLogin({env,db,body}),200);
        if(action==="session"){
          const out=await subscriberSession({env,request});
          return json(out,out.status||200);
        }
        return json({success:false,message:"Acción de suscriptores todavía no migrada al Worker modular."},400);
      }

      // MODIFICAR DATOS: lectura inicial únicamente. Mutaciones se conectan en el siguiente segmento.
      if(p==="/commerce"&&request.method==="GET"){
        const action=actionOf(url);
        const aid=advertiserIdOf(url);
        if(!aid)return json({success:false,message:"Falta advertiserId"},400);
        const auth=await requireSubscriber(env,request,aid,"modificar_datos");
        if(auth.response)return auth.response;

        if(action==="permisos_panel"){
          const admin=await db.get("anunciantes_administracion",aid);
          return json({success:!!admin,id:aid,administracion:admin||{}},admin?200:404);
        }
        if(action==="anunciante"){
          const catalogs=await getCommerceCatalogs(cache);
          return json(await commercePanelData({db,advertiserId:aid,catalogs}),200);
        }
        return json({success:false,message:"Acción Commerce no reconocida"},400);
      }

      // PROMOS: panel-data sin ciudades.
      if(p==="/promos"&&request.method==="POST"){
        const body=await readJson(request), action=actionOf(url,body), aid=advertiserIdOf(url,body);
        if(action==="getpaneldata"){
          const auth=await requireSubscriber(env,request,aid,"promos"); if(auth.response)return auth.response;
          const catalogs=await getPromosCatalogs(cache);
          return json(await promosPanelData({
            db,advertiserId:aid,categories:catalogs.categorias,
            cupoFromAdmin:a=>cupo(a,"PROMOS")
          }),200);
        }
        return json({success:false,message:"Mutación Promos todavía no conectada en V3."},501);
      }

      // EVENTOS: panel-data sin ciudades.
      if(p==="/events-new"&&request.method==="POST"){
        const body=await readJson(request), action=actionOf(url,body), aid=advertiserIdOf(url,body);
        if(["getpaneldata","paneldata","bootstrap","geteventospanel"].includes(action)){
          const auth=await requireSubscriber(env,request,aid,"eventos"); if(auth.response)return auth.response;
          const catalogs=await getEventosCatalogs(cache);
          return json(await eventosPanelData({
            db,advertiserId:aid,
            catalogs:{...catalogs,partners:catalogs.partners||[]},
            featureEnabled,cupo,
            enrichPrograms:null
          }),200);
        }
        return json({success:false,message:"Mutación Eventos todavía no conectada en V3."},501);
      }

      // ACTIVIDADES
      if(p==="/actividades"&&request.method==="GET"&&actionOf(url)==="getpaneldata"){
        const aid=advertiserIdOf(url);
        const auth=await requireSubscriber(env,request,aid,"actividades"); if(auth.response)return auth.response;
        const catalogs=await getActividadesCatalogs(cache);
        return json(await actividadesPanelData({
          db,advertiserId:aid,categorias:catalogs.categorias,lugares:catalogs.lugares,
          featureAllowed:a=>featureEnabled(a,"ACTIVIDADES"),
          cupoMax:a=>cupo(a,"ACTIVIDADES")
        }),200);
      }

      // PUBLICIDAD
      if(p==="/publicidad"&&request.method==="GET"&&actionOf(url)==="getpaneldata"){
        const aid=advertiserIdOf(url);
        const auth=await requireSubscriber(env,request,aid,"publicidad"); if(auth.response)return auth.response;
        const catalogs=await getPublicidadCatalogs(cache);
        return json(await publicidadPanelData({
          db,advertiserId:aid,catalogs,
          featureEnabled:a=>featureEnabled(a,"PUBLICIDAD"),
          configFromAdmin:a=>{
            const root=a&&a.funcionalidades_config&&typeof a.funcionalidades_config==="object"?a.funcionalidades_config:{};
            return root.PUBLICIDAD&&typeof root.PUBLICIDAD==="object"?root.PUBLICIDAD:{};
          },
          cambiosHoy:async()=>({usados:0,max:0}),
          enrichMany:null
        }),200);
      }

      // EFEMERIDES / FARMACIAS: panel-data base conectado; reglas finas se completan en su segmento.
      if(p==="/efemerides"&&request.method==="POST"){
        const body=await readJson(request),action=actionOf(url,body),aid=advertiserIdOf(url,body);
        if(action==="getpaneldata"){
          const auth=await requireSubscriber(env,request,aid,"efemerides"); if(auth.response)return auth.response;
          const admin=await db.get("anunciantes_administracion",aid);
          const permisos=async()=>({
            efemerides_grl:bool(admin&&admin.efemerides_grl),
            efemerides_provincial:bool(admin&&admin.efemerides_provincial),
            efemerides_local:bool(admin&&admin.efemerides_local),
            todas_provincias:bool(admin&&admin.efemerides_todas_provincias),
            todas_ciudades:bool(admin&&admin.efemerides_todas_ciudades),
            provincias:Array.isArray(admin&&admin.efemerides_provincias)?admin.efemerides_provincias:[],
            ciudades:Array.isArray(admin&&admin.efemerides_ciudades)?admin.efemerides_ciudades:[]
          });
          return json(await efemeridesPanelData({db,permisos,advertiserId:aid,canSee:()=>true}),200);
        }
        return json({success:false,message:"Mutación Efemérides todavía no conectada en V3."},501);
      }

      if(p==="/farmacias"&&request.method==="POST"){
        const body=await readJson(request),action=actionOf(url,body),aid=advertiserIdOf(url,body);
        if(action==="getpaneldata"){
          const auth=await requireSubscriber(env,request,aid,"turnos_farma"); if(auth.response)return auth.response;
          return json(await farmaciasPanelData({
            db,advertiserId:aid,featureAllowed:a=>featureEnabled(a,"TURNOS_FARMA")||bool(a&&a.turnos_farma)
          }),200);
        }
        return json({success:false,message:"Mutación Farmacias todavía no conectada en V3."},501);
      }

      return json({success:false,message:"Ruta no encontrada"},404);
    }catch(err){
      return json({success:false,message:String(err&&err.message?err.message:err)},500);
    }
  }
};
