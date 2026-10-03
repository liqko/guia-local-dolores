import {publicJson,json} from "../core/http.js";
import {routePublicV10} from "./public-v10.js";
import {getFarmCityV2} from "../core/farmacias-read-model-v2.js";

const text=v=>String(v??"").trim();

export async function routePublicV11(ctx){
  const {path,request,url,cache}=ctx;

  if(path==="/farmacias"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="turnos"){
      const out=await getFarmCityV2({cache,cityId:text(url.searchParams.get("ciudad_id"))});
      return out.status?json(out,out.status):publicJson(out);
    }
  }

  return routePublicV10(ctx);
}
