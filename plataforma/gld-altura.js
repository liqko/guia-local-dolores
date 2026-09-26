/* =========================================================
   GUÍA LOCAL — ALTURA DINÁMICA ÚNICA
   Contrato común para todos los HTML embebidos.
   Envía: {tipo:'alturaIframeGLD', altura:N, ruta:'...'}
========================================================= */
(function(){
  if(window.__gldAlturaDinamicaUnica) return;
  window.__gldAlturaDinamicaUnica = true;

  let ultimoAlto = 0;
  let raf = 0;
  let timer = 0;
  let ro = null;

  function px(v){
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function medirAlturaReal(){
    const body = document.body;
    const html = document.documentElement;
    if(!body || !html) return 0;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const viewport = Math.max(
      window.innerHeight || 0,
      html.clientHeight || 0
    );

    let fondoReal = 0;

    Array.from(body.children).forEach(function(el){
      if(!el || el.nodeType !== 1) return;

      const tag = String(el.tagName || '').toLowerCase();
      if(tag === 'script' || tag === 'style' || tag === 'link') return;

      let st = null;
      try{ st = window.getComputedStyle(el); }catch(e){}

      if(st && (st.display === 'none' || st.position === 'fixed')) return;

      const r = el.getBoundingClientRect();
      if(!r || (!r.width && !r.height)) return;

      const mb = st ? px(st.marginBottom) : 0;
      fondoReal = Math.max(fondoReal, r.bottom + scrollY + mb);
    });

    if(fondoReal < 1){
      const r = body.getBoundingClientRect();
      fondoReal = Math.max(1, r.bottom + scrollY);
    }

    const scrollTotal = Math.max(
      body.scrollHeight || 0,
      html.scrollHeight || 0
    );

    /*
      Si el contenido realmente desborda el viewport, scrollHeight es útil.
      Si no desborda, NO se usa como piso porque la altura previa del iframe
      puede inflarlo e impedir que luego vuelva a achicarse.
    */
    if(scrollTotal > viewport + 2){
      fondoReal = Math.max(fondoReal, scrollTotal);
    }

    return Math.max(1, Math.ceil(fondoReal));
  }

  function enviar(forzar){
    cancelAnimationFrame(raf);

    raf = requestAnimationFrame(function(){
      const alto = medirAlturaReal();
      if(!alto) return;

      if(!forzar && Math.abs(alto - ultimoAlto) < 2) return;
      ultimoAlto = alto;

      try{
        window.parent.postMessage({
          tipo:'alturaIframeGLD',
          altura:alto,
          ruta:window.location.pathname
        }, '*');
      }catch(e){}
    });
  }

  function programar(forzar){
    clearTimeout(timer);
    timer = setTimeout(function(){
      enviar(!!forzar);
    }, 40);
  }

  function observar(){
    if(!window.ResizeObserver || !document.body) return;

    try{
      if(ro) ro.disconnect();
      ro = new ResizeObserver(function(){
        programar(false);
      });

      ro.observe(document.body);

      Array.from(document.body.children).forEach(function(el){
        const tag = String(el.tagName || '').toLowerCase();
        if(tag !== 'script' && tag !== 'style' && tag !== 'link'){
          try{ ro.observe(el); }catch(e){}
        }
      });
    }catch(e){}
  }

  function serieInicial(){
    [0,80,180,350,700,1200,2000,3500,5500].forEach(function(ms){
      setTimeout(function(){ enviar(true); }, ms);
    });
  }

  window.gldRecalcularAltura = function(){
    enviar(true);
  };

  window.gldRecalcularAlturaCarcasa = function(){
    enviar(true);
  };

  document.addEventListener('DOMContentLoaded', function(){
    observar();
    serieInicial();
  }, {once:true});

  window.addEventListener('load', function(){
    observar();
    serieInicial();
  }, {once:true});

  window.addEventListener('resize', function(){
    programar(true);
  }, {passive:true});

  window.addEventListener('orientationchange', function(){
    setTimeout(function(){ enviar(true); }, 120);
    setTimeout(function(){ enviar(true); }, 450);
  });

  window.addEventListener('hashchange', function(){
    setTimeout(function(){ enviar(true); }, 80);
  });

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', function(){
      programar(true);
    }, {passive:true});
  }

  if(document.fonts && document.fonts.ready){
    document.fonts.ready
      .then(function(){ enviar(true); })
      .catch(function(){});
  }

  document.addEventListener('load', function(e){
    const t = e && e.target;
    if(t && (t.tagName === 'IMG' || t.tagName === 'IFRAME' || t.tagName === 'VIDEO')){
      programar(true);
    }
  }, true);

  document.addEventListener('transitionend', function(){
    programar(false);
  }, true);

  document.addEventListener('animationend', function(){
    programar(false);
  }, true);

  document.addEventListener('click', function(){
    setTimeout(function(){ enviar(true); }, 100);
    setTimeout(function(){ enviar(true); }, 350);
  }, true);

  if(window.MutationObserver){
    const mo = new MutationObserver(function(){
      observar();
      programar(false);
    });

    const iniciarMO = function(){
      if(!document.body) return;
      try{
        mo.observe(document.body, {
          childList:true,
          subtree:true,
          attributes:true,
          characterData:false
        });
      }catch(e){}
    };

    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', iniciarMO, {once:true});
    }else{
      iniciarMO();
    }
  }

  enviar(true);
})();
