import {json} from "../core/http.js";
import {verifyAdmin} from "../core/auth-admin.js";
import {rebuildCatalogs} from "../core/catalogs.js";
import {rebuildGuideAll} from "../core/guide-read-model.js";
import {rebuildPromosAll} from "../core/promos-read-model.js";
import {rebuildEventsAll} from "../core/events-read-model.js";
import {
  territoryAdmin,saveCountry,saveProvince,saveCity,rebuildTerritory
} from "../modules/territory.js";
import {pendingEvents,resolveEventModeration} from "../modules/moderacion-eventos.js";

const text=v=>String(v??"").trim();
async function admin(env,request){
  const a=await verifyAdmin(env,request);
  return a.ok?a:null;
}

export async function routeAdmin({path,request,url,env,db,cache}){
  if(!path.startsWith("/superadmin/"))return null;

  if(path==="/superadmin/territory"&&request.method==="GET"){
    return territoryAdmin({env,request,cache});
  }

  if(path==="/superadmin/territory/rebuild-cache"&&request.method==="POST"){
    return rebuildTerritory({env,request,db,cache});
  }

  if(path==="/superadmin/countries/create"&&request.method==="POST")return saveCountry({env,request,db,cache});
  if(path==="/superadmin/provinces/create"&&request.method==="POST")return saveProvince({env,request,db,cache});
  if(path==="/superadmin/cities/create"&&request.method==="POST")return saveCity({env,request,db,cache});

  let m=path.match(/^\/superadmin\/countries\/([^/]+)$/);
  if(m&&request.method==="PATCH")return saveCountry({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
  m=path.match(/^\/superadmin\/provinces\/([^/]+)$/);
  if(m&&request.method==="PATCH")return saveProvince({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
  m=path.match(/^\/superadmin\/cities\/([^/]+)$/);
  if(m&&request.method==="PATCH")return saveCity({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});

  const a=await admin(env,request);
  if(!a)return json({success:false,message:"Sesión de administrador requerida."},401);

  if(path==="/superadmin/catalogs/rebuild-cache"&&request.method==="POST"){
    return json(await rebuildCatalogs({db,cache}));
  }
  if(path==="/superadmin/guide/rebuild-cache"&&request.method==="POST"){
    return json(await rebuildGuideAll({db,cache}));
  }
  if(path==="/superadmin/promos/rebuild-cache"&&request.method==="POST"){
    return json(await rebuildPromosAll({db,cache}));
  }
  if(path==="/superadmin/events/rebuild-cache"&&request.method==="POST"){
    return json(await rebuildEventsAll({db,cache}));
  }
  if(path==="/superadmin/moderation/events/pending"&&request.method==="GET"){
    return json(await pendingEvents({db,limit:100}));
  }
  if(path==="/superadmin/moderation/events/resolve"&&request.method==="POST"){
    let body={};try{body=await request.json()}catch(_){}
    return json(await resolveEventModeration({
      db,cache,
      eventId:text(body.evento_id||body.id),
      decision:text(body.decision||body.decision_moderacion||body.accion),
      moderatorId:a.sid
    }));
  }

  return null;
}
