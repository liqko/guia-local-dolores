/* =========================================================
   GUÍA LOCAL — ALTURA DINÁMICA ÚNICA
   Regla:
   contenido real -> alturaIframeGLD -> iframe padre.
   La medición NO depende de la altura actual del iframe.
========================================================= */
(function(){
  if(window.__gldAlturaDinamicaUnica) return;
  window.__gldAlturaDinamicaUnica=true;

  let ultimaAltura=0;
  let raf=0;
  let timer=0;
  let sentinel=null;
  let resizeObserver=null;

  function asegurarSentinel(){
    if(sentinel && sentinel.isConnected) return sentinel;
    if(!document.body) return null;

    sentinel=document.createElement('div');
    sentinel.id='gldAlturaSentinel';
    sentinel.setAttribute('aria-hidden','true');
    sentinel.style.cssText=[
      'display:block',
      'position:relative',
      'width:1px',
      'height:1px',
      'margin:0',
      'padding:0',
      'border:0',
      'clear:both',
      'pointer-events:none',
      'visibility:hidden'
    ].join(';');

    document.body.appendChild(sentinel);
    return sentinel;
  }

  function numeroPx(valor){
    const n=parseFloat(valor);
    return Number.isFinite(n)?n:0;
  }

  function medirAlturaReal(){
    const s=asegurarSentinel();
    const body=document.body;
    if(!s || !body) return 0;

    const bodyRect=body.getBoundingClientRect();
    const sRect=s.getBoundingClientRect();

    let paddingBottom=0;
    try{
      paddingBottom=numeroPx(getComputedStyle(body).paddingBottom);
    }catch(e){}

    /*
      El sentinel está inmediatamente después del contenido en flujo.
      Su posición NO aumenta porque el iframe padre sea más alto.
      Por eso puede crecer y también achicarse sin realimentación.
    */
    return Math.max(
      1,
      Math.ceil((sRect.bottom-bodyRect.top)+paddingBottom)
    );
  }

  function enviar(forzar){
    cancelAnimationFrame(raf);

    raf=requestAnimationFrame(function(){
      const altura=medirAlturaReal();
      if(!altura) return;

      if(!forzar && Math.abs(altura-ultimaAltura)<2) return;
      ultimaAltura=altura;

      try{
        window.parent.postMessage({
          tipo:'alturaIframeGLD',
          altura:altura,
          ruta:window.location.pathname
        },'*');
      }catch(e){}
    });
  }

  function programar(forzar){
    clearTimeout(timer);
    timer=setTimeout(function(){
      enviar(!!forzar);
    },50);
  }

  function observarContenido(){
    if(!window.ResizeObserver || !document.body) return;

    try{
      if(resizeObserver) resizeObserver.disconnect();

      resizeObserver=new ResizeObserver(function(){
        programar(false);
      });

      Array.from(document.body.children).forEach(function(el){
        if(!el || el===sentinel) return;

        const tag=String(el.tagName||'').toLowerCase();
        if(tag==='script' || tag==='style' || tag==='link') return;

        try{ resizeObserver.observe(el); }catch(e){}
      });
    }catch(e){}
  }

  function iniciar(){
    asegurarSentinel();
    observarContenido();

    [0,80,200,500,1000,2000,4000].forEach(function(ms){
      setTimeout(function(){ enviar(true); },ms);
    });
  }

  window.gldRecalcularAltura=function(){
    programar(true);
  };

  window.gldRecalcularAlturaCarcasa=function(){
    programar(true);
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  }else{
    iniciar();
  }

  window.addEventListener('load',function(){
    observarContenido();
    enviar(true);
  },{once:true});

  /*
    Sólo un cambio de ANCHO puede alterar el reflow del contenido.
    Un cambio de ALTO del iframe padre no debe provocar una nueva medición.
  */
  let ultimoAncho=Math.round(window.innerWidth||0);

  window.addEventListener('resize',function(){
    const ancho=Math.round(window.innerWidth||0);
    if(!ancho || Math.abs(ancho-ultimoAncho)<2) return;

    ultimoAncho=ancho;
    programar(true);
  },{passive:true});

  window.addEventListener('orientationchange',function(){
    setTimeout(function(){
      ultimoAncho=0;
      programar(true);
    },200);
  });

  if(document.fonts && document.fonts.ready){
    document.fonts.ready
      .then(function(){ programar(true); })
      .catch(function(){});
  }

  document.addEventListener('load',function(e){
    const t=e&&e.target;
    const tag=t?String(t.tagName||'').toUpperCase():'';

    if(tag==='IMG' || tag==='IFRAME' || tag==='VIDEO'){
      programar(true);
    }
  },true);

  document.addEventListener('transitionend',function(){
    programar(false);
  },true);

  document.addEventListener('animationend',function(){
    programar(false);
  },true);

  document.addEventListener('click',function(){
    setTimeout(function(){ programar(true); },100);
    setTimeout(function(){ programar(true); },350);
  },true);

  if(window.MutationObserver){
    const mo=new MutationObserver(function(mutations){
      let cambioReal=false;

      for(const m of mutations){
        if(
          m.target===sentinel ||
          (m.target && m.target.id==='gldAlturaSentinel')
        ){
          continue;
        }
        cambioReal=true;
        break;
      }

      if(!cambioReal) return;

      asegurarSentinel();

      /*
        Si algún código agregó nodos después del sentinel,
        lo devolvemos al final para que siga marcando el final real.
      */
      if(
        sentinel &&
        sentinel.parentNode===document.body &&
        sentinel!==document.body.lastElementChild
      ){
        document.body.appendChild(sentinel);
      }

      observarContenido();
      programar(false);
    });

    const activar=function(){
      if(!document.body) return;

      try{
        mo.observe(document.body,{
          childList:true,
          subtree:true,
          attributes:true,
          characterData:false
        });
      }catch(e){}
    };

    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',activar,{once:true});
    }else{
      activar();
    }
  }
})();
