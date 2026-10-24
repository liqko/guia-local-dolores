/* Registro técnico automático. No captura valores, textos escritos ni identidades. */
(function () {
  'use strict';
  if (window.gldTelemetry || /\/observabilidad(?:\.html)?$/.test(location.pathname)) return;
  const API = 'https://login.liqkoargentina.workers.dev';
  const nativeFetch = window.fetch.bind(window);
  const uuid = () => crypto.randomUUID();
  const safeRead = key => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const safeWrite = (key, value) => { try { sessionStorage.setItem(key, value); } catch {} };
  const page = location.pathname.replace(/\.html$/, '');
  const session = safeRead('gld_telemetry_session_v1') || uuid();
  safeWrite('gld_telemetry_session_v1', session);
  const view = uuid(), storageKey = 'gld_telemetry_queue_v1:' + view;
  let parentPage='';try{parentPage=parent.location.pathname;}catch{}
  const contextPage=page+' '+parentPage;
  const iface = /granhermano/.test(contextPage) ? 'administrador' : /\/login(?:\.html)?(?:$| )/.test(contextPage) ? 'anunciante' : 'usuario';
  let queue = [], sending = false, failed = 0, dropped = 0, timer = null;
  let current = { id: uuid(), action: 'cargar_pagina', at: 0 }, history = [current];
  function record(data) {
    const row = { id: uuid(), at: Date.now(), action_id: current.id, session_id: session, view_id: view,
      page, interface: iface, association: 'temporal', ...data };
    if (queue.length >= 200) { dropped++; return; }
    queue.push(row); safeWrite(storageKey, JSON.stringify(queue));
    if (queue.length >= 35) schedule(100); else schedule(5000);
  }
  function schedule(delay) { if (timer !== null || sending || failed >= 3) return; timer = setTimeout(() => { timer = null; flush(); }, delay); }
  function newAction(action, control, explicit = false) {
    current = { id: uuid(), action, at: performance.now() }; history.push(current); history = history.slice(-200);
    record({ kind: 'action', action, control, association: explicit ? 'explicit' : 'temporal' });
    return current.id;
  }
  const labels = {buscarCiudad:'buscar_ciudad',entrar:'ingresar_ciudad',btnLogin:'iniciar_sesion',btnSalir:'cerrar_sesion'};
  function targetInfo(target) {
    const el = target?.closest?.('button,a,input,select,textarea,[role="button"],[data-gld-action]');
    if (!el || el.closest('[data-gld-telemetry-ignore]')) return null;
    const raw = el.getAttribute('data-gld-action') || el.id || el.tagName.toLowerCase();
    const control = /^[a-zA-Z][a-zA-Z_-]{0,60}$/.test(raw) ? raw : el.tagName.toLowerCase();
    return {control, action:labels[control] || (el.getAttribute('data-gld-action') ? control : 'interactuar_' + control)};
  }
  document.addEventListener('click', e => {const info=targetInfo(e.target);if(info)newAction(info.action,info.control);},true);
  let inputControl='', inputAt=0;
  document.addEventListener('input', e => {
    const info=targetInfo(e.target);if(!info)return;
    // One typing burst, without storing the entered value or each keypress.
    if(info.control!==inputControl||performance.now()-inputAt>1200)newAction(labels[info.control]||'editar_'+info.control,info.control);
    inputControl=info.control;inputAt=performance.now();
  },true);
  document.addEventListener('change', e => {const info=targetInfo(e.target);if(info&&e.target?.tagName==='SELECT')newAction('seleccionar_'+info.control,info.control);},true);
  window.fetch = function(input, options) {
    let url;try {url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);}catch{return nativeFetch(input,options);}
    if(url.origin!==API||/^\/(?:telemetry|superadmin\/(?:telemetry|diagnostics))/.test(url.pathname))return nativeFetch(input,options);
    const action=current;
    // Headers preserve URL cache keys and never read request bodies or credentials.
    let request;
    try {
      request=new Request(input instanceof Request?input:url.href,options);
      const headers=new Headers(request.headers);
      headers.set('X-GLD-Trace',[action.id,session,view,page,iface].join(';'));
      request=new Request(request,{headers});
    } catch { return nativeFetch(input,options); }
    return nativeFetch(request).catch(error=>{record({kind:'network_error',action_id:action.id,action:action.action});throw error;});
  };
  if (window.PerformanceObserver) {
    try {
      performance.setResourceTimingBufferSize(2000);
      const observer=new PerformanceObserver(list=>{
        for(const entry of list.getEntries()) {
          let url;try{url=new URL(entry.name);}catch{continue;}
          if(!['http:','https:'].includes(url.protocol)||/^\/(?:telemetry|superadmin\/(?:telemetry|diagnostics))/.test(url.pathname))continue;
          const action=[...history].reverse().find(a=>a.at<=entry.startTime)||history[0];
          // Cross-origin zero can mean hidden data, never assume a cache hit.
          const measurable=url.origin===location.origin||entry.transferSize>0||entry.encodedBodySize>0;
          record({kind:'resource',action_id:action.id,action:action.action,host:url.hostname,
            resource_type:entry.initiatorType||'other',transfer_bytes:measurable?Math.max(0,Math.round(entry.transferSize)):null,
            resource_ms:Math.round(entry.duration)});
        }
      });
      observer.observe({type:'resource',buffered:true});
      // Navigation contains the HTML transfer that happened before this script ran.
      for(const entry of performance.getEntriesByType('navigation'))record({kind:'resource',resource_type:'document',host:location.hostname,
        transfer_bytes:entry.transferSize>0||entry.encodedBodySize>0?Math.round(entry.transferSize):null,resource_ms:Math.round(entry.duration)});
    } catch { record({kind:'gap',count:1,action:'resource_timing_no_disponible'}); }
  }
  window.addEventListener('error', e=>record({kind:'runtime_error',action:'error_javascript',line:Number.isInteger(e.lineno)?e.lineno:null}));
  window.addEventListener('unhandledrejection',()=>record({kind:'runtime_error',action:'promesa_rechazada'}));
  async function flush() {
    if(sending||!queue.length||failed>=3)return;
    sending=true;
    const batch=queue.slice(0,35);
    try {
      const r=await nativeFetch(API+'/telemetry/events',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({rows:batch}),keepalive:true,credentials:'omit'});
      if(!r.ok)throw Error('Telemetry unavailable');
      const result=await r.json();if(!result.success)throw Error('Telemetry unavailable');
      queue.splice(0,batch.length);failed=0;
      safeWrite(storageKey,JSON.stringify(queue));
      if(dropped){const count=dropped;dropped=0;record({kind:'gap',action:'cola_saturada',count});}
    } catch {failed++;}
    finally {sending=false;if(queue.length)schedule(failed?Math.min(30000,5000*2**failed):100);}
  }
  window.addEventListener('online',()=>{failed=0;flush();});
  window.addEventListener('pagehide',()=>{failed=0;flush();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){failed=0;flush();}});
  // Resume only this tab's technical batches, whose ids allow server deduplication.
  try {
    for(let i=0;i<sessionStorage.length;i++){
      const key=sessionStorage.key(i);if(!key?.startsWith('gld_telemetry_queue_v1:')||key===storageKey)continue;
      const pending=JSON.parse(sessionStorage.getItem(key)||'[]');
      if(Array.isArray(pending)&&pending.length&&Date.now()-pending.at(-1).at>30000){
        queue.push(...pending.filter(r=>Date.now()-r.at<3600000).slice(0,200-queue.length));sessionStorage.removeItem(key);
      }
    }
  } catch {}
  window.gldTelemetry={version:1,action:(label)=>newAction(/^[a-zA-Z_:-]{1,60}$/.test(label)?label:'accion','',true),flush};
  record({kind:'action',action:'cargar_pagina',association:'explicit'});
})();
