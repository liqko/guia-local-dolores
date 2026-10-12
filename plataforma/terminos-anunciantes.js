(function(){
 const version='2026-10-11',origin='https://login.liqkoargentina.workers.dev';
 let pending=null;
 const check=document.getElementById('aceptar-terminos-anunciantes');
 const enter=document.getElementById('continuar-terminos-anunciantes');
 const back=document.getElementById('volver-terminos-anunciantes');
 const status=document.getElementById('terminos-anunciantes-msg');
 check.addEventListener('change',()=>{enter.disabled=!check.checked;});
 const valid=(r,id)=>r?.version===version&&r?.usuario_id===id&&!!r?.fecha;
 function remember(key,receipt){try{localStorage.setItem(key,JSON.stringify(receipt));}catch{}}
 async function api(body){
  const token=localStorage.getItem('gld_suscriptor_token_v2')||'';
  const response=await fetch(origin+'/advertiser/terms',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(response.status===404&&result.message==='Ruta no encontrada')return {legacy:true};
  if(!response.ok||!result.success)throw new Error(result.message||'No se pudo comprobar la aceptación.');
  return result;
 }
 window.GLD_TERMINOS_ANUNCIANTES={aceptarIngreso(usuarioId,receipt){
  if(pending)return pending;
  pending=(async()=>{
   const key='gld_terms_advertiser_record:'+version+':'+usuarioId;
   if(valid(receipt,usuarioId)){remember(key,receipt);return true;}
   let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
   if(valid(saved,usuarioId))return true;
   let state;
   try{state=await api();}catch(error){status.textContent=error.message;mostrarPanel('terminos-anunciantes');check.checked=false;enter.disabled=true;state={failed:true};}
   if(state.aceptada&&valid(state.aceptacion,usuarioId)){remember(key,state.aceptacion);return true;}
   const legacyKey='gld_terms_advertiser:'+version+':'+usuarioId;
   try{if(state.legacy&&sessionStorage.getItem(legacyKey)==='aceptado')return true;}catch{}
   check.checked=false;enter.disabled=true;if(!state.failed)status.textContent='';mostrarPanel('terminos-anunciantes');
   return new Promise(resolve=>{
    enter.onclick=async()=>{
     if(!check.checked)return;enter.disabled=true;back.disabled=true;status.textContent='Guardando aceptación…';
     try{
      if(state.legacy){try{sessionStorage.setItem(legacyKey,'aceptado');}catch{}status.textContent='';resolve(true);return;}
      const result=await api({aceptada:true,version});
      if(!result.aceptada||!valid(result.aceptacion,usuarioId))throw new Error('No se pudo guardar la aceptación. Reintentá.');
      remember(key,result.aceptacion);status.textContent='';resolve(true);
     }catch(error){status.textContent=error.message;enter.disabled=!check.checked;}
     finally{back.disabled=false;}
    };
    back.onclick=()=>{mostrarPanel('login');const login=document.getElementById('btnLogin');if(login){login.disabled=false;login.textContent='Ingresar';}resolve(false);};
   });
  })().finally(()=>{pending=null;});return pending;
 }};
})();
