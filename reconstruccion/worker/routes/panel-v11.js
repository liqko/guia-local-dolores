import {json} from "../core/http.js";
import {routePanelV10} from "./panel-v10.js";
import {verifySubscriberSession,sessionAllows} from "../modules/suscriptores.js";
import {promoListOwnV3} from "../modules/promos-panel-v3.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}
function actionOf(url,b={}){return text(b.action||b.accion||url.searchParams.get("action")).toLowerCase()}
function aidOf(url,b={}){return text(b.advertiserId||b.advertiser_id||b.id||b.__id||b.comercio_id||url.searchParams.get("advertiserId")||url.searchParams.get("advertiser_id")||url.searchParams.get("id"))}

export async function routePanelV11(ctx){
  const {path,request,url,env,db}=ctx;

  if(path==="/promos"&&request.method==="POST"){
    const clone=request.clone();
    const body=await bodyOf(clone);
    const action=actionOf(url,body);
    if(action==="getpromos"){
      const aid=aidOf(url,body);
      if(!aid)return json({success:false,message:"Falta advertiserId"},400);
      const s=await verifySubscriberSession(env,request);
      if(!s.ok)return json({success:false,message:s.message},401);
      if(!sessionAllows(s,aid,"promos",{write:false})){
        return json({success:false,message:"No tenés permiso para ver Promos."},403);
      }
      return json(await promoListOwnV3({db,advertiserId:aid}));
    }
  }

  return routePanelV10(ctx);
}
