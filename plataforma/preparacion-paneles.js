(function(){
 'use strict';
 window.GLDPrepararPaneles116=async function(){
  const button=document.getElementById('ghPreparePanels116'),message=document.getElementById('ghPreparePanelsStatus116');if(!button||button.disabled)return;
  button.disabled=true;message.textContent='Preparando las copias de los paneles…';
  try{
   let data=await ghAdminRequest_('/panel-cache/prepare',{action:'iniciar'},'POST');
   let state=data.estado;
   while(state&&!state.completo){
    message.textContent='Preparando cuentas: '+state.procesados+' de '+state.anunciantes+'. Podés dejar esta pantalla abierta; no hace falta entrar a cada anunciante.';
    await new Promise(resolve=>setTimeout(resolve,1100));
    data=await ghAdminRequest_('/panel-cache/prepare',{action:'continuar'},'POST');state=data.estado;
   }
   if(!state)throw Error('No se recibió el estado de la preparación.');
   message.textContent=state.omitidas?'La preparación terminó con '+state.omitidas+' copias pendientes por tamaño. No está completa.':'Preparación completa: '+state.procesados+' cuentas. Las cuentas nuevas se preparan automáticamente.';
  }catch(e){message.textContent=String(e.message||e).includes('Ruta no encontrada')?'Esta preparación requiere desplegar el Worker 116.':'La preparación se detuvo: '+String(e.message||e)+'. Volvé a presionar el botón para continuar.';}
  finally{button.disabled=false;}
 };
})();
