import {createDb} from "./core/db.js";
import {createCache} from "./core/cache.js";
import {cors,json} from "./core/http.js";
import {verifyAdmin} from "./core/auth-admin.js";
import {rebuildCatalogs} from "./core/catalogs.js";
import {territoryPublic,territoryAdmin,saveCountry,saveProvince,saveCity,rebuildTerritory} from "./modules/territory.js";

const clean=p=>{p=String(p||"/").replace(/\/+/g,"/");return p.length>1&&p.endsWith("/")?p.slice(0,-1):p;};

export default{
  async fetch(request,env){
    try{
      if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
      const p=clean(new URL(request.url).pathname);
      const db=createDb(env),cache=createCache(env);

      if(p==="/")return json({success:true,app:"Guía Local reconstrucción modular",version:"2"});
      if(p==="/territory/public"&&request.method==="GET")return territoryPublic({cache});
      if(p==="/superadmin/territory"&&request.method==="GET")return territoryAdmin({env,request,cache});
      if(p==="/superadmin/territory/rebuild-cache"&&request.method==="POST")return rebuildTerritory({env,request,db,cache});

      if(p==="/superadmin/countries/create"&&request.method==="POST")return saveCountry({env,request,db,cache});
      if(p==="/superadmin/provinces/create"&&request.method==="POST")return saveProvince({env,request,db,cache});
      if(p==="/superadmin/cities/create"&&request.method==="POST")return saveCity({env,request,db,cache});

      let m=p.match(/^\/superadmin\/countries\/([^/]+)$/);
      if(m&&request.method==="PATCH")return saveCountry({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
      m=p.match(/^\/superadmin\/provinces\/([^/]+)$/);
      if(m&&request.method==="PATCH")return saveProvince({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});
      m=p.match(/^\/superadmin\/cities\/([^/]+)$/);
      if(m&&request.method==="PATCH")return saveCity({env,request,db,cache,idFromPath:decodeURIComponent(m[1])});

      if(p==="/superadmin/catalogs/rebuild-cache"&&request.method==="POST"){
        const a=await verifyAdmin(env,request);
        if(!a.ok)return json({success:false,message:a.message},401);
        if(!["SUPERADMIN_PRINCIPAL","SUPERADMIN"].includes(a.rol))return json({success:false,message:"Permiso insuficiente"},403);
        return json(await rebuildCatalogs({db,cache}));
      }

      return json({success:false,message:"Ruta no encontrada"},404);
    }catch(err){
      return json({success:false,message:String(err&&err.message?err.message:err)},500);
    }
  }
};
