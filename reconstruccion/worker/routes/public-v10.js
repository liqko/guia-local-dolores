import {publicJson,json} from "../core/http.js";
import {routePublicV9} from "./public-v9.js";
import {efemeridesPublicV3} from "../modules/efemerides-public-v3.js";

const text=v=>String(v??"").trim();

export async function routePublicV10(ctx){
  const {path,request,url,cache}=ctx;

  if(path==="/efemerides"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(["efemerides","publicas","public"].includes(action)){
      const out=await efemeridesPublicV3({
        cache,
        cityId:text(url.searchParams.get("ciudad_id")),
        fecha:text(url.searchParams.get("fecha"))
      });
      return out.status?json(out,out.status):publicJson(out);
    }
  }

  return routePublicV9(ctx);
}
