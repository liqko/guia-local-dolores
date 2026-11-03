/* Registro restringido al origen de Hosting. No agrega consultas a los datos. */
(function(){
  'use strict';
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/plataforma/sw.js',{scope:'/plataforma/'})
      .catch(err=>console.warn('Guía Local: modo sin conexión no disponible',err));
  },{once:true});
})();
