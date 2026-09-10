/* Guía Local - Ajuste visual Eventos VIP */
(function(){
  'use strict';

  function aplicarLayoutEventosVip_(){
    const panel=document.getElementById('eventos-panel');
    if(!panel) return;

    const descripcion=document.getElementById('ev-descripcion');
    const descripcionWrap=descripcion&&(descripcion.closest('.full')||descripcion.parentElement);

    if(descripcionWrap && !document.getElementById('ev-programacion-aviso')){
      const aviso=document.createElement('div');
      aviso.id='ev-programacion-aviso';
      aviso.className='full info-banner';
      aviso.style.marginTop='4px';
      aviso.innerHTML='<strong>Datos generales del evento.</strong><br>Más abajo vas a poder agregar todas las fechas, sedes, horarios, actividades o partidos que formen parte de la programación.';
      descripcionWrap.insertAdjacentElement('afterend',aviso);
    }

    const programacion=document.getElementById('ev-programacion-wrap');
    const acciones=panel.querySelector('.module-form-actions');
    if(programacion && acciones && programacion.nextElementSibling!==acciones){
      acciones.insertAdjacentElement('beforebegin',programacion);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(aplicarLayoutEventosVip_,0),{once:true});
  }else{
    setTimeout(aplicarLayoutEventosVip_,0);
  }
})();
