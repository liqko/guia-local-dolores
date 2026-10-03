import {territoryPublic} from "../modules/territory.js";
import {guidePublic} from "../modules/guide.js";
import {getPromosCity} from "../core/promos-read-model.js";
import {getEventsCity} from "../core/events-read-model.js";
import {getActivitiesCity} from "../core/activities-read-model.js";
import {getPublicityCity} from "../core/publicity-read-model.js";
import {getEfemCity} from "../core/efemerides-read-model.js";
import {getFarmCity} from "../core/farmacias-read-model.js";
import {publicJson,json} from "../core/http.js";

const text=v=>String(v??"").trim();

function out(response){
  return response.status ? json(response,response.status) : publicJson(response);
}

export async function routePublicV2({path,request,url,cache}){
  if(path==="/territory/public"&&request.method==="GET")return territoryPublic({cache});
  if(path==="/guide"&&request.method==="GET")return guidePublic({url,cache});

  const city=text(url.searchParams.get("ciudad_id"));

  if(path==="/promos"&&request.method==="GET")return out(await getPromosCity({cache,cityId:city}));
  if(path==="/events-new"&&request.method==="GET"){
    const r=await getEventsCity({cache,cityId:city});
    if(r.status)return json(r,r.status);
    return publicJson({success:true,events:r.events||[],data:r.events||[],...r});
  }
  if(path==="/actividades"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="publicas")return out(await getActivitiesCity({cache,cityId:city}));
  }
  if(path==="/publicidad"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="publicas")return out(await getPublicityCity({cache,cityId:city}));
  }
  if(path==="/efemerides"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(["efemerides","publicas","public"].includes(action))return out(await getEfemCity({cache,cityId:city}));
  }
  if(path==="/farmacias"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="turnos")return out(await getFarmCity({cache,cityId:city}));
  }

  return null;
}
