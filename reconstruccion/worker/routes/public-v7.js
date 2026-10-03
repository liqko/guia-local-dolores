import {publicJson,json} from "../core/http.js";
import {routePublicV6} from "./public-v6.js";
import {getActivitiesCityV2} from "../core/activities-read-model-v2.js";

const text=v=>String(v??"").trim();

export async function routePublicV7(ctx){
  const {path,request,url,cache}=ctx;

  if(path==="/actividades"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="publicas"){
      const out=await getActivitiesCityV2({
        cache,
        cityId:text(url.searchParams.get("ciudad_id"))
      });
      return out.status?json(out,out.status):publicJson(out);
    }
  }

  return routePublicV6(ctx);
}
