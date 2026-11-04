/* Identidad compartida de la plataforma, sin dependencia de contenedores Jimdo. */
(function(){
  'use strict';
  const BACKGROUND='https://image.jimcdn.com/app/cms/image/transf/dimension=1150x/path/sce186cc4fc44f014/backgroundarea/id39632ac3c36b8b7/version/1792596239/imagen-de-fondo-ciudad-digital.png';
  const LOGO='https://image.jimcdn.com/app/cms/image/transf/none/path/sce186cc4fc44f014/image/i4c2364db49e7f4cd/version/1784742392/image.png';

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
      @media(max-width:620px){
        #gldMarcaGlobal{min-height:155px}
        #gldMarcaGlobal .gld-brand-inner{padding:15px 10px}
        #gldMarcaGlobal .gld-brand-logo{max-width:min(220px,75vw);max-height:95px}
        #gldMarcaGlobal .gld-brand-slogan{font-size:clamp(.98rem,4.1vw,1.4rem)}
      }
    `;
    document.head.appendChild(styles);
    document.body.classList.add('gld-identidad-directa');

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
