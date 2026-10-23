// Simulate opening the advertiser form before the mutation, as required by the
// coordinated frontend. Its GET is recorded separately by audit-worker.
export async function attachFormRevision(worker,env,request){
 if(request.method!=='POST')return request;
 const url=new URL(request.url),body=await request.clone().json().catch(()=>null);if(!body)return request;
 const action=String(body.action||body.accion||'').toLowerCase();
 let path='',scope='';
 const m=url.pathname.match(/^\/superadmin\/advertisers\/([^/]+)\/(commercial|profile|sedes)$/);
 if(m){path='/superadmin/advertisers/'+m[1];scope=m[2];}
 else if(url.pathname==='/commerce'&&['set_datos','set_sedes','set_relaciones_sede','delete_sede'].includes(action)){path='/commerce?action=anunciante&advertiserId='+encodeURIComponent(body.advertiserId||body.advertiser_id);scope='owner';}
 if(!path)return request;
 const loaded=await worker.fetch(new Request(new URL(path,url),{headers:request.headers}),env),data=await loaded.json();if(!data.success)return request;
 if(scope==='commercial')body.payload={...body.payload,revision_comercial:data.revision_comercial};
 if(scope==='profile')body.payload={...body.payload,revision_perfil:data.revision_perfil};
 if(scope==='sedes')body.sedes=body.sedes.map(row=>({...row,revision_sede:data.revision_sedes[row.sede_id]}));
 if(scope==='owner'){
  if(action==='set_datos')body.revision_datos=data.advertiser.revision_datos;
  if(action==='set_sedes')body.sedes=body.sedes.map(row=>({...row,revision_sede:data.advertiser.revision_sedes[row.sede_id]}));
  if(['set_relaciones_sede','delete_sede'].includes(action))body.revision_sede=data.advertiser.revision_sedes[body.sede_id];
 }
 return new Request(request,{body:JSON.stringify(body)});
}
