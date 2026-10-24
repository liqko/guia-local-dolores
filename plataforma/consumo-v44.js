/* Shared with the browser bundle; contains no requests or storage writes. */
(function(root){
  'use strict';
  const quotas={worker_requests:[10000000,'mes'],kv_reads:[10000000,'mes'],kv_writes:[1000000,'mes'],kv_deletes:[1000000,'mes'],kv_lists:[1000000,'mes'],sql_reads:[25000000000,'mes'],sql_writes:[50000000,'mes'],do_requests:[1000000,'mes'],fs_reads:[50000,'día'],fs_writes:[20000,'día'],fs_deletes:[20000,'día']};
  const number=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:null;
  const add=(...values)=>values.some(x=>number(x)===null)?null:values.reduce((a,b)=>a+b,0);
  function metrics(row){
    const m=row.consumo;
    if(!m||m.schema!==136||m.request_id!==row.request_id||String(m.version)!==String(row.version))return null;
    const c=m.cloudflare,f=m.firestore;
    if(!c?.kv||!c.public_store||!c.admin_store||!f||!m.coverage||!Array.isArray(c.public_store.components)||!Array.isArray(m.coverage.missing))return null;
    return {fs_reads:number(f.billed_reads),fs_writes:number(f.billed_writes),fs_deletes:number(f.billed_deletes),fs_read_calls:number(f.read_calls),fs_write_calls:number(f.write_calls),fs_delete_calls:number(f.delete_calls),documents:number(f.documents_returned),kv_direct_reads:number(c.kv.get_calls),kv_actor_reads:number(c.public_store.legacy_gets),kv_reads:add(c.kv.get_calls,c.public_store.legacy_gets),kv_writes:number(c.kv.put_calls),kv_deletes:number(c.kv.delete_calls),kv_lists:add(c.kv.list_calls,c.public_store.legacy_lists),sql_reads:add(c.public_store.rows_read,c.admin_store.rows_read),sql_writes:add(c.public_store.rows_written,c.admin_store.rows_written),do_requests:add(c.public_store.calls,c.admin_store.calls),worker_requests:number(c.worker_requests),failures:add(f.failures,c.kv.failures),components:c.public_store.components};
  }
  function audit(rows,session){
    const issues=[],selected=session?rows.filter(r=>r.prueba===session.id):[];
    if(!session)issues.push('Iniciá una medición para separar esta acción de las anteriores.');
    if(session&&!session.ended_at)issues.push('La medición está abierta.');
    if(session?.capture_errors?.length)issues.push('No se pudo guardar algún registro local.');
    if(!selected.length)issues.push('No hay respuestas registradas para esta acción.');
    const expected=session?.kind==='guia'?['/guide','/farmacias','/efemerides','/publicidad']:[];
    if(session?.kind==='guia'&&(session.authenticated||selected.some(r=>r.ruta==='/suscriptores'&&['perfil','favoritos'].includes(r.accion))))expected.push('/suscriptores:perfil','/suscriptores:favoritos');
    for(const requirement of expected){const [path,action]=requirement.split(':');if(!selected.some(r=>r.ruta===path&&r.metodo==='GET'&&(!action||r.accion===action)))issues.push('Falta '+requirement);}
    const totals={},seen=new Set(),details=[];
    for(const row of selected){
      if(row.estado==='EN CURSO')issues.push('Respuesta en curso: '+row.ruta);
      if(typeof row.estado!=='number'||row.estado<200||row.estado>=400||row.resultado==='Rechazada'||row.vista==='Error')issues.push('Error en '+row.ruta);
      if(!row.request_id||seen.has(row.request_id))issues.push('Traza ausente o repetida: '+row.ruta);
      if(row.request_id)seen.add(row.request_id);
      const measured=metrics(row);
      if(!measured){issues.push('Sin contadores compatibles: '+row.ruta);details.push({row,metrics:null});continue;}
      details.push({row,metrics:measured});
      for(const [key,value] of Object.entries(measured))if(key!=='components')totals[key]=Object.hasOwn(totals,key)?add(totals[key],value):value;
      for(const missing of row.consumo.coverage.missing||[])issues.push(row.ruta+': '+missing);
      if(row.consumo.coverage.operation_counters!=='REGISTRADOS')issues.push('Operaciones incompletas: '+row.ruta);
      if(measured.failures!==0)issues.push('Fallos de operaciones en '+row.ruta);
    }
    // A partial sum must never look like the total of the action.
    if(details.some(d=>!d.metrics))for(const key of Object.keys(quotas))totals[key]=null;
    const percentages={};
    for(const [key,[limit,period]]of Object.entries(quotas))percentages[key]={value:number(totals[key])===null?null:totals[key]/limit*100,limit,period};
    return {status:issues.length?'INCOMPLETO':'COMPLETO',issues:[...new Set(issues)],expected,details,totals,percentages,quota_note:'Cuotas de referencia documentadas; no saldo ni factura de la cuenta.'};
  }
  const api={metrics,audit,quotas};root.GLDMeasurement136=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/* Diagnóstico local; compartir una copia requiere una acción explícita del principal. */
(function(){
  'use strict';
  if(window.__gldConsumoV44)return;
  window.__gldConsumoV44=true;
  const script=document.currentScript;
  const showPanel=script&&script.hasAttribute('data-gld-consumo-panel');
  const key='gld_consumo_admin_v87';
  const control=window.GLDMeasurement136;
  const sessionKey='gld_consumo_action_v136';
  let sessionMemory=null;
  function session(){try{return JSON.parse(localStorage.getItem(sessionKey)||'null')}catch{return sessionMemory}}
  function storeSession(value){sessionMemory=value;try{localStorage.setItem(sessionKey,JSON.stringify(value))}catch{value.capture_errors=(value.capture_errors||[]).concat('local-storage');}return value}
  function startMeasurement(authenticated){
    if(!authorized())return;
    storeSession({id:crypto.randomUUID(),kind:'guia',authenticated,started_at:new Date().toISOString(),ended_at:null});render();
  }
  function endMeasurement(){const active=session();if(!active||!authorized())return;storeSession({...active,ended_at:new Date().toISOString()});render();}
  const missingLabels={'kv-binding':'KV no disponible','firestore-billed-operations':'Lecturas/escrituras facturadas de Firestore sin confirmar','public-store-component':'Falta un contador de almacenamiento público','admin-store-internal-kv':'Faltan operaciones internas de Gran Hermano','worker-cpu':'CPU sin medir','durable-object-billed-duration':'Duración facturada interna sin medir','persistent-storage-size':'Espacio almacenado sin medir','browser-preflight-and-external-assets':'Peticiones del navegador y archivos externos fuera del contador'};
  const metricColumns=[['fs_reads','Firestore: lecturas'],['fs_writes','Firestore: escrituras'],['fs_deletes','Firestore: borrados'],['kv_direct_reads','CF KV: lecturas directas'],['kv_actor_reads','CF KV: lecturas internas'],['kv_reads','CF KV: total lecturas'],['kv_writes','CF KV: escrituras'],['kv_deletes','CF KV: borrados'],['kv_lists','CF KV: listados'],['sql_reads','CF: filas leídas'],['sql_writes','CF: filas escritas, incluidos borrados'],['do_requests','CF: llamadas internas'],['worker_requests','CF: solicitudes registradas']];
  function measuredText(value,metric){if(value==null)return 'Sin medir';const quota=control.quotas[metric];return String(value)+(quota?' · '+(value/quota[0]*100).toLocaleString('es-AR',{maximumFractionDigits:12})+'% / '+quota[1]:'');}
  function componentText(row){const list=control.metrics(row)?.components;if(!list)return 'Sin medir';return list.map(c=>c.module+': '+(c.rows_read??'sin medir')+' filas leídas, '+(c.rows_written??'sin medir')+' escritas; '+(c.reads||[]).map(p=>({memory:'memoria temporal','saved-packet':'paquete guardado','entity-list':'lista de registros','legacy-kv':'KV anterior','deleted-packet':'paquete borrado'}[p.source]||p.source)).join(', ')).join('; ')||'Sin llamadas públicas internas';}
  const origin='https://login.liqkoargentina.workers.dev';
  const allowed=new Set(['login','session','favoritos','anunciantes_autorizados','publicas','turnos','efemerides','perfil','crear','actualizar_perfil','actualizar_ciudad','cambiar_clave','eliminar_cuenta','agregar_favorito','quitar_favorito']);
  let memory=[],view=null,container=null,adminExpires=0;
  const authorized=()=>adminExpires>Date.now();
  const originalFetch=window.fetch.bind(window);
  function read(){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:memory}catch(_){return memory}}
  function render(){
    if(!view||!authorized())return;
    const rows=read();view.textContent='';
    const intro=document.createElement('p');
    intro.textContent='Medidor 136. Firestore, registros Cloudflare y KV se cuentan por separado. Las lecturas KV directas e internas se suman en Total KV; no sumes ese total otra vez. Guardar este registro es local. Los porcentajes usan cuotas de referencia, no el saldo de la cuenta. Las llamadas a Firestore no equivalen a lecturas facturadas. Sin medir nunca significa cero. CPU, duración interna y archivos externos requieren datos del proveedor.';
    view.appendChild(intro);
    const active=session(),audit=control.audit(rows,active);
    const status=document.createElement('strong');status.textContent='Control de la acción: '+audit.status;status.style.color=audit.status==='COMPLETO'?'#14652a':'#a32112';view.appendChild(status);
    const issues=document.createElement('ul');audit.issues.forEach(issue=>{const li=document.createElement('li');li.textContent=Object.entries(missingLabels).reduce((text,[key,label])=>text.replace(key,label),issue);issues.appendChild(li)});view.appendChild(issues);
    if(active){const totals=document.createElement('p');totals.textContent='Contadores registrados de esta acción: '+metricColumns.map(([metric,label])=>label+' = '+measuredText(audit.totals[metric],metric)).join(' | ')+'. Si el control dice INCOMPLETO, estos valores no son el costo total de la pantalla.';view.appendChild(totals);}
    const table=document.createElement('table');table.style.cssText='border-collapse:collapse;font:12px sans-serif;min-width:760px';
    const fields=['hora','pagina','ruta','accion','estado','resultado','vista','version',...metricColumns.map(([key])=>'metric:'+key),'consultas','documentos','escrituras','eliminaciones','componentes','control','origen','detalle','cache_estado'];
    const labels=['Hora Argentina','Pantalla','Ruta','Acción','HTTP','Respuesta','Vista','Worker',...metricColumns.map(([,label])=>label),'Firestore: llamadas de lectura','Firestore: documentos devueltos','Firestore: llamadas de escritura','Firestore: llamadas de borrado','Desglose interno Cloudflare','Cobertura','Fuente','Operaciones','Caché'];
    const head=document.createElement('tr');labels.forEach(label=>{const th=document.createElement('th');th.textContent=label;th.style.cssText='padding:6px;border:1px solid #ccc';head.appendChild(th)});table.appendChild(head);
    rows.forEach(row=>{const tr=document.createElement('tr'),metrics=control.metrics(row);fields.forEach(field=>{const td=document.createElement('td');td.textContent=field.startsWith('metric:')?measuredText(metrics?.[field.slice(7)],field.slice(7)):field==='componentes'?componentText(row):field==='control'?'INCOMPLETO':row[field]==null?(['resultado','vista'].includes(field)?'Sin comprobar':'Sin medir'):String(row[field]);td.style.cssText='padding:6px;border:1px solid #ccc';tr.appendChild(td)});table.appendChild(tr)});
    view.appendChild(table);
    const data=document.createElement('textarea');data.readOnly=true;data.setAttribute('aria-label','Registro para compartir');data.style.cssText='width:100%;height:110px;margin-top:10px';data.value=JSON.stringify(rows,null,2);view.appendChild(data);
    if(!rows.length){const p=document.createElement('p');p.textContent='Todavía no se registraron llamadas.';view.appendChild(p)}
  }
  function save(row){
    if(!authorized())return;
    const previous=read(),index=row.capture_id?previous.findIndex(x=>x.capture_id===row.capture_id):-1;
    if(index>=0)previous[index]=row;else previous.push(row);
    const active=session();if(previous.length>160&&active&&previous.slice(0,-160).some(x=>x.prueba===active.id))storeSession({...active,capture_errors:[...(active.capture_errors||[]),'registro truncado']});
    memory=previous.slice(-160);
    try{localStorage.setItem(key,JSON.stringify(memory))}catch(_){if(active)storeSession({...active,capture_errors:[...(active.capture_errors||[]),'no se pudo guardar el registro']})}
    try{render()}catch(_){}
    try{if(window.parent!==window)window.parent.postMessage({tipo:'gld_consumo_actualizado_v44'},location.origin)}catch(_){}
  }
  window.gldConsumoVistaV49=function(moduleName,loaded){
    const routes={turnos_farma:'/farmacias',publicidad:'/publicidad',promos:'/promos',eventos:'/events-new',eventos_free:'/events-new',actividades:'/actividades',efemerides:'/efemerides',modificar_datos:'/commerce'};
    const route=routes[moduleName];if(!route||typeof loaded!=='boolean')return;
    const rows=read();
    const row=[...rows].reverse().find(r=>r.pagina===location.pathname&&r.ruta===route);
    if(!row||!authorized())return;
    row.vista=loaded?'Lista':'Error';memory=rows;
    try{localStorage.setItem(key,JSON.stringify(rows))}catch(_){}
    try{render()}catch(_){}
  };
  window.addEventListener('message',ev=>{if(ev.origin===location.origin&&ev.data&&ev.data.tipo==='gld_consumo_actualizado_v44')render()});
  function numberHeader(response,name){const value=response.headers.get(name);return value!==null&&/^\d+$/.test(value)?Number(value):null}
  function detailHeader(response,name){try{const raw=response.headers.get(name);return raw===null?null:JSON.parse(decodeURIComponent(raw))}catch(_){return null}}
  function operationsText(items){return items===null?'Sin medición':items.map(x=>x.operation+' · '+x.collection+(x.field?' por '+x.field:'')+': '+x.calls+' operación(es), '+x.documents_returned+' documento(s)').join('; ')||'Sin operaciones en Firestore'}
  function cacheText(items){const labels={hit:'Encontrada',miss:'No encontrada: consulta a Firestore',not_supported:'Consulta sin caché compatible'};return items===null?'Sin medición':items.map(x=>x.collection+(x.field?' por '+x.field:'')+': '+(labels[x.result]||x.result)).join('; ')||'Sin comprobaciones registradas'}
  window.fetch=async function(input,options){
    let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href)}catch(_){return originalFetch(input,options)}
    if(url.origin!==origin)return originalFetch(input,options);
    await diagnosticReady;
    if(!authorized())return originalFetch(input,options);
    let action=url.searchParams.get('action')||'';
    try{if(options&&typeof options.body==='string'){const body=JSON.parse(options.body);action=body.action||body.accion||action}}catch(_){}
    action=allowed.has(String(action).toLowerCase())?String(action).toLowerCase():'';
    const active=session();
    const row={capture_id:crypto.randomUUID(),prueba:active&&!active.ended_at?active.id:null,fecha:new Date().toISOString(),hora:new Date().toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}),pagina:location.pathname,ruta:url.pathname.replace(/(\/advertisers\/)[^/]+/g,'$1:id').replace(/(\/subscribers\/)[^/]+/g,'$1:id'),accion:action,metodo:String(options&&options.method||input&&input.method||'GET').toUpperCase()};
    try{save({...row,estado:'EN CURSO'})}catch(_){}
    try{
      const response=await originalFetch(input,options);
      let resultado=response.ok?'Sin comprobar':'Error HTTP';
      try{const data=await response.clone().json();if(response.ok&&data&&typeof data.success==='boolean')resultado=data.success?'Aceptada':'Rechazada';}catch(_){}
      const operaciones=detailHeader(response,'X-GLD-Operations'),cache=detailHeader(response,'X-GLD-Cache-Checks');
      try{save({...row,accion:response.headers.get('X-GLD-Action')||row.accion,consumo:detailHeader(response,'X-GLD-Consumption'),operaciones,cache,detalle:operationsText(operaciones),cache_estado:cacheText(cache),estado:response.status,resultado,version:response.headers.get('X-GLD-Worker-Version'),request_id:response.headers.get('X-GLD-Request-Id'),consultas:numberHeader(response,'X-GLD-Read-Calls'),documentos:numberHeader(response,'X-GLD-Documents-Returned'),escrituras:numberHeader(response,'X-GLD-Write-Calls'),eliminaciones:numberHeader(response,'X-GLD-Delete-Calls'),origen:response.headers.get('X-GLD-Source'),bloqueadas:numberHeader(response,'X-GLD-Public-Blocked')})}catch(_){}
      return response;
    }catch(error){try{save({...row,estado:'Error de red',version:null,consultas:null,documentos:null,escrituras:null,eliminaciones:null})}catch(_){}throw error}
  };
  function mount(){
    if(!document.body||!authorized()||container)return;
    const details=document.createElement('details');container=details;details.style.cssText='margin:16px 8px;padding:10px;background:#fff;color:#111;border:1px solid #aaa;border-radius:6px;font:14px sans-serif;position:relative;z-index:2';
    const summary=document.createElement('summary');summary.textContent='🔒 Pruebas privadas · ver consumo';summary.style.cursor='pointer';details.appendChild(summary);
    view=document.createElement('div');view.style.overflowX='auto';details.appendChild(view);
    const selector=script&&script.getAttribute('data-gld-consumo-container');
    const host=(selector&&document.querySelector(selector))||document.body;

    host.appendChild(details);details.addEventListener('toggle',render);render();
  }
  let adminToken='',toolbar=null;
  const capabilityKey='gld_diagnostic_capability_v87';
  const endpoint=origin+'/superadmin/diagnostics/session';
  const shareKey='gld_shared_diagnostics_v90';
  function shareInfo(){try{return JSON.parse(localRead(shareKey)||'null')}catch{return null}}
  function updateShareControls(){
    const info=shareInfo(),live=info&&Number(info.expires_at)>Date.now();
    const input=document.getElementById('gld-diagnostics-share-url');if(input)input.value=live?String(info.url||''):'';
    for(const id of ['gld-diagnostics-share-update','gld-diagnostics-share-revoke']){const b=document.getElementById(id);if(b)b.disabled=!live;}
  }
  async function shareRegistry(action){
    const message=document.getElementById('gld-diagnostics-share-message');
    if(!authorized()){if(message)message.textContent='Activá primero las pruebas privadas.';return;}
    const ids=['gld-diagnostics-share-create','gld-diagnostics-share-update','gld-diagnostics-share-revoke'];
    ids.forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=true;});
    try{
      const previous=shareInfo(),rows=action==='revoke'?undefined:read();
      if(action!=='revoke'&&!rows.length)throw new Error('Todavía no hay registros para compartir.');
      const token=localRead('gld_superadmin_token')||adminToken;
      const response=await originalFetch(origin+'/superadmin/diagnostics/share',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,rows,token:previous?.token})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw new Error(response.status===404?'Instalá Worker B90 para compartir el registro.':result.message||'No se pudo compartir el registro.');
      if(action==='revoke'){localStorage.removeItem(shareKey);if(message)message.textContent='Enlace revocado.';}
      else{
        localStorage.setItem(shareKey,JSON.stringify({token:result.token,url:result.url,expires_at:result.expires_at}));
        if(message)message.textContent=(action==='update'?'Copia actualizada. ':'Enlace creado. ')+result.rows+' registros. Caduca a las '+new Date(result.expires_at).toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})+'. Copiá el enlace y compartilo. Si recién se creó, puede tardar unos segundos en estar disponible.';
      }
    }catch(error){if(message)message.textContent=error.message||'No se pudo compartir.';}
    finally{const create=document.getElementById(ids[0]);if(create)create.disabled=false;updateShareControls();}
  }
  function addShareControls(host){
    const title=document.createElement('p');title.textContent='Compartir copia del registro · solo lectura, sin Firestore';host.appendChild(title);
    for(const [id,label,action] of [['create','Compartir registro','create'],['update','Actualizar enlace','update'],['revoke','Revocar enlace','revoke']]){
      const button=document.createElement('button');button.type='button';button.id='gld-diagnostics-share-'+id;button.textContent=label;button.style.cssText='display:block;width:100%;margin:6px 0;min-height:44px';button.onclick=()=>shareRegistry(action);host.appendChild(button);
    }
    const input=document.createElement('input');input.id='gld-diagnostics-share-url';input.type='text';input.readOnly=true;input.setAttribute('aria-label','Enlace temporal para compartir');input.style.cssText='width:100%;box-sizing:border-box;margin:8px 0;min-height:44px';input.onclick=()=>input.select();host.appendChild(input);
    const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar enlace';copy.style.cssText='display:block;width:100%;min-height:44px';copy.onclick=async()=>{if(!input.value)return;try{await navigator.clipboard.writeText(input.value);document.getElementById('gld-diagnostics-share-message').textContent='Enlace copiado.';}catch{input.select();document.getElementById('gld-diagnostics-share-message').textContent='Enlace seleccionado: copialo con Ctrl+C o desde el menú del teléfono.';}};host.appendChild(copy);
    const message=document.createElement('p');message.id='gld-diagnostics-share-message';message.textContent='Se comparte una copia, no una transmisión en vivo. Actualizar envía las nuevas filas a la misma URL. Cada enlace caduca en una hora.';host.appendChild(message);updateShareControls();
  }
  const localRead=k=>{try{return localStorage.getItem(k)||''}catch{return ''}};
  function clearView(){container?.remove();container=null;view=null;updateButton();}
  function stop(){adminExpires=0;try{localStorage.removeItem(capabilityKey)}catch{}clearView();}
  function updateButton(){const b=document.getElementById('gld-diagnostics-toggle');if(b)b.textContent=authorized()?'Desactivar pruebas privadas':'Activar pruebas privadas';}
  async function validate(){
    adminExpires=0;
    const capability=localRead(capabilityKey);if(!capability){clearView();return;}
    try{
      const r=await originalFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'validate',capability})});const j=await r.json();
      if(r.ok&&j.success===true)adminExpires=Number(j.expires_at)||0;
      else if(r.status===401&&localRead(capabilityKey)===capability){try{localStorage.removeItem(capabilityKey)}catch{}}
      if(authorized())mount();else clearView();
    }catch{clearView();}
    updateButton();
  }
  let diagnosticReady=validate();
  async function toggle(){
    if(authorized()){stop();return;}
    const b=document.getElementById('gld-diagnostics-toggle'),message=document.getElementById('gld-diagnostics-message');if(b)b.disabled=true;
    try{
      const token=localRead('gld_superadmin_token')||adminToken;
      const r=await originalFetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'create'})});const j=await r.json();
      if(!r.ok||!j.success)throw new Error(j.message||'Instalá Worker B87 para activar las pruebas privadas.');
      localStorage.setItem(capabilityKey,j.capability);adminExpires=Number(j.expires_at);mount();
      if(message)message.textContent='Activo por ocho horas en este navegador. Probá como visitante o anunciante y volvé aquí para consultar las mediciones.';
    }catch(e){if(message)message.textContent=e.message||'No se pudo activar.';}finally{if(b)b.disabled=false;updateButton();}
  }
  window.gldConsumoAdminV68=function(token){
    adminToken=String(token||'');
    if(!adminToken){adminExpires=0;clearView();toolbar?.remove();toolbar=null;return;}
    let p;try{p=JSON.parse(atob(adminToken.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')))}catch{return;}
    if(p.rol!=='SUPERADMIN_PRINCIPAL')return;
    if(!toolbar){toolbar=document.createElement('div');toolbar.className='card';const b=document.createElement('button');b.id='gld-diagnostics-toggle';b.type='button';b.onclick=toggle;toolbar.appendChild(b);const message=document.createElement('p');message.id='gld-diagnostics-message';message.textContent='Activá las pruebas privadas para medir la guía y los paneles. El público no verá estas mediciones.';toolbar.appendChild(message);const choices=document.createElement('div');choices.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:10px 0';
      const frame=document.createElement('iframe');frame.title='Simulación privada de Guía Local';frame.style.cssText='width:100%;height:760px;border:1px solid #ccc;background:#fff';frame.hidden=true;
      for(const [label,page] of [['Probar visitante','carcasa.html'],['Probar Mi Guía','suscriptores.html'],['Probar anunciante','login.html']]){const choice=document.createElement('button');choice.type='button';choice.textContent=label;choice.onclick=()=>{if(!authorized()){message.textContent='Activá primero las pruebas privadas.';return;}frame.hidden=false;frame.src='/plataforma/'+page;};choices.appendChild(choice);}
      const close=document.createElement('button');close.type='button';close.textContent='Cerrar simulación';close.onclick=()=>{frame.hidden=true;frame.removeAttribute('src');};choices.appendChild(close);toolbar.appendChild(choices);toolbar.appendChild(frame);
      const measurement=document.createElement('div');
      for(const [label,run]of [['Medir Guía con mi cuenta',()=>startMeasurement(true)],['Medir Guía sin sesión',()=>startMeasurement(false)],['Finalizar medición',endMeasurement]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='display:block;width:100%;min-height:44px;margin:6px 0';b.onclick=run;measurement.appendChild(b);}
      const help=document.createElement('p');help.textContent='Iniciá la medición antes de abrir o recargar Guía. Al terminar, volvé y pulsá Finalizar medición. Incluye las llamadas registradas en este navegador. Los datos ausentes bloquean el cierre.';measurement.appendChild(help);toolbar.appendChild(measurement);
      document.querySelector('#app')?.appendChild(toolbar);addShareControls(toolbar);}
    diagnosticReady=validate();updateButton();
  };
  window.addEventListener('storage',e=>{if(e.key===capabilityKey)diagnosticReady=validate();else if(e.key===key||e.key===sessionKey)render();else if(e.key==='gld_superadmin_token'&&!e.newValue){stop();toolbar?.remove();toolbar=null;}});
  window.addEventListener('gld-diagnostics-logout',()=>{stop();toolbar?.remove();toolbar=null;});
  document.addEventListener('DOMContentLoaded',()=>{if(authorized())mount();});


})();



