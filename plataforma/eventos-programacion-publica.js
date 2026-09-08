/* Guía Local - programación pública de Eventos VIP */
(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function truthy(v){
    if(v===true || v===1) return true;
    const s=String(v??'').trim().toLowerCase();
    return ['true','1','si','sí','yes','activo','publicado','aprobado'].includes(s);
  }

  function normalizarTexto(v){
    return String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function formatFecha(v){
    const s=String(v||'').trim();
    if(!s) return '';
    let d=null;
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    else {
      const p=new Date(s);
      if(!Number.isNaN(p.getTime())) d=p;
    }
    if(!d) return s;
    return new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d)
      .replace(/^./,c=>c.toUpperCase());
  }

  function formatHora(desde,hasta){
    const a=String(desde||'').trim();
    const b=String(hasta||'').trim();
    if(a&&b) return `${a} a ${b} hs`;
    if(a) return `${a} hs`;
    if(b) return `Hasta ${b} hs`;
    return '';
  }

  function obtenerDatos(){
    try{
      if(typeof eventosData!=='undefined' && Array.isArray(eventosData)) return eventosData;
    }catch(e){}
    return [];
  }

  function buscarEvento(card){
    const titulo=normalizarTexto(card.querySelector('.title-card')?.textContent||'');
    if(!titulo) return null;
    return obtenerDatos().find(ev=>normalizarTexto(ev?.nombre_evento||ev?.nombre||ev?.titulo)===titulo)||null;
  }

  function filasActivas(ev){
    return (Array.isArray(ev?.programacion)?ev.programacion:[])
      .filter(r=>r?.activo===undefined || truthy(r.activo))
      .sort((a,b)=>{
        const oa=Number(a?.orden||0), ob=Number(b?.orden||0);
        if(oa||ob) return oa-ob;
        const ka=String(a?.fecha||'')+' '+String(a?.hora_desde||'');
        const kb=String(b?.fecha||'')+' '+String(b?.hora_desde||'');
        return ka.localeCompare(kb);
      });
  }

  function filaHtml(r,index){
    const fecha=formatFecha(r.fecha);
    const hora=formatHora(r.hora_desde,r.hora_hasta);
    const lugar=String(r.lugar_texto||r.lugar||'').trim();
    const direccion=String(r.direccion||'').trim();
    const maps=String(r.maps||r.llegar||'').trim();
    const actividad=String(r.actividad||'').trim();
    const detalle=String(r.detalle||'').trim();
    const obs=String(r.observaciones||'').trim();

    return `<div class="evpub-program-row">
      <div class="evpub-program-head">
        <span class="evpub-program-num">${index+1}</span>
        <div>
          ${fecha?`<div class="evpub-program-date"><i class="ri-calendar-event-line"></i>${esc(fecha)}</div>`:''}
          ${hora?`<div class="evpub-program-time"><i class="ri-time-line"></i>${esc(hora)}</div>`:''}
        </div>
      </div>
      ${actividad?`<div class="evpub-program-activity">${esc(actividad)}</div>`:''}
      ${lugar?`<div class="evpub-program-place"><i class="ri-map-pin-2-line"></i><strong>${esc(lugar)}</strong></div>`:''}
      ${direccion?`<div class="evpub-program-address"><i class="ri-road-map-line"></i>${esc(direccion)}</div>`:''}
      ${maps?`<div class="evpub-program-map"><a href="${esc(maps)}" target="_blank" rel="noopener"><i class="ri-map-pin-line"></i> ¿Cómo llegar?</a></div>`:''}
      ${detalle?`<div class="evpub-program-detail">${esc(detalle)}</div>`:''}
      ${obs?`<div class="evpub-program-obs">${esc(obs)}</div>`:''}
    </div>`;
  }

  function aplicarCard(card){
    if(card.dataset.programacionPublicaAplicada==='1') return;
    if(!card.classList.contains('vip')) return;

    const ev=buscarEvento(card);
    if(!ev) return;
    const rows=filasActivas(ev);
    if(!rows.length) return;

    const body=card.querySelector('.card-body');
    if(!body) return;

    /* Los datos generales del evento permanecen visibles.
       La programación se agrega debajo como detalle, sin reemplazarlos. */
    let bloque=body.querySelector('.evpub-programacion');
    if(!bloque){
      bloque=document.createElement('section');
      bloque.className='evpub-programacion';
      const info=body.querySelector('.info-block');
      if(info) info.insertAdjacentElement('afterend',bloque);
      else {
        const category=body.querySelector('.category-group');
        if(category) category.insertAdjacentElement('afterend',bloque);
        else body.prepend(bloque);
      }
    }

    bloque.innerHTML=`<div class="evpub-program-title"><i class="ri-calendar-schedule-line"></i> Programación detallada</div>${rows.map(filaHtml).join('')}`;
    card.dataset.programacionPublicaAplicada='1';
  }

  function aplicar(){
    document.querySelectorAll('.event-card.vip').forEach(aplicarCard);
  }

  function instalarEstilos(){
    if(document.getElementById('evpub-programacion-style')) return;
    const style=document.createElement('style');
    style.id='evpub-programacion-style';
    style.textContent=`
      .evpub-programacion{margin-top:12px;width:100%;display:flex;flex-direction:column;gap:10px}
      .evpub-program-title{font-weight:950;color:#102f5b;font-size:1.05rem;display:flex;align-items:center;gap:7px;margin-bottom:1px}
      .evpub-program-row{width:100%;background:#fff;border:1px solid #ffc88c;border-left:4px solid #ff8a35;border-radius:12px;padding:11px 12px;box-sizing:border-box;box-shadow:0 4px 12px rgba(255,122,42,.08)}
      .evpub-program-head{display:flex;align-items:flex-start;gap:9px}
      .evpub-program-num{width:26px;height:26px;flex:0 0 26px;border-radius:50%;background:#ff8a35;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:950;font-size:.82rem}
      .evpub-program-date,.evpub-program-time,.evpub-program-place,.evpub-program-address{display:flex;align-items:flex-start;gap:7px;line-height:1.35}
      .evpub-program-date{font-weight:950;color:#174f9e}
      .evpub-program-time{font-weight:850;color:#22529a;margin-top:2px}
      .evpub-program-place{margin-top:8px;color:#173d70}
      .evpub-program-address{margin-top:4px;color:#3a536e}
      .evpub-program-map{margin-top:5px}
      .evpub-program-map a{color:#0d69b5;font-weight:850;text-decoration:underline}
      .evpub-program-activity{margin:8px 0 0 35px;font-weight:950;color:#5a39b9}
      .evpub-program-detail{margin:6px 0 0 35px;font-weight:800;color:#374a5e}
      .evpub-program-obs{margin:4px 0 0 35px;color:#66788a;font-style:italic}
      @media(max-width:600px){
        .evpub-program-row{padding:10px}
        .evpub-program-activity,.evpub-program-detail,.evpub-program-obs{margin-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function init(){
    instalarEstilos();
    aplicar();
    const observer=new MutationObserver(()=>aplicar());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
