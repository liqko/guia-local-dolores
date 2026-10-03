import {createDb} from "./core/db.js";
import {createCache} from "./core/cache.js";
import {cors,json} from "./core/http.js";
import {routePublicV4} from "./routes/public-v4.js";
import {routePanelV5} from "./routes/panel-v5.js";
import {routeAdminV8} from "./routes/admin-v8.js";

const clean=p=>{
  p=String(p||"/").replace(/\/+/g,"/");
  return p.length>1&&p.endsWith("/")?p.slice(0,-1):p;
};

export default{
  async fetch(request,env){
    try{
      if(request.method==="OPTIONS"){
        return new Response(null,{status:204,headers:cors()});
      }

      const url=new URL(request.url);
      const path=clean(url.pathname);
      const db=createDb(env);
      const cache=createCache(env);
      const ctx={path,request,url,env,db,cache};

      if(path==="/"){
        return json({
          success:true,
          app:"Guía Local reconstrucción modular",
          version:"14"
        });
      }

      const pub=await routePublicV4(ctx);
      if(pub)return pub;

      const panel=await routePanelV5(ctx);
      if(panel)return panel;

      const admin=await routeAdminV8(ctx);
      if(admin)return admin;

      return json({success:false,message:"Ruta no encontrada"},404);
    }catch(err){
      return json({
        success:false,
        message:String(err&&err.message?err.message:err)
      },500);
    }
  }
};
