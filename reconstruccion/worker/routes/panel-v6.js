import {json} from "../core/http.js";
import {routePanelV5} from "./panel-v5.js";
import {listFavoritesV2,addFavoriteV2,removeFavoriteV2} from "../modules/suscriptor-favoritos-v2.js";

const text=v=>String(v??"").trim();
async function bodyOf(request){try{return await request.json()}catch(_){return{}}}

export async function routePanelV6(ctx){
  const {path,request,url,env,db}=ctx;

  if(path==="/suscriptores"&&request.method==="GET"){
    const action=text(url.searchParams.get("action")).toLowerCase();
    if(action==="favoritos"){
      return json(await listFavoritesV2({
        env,request,db,type:text(url.searchParams.get("tipo"))
      }));
    }
  }

  if(path==="/suscriptores"&&request.method==="POST"){
    const body=await bodyOf(request);
    const action=text(body.action||body.accion||url.searchParams.get("action")).toLowerCase();

    if(action==="agregar_favorito"){
      return json(await addFavoriteV2({env,request,db,body}));
    }
    if(action==="quitar_favorito"){
      return json(await removeFavoriteV2({env,request,db,body}));
    }
  }

  return routePanelV5(ctx);
}
