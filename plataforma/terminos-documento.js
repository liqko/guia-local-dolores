(async function(){
 const version=new URL(location.href).searchParams.get('version'),main=document.querySelector('main');
 const historical=version&&version!=='2026-10-11';
 if(historical){main.replaceChildren();const p=document.createElement('p');p.textContent='Cargando la versión solicitada…';main.append(p);}
 try{
  const response=await fetch('https://login.liqkoargentina.workers.dev/advertiser/terms/content'+(version?'?version='+encodeURIComponent(version):''));
  const result=await response.json();if(!response.ok||!result.success){if(historical)main.textContent='No se pudo cargar la versión solicitada. Reintentá antes de aceptarla.';return;}
  const t=result.terms;main.replaceChildren();
  const title=document.createElement('h1');title.textContent=t.titulo;main.append(title);
  const info=document.createElement('p');info.textContent='Guía Local · Versión '+t.version;main.append(info);
  for(const text of t.contenido.split(/\n\s*\n/)){const el=document.createElement(/^\d+\.\s/.test(text)?'h2':'p');el.textContent=text;el.style.whiteSpace='pre-wrap';main.append(el);}
  const footer=document.createElement('footer');
  for(const [label,href]of [['Panel de anunciantes','/plataforma/login.html'],['Política de privacidad','/plataforma/privacidad.html']]){const a=document.createElement('a');a.textContent=label;a.href=href;footer.append(a,document.createTextNode(' · '));}
  main.append(footer);
 }catch{if(historical)main.textContent='No se pudo cargar la versión solicitada. Reintentá antes de aceptarla.';else{const p=document.createElement('p');p.textContent='No se pudo consultar la versión vigente. Se muestra el documento de la versión 2026-10-11.';main.prepend(p);}}
})();
