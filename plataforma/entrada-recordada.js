/* Public entry preferences; authorization remains on the server. */
(function(){
 'use strict';
 const SESSION='gld_suscriptor_session_v2',TOKEN='gld_suscriptor_token_v2',CONTEXT='gld_ciudad_contexto',INTENT='gld_abrir_selector_ciudad_v92';
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
 const token=()=>{try{return localStorage.getItem(TOKEN)||'';}catch{return '';}};
 function identity(value){
  if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))return '';
  try{
   const p=JSON.parse(atob(value.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
   if(p?.typ!=='GLD_SUBSCRIBER'||!p.sid)return '';
   const expires=Number(p.exp);
   const eligible=p.persistent===true||(Number.isFinite(expires)&&expires>Date.now());
   return eligible?String(p.sid):'';
  }catch{return '';}
 }
 const selector=()=>({recordada:false,ciudad_id:'',contexto:null,perfil:null});
 let pending;

 window.gldPedirSelectorCiudadV92=function(){try{sessionStorage.setItem(INTENT,String(Date.now()));}catch{}};
 window.gldConsumirSelectorCiudadV92=function(){
  let marked=false;try{const ts=Number(sessionStorage.getItem(INTENT));sessionStorage.removeItem(INTENT);marked=ts>0&&Date.now()-ts>=0&&Date.now()-ts<120000;}catch{}
  const explicit=new URLSearchParams(location.search).get('cambiar_ciudad')==='1';
  return marked||explicit;
 };
 window.gldRecuperarEntradaV92=function(){
  const sent=token(),sid=identity(sent);
  if(!sid)return Promise.resolve(selector());
  if(pending?.token===sent)return pending.request;
  const request=(async()=>{
   let profile=read(SESSION);
   if(profile&&String(profile.suscriptor_id)!==sid)profile=null;
   if(profile?.activo===false)return selector();
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try{
    const r=await fetch('https://login.liqkoargentina.workers.dev/suscriptores?action=perfil',{headers:{Authorization:'Bearer '+sent},signal:controller.signal});
    // Una denegación HTTP prevalece incluso cuando no llega un cuerpo JSON.
    if(r.status>=400&&r.status<500)return selector();
    if(r.ok){
     const j=await r.json().catch(()=>null);
     if(identity(token())!==sid||!j?.success||String(j.suscriptor?.suscriptor_id)!==sid)return selector();
     profile={...profile,...j.suscriptor};
     if(profile.activo===false)return selector();
     try{localStorage.setItem(SESSION,JSON.stringify(profile));}catch{}
    }
   }catch{}finally{clearTimeout(timer);}
   if(identity(token())!==sid)return selector();
   const context=read(CONTEXT);
   const city=String(profile?.ciudad_predeterminada_id||context?.ciudad_id||'').trim();
   // A city from a different browsing context must not supply the preferred city's labels or parents.
   const ctx=String(context?.ciudad_id||'')===city?context:{ciudad_id:city};
   return {recordada:true,ciudad_id:city,contexto:ctx,perfil:profile};
  })();
  pending={token:sent,request};
  request.finally(()=>{if(pending?.request===request)pending=null;});
  return request;
 };
})();
