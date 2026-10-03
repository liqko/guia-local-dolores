import {publicJson,json} from "../core/http.js";
import {routePublicV7} from "./public-v7.js";
import {getPublicityCityV2} from "../core/publicity-read-model-v2.js";

const text=v=>String(v??"").trim();

export async function routePublicV8(ctx){
  const {path,request,url,cache}=ctx;

  if(path==="/publicidad"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="publicas"){
      const out=await getPublicityCityV2({
        cache,
        cityId:text(url.searchParams.get("ciudad_id"))
      });
      return out.status?json(out,out.status):publicJson(out);
    }
  }

  return routePublicV7(ctx);
}
