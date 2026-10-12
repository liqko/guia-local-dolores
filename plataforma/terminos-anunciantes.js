(function(){
 const origin='https://login.liqkoargentina.workers.dev';
 const check=document.getElementById('aceptar-terminos-anunciantes'),enter=document.getElementById('continuar-terminos-anunciantes'),back=document.getElementById('volver-terminos-anunciantes'),status=document.getElementById('terminos-anunciantes-msg');
 const button=document.getElementById('btnTerminosAnunciante'),link=document.querySelector('#panel-terminos-anunciantes a');
 let pending=null,lastUser='',states=new Map();
 check.addEventListener('change',()=>{enter.disabled=!check.checked;});
 async function api(body){
  const token=localStorage.getItem('gld_suscriptor_token_v2')||'';
  const response=await fetch(origin+'/advertiser/terms',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(response.status===404&&result.message==='Ruta no encontrada')return {legacy:true,version:'2026-10-11'};
  if(!response.ok||!result.success)throw Object.assign(new Error(result.message||'No se pudo comprobar la aceptación.'),{status:response.status});return result;
 }
 function notice(required){if(!button)return;button.classList.toggle('needs-terms-review',required);button.textContent=required?'Términos actualizados · Revisar':'Términos y condiciones';}
 function remember(state,id){try{localStorage.setItem('gld_terms_advertiser_record:'+state.version+':'+id,JSON.stringify(state.aceptacion));}catch{}states.set(id,state);notice(false);}
 async function current(id,force=false){if(!force&&states.has(id))return states.get(id);const state=await api();states.set(id,state);notice(!!state.requiere_revision);return state;}
 function openGate(id,state){
  check.checked=false;enter.disabled=true;status.textContent=state.error?.message||'';
  if(link)link.href='/plataforma/terminos-anunciantes.html'+(state.version?'?version='+encodeURIComponent(state.version):'');
  mostrarPanel('terminos-anunciantes');
  return new Promise(resolve=>{
   enter.onclick=async()=>{
    if(!check.checked)return;enter.disabled=true;back.disabled=true;status.textContent='Guardando aceptación…';
    try{
     if(state.error){state=await current(id,true);if(state.aceptada){remember(state,id);resolve(true);return;}check.checked=false;enter.disabled=true;if(link)link.href='/plataforma/terminos-anunciantes.html?version='+encodeURIComponent(state.version);status.textContent='Revisá los términos vigentes y marcá la casilla para aceptarlos.';return;}
     if(state.legacy){try{sessionStorage.setItem('gld_terms_advertiser:'+state.version+':'+id,'aceptado');}catch{}resolve(true);return;}
     const result=await api({aceptada:true,version:state.version,hash:state.hash});
     if(!result.aceptada||result.aceptacion?.usuario_id!==id||result.aceptacion?.version!==state.version)throw new Error('No se pudo guardar la aceptación.');
     remember(result,id);status.textContent='';resolve(true);
    }catch(error){status.textContent=error.message;enter.disabled=!check.checked;if(error.status===412){try{state=await current(id,true);check.checked=false;enter.disabled=true;notice(true);if(link)link.href='/plataforma/terminos-anunciantes.html?version='+encodeURIComponent(state.version);status.textContent='Los términos cambiaron mientras los revisabas. Leé la nueva versión y marcá la casilla para aceptarla.';}catch{}}}
    finally{back.disabled=false;}
   };
   back.onclick=()=>{mostrarPanel('login');const login=document.getElementById('btnLogin');if(login){login.disabled=false;login.textContent='Ingresar';}resolve(false);};
  });
 }
 const ui=window.GLD_TERMINOS_ANUNCIANTES={
  aceptarIngreso(id){lastUser=id;if(pending)return pending;
   pending=(async()=>{
    let state;try{state=await current(id);}catch(error){state={error};}
    if(state.aceptada&&state.aceptacion?.usuario_id===id){remember(state,id);return true;}
    try{if(state.legacy&&sessionStorage.getItem('gld_terms_advertiser:'+state.version+':'+id)==='aceptado')return true;}catch{}
    return openGate(id,state);
   })().finally(()=>{pending=null;});return pending;
  },
  marcarRevision(){states.delete(lastUser);notice(true);},
  async abrir(){
   try{const state=await current(lastUser,true);if(state.aceptada){window.open('/plataforma/terminos-anunciantes.html','_blank','noopener');return;}const accepted=await openGate(lastUser,state);if(accepted)mostrarPanel('dashboard');}
   catch(error){alert(error.message);}
  }
 };
 if(button)button.onclick=()=>ui.abrir();
})();
