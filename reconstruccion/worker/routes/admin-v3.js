import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {rebuildCatalogs} from "../core/catalogs.js";
import {rebuildGuideAll} from "../core/guide-read-model.js";
import {rebuildPromosAll} from "../core/promos-read-model.js";
import {rebuildEventsAllV2} from "../core/events-read-model-v2.js";
import {rebuildActivitiesAllV2} from "../core/activities-read-model-v2.js";
import {rebuildPublicityAllV2} from "../core/publicity-read-model-v2.js";
import {rebuildFarmAllV2} from "../core/farmacias-read-model-v2.js";
import {
  territoryAdmin,saveCountry,saveProvince,saveCity,rebuildTerritory
} from "../modules/territory.js";
import {pendingEventsV2,resolveEventModerationV2} from "../modules/moderacion-eventos-v2.js";

const text=v=>String(v??"").trim();

async function requireAdmin(env,request){
  const a=await verifyAdmin(env,request);
  return a.ok?a:null;
}

export async function routeAdminV3({path,request,env,db,cache}){
  if(!path.startsWith("/superadmin/"))return null;

  if(path==="/superadmin/territory"&&request.method==="GET")return territoryAdmin({env,request,cache});
  if(path==="/superadmin/territory/rebuild-cache"&&request.method==="POST")return rebuildTerritory({env,request,db,cache});
  if(path==="/superadmin/countries/create"&&request.method==="POST")return saveCountry({env,request,db,cache});
  if(path==="/superadmin/provinces/create"&&request.method==="POST")return saveProvince({env,request,db,cache});
  if(path==="/superadmin/cities/create"&&request.method==="POST")return saveCity({env,request,db,cache});

  let m=path.match(/^\/superadmin\/countries\/([^/]+)$/);
  if(m&&request.method==="PATCH")return saveCountry({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
  m=path.match(/^\/superadmin\/provinces\/([^/]+)$/);
  if(m&&request.method==="PATCH")return saveProvince({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
  m=path.match(/^\/superadmin\/cities\/([^/]+)$/);
  if(m&&request.method==="PATCH")return saveCity({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});

  const a=await requireAdmin(env,request);
  if(!a)return json({success:false,message:"Sesión de administrador requerida."},401);
  if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(a.rol)){
    return json({success:false,message:"Permiso insuficiente."},403);
  }

  if(path==="/superadmin/catalogs/rebuild-cache"&&request.method==="POST")return json(await rebuildCatalogs({db,cache}));
  if(path==="/superadmin/guide/rebuild-cache"&&request.method==="POST")return json(await rebuildGuideAll({db,cache}));
  if(path==="/superadmin/promos/rebuild-cache"&&request.method==="POST")return json(await rebuildPromosAll({db,cache}));
  if(path==="/superadmin/events/rebuild-cache"&&request.method==="POST")return json(await rebuildEventsAllV2({db,cache}));
  if(path==="/superadmin/activities/rebuild-cache"&&request.method==="POST")return json(await rebuildActivitiesAllV2({db,cache}));
  if(path==="/superadmin/publicity/rebuild-cache"&&request.method==="POST")return json(await rebuildPublicityAllV2({db,cache}));
  if(path==="/superadmin/pharmacies/rebuild-cache"&&request.method==="POST")return json(await rebuildFarmAll({db,cache}));

  if(path==="/superadmin/moderation/events/pending"&&request.method==="GET"){
    return json(await pendingEventsV2({db,limit:100}));
  }

  if(path==="/superadmin/moderation/events/resolve"&&request.method==="POST"){
    let body={};try{body=await request.json()}catch(_){}
    return json(await resolveEventModerationV2({
      db,cache,eventId:text(body.evento_id||body.id),
      decision:text(body.decision||body.accion),
      moderatorId:a.sid
    }));
  }

  return null;
}
