import {publicJson} from "../core/http.js";
import {routePublicV4} from "./public-v4.js";
import {publicGuideCatalogsV2} from "../modules/public-catalogs-v2.js";

export async function routePublicV5(ctx){
  const {path,request,cache}=ctx;

  if(path==="/catalogs/public/guide"&&request.method==="GET"){
    return publicJson(await publicGuideCatalogsV2({cache}));
  }

  return routePublicV4(ctx);
}
