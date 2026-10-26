/* Diagnóstico local; compartir una copia requiere una acción explícita del principal. */
(function(){
  'use strict';
  if(window.__gldConsumoV44)return;
  window.__gldConsumoV44=true;
  const script=document.currentScript;
  const showPanel=script&&script.hasAttribute('data-gld-consumo-panel');
  const key='gld_consumo_admin_v87';
  const origin='https://login.liqkoargentina.workers.dev';
  const allowed=new Set(['login','session','favoritos','anunciantes_autorizados','publicas','turnos','efemerides','perfil','crear','actualizar_perfil','actualizar_ciudad','cambiar_clave','eliminar_cuenta','agregar_favorito','quitar_favorito']);
  let memory=[],view=null,container=null,adminExpires=0;
  const authorized=()=>adminExpires>Date.now();
  const originalFetch=window.fetch.bind(window);
  function read(){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:memory}catch(_){return memory}}
  const measurementKey='gld_medicion_actual_v141';
  function measurement(){try{return JSON.parse(localStorage.getItem(measurementKey)||'null');}catch{return null;}}
  function currentRows(rows=read()){const m=measurement();return m?rows.filter(r=>r.medicion_id===m.id&&Date.parse(r.fecha)>=m.start):[];}
  function beginMeasurement(){const m={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),start:Date.now(),active:true};try{localStorage.setItem(measurementKey,JSON.stringify(m));}catch{throw Error('No se pudo iniciar la medición en este navegador.');}render();}
  const exportFields=['medicion_id','inicio_medicion_utc','fecha','fecha_argentina','pagina','ruta','accion','metodo','estado','resultado','vista','version','request_id','consultas','documentos','escrituras','eliminaciones','cf_worker','cf_kv_get','cf_kv_put','cf_kv_delete','cf_kv_list','cf_public_calls','cf_store_read','cf_store_write','cf_admin_calls','cf_admin_read','cf_admin_write','cf_action_calls','cf_action_read','cf_action_write','cf_alarm_set','cf_alarm_cancel','cf_marker_get','cf_marker_put','cf_cpu','cf_cobertura','cf_missing','detalle','cache_estado'];
  function csvCell(value){let v=value==null?'':String(value);if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
  function csvRows(rows){return '\uFEFF'+[exportFields.map(csvCell).join(','),...rows.map(saved=>{const row={...saved,...(saved.consumo_cloudflare?cloudflareMetrics(saved.consumo_cloudflare):{}),fecha_argentina:argStamp(saved)};return exportFields.map(k=>csvCell(row[k])).join(',');})].join('\r\n');}
  function downloadRows(rows,label){const blob=new Blob([csvRows(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='medicion-'+label+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const argStamp=row=>{const d=new Date(row.fecha);return row.fecha&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d):'Fecha no registrada · '+String(row.hora||'Hora no registrada');};
  function render(){
    if(!view||!authorized())return;
    const stored=read(),m=measurement();view.textContent='';
    const intro=document.createElement('p');
    intro.textContent='Respuestas capturadas en este navegador con las pruebas privadas activadas. No es el consumo total de la cuenta ni un monitor global en vivo. Consultas Firebase y documentos devueltos no equivalen a lecturas facturadas. Los datos ausentes se indican como sin medición. Mostrar y filtrar este historial no consulta servidores.';view.appendChild(intro);
    const controls=document.createElement('div');controls.style.cssText='display:flex;flex-direction:column;gap:8px';view.appendChild(controls);
    const begin=document.createElement('button');begin.type='button';begin.textContent=m?'Empezar una nueva medición desde ahora':'Empezar medición desde ahora';begin.onclick=()=>{try{beginMeasurement();}catch(e){count.textContent=e.message;}};controls.appendChild(begin);
    const rows=currentRows(stored).map((row,index)=>({row,index})).sort((a,b)=>(Date.parse(b.row.fecha)||0)-(Date.parse(a.row.fecha)||0)||b.index-a.index).map(({row})=>row);
    const end=document.createElement('button');end.type='button';end.textContent='Terminar medición';end.disabled=!m?.active;end.onclick=()=>{const latest=measurement();if(latest){latest.active=false;latest.end=Date.now();localStorage.setItem(measurementKey,JSON.stringify(latest));render();}};controls.appendChild(end);
    const exportCurrent=document.createElement('button');exportCurrent.type='button';exportCurrent.textContent='Descargar esta medición · CSV para Sheets';exportCurrent.disabled=!rows.length;exportCurrent.onclick=()=>downloadRows(currentRows(),'actual');controls.appendChild(exportCurrent);
    const count=document.createElement('p');count.textContent=m?(m.active?'Midiendo desde ':'Medición terminada · inicio ')+argStamp({fecha:new Date(m.start).toISOString()})+' · '+rows.length+' pedidos conservados (límite del navegador:160).':'Sin medición iniciada. Pulsá Empezar medición antes de realizar la acción.';view.appendChild(count);
    const archived=stored.filter(r=>!m||r.medicion_id!==m.id),history=document.createElement('details'),title=document.createElement('summary');title.textContent='Registros anteriores · sólo para exportar';history.appendChild(title);const info=document.createElement('p');info.textContent='No se mezclan con la medición actual. Este navegador conserva hasta160registros en total; descargá el CSV antes de acumular más o borrar los datos del navegador. Importalo en Google Sheets para conservar y comparar. Las celdas numéricas vacías significan sin medición, no cero.';history.appendChild(info);const exportHistory=document.createElement('button');exportHistory.type='button';exportHistory.textContent='Descargar registros anteriores · CSV';exportHistory.disabled=!archived.length;exportHistory.onclick=()=>{const active=measurement();downloadRows(read().filter(r=>!active||r.medicion_id!==active.id),'anteriores');};history.appendChild(exportHistory);view.appendChild(history);
    const scroll=document.createElement('div');scroll.style.cssText='overflow:auto;max-height:65vh;border:1px solid #ccd8df';view.appendChild(scroll);
    const table=document.createElement('table');table.style.cssText='border-collapse:separate;border-spacing:0;font:13px sans-serif;min-width:900px;width:100%';scroll.appendChild(table);
    const fields=['fecha','accion','estado','consultas','documentos','escrituras','eliminaciones','cf_worker','details'];
    const labels=['Fecha y hora Argentina','Acción / ruta','HTTP','Consultas Firebase','Documentos devueltos','Escrituras Firebase','Eliminaciones Firebase','Solicitudes Worker','Desglose'];
    const thead=document.createElement('thead'),head=document.createElement('tr');thead.appendChild(head);table.appendChild(thead);labels.forEach(label=>{const th=document.createElement('th');th.textContent=label;th.scope='col';th.style.cssText='position:sticky;top:0;z-index:1;background:#edf5f9;padding:9px;border:1px solid #ccd8df;text-align:left';head.appendChild(th);});
    const tbody=document.createElement('tbody');table.appendChild(tbody);
    const detailFields=[['pagina','Pantalla'],['ruta','Ruta'],['metodo','Método'],['request_id','Identificador del pedido'],['version','Versión Worker'],['resultado','Respuesta'],['vista','Vista'],['cf_kv_get','KV: lecturas'],['cf_kv_put','KV: escrituras'],['cf_kv_delete','KV: eliminaciones'],['cf_kv_list','KV: listados'],['cf_public_calls','Llamadas al almacén público'],['cf_store_read','SQL público: filas leídas'],['cf_store_write','SQL público: filas escritas'],['cf_admin_calls','Llamadas al almacén administrativo'],['cf_admin_read','SQL administrativo: filas leídas'],['cf_admin_write','SQL administrativo: filas escritas'],['cf_action_calls','Llamadas al coordinador de Ciudades'],['cf_action_read','Coordinador: filas leídas'],['cf_action_write','Coordinador: filas/unidades de escritura registradas'],['cf_alarm_set','Alarmas: programación'],['cf_alarm_cancel','Alarmas: cancelación'],['cf_marker_get','Marcador durable: lecturas (incluidas en el coordinador)'],['cf_marker_put','Marcador durable: escrituras (incluidas en el coordinador)'],['cf_cpu','CPU del Worker (ms)'],['cf_cobertura','Cobertura informada'],['cf_missing','Mediciones no disponibles'],['detalle','Operaciones Firebase'],['cache_estado','Caché']];
    rows.forEach(saved=>{const row={...saved,...(saved.consumo_cloudflare?cloudflareMetrics(saved.consumo_cloudflare):{})},tr=document.createElement('tr');tbody.appendChild(tr);fields.forEach(field=>{const td=document.createElement('td');td.style.cssText='padding:9px;border:1px solid #ccd8df;vertical-align:top';tr.appendChild(td);
      if(field==='details'){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ver Firebase y Cloudflare';details.appendChild(summary);const dl=document.createElement('dl');for(const [key,label]of detailFields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dt.style.fontWeight='bold';dd.textContent=row[key]==null?'Sin medición':String(row[key]);dl.appendChild(dt);dl.appendChild(dd);}details.appendChild(dl);td.appendChild(details);}
      else td.textContent=field==='fecha'?argStamp(row):field==='accion'?[row.accion,row.ruta].filter(Boolean).join(' · '):row[field]==null?'Sin medición':String(row[field]);
    });});
    if(!rows.length){const empty=document.createElement('p');empty.textContent='Esta medición todavía no tiene pedidos registrados.';view.appendChild(empty);}
  }
  function save(row){
    const m=measurement();if(!authorized()||!m?.active||row.medicion_id!==m.id||Date.parse(row.fecha)<m.start)return;
    memory=read().concat(row).slice(-160);
    try{localStorage.setItem(key,JSON.stringify(memory))}catch(_){}
    try{render()}catch(_){}
    try{if(window.parent!==window)window.parent.postMessage({tipo:'gld_consumo_actualizado_v44'},location.origin)}catch(_){}
  }
  window.gldConsumoVistaV49=function(moduleName,loaded){
    const routes={turnos_farma:'/farmacias',publicidad:'/publicidad',promos:'/promos',eventos:'/events-new',eventos_free:'/events-new',actividades:'/actividades',efemerides:'/efemerides',modificar_datos:'/commerce'};
    const route=routes[moduleName];if(!route||typeof loaded!=='boolean')return;
    const rows=read();
    const row=[...currentRows(rows)].reverse().find(r=>r.pagina===location.pathname&&r.ruta===route);
    if(!row||!authorized())return;
    row.vista=loaded?'Lista':'Error';memory=rows;
    try{localStorage.setItem(key,JSON.stringify(rows))}catch(_){}
    try{render()}catch(_){}
  };
  window.addEventListener('message',ev=>{if(ev.origin===location.origin&&ev.data&&ev.data.tipo==='gld_consumo_actualizado_v44')render()});
  function numberHeader(response,name){const value=response.headers.get(name);return value!==null&&/^\d+$/.test(value)?Number(value):null}
  function detailHeader(response,name){try{const raw=response.headers.get(name);return raw===null?null:JSON.parse(decodeURIComponent(raw))}catch(_){return null}}
  function metric(value){return Number.isSafeInteger(value)&&value>=0?value:null}
  function cloudflareMetrics(raw){
    const c=raw&&typeof raw==='object'?raw.cloudflare:null,kv=c?.kv||{},pub=c?.public_store||{},admin=c?.admin_store||{},action=c?.action_store||{},coverage=raw?.coverage||{};
    return {cf_worker:metric(c?.worker_requests),cf_kv_get:metric(kv.get_calls),cf_kv_put:metric(kv.put_calls),cf_kv_delete:metric(kv.delete_calls),cf_kv_list:metric(kv.list_calls),cf_public_calls:metric(pub.calls),cf_store_read:metric(pub.rows_read),cf_store_write:metric(pub.rows_written),cf_admin_calls:metric(admin.calls),cf_admin_read:metric(admin.rows_read),cf_admin_write:metric(admin.rows_written),cf_action_calls:metric(action.calls),cf_action_read:metric(action.rows_read),cf_action_write:metric(action.rows_written),cf_alarm_set:metric(action.alarm_set_calls),cf_alarm_cancel:metric(action.alarm_cancel_calls),cf_marker_get:metric(action.marker_get_calls),cf_marker_put:metric(action.marker_put_calls),cf_cpu:typeof c?.cpu_ms==='number'&&Number.isFinite(c.cpu_ms)&&c.cpu_ms>=0?c.cpu_ms:null,cf_cobertura:coverage.status||'Sin medición',cf_missing:Array.isArray(coverage.missing)?coverage.missing.join(', '):null};
  }
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
    const m=measurement();
    const row={medicion_id:m?.active?m.id:null,inicio_medicion_utc:m?new Date(m.start).toISOString():null,fecha:new Date().toISOString(),hora:new Date().toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}),pagina:location.pathname,ruta:url.pathname.replace(/(\/advertisers\/)[^/]+/g,'$1:id').replace(/(\/subscribers\/)[^/]+/g,'$1:id'),accion:action,metodo:String(options&&options.method||input&&input.method||'GET').toUpperCase()};
    try{
      const response=await originalFetch(input,options);
      let resultado=response.ok?'Sin comprobar':'Error HTTP';
      try{const data=await response.clone().json();if(response.ok&&data&&typeof data.success==='boolean')resultado=data.success?'Aceptada':'Rechazada';}catch(_){}
      const operaciones=detailHeader(response,'X-GLD-Operations'),cache=detailHeader(response,'X-GLD-Cache-Checks'),consumption=detailHeader(response,'X-GLD-Consumption');
      try{save({...row,...cloudflareMetrics(consumption),consumo_cloudflare:consumption,accion:response.headers.get('X-GLD-Action')||row.accion,operaciones,cache,detalle:operationsText(operaciones),cache_estado:cacheText(cache),estado:response.status,resultado,version:response.headers.get('X-GLD-Worker-Version'),request_id:response.headers.get('X-GLD-Request-Id'),consultas:numberHeader(response,'X-GLD-Read-Calls'),documentos:numberHeader(response,'X-GLD-Documents-Returned'),escrituras:numberHeader(response,'X-GLD-Write-Calls'),eliminaciones:numberHeader(response,'X-GLD-Delete-Calls'),origen:response.headers.get('X-GLD-Source'),bloqueadas:numberHeader(response,'X-GLD-Public-Blocked')})}catch(_){}
      return response;
    }catch(error){try{save({...row,estado:'Error de red',version:null,consultas:null,documentos:null,escrituras:null,eliminaciones:null})}catch(_){}throw error}
  };
  function mount(){
    if(!document.body||!authorized()||container)return;
    const details=document.createElement('details');container=details;details.style.cssText='margin:16px 8px;padding:10px;background:#fff;color:#111;border:1px solid #aaa;border-radius:6px;font:14px sans-serif;position:relative;z-index:2';
    const summary=document.createElement('summary');summary.textContent='🔒 Medición actual · consumos';summary.style.cursor='pointer';details.appendChild(summary);
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
      const previous=shareInfo(),rows=action==='revoke'?undefined:currentRows();
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
      document.querySelector('#app')?.appendChild(toolbar);addShareControls(toolbar);}
    diagnosticReady=validate();updateButton();
  };
  window.addEventListener('storage',e=>{if(e.key===capabilityKey)diagnosticReady=validate();else if(e.key===key||e.key===measurementKey)render();else if(e.key==='gld_superadmin_token'&&!e.newValue){stop();toolbar?.remove();toolbar=null;}});
  window.addEventListener('gld-diagnostics-logout',()=>{stop();toolbar?.remove();toolbar=null;});
  document.addEventListener('DOMContentLoaded',()=>{if(authorized())mount();});


})();
