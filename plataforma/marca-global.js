/* Identidad compartida de la plataforma, sin dependencia de contenedores Jimdo. */
(function(){
  'use strict';
  const resources=document.currentScript?.dataset||{};
  const LOGO='/plataforma/assets/marca/logo-guia-local.png';


  function hoja(url){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=url;
    return link;
  }

  function montarPie(){
    const host=document.createElement('div');
    host.id='gldPieGlobal';
    document.body.appendChild(host);
    async function cargar(){
      try{
        const response=await fetch(resources.gldPie||'/plataforma/pie');
        if(!response.ok)throw Error('HTTP '+response.status);
        const parsed=new DOMParser().parseFromString(await response.text(),'text/html');
        const footer=parsed.querySelector('footer.gld-footer');
        if(!footer)throw Error('Contenido institucional inválido');
        const shadow=host.attachShadow({mode:'open'});
        const link=hoja(resources.gldPieCss||'/plataforma/pie.css');
        shadow.append(link,footer);
      }catch(error){console.error('No se pudo cargar el pie institucional',error);}
    }
    if(!('IntersectionObserver' in window)){void cargar();return;}
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      void cargar();
    },{rootMargin:'300px'});
    observer.observe(host);
  }

  function montar(){
    if(document.getElementById('gldMarcaGlobal')) return;
    document.head.appendChild(hoja(resources.gldMarcaCss||'/plataforma/marca-global.css'));
    document.body.classList.add('gld-identidad-directa');

    const navigation=document.createElement('nav');
    navigation.id='gldNavegacionGlobal';
    navigation.setAttribute('aria-label','Navegación general de Guía Local');
    const routes=[
      ['Inicio','/'],
      ['Nuestro ecosistema','/ecosistema'],
      ['Planes y servicios','/plataforma/planes-servicios.html'],
      ['App','/app'],
      ['Políticas, fuentes y privacidad','/politicas-y-privacidad'],
      ['Suscriptores','/mi-guia'],
      ['Anunciantes','/anunciantes'],
      ['Panel administrador','/administracion']
    ];
    // Regresar a la Guía conserva la ciudad que la persona eligió para esta
    // navegación, incluso si su ciudad predeterminada de perfil es distinta.
    function urlGuiaActual(){
      let contexto=null;
      try{contexto=JSON.parse(localStorage.getItem('gld_ciudad_contexto')||'null')}catch(_){}
      const urlParams=new URLSearchParams(window.location.search);
      const cid=String(urlParams.get('ciudad_id')||contexto?.ciudad_id||'').trim();
      if(!cid)return '/elegi-tu-ciudad?cambiar_ciudad=1';
      if(urlParams.get('ciudad_id') && cid!==String(contexto?.ciudad_id||'').trim())contexto=null;
      const url=new URL('/descubrir',window.location.origin);
      url.searchParams.set('ciudad_id',cid);
      for(const k of ['pais_id','provincia_id','pais','provincia','ciudad']){
        const v=String(urlParams.get(k)||contexto?.[k]||'').trim();
        if(v)url.searchParams.set(k,v);
      }
      return url.pathname+url.search;
    }
    const list=document.createElement('div');list.className='gld-nav-links';
    for(const [title,href] of routes){
      const a=document.createElement('a');a.href=href==='/'?urlGuiaActual():href;a.textContent=title;
      const current=location.pathname;
      const active=href==='/'?(['/', '/descubrir', '/elegi-tu-ciudad', '/plataforma/inicio.html', '/plataforma/inicio','/plataforma/carcasa.html','/plataforma/carcasa'].includes(current)):(current===href);
      if(active){a.setAttribute('aria-current','page');a.classList.add('active')}
      list.appendChild(a);
    }
    const drawer=document.createElement('details');drawer.className='gld-nav-drawer';
    const summary=document.createElement('summary');summary.textContent='Menú';
    drawer.append(summary,list);
    // Un details cerrado oculta los enlaces: mantenerlo abierto en escritorio
    // y plegable en móviles, siempre accesible desde la barra fija.
    const sincronizarMenu=()=>{
      const escritorio=window.matchMedia('(min-width: 761px)').matches;
      if(escritorio)drawer.open=true;
      else if(!drawer.dataset.mobileInitialized){drawer.open=false;drawer.dataset.mobileInitialized='1'}
      if(escritorio)delete drawer.dataset.mobileInitialized;
    };
    sincronizarMenu();
    window.addEventListener('resize',sincronizarMenu,{passive:true});
    navigation.append(drawer);
    const regreso=document.createElement('a');
    regreso.className='gld-volver-guia';
    regreso.href=urlGuiaActual();
    regreso.textContent='← Volver a Guía';
    if(['/mi-guia','/anunciantes','/administracion','/plataforma/suscriptores','/plataforma/suscriptores.html','/plataforma/login','/plataforma/login.html','/plataforma/administracion','/plataforma/administracion.html'].includes(location.pathname)){
      navigation.appendChild(regreso);
    }

    const hero=document.createElement('section');
    hero.id='gldMarcaGlobal';
    hero.style.setProperty('--gld-fondo-institucional',`url("${resources.gldFondo||'/plataforma/assets/marca/fondo-ciudad.jpg'}")`);
    hero.setAttribute('aria-label','Guía Local');
    const inner=document.createElement('div');
    inner.className='gld-brand-inner';
    const logo=document.createElement('img');
    logo.className='gld-brand-logo';logo.src=resources.gldLogo||LOGO;logo.alt='Guía Local';logo.decoding='async';
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


    montarPie();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar,{once:true});
  else montar();
})();
