import {createDb} from "./core/db.js";
import {createCache} from "./core/cache.js";
import {cors,json} from "./core/http.js";
import {routePublicV12} from "./routes/public-v12.js";
import {routePanelV15} from "./routes/panel-v15.js";
import {routeAdminV11} from "./routes/admin-v11.js";
import {observeDbV41,observationPathV41,finishObservationV42,observationActionV43,publicDbGuardV44} from "./core/db-observation-v41.js";

const clean=p=>{
  p=String(p||"/").replace(/\/+/g,"/");
  return p.length>1&&p.endsWith("/")?p.slice(0,-1):p;
};

export default{
  async fetch(request,env){
    const report={event:'gld_firestore_observation',worker_version:'44',started_at:new Date().toISOString(),status:500,request_id:crypto.randomUUID(),method:request.method,path:observationPathV41(clean(new URL(request.url).pathname)),operations:{}};
    const traced=response=>{
      report.status=response.status;
      const headers=new Headers(response.headers);
      headers.set('X-GLD-Request-Id',report.request_id);
      const {totals}=finishObservationV42(report);
      headers.set('X-GLD-Worker-Version',report.worker_version);
      headers.set('X-GLD-Read-Calls',String(totals.read_calls));
      headers.set('X-GLD-Documents-Returned',String(totals.documents_returned));
      headers.set('X-GLD-Write-Calls',String(totals.write_calls));
      headers.set('X-GLD-Delete-Calls',String(totals.delete_calls));
      headers.set('X-GLD-Source',report.source||'worker');
      headers.set('X-GLD-Public-Blocked',String(report.public_blocked||0));
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    };
    try{
      if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
      const url=new URL(request.url),path=clean(url.pathname);
      const db=observeDbV41(createDb(env),report),cache=createCache(env);
      const action=await observationActionV43(request,url);
      if(action)report.action=action;
      const ctx={path,request,url,env,db,cache};

      if(path==="/")return traced(json({success:true,app:"Guía Local reconstrucción modular",version:"44"}));

      const pub=await routePublicV12({...ctx,db:publicDbGuardV44(report)});if(pub){report.source='public-kv';return traced(pub);}
      const panel=await routePanelV15(ctx);if(panel)return traced(panel);
      const admin=await routeAdminV11(ctx);if(admin)return traced(admin);

      return traced(json({success:false,message:"Ruta no encontrada"},404));
    }catch(err){
      return traced(json({success:false,message:String(err&&err.message?err.message:err)},500));
    }finally{
      if(request.method!=="OPTIONS")console.log(JSON.stringify(finishObservationV42(report)));
    }
  }
};
