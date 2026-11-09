/* Public entry preferences; authorization remains on the server. */
(function(){
 'use strict';
 const SESSION='gld_suscriptor_session_v2',TOKEN='gld_suscriptor_token_v2',CONTEXT='gld_ciudad_contexto',INTENT='gld_abrir_selector_ciudad_v92';
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
 const token=()=>{try{return localStorage.getItem(TOKEN)||'';}catch{return '';}};
 const identity=value=>{try{const p=JSON.parse(atob(value.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));return p?.typ==='GLD_SUBSCRIBER'&&p.sid?String(p.sid):'';}catch{return '';}};
 const FAVORITES='gld_favoritos_anunciantes_v2:', HANDOFF='gld_entrada_favoritos_v163';
 let pending;

 window.gldPedirSelectorCiudadV92=function(){try{sessionStorage.setItem(INTENT,String(Date.now()));}catch{}};
 window.gldConsumirSelectorCiudadV92=function(){
  let marked=false;try{const ts=Number(sessionStorage.getItem(INTENT));sessionStorage.removeItem(INTENT);marked=ts>0&&Date.now()-ts>=0&&Date.now()-ts<120000;}catch{}
  const explicit=new URLSearchParams(location.search).get('cambiar_ciudad')==='1';
  return marked||explicit;
 };
 window.gldRecuperarEntradaV92=function(){
  if(pending)return pending;
  pending=(async()=>{
   const sent=token(),sid=identity(sent);let profile=read(SESSION);
   if(!sid){
    // Sin sesión válida, la entrada pública siempre ofrece selección de ciudad.
    // El contexto local no representa una sesión autenticada.
    return {recordada:false,ciudad_id:'',contexto:null,perfil:null};
   }
   if(profile&&String(profile.suscriptor_id)!==sid)profile=null;
   const stamp=window.gldEntradaSessionStampV163?.(),cacheKey=FAVORITES+sid;
   const existing=read(cacheKey);
   let rawBefore=null;try{rawBefore=localStorage.getItem(cacheKey);}catch{}
   let favoritosRecibo='';
   try{sessionStorage.removeItem(HANDOFF);}catch{}
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try{
    const endpoint='https://login.liqkoargentina.workers.dev/suscriptores';
    const url=new URL(endpoint);url.searchParams.set('action','entrada');
    if(stamp&&Array.isArray(existing?.ids)&&existing.revision)url.searchParams.set('favoritos_revision',existing.revision);
    const options={headers:{Authorization:'Bearer '+sent},signal:controller.signal};
    let r=await fetch(url.toString(),options);
    if(r.status===404)r=await fetch(endpoint+'?action=perfil',options);
    const j=await r.json();
    // Never apply a response after logout or an account switch.
    if(identity(token())!==sid)return {recordada:false,ciudad_id:'',perfil:null};
    if(r.status>=400&&r.status<500)return {recordada:false,ciudad_id:'',perfil:null};
    if(r.ok&&j.success&&String(j.suscriptor?.suscriptor_id)===sid){
     profile={...profile,...j.suscriptor};if(profile.activo===false)return {recordada:false,ciudad_id:'',perfil:null};
     try{
      localStorage.setItem(SESSION,JSON.stringify(profile));
      if(stamp&&stamp===window.gldEntradaSessionStampV163?.()&&localStorage.getItem(cacheKey)===rawBefore){
       const nuevos=Array.isArray(j.favoritos_ids);
       const iguales=j.favoritos_sin_cambios===true&&Array.isArray(existing?.ids)&&existing.revision===j.favoritos_revision;
       const ts=nuevos?Date.now():existing?.ts;
       if(nuevos)localStorage.setItem(cacheKey,JSON.stringify({ts,ids:j.favoritos_ids,revision:j.favoritos_revision||''}));
       if(nuevos||iguales){
        favoritosRecibo=crypto.randomUUID();
        sessionStorage.setItem(HANDOFF,JSON.stringify({id:favoritosRecibo,stamp,ts}));
       }
      }
     }catch{favoritosRecibo='';}
    }
   }catch{}finally{clearTimeout(timer);}
   if(identity(token())!==sid)return {recordada:false,ciudad_id:'',perfil:null};
   const context=read(CONTEXT);
   const city=String(profile?.ciudad_predeterminada_id||context?.ciudad_id||'').trim();
   // A city from a different browsing context must not supply the preferred city's labels or parents.
   const ctx=String(context?.ciudad_id||'')===city?context:{ciudad_id:city};
   return {recordada:true,ciudad_id:city,contexto:ctx,perfil:profile,favoritosRecibo};
  })();
  return pending;
 };
})();
