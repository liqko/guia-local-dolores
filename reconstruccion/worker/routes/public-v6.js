import {publicJson,json} from "../core/http.js";
import {routePublicV5} from "./public-v5.js";
import {publicidadPublicaV2} from "../modules/publicidad-public-v2.js";

const text=v=>String(v??"").trim();

export async function routePublicV6(ctx){
  const {path,request,url,cache}=ctx;

  if(path==="/publicidad"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="publicas"){
      const out=await publicidadPublicaV2({
        cache,
        cityId:text(url.searchParams.get("ciudad_id")),
        moduleName:text(url.searchParams.get("modulo")),
        categoryId:text(url.searchParams.get("categoria_id"))
      });
      return out.status?json(out,out.status):publicJson(out);
    }
  }

  return routePublicV5(ctx);
}
