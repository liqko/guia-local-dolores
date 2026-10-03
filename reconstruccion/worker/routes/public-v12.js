import {publicJson,json} from "../core/http.js";
import {routePublicV10} from "./public-v10.js";
import {farmTurnosPublicV3} from "../modules/farmacias-public-v3.js";

const text=v=>String(v??"").trim();

export async function routePublicV12(ctx){
  const {path,request,url,cache}=ctx;

  if(path==="/farmacias"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="turnos"){
      const out=await farmTurnosPublicV3({
        cache,
        cityId:text(url.searchParams.get("ciudad_id")),
        fecha:text(url.searchParams.get("fecha"))
      });
      return out.status?json(out,out.status):publicJson(out);
    }
  }

  return routePublicV10(ctx);
}
