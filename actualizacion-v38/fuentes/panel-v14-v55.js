import {json} from "../core/http.js";
import {routePanelV13} from "./panel-v13.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {efemSaveV3,efemToggleV3,efemDeleteV3} from "../modules/efemerides-v3.js";

const text=v=>String(v??"").trim();
const truthy=v=>v===true||v===1||["true","1","si","sí","x","activo","activa"].includes(text(v).toLowerCase());
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}

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

export async function routePanelV14(ctx){
  const {path,request,url,env,db,cache}=ctx;

  if(path==="/efemerides"&&request.method==="POST"){
    const clone=request.clone();
    const body=await bodyOf(clone);
    const action=actionOf(url,body);

    if(["guardar","save","activar","desactivar","eliminar","delete"].includes(action)){
      const aid=aidOf(url,body);
      if(!aid)return json({success:false,message:"Falta advertiserId"},400);

      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);
      if(!sessionAllows(s,aid,"efemerides",{write:true})){
        return json({success:false,message:"No tenés permiso para modificar Efemérides."},403);
      }

      const admin=await db.get("anunciantes_administracion",aid);
      const permisos=efemPermisos(admin||{});

      if(action==="guardar"||action==="save"){
        return json(await efemSaveV3({db,cache,advertiserId:aid,body,permisos}));
      }

      const id=text(body.efemeride_id||body.id||(body.payload&&(body.payload.efemeride_id||body.payload.id)));

      if(action==="activar"||action==="desactivar"){
        return json(await efemToggleV3({db,cache,id,activo:action==="activar",permisos}));
      }

      return json(await efemDeleteV3({db,cache,id,permisos}));
    }
  }

  return routePanelV13(ctx);
}
