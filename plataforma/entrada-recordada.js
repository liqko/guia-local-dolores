/* Public entry preferences; authorization remains on the server. */
(function(){
 'use strict';
 const SESSION='gld_suscriptor_session_v2',TOKEN='gld_suscriptor_token_v2',CONTEXT='gld_ciudad_contexto',INTENT='gld_abrir_selector_ciudad_v92';
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
 const token=()=>{try{return localStorage.getItem(TOKEN)||'';}catch{return '';}};
 const identity=value=>{try{const p=JSON.parse(atob(value.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));return p?.typ==='GLD_SUBSCRIBER'&&p.sid?String(p.sid):'';}catch{return '';}};
 let pending;

 // Read-only account diagnostics: no credentials, account fields or city identifiers.
 window.gldDiagnosticoIngreso=function(){
  let storage='disponible',error='';
  try{const key='gld_ingreso_probe';localStorage.setItem(key,'1');if(localStorage.getItem(key)!=='1')throw new Error('NoPersistido');localStorage.removeItem(key);}catch(e){storage='bloqueado';error=String(e.name||'Error');}
  const saved=read(SESSION),ctx=read(CONTEXT),raw=token();
  let container='';try{container=new URL(document.referrer).origin;}catch{}
  return {version:'ingreso-102',origen:location.origin,contenedor:container,embebida:window.self!==window.top,almacenamiento:storage,error,credencial_guardada:!!raw,credencial_reconocida:!!identity(raw),perfil_guardado:!!saved?.suscriptor_id,ciudad_guardada:!!ctx?.ciudad_id,resultado:window.__gldResultadoEntrada||'sin_iniciar'};
 };
 function diagnosticoVisible(){
  const selector=document.getElementById('selectorCiudad');
  if(!selector||selector.hidden||document.getElementById('gldDiagnosticoIngreso'))return;
  const box=document.createElement('details');box.id='gldDiagnosticoIngreso';box.style.cssText='margin-top:16px;font-size:13px';
  const title=document.createElement('summary');title.textContent='Diagnóstico de ingreso';
  const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
  box.append(title,pre);box.addEventListener('toggle',()=>{if(box.open)pre.textContent=JSON.stringify(window.gldDiagnosticoIngreso(),null,2);});selector.appendChild(box);
 }
 function watchSelector(){const s=document.getElementById('selectorCiudad');if(s)new MutationObserver(diagnosticoVisible).observe(s,{attributes:true,attributeFilter:['hidden']});diagnosticoVisible();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchSelector);else watchSelector();

 window.gldPedirSelectorCiudadV92=function(){try{sessionStorage.setItem(INTENT,String(Date.now()));}catch{}};
 window.gldConsumirSelectorCiudadV92=function(){
  let marked=false;try{const ts=Number(sessionStorage.getItem(INTENT));sessionStorage.removeItem(INTENT);marked=ts>0&&Date.now()-ts>=0&&Date.now()-ts<120000;}catch{}
  const explicit=new URLSearchParams(location.search).get('cambiar_ciudad')==='1';
  return marked||explicit;
 };
 window.gldRecuperarEntradaV92=function(){
  if(pending)return pending;
  pending=(async()=>{
   const sent=token(),sid=identity(sent);let profile=read(SESSION);window.__gldResultadoEntrada=sid?'validando':'sin_credencial_reconocida';
   if(!sid){
    // Remember public navigation independently of account credentials.
    // This context never authenticates a subscriber or grants private access.
    const context=read(CONTEXT),city=String(context?.ciudad_id||'').trim();
    return {recordada:!!city,ciudad_id:city,contexto:city?context:null,perfil:null};
   }
   if(profile&&String(profile.suscriptor_id)!==sid)profile=null;
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try{
    const r=await fetch('https://login.liqkoargentina.workers.dev/suscriptores?action=perfil',{headers:{Authorization:'Bearer '+sent},signal:controller.signal});
    const j=await r.json();
    // Never apply a response after logout or an account switch.
    if(identity(token())!==sid)return {recordada:false,ciudad_id:'',perfil:null};
    window.__gldResultadoEntrada='perfil_http_'+r.status;
    if(r.status>=400&&r.status<500)return {recordada:false,ciudad_id:'',perfil:null};
    if(r.ok&&j.success&&String(j.suscriptor?.suscriptor_id)===sid){profile={...profile,...j.suscriptor};if(profile.activo===false)return {recordada:false,ciudad_id:'',perfil:null};try{localStorage.setItem(SESSION,JSON.stringify(profile));}catch{}}
   }catch(e){window.__gldResultadoEntrada='fallo_red_'+String(e.name||'Error');}finally{clearTimeout(timer);}
   if(identity(token())!==sid)return {recordada:false,ciudad_id:'',perfil:null};
   const context=read(CONTEXT);
   const city=String(profile?.ciudad_predeterminada_id||context?.ciudad_id||'').trim();
   // A city from a different browsing context must not supply the preferred city's labels or parents.
   const ctx=String(context?.ciudad_id||'')===city?context:{ciudad_id:city};
   return {recordada:true,ciudad_id:city,contexto:ctx,perfil:profile};
  })();
  return pending;
 };
})();
