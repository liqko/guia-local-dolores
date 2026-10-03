import {publicJson,json} from "../core/http.js";
import {getGuideCity} from "../core/guide-read-model.js";

export async function guidePublic({url,cache}){
  const cityId=String(url.searchParams.get("ciudad_id")||url.searchParams.get("ciudadId")||"").trim();
  const out=await getGuideCity({cache,cityId});
  return out.status ? json(out,out.status) : publicJson(out);
}
