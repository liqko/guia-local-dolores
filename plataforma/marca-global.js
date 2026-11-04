/* Identidad compartida de la plataforma, sin dependencia de contenedores Jimdo. */
(function(){
  'use strict';
  const BACKGROUND='/plataforma/assets/marca/fondo-ciudad.jpg';
  const LOGO='/plataforma/assets/marca/logo-guia-local.png';

  function montar(){
    if(document.getElementById('gldMarcaGlobal')) return;
    const styles=document.createElement('style');
    styles.textContent=`
      #gldMarcaGlobal{box-sizing:border-box;position:relative;width:100%;min-height:220px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#243c46 url("${BACKGROUND}") center 52%/cover no-repeat;color:#fff;}
      #gldMarcaGlobal::before{content:"";position:absolute;inset:0;background:rgba(10,26,35,.60);pointer-events:none}
      #gldMarcaGlobal .gld-brand-inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;width:min(100%,1100px);padding:21px 20px}
      #gldMarcaGlobal .gld-brand-logo{display:block;max-width:min(320px,75vw);max-height:144px;width:auto;height:auto;object-fit:contain}
      #gldMarcaGlobal .gld-brand-slogan{font-family:"Courgette","Brush Script MT",cursive;font-style:italic;font-weight:700;font-size:clamp(1.15rem,2.7vw,2.15rem);line-height:1.3;color:#ff9b2d;text-shadow:0 2px 5px #18222b;margin:0}
      #gldPieGlobal{box-sizing:border-box;width:100%;max-width:100%;margin-top:24px;background:#f8fbfc;border:0;display:block;min-height:260px}
      body.gld-identidad-directa{background-color:#f8fbfc}
      #gldNavegacionGlobal{width:100%;box-sizing:border-box;background:#fff;border-bottom:1px solid #d9e5e9;box-shadow:0 2px 8px #00344b13;position:relative;z-index:10}
      #gldNavegacionGlobal .gld-nav-links{max-width:1260px;margin:0 auto;display:flex;justify-content:center;gap:3px;flex-wrap:wrap;padding:6px 12px}
      #gldNavegacionGlobal a{display:inline-flex;align-items:center;text-decoration:none;padding:10px 13px;border-radius:8px;font:600 14px/1.3 'Segoe UI',Arial,sans-serif;color:#245a71}
      #gldNavegacionGlobal a:hover,#gldNavegacionGlobal a:focus-visible,#gldNavegacionGlobal a.active{background:#e9f5fa;color:#005e84}
      #gldNavegacionGlobal summary{display:none;cursor:pointer;padding:13px 16px;font:700 15px/1.4 'Segoe UI',Arial,sans-serif;color:#005e84}
      @media(max-width:760px){#gldNavegacionGlobal summary{display:list-item;list-style:inside}#gldNavegacionGlobal .gld-nav-links{display:none;flex-direction:column;align-items:stretch;max-height:65vh;overflow:auto}#gldNavegacionGlobal details[open] .gld-nav-links{display:flex}#gldNavegacionGlobal a{min-height:40px}}

      @media(max-width:620px){
        #gldMarcaGlobal{min-height:155px}
        #gldMarcaGlobal .gld-brand-inner{padding:15px 10px}
        #gldMarcaGlobal .gld-brand-logo{max-width:min(220px,75vw);max-height:95px}
        #gldMarcaGlobal .gld-brand-slogan{font-size:clamp(.98rem,4.1vw,1.4rem)}
      }
    `;
    document.head.appendChild(styles);
    document.body.classList.add('gld-identidad-directa');

    const navigation=document.createElement('nav');
    navigation.id='gldNavegacionGlobal';
    navigation.setAttribute('aria-label','Navegación general de Guía Local');
    const routes=[
      ['Inicio','/'],
      ['Nuestro ecosistema','/plataforma/nosotros.html'],
      ['App','/plataforma/app-prueba.html'],
      ['Políticas, fuentes y privacidad','/plataforma/privacidad.html'],
      ['Suscriptores','/plataforma/suscriptores.html'],
      ['Anunciantes','/plataforma/login.html'],
      ['Panel administrador','/plataforma/granhermano.html']
    ];
    const list=document.createElement('div');list.className='gld-nav-links';
    for(const [title,href] of routes){
      const a=document.createElement('a');a.href=href;a.textContent=title;
      const active=href==='/'?location.pathname==='/'||/\\/plataforma\\/inicio(?:\\.html)?$/.test(location.pathname):location.pathname===href||location.pathname===href.replace(/\\.html$/, '');
      if(active){a.setAttribute('aria-current','page');a.classList.add('active')}
      list.appendChild(a);
    }
    const drawer=document.createElement('details');drawer.className='gld-nav-drawer';
    const summary=document.createElement('summary');summary.textContent='Menú';
    drawer.append(summary,list);navigation.append(drawer);

    const hero=document.createElement('section');
    hero.id='gldMarcaGlobal';
    hero.setAttribute('aria-label','Guía Local');
    const inner=document.createElement('div');
    inner.className='gld-brand-inner';
    const logo=document.createElement('img');
    logo.className='gld-brand-logo';logo.src=LOGO;logo.alt='Guía Local';logo.decoding='async';
    const slogan=document.createElement('p');
    slogan.className='gld-brand-slogan';
    slogan.textContent='Todo lo que ofrece la ciudad, en un sólo lugar!';
    inner.append(logo,slogan);
    hero.append(inner);

    // La carcasa conserva su cabecera de ciudad por debajo de la marca.
    const anchor=document.querySelector('#titulo-principal')||document.querySelector('main')||document.body.firstElementChild;
    if(anchor&&anchor.parentElement===document.body)document.body.insertBefore(hero,anchor);
    else document.body.prepend(hero);
    hero.insertAdjacentElement('afterend',navigation);


    // Reutilizamos el mismo pie de Guía Local, sin copiar ni bifurcar su HTML.
    const footer=document.createElement('iframe');
    footer.id='gldPieGlobal';
    footer.title='Pie de Guía Local';
    footer.src='/plataforma/pie.html';
    footer.loading='lazy';
    footer.setAttribute('scrolling','no');
    document.body.appendChild(footer);
    window.addEventListener('message',function(ev){
      if(ev.origin!==window.location.origin||ev.source!==footer.contentWindow)return;
      const data=ev.data;
      if(data?.tipo!=='alturaIframeGLD')return;
      const height=Number(data.altura);
      if(Number.isFinite(height)&&height>=80&&height<4000)footer.style.height=Math.ceil(height)+'px';
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar,{once:true});
  else montar();
})();
