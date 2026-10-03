import {territoryPublic} from "../modules/territory.js";
import {guidePublic} from "../modules/guide.js";
import {getPromosCity} from "../core/promos-read-model.js";
import {getEventsCityV2} from "../core/events-read-model-v2.js";
import {getActivitiesCity} from "../core/activities-read-model.js";
import {getPublicityCity} from "../core/publicity-read-model.js";
import {efemeridesPublicV2} from "../modules/efemerides-public-v2.js";
import {getFarmCity} from "../core/farmacias-read-model.js";
import {publicJson,json} from "../core/http.js";

const text=v=>String(v??"").trim();
const out=r=>r.status?json(r,r.status):publicJson(r);

export async function routePublicV4({path,request,url,cache}){
  if(path==="/territory/public"&&request.method==="GET")return territoryPublic({cache});
  if(path==="/guide"&&request.method==="GET")return guidePublic({url,cache});

  const city=text(url.searchParams.get("ciudad_id"));

  if(path==="/promos"&&request.method==="GET"){
    return out(await getPromosCity({cache,cityId:city}));
  }

  if(path==="/events-new"&&request.method==="GET"){
    const r=await getEventsCityV2({cache,cityId:city});
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
    if(["efemerides","publicas","public"].includes(action)){
      return out(await efemeridesPublicV2({
        cache,
        cityId:city,
        fecha:text(url.searchParams.get("fecha"))
      }));
    }
  }

  if(path==="/farmacias"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="turnos")return out(await getFarmCity({cache,cityId:city}));
  }

  return null;
}
