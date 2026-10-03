import {territoryPublic} from "../modules/territory.js";
import {guidePublic} from "../modules/guide.js";
import {getPromosCity} from "../core/promos-read-model.js";
import {getEventsCity} from "../core/events-read-model.js";
import {publicJson,json} from "../core/http.js";

const text=v=>String(v??"").trim();

export async function routePublic({path,request,url,cache}){
  if(path==="/territory/public"&&request.method==="GET"){
    return territoryPublic({cache});
  }
  if(path==="/guide"&&request.method==="GET"){
    return guidePublic({url,cache});
  }
  if(path==="/promos"&&request.method==="GET"){
    const out=await getPromosCity({cache,cityId:text(url.searchParams.get("ciudad_id"))});
    return out.status?json(out,out.status):publicJson(out);
  }
  if(path==="/events-new"&&request.method==="GET"){
    const out=await getEventsCity({cache,cityId:text(url.searchParams.get("ciudad_id"))});
    return out.status?json(out,out.status):publicJson({success:true,events:out.events||[],data:out.events||[],...out});
  }
  return null;
}
