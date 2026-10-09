/* Diagnóstico local: no envía registros, cuerpos, credenciales ni datos personales. */
(function(){
  'use strict';
  if(window.__gldConsumoV44)return;
  window.__gldConsumoV44=true;
  const script=document.currentScript;
  const showPanel=script&&script.hasAttribute('data-gld-consumo-panel');
  const key='gld_consumo_admin_v68';
  const origin='https://login.liqkoargentina.workers.dev';
  const allowed=new Set(['login','session','favoritos','anunciantes_autorizados','publicas','turnos','efemerides','perfil','crear','actualizar_perfil','actualizar_ciudad','cambiar_clave','eliminar_cuenta','agregar_favorito','quitar_favorito']);
  let memory=[],view=null,container=null,adminExpires=0;
  const authorized=()=>adminExpires>Date.now();
  const originalFetch=window.fetch.bind(window);
  function read(){try{const x=JSON.parse(sessionStorage.getItem(key)||'[]');return Array.isArray(x)?x:memory}catch(_){return memory}}
  function render(){
    if(!view||!authorized())return;
    const rows=read();view.textContent='';
    const intro=document.createElement('p');
    intro.textContent='Registro de las últimas llamadas de esta sesión. Consultas y documentos devueltos no son el contador de lecturas facturadas de Firebase. “Sin medición” no significa cero. Respuesta indica si el servicio aceptó la operación; Vista indica si el panel terminó de cargar. Los registros anteriores quedan sin comprobar.';
    view.appendChild(intro);
    const table=document.createElement('table');table.style.cssText='border-collapse:collapse;font:12px sans-serif;min-width:760px';
    const fields=['hora','pagina','ruta','accion','estado','resultado','vista','version','consultas','documentos','escrituras','eliminaciones','origen','detalle','cache_estado'];
    const labels=['Hora Argentina','Pantalla','Llamada','Acción','HTTP','Respuesta','Vista','Worker','Consultas','Documentos','Escrituras','Eliminaciones','Fuente','Operaciones','Caché'];
    const head=document.createElement('tr');labels.forEach(label=>{const th=document.createElement('th');th.textContent=label;th.style.cssText='padding:6px;border:1px solid #ccc';head.appendChild(th)});table.appendChild(head);
    rows.forEach(row=>{const tr=document.createElement('tr');fields.forEach(field=>{const td=document.createElement('td');td.textContent=row[field]==null?(['resultado','vista'].includes(field)?'Sin comprobar':'Sin medición'):String(row[field]);td.style.cssText='padding:6px;border:1px solid #ccc';tr.appendChild(td)});table.appendChild(tr)});
    view.appendChild(table);
    const data=document.createElement('textarea');data.readOnly=true;data.setAttribute('aria-label','Registro para compartir');data.style.cssText='width:100%;height:110px;margin-top:10px';data.value=JSON.stringify(rows,null,2);view.appendChild(data);
    if(!rows.length){const p=document.createElement('p');p.textContent='Todavía no se registraron llamadas.';view.appendChild(p)}
  }
  function save(row){
    if(!authorized())return;
    memory=read().concat(row).slice(-80);
    try{sessionStorage.setItem(key,JSON.stringify(memory))}catch(_){}
    try{render()}catch(_){}
    try{if(window.parent!==window)window.parent.postMessage({tipo:'gld_consumo_actualizado_v44'},location.origin)}catch(_){}
  }
  window.gldConsumoVistaV49=function(moduleName,loaded){
    const routes={turnos_farma:'/farmacias',publicidad:'/publicidad',promos:'/promos',eventos:'/events-new',eventos_free:'/events-new',actividades:'/actividades',efemerides:'/efemerides',modificar_datos:'/commerce'};
    const route=routes[moduleName];if(!route||typeof loaded!=='boolean')return;
    const rows=read();
    const row=[...rows].reverse().find(r=>r.pagina===location.pathname&&r.ruta===route);
    if(!row)return;
    row.vista=loaded?'Lista':'Error';memory=rows;
    try{sessionStorage.setItem(key,JSON.stringify(rows))}catch(_){}
    try{render()}catch(_){}
  };
  window.addEventListener('message',ev=>{if(ev.origin===location.origin&&ev.data&&ev.data.tipo==='gld_consumo_actualizado_v44')render()});
  function numberHeader(response,name){const value=response.headers.get(name);return value!==null&&/^\d+$/.test(value)?Number(value):null}
  function detailHeader(response,name){try{const raw=response.headers.get(name);return raw===null?null:JSON.parse(decodeURIComponent(raw))}catch(_){return null}}
  function operationsText(items){return items===null?'Sin medición':items.map(x=>x.operation+' · '+x.collection+(x.field?' por '+x.field:'')+': '+x.calls+' operación(es), '+x.documents_returned+' documento(s)').join('; ')||'Sin operaciones en Firestore'}
  function cacheText(items){const labels={hit:'Encontrada',miss:'No encontrada: consulta a Firestore',not_supported:'Consulta sin caché compatible'};return items===null?'Sin medición':items.map(x=>x.collection+(x.field?' por '+x.field:'')+': '+(labels[x.result]||x.result)).join('; ')||'Sin comprobaciones registradas'}
  window.fetch=async function(input,options){
    if(!authorized())return originalFetch(input,options);
    let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href)}catch(_){return originalFetch(input,options)}
    if(url.origin!==origin)return originalFetch(input,options);
    let action=url.searchParams.get('action')||'';
    try{if(options&&typeof options.body==='string'){const body=JSON.parse(options.body);action=body.action||body.accion||action}}catch(_){}
    action=allowed.has(String(action).toLowerCase())?String(action).toLowerCase():'';
    const row={fecha:new Date().toISOString(),hora:new Date().toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}),pagina:location.pathname,ruta:url.pathname.replace(/(\/advertisers\/)[^/]+/g,'$1:id').replace(/(\/subscribers\/)[^/]+/g,'$1:id'),accion:action,metodo:String(options&&options.method||input&&input.method||'GET').toUpperCase()};
    try{
      const response=await originalFetch(input,options);
      let resultado=response.ok?'Sin comprobar':'Error HTTP';
      try{const data=await response.clone().json();if(response.ok&&data&&typeof data.success==='boolean')resultado=data.success?'Aceptada':'Rechazada';}catch(_){}
      const operaciones=detailHeader(response,'X-GLD-Operations'),cache=detailHeader(response,'X-GLD-Cache-Checks');
      try{save({...row,accion:response.headers.get('X-GLD-Action')||row.accion,operaciones,cache,detalle:operationsText(operaciones),cache_estado:cacheText(cache),estado:response.status,resultado,version:response.headers.get('X-GLD-Worker-Version'),request_id:response.headers.get('X-GLD-Request-Id'),consultas:numberHeader(response,'X-GLD-Read-Calls'),documentos:numberHeader(response,'X-GLD-Documents-Returned'),escrituras:numberHeader(response,'X-GLD-Write-Calls'),eliminaciones:numberHeader(response,'X-GLD-Delete-Calls'),origen:response.headers.get('X-GLD-Source'),bloqueadas:numberHeader(response,'X-GLD-Public-Blocked')})}catch(_){}
      return response;
    }catch(error){try{save({...row,estado:'Error de red',version:null,consultas:null,documentos:null,escrituras:null,eliminaciones:null})}catch(_){}throw error}
  };
  function mount(){
    if(!showPanel||!document.body||!authorized()||container)return;
    const details=document.createElement('details');container=details;details.style.cssText='margin:16px 8px;padding:10px;background:#fff;color:#111;border:1px solid #aaa;border-radius:6px;font:14px sans-serif;position:relative;z-index:2';
    const summary=document.createElement('summary');summary.textContent='Ver comprobación de consultas';summary.style.cursor='pointer';details.appendChild(summary);
    view=document.createElement('div');view.style.overflowX='auto';details.appendChild(view);
    const selector=script&&script.getAttribute('data-gld-consumo-container');
    const host=(selector&&document.querySelector(selector))||document.body;
    if(selector)details.open=true;
    host.appendChild(details);details.addEventListener('toggle',render);render();
  }
  window.gldConsumoAdminV68=function(token){
    adminExpires=0;
    try{const payload=JSON.parse(atob(String(token).split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));if(payload.rol==='SUPERADMIN_PRINCIPAL'&&Number(payload.exp)>Date.now())adminExpires=Number(payload.exp)}catch(_){}
    if(authorized())mount();else{container?.remove();container=null;view=null;memory=[];try{sessionStorage.removeItem(key)}catch(_){}}
  };

})();

