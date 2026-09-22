/* Guía Local - Duplicar bloque de programación en Eventos VIP */
(function(){
  'use strict';

  function leerCard(card){
    return {
      fecha:String(card.querySelector('.evp-fecha')?.value||''),
      actividad:String(card.querySelector('.evp-actividad')?.value||''),
      hora_desde:String(card.querySelector('.evp-desde')?.value||''),
      hora_hasta:String(card.querySelector('.evp-hasta')?.value||''),
      ciudad_id:String(card.querySelector('.evp-ciudad')?.value||''),
      lugar_key:String(card.querySelector('.evp-lugar')?.value||''),
      detalle:String(card.querySelector('.evp-detalle')?.value||''),
      observaciones:String(card.querySelector('.evp-obs')?.value||'')
    };
  }

  function completarCard(card,data){
    if(!card) return;
    const fecha=card.querySelector('.evp-fecha');
    const actividad=card.querySelector('.evp-actividad');
    const desde=card.querySelector('.evp-desde');
    const hasta=card.querySelector('.evp-hasta');
    const ciudad=card.querySelector('.evp-ciudad');
    const lugar=card.querySelector('.evp-lugar');
    const detalle=card.querySelector('.evp-detalle');
    const obs=card.querySelector('.evp-obs');

    if(fecha) fecha.value=data.fecha||'';
    if(actividad) actividad.value=data.actividad||'';
    if(desde) desde.value=data.hora_desde||'';
    if(hasta) hasta.value=data.hora_hasta||'';
    if(detalle) detalle.value=data.detalle||'';
    if(obs) obs.value=data.observaciones||'';

    if(ciudad){
      ciudad.value=data.ciudad_id||'';
      ciudad.dispatchEvent(new Event('change',{bubbles:true}));
    }

    requestAnimationFrame(()=>{
      if(lugar){
        lugar.value=data.lugar_key||'';
        lugar.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
  }

  function duplicar(card){
    const data=leerCard(card);
    const add=document.getElementById('ev-add-programacion');
    if(!add) return;

    add.click();

    requestAnimationFrame(()=>{
      const cards=document.querySelectorAll('#ev-programacion .evp-card');
      const nueva=cards[cards.length-1];
      completarCard(nueva,data);
      nueva?.scrollIntoView({behavior:'smooth',block:'center'});
    });
  }

  function asegurarBotones(){
    document.querySelectorAll('#ev-programacion .evp-card').forEach(card=>{
      if(card.querySelector('.evp-duplicate')) return;

      const quitar=card.querySelector('.evp-remove');
      if(!quitar) return;

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='secondary evp-duplicate';
      btn.style.cssText='width:auto;margin:0';
      btn.textContent='Duplicar fecha / sede / horario';
      btn.addEventListener('click',()=>duplicar(card));

      quitar.insertAdjacentElement('beforebegin',btn);
    });
  }

  const observer=new MutationObserver(asegurarBotones);

  function iniciar(){
    asegurarBotones();
    const root=document.getElementById('ev-programacion-wrap')||document.body;
    observer.observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  }else{
    iniciar();
  }
})();
