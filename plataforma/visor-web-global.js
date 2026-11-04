/* Visor web de la carcasa: un solo desplazamiento a pantalla completa,
   conserva el módulo y el listado bajo el panel para poder volver. */
(function(){
 'use strict';
 const frameGuia=()=>document.getElementById('moduloCentralFrame');
 let abierto=false, origen=null, previousOverflow='';
 const css=document.createElement('style');
 css.textContent=`
   #gldVisorWebGlobal[hidden]{display:none!important}
   #gldVisorWebGlobal{position:fixed!important;inset:0!important;z-index:2147483000!important;display:flex!important;flex-direction:column!important;background:#fff!important;color:#153744!important;box-sizing:border-box!important}
   #gldVisorWebGlobal *{box-sizing:border-box}
   #gldVisorWebGlobal .gld-visor-barra{flex:0 0 auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#f4f9fb;border-bottom:1px solid #bad6e2;padding:9px 12px}
   #gldVisorWebGlobal button{padding:10px 14px;border:0;border-radius:8px;font:700 15px/1.2 Arial,sans-serif;color:#fff;background:#006699;cursor:pointer}
   #gldVisorWebGlobal .gld-visor-titulo{font:700 15px/1.3 Arial,sans-serif;flex:1;min-width:120px}
   #gldVisorWebGlobal a{font:600 13px/1.3 Arial,sans-serif;color:#006699;text-decoration:underline}
   #gldVisorWebGlobal iframe{border:0;display:block;flex:1 1 auto;min-height:0;width:100%;background:#fff}
 `;
 document.head.appendChild(css);
 const modal=document.createElement('section');
 modal.id='gldVisorWebGlobal';modal.hidden=true;
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Sitio web del anunciante');
 const bar=document.createElement('div');bar.className='gld-visor-barra';
 const back=document.createElement('button');back.type='button';back.textContent='← Volver a los resultados';
 const label=document.createElement('strong');label.className='gld-visor-titulo';label.textContent='Sitio web del anunciante';
 const external=document.createElement('a');external.textContent='Abrir directamente';external.target='_blank';external.rel='noopener noreferrer';
 bar.append(back,label,external);
 const site=document.createElement('iframe');site.title='Sitio web del anunciante';site.referrerPolicy='strict-origin-when-cross-origin';
 modal.append(bar,site);
 function mount(){if(!modal.isConnected)document.body.appendChild(modal)}
 function close(){
   if(!abierto)return;
   abierto=false;site.removeAttribute('src');modal.hidden=true;
   document.documentElement.style.overflow=previousOverflow;
   try{origen?.postMessage({tipo:'gld:visor-web:cerrado'},location.origin)}catch(_){}
   origen=null;
   try{frameGuia()?.focus({preventScroll:true})}catch(_){}
 }
 back.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&abierto){e.preventDefault();close()}});
 window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==frameGuia()?.contentWindow)return;
   const data=e.data||{};
   if(data.tipo==='gld:visor-web:ping'){
     e.source.postMessage({tipo:'gld:visor-web:disponible'},location.origin);return;
   }
   if(data.tipo!=='gld:visor-web:abrir')return;
   let u;try{u=new URL(String(data.url||''))}catch{return}
   if(!['http:','https:'].includes(u.protocol))return;
   mount();origen=e.source;external.href=u.href;
   previousOverflow=document.documentElement.style.overflow;
   document.documentElement.style.overflow='hidden';
   modal.hidden=false;abierto=true;site.src=u.href;
   back.focus({preventScroll:true});
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
