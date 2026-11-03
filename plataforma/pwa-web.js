/* Instalación PWA de Guía Local. Sin solicitudes a servicios de datos. */
(function(){
  'use strict';
  if(!window.isSecureContext)return;
  if('serviceWorker' in navigator){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/plataforma/sw.js',{scope:'/plataforma/'})
        .catch(err=>console.warn('Guía Local: modo sin conexión no disponible',err));
    },{once:true});
  }
  // Dentro del contenedor de Jimdo no se anuncia una instalación que no corresponde al origen visible.
  if(window.top!==window.self)return;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  if(standalone())return;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const mobile=ios||/Android/i.test(navigator.userAgent);
  if(!mobile)return;
  let deferredPrompt=null;
  let banner=null;
  let dismissed=false;
  try{dismissed=Number(sessionStorage.getItem('gld_instalacion_cerrada')||0)>Date.now();}catch(e){}
  function hide(){
    if(banner){banner.remove();banner=null;}
  }
  function show(){
    if(standalone()||dismissed||banner||!document.body)return;
    const style=document.createElement('style');
    style.textContent='#gld-pwa-instalacion{position:fixed;bottom:max(12px,env(safe-area-inset-bottom));left:12px;right:12px;max-width:470px;margin:auto;z-index:2147483600;background:#fff;color:#19384b;border:1px solid #c5d9e3;border-radius:16px;box-shadow:0 7px 32px rgba(0,0,0,.23);padding:16px;font:15px/1.4 system-ui,-apple-system,sans-serif;text-align:left}#gld-pwa-instalacion strong{display:block;font-size:17px;margin-right:28px}#gld-pwa-instalacion p{margin:8px 0 12px;font-size:14px}#gld-pwa-instalacion button{font:inherit;min-height:40px;cursor:pointer}#gld-pwa-instalar{background:#006699;color:#fff;border:0;border-radius:9px;font-weight:700;padding:8px 16px}#gld-pwa-cerrar{position:absolute;top:7px;right:8px;color:#263238;border:0;background:transparent;font-size:24px;width:36px;height:36px}#gld-pwa-ayuda{margin-top:10px;font-size:13px;color:#374d59}';
    document.head.appendChild(style);
    banner=document.createElement('aside');
    banner.id='gld-pwa-instalacion';
    banner.setAttribute('aria-label','Instalar Guía Local');
    banner.innerHTML='<strong>Instalá Guía Local en tu teléfono</strong><button type="button" id="gld-pwa-cerrar" aria-label="Cerrar aviso">×</button><p>Accedé desde el ícono de tu pantalla, sin buscar el enlace cada vez.</p><button type="button" id="gld-pwa-instalar">Instalar Guía Local</button><div id="gld-pwa-ayuda" role="status" aria-live="polite"></div>';
    document.body.appendChild(banner);
    const help=banner.querySelector('#gld-pwa-ayuda');
    const button=banner.querySelector('#gld-pwa-instalar');
    function instructions(){
      if(ios){
        help.textContent='En Safari: tocá Compartir (cuadrado con flecha) y elegí «Agregar a pantalla de inicio». Si no aparece, buscá esa opción en el menú Compartir.';
      }else{
        help.textContent='En Chrome: abrí el menú ⋮ del navegador y elegí «Instalar aplicación» o «Agregar a pantalla de inicio».';
      }
      button.textContent='Ver instrucciones';
    }
    banner.querySelector('#gld-pwa-cerrar').addEventListener('click',function(){
      dismissed=true;
      try{sessionStorage.setItem('gld_instalacion_cerrada',String(Date.now()+86400000));}catch(e){}
      hide();
    });
    button.addEventListener('click',async function(){
      if(!deferredPrompt){instructions();return;}
      const prompt=deferredPrompt;
      deferredPrompt=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        if(choice&&choice.outcome==='accepted'){hide();}
        else{instructions();}
      }catch(e){instructions();}
    });
    if(ios)instructions();
    else if(!deferredPrompt)help.textContent='Si tu navegador admite la instalación directa, se activará automáticamente. También podés consultar las instrucciones.';
  }
  window.addEventListener('beforeinstallprompt',function(event){
    event.preventDefault();
    deferredPrompt=event;
    if(!banner&&!dismissed)show();
    if(banner){
      const help=banner.querySelector('#gld-pwa-ayuda');
      const button=banner.querySelector('#gld-pwa-instalar');
      if(help)help.textContent='Instalación disponible en este dispositivo.';
      if(button)button.textContent='Instalar Guía Local';
    }
  });
  window.addEventListener('appinstalled',function(){deferredPrompt=null;hide();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});
  else show();
})();
