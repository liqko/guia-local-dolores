(function(){
'use strict';
const API='https://login.liqkoargentina.workers.dev/catalogs/public/guide';
const KEY='gld_planes_publicos_catalogo_v4',MAX_AGE=5*60*1000;
const list=document.querySelector('.plans');if(!list||!window.GLD_PLANES_RESUMEN)return;
const fmt=window.GLD_PLANES_RESUMEN;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ars=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
const wa='https://wa.me/5491150972086?text='+encodeURIComponent('Hola, quisiera consultar los planes y servicios de Guía Local.');
const gloss=document.getElementById('glosarioPlanes');
if(gloss&&Array.isArray(fmt.glossary))gloss.innerHTML=fmt.glossary.map(g=>'<article class="glossary-item"><h3>'+esc(g.term)+'</h3><p>'+esc(g.meaning)+'</p></article>').join('');
function priceHtml(item){
 if(!item||!Number.isSafeInteger(item.importe)||item.importe<0)return '<p class="plan-price">Consultá condiciones</p>';
 const d=Number.isInteger(item.descuento_porcentaje)&&item.descuento_porcentaje>0&&item.descuento_porcentaje<=100?item.descuento_porcentaje:0;
 const normal=item.importe===0?'Gratuito':ars(item.importe);
 if(!d)return '<p class="plan-price">'+esc(normal)+'</p>';
 const final=Math.round(item.importe*(100-d)/100);
 const reason=String(item.descuento_texto||'').trim();
 return '<p class="plan-price"><span style="text-decoration:line-through;color:var(--muted);font-weight:400">'+esc(normal)+'</span> <strong>'+esc(final===0?'Gratuito':ars(final))+'</strong></p>'+
 '<p class="plan-discount">'+d+'% de descuento'+(reason?' · '+esc(reason):'')+'</p>';
}
function render(payload){
 const rows=Array.isArray(payload.niveles_anunciante)?payload.niveles_anunciante:[];
 const usable=rows.filter(r=>r&&r.eliminado!==true);
 const cfg=rows.find(r=>String(r.nivel_id||r.id||'')==='CONFIG_GENERAL_ANUNCIANTES')||{};
 const details=payload.precios_detalle||{};
 list.innerHTML=Array.from({length:6},(_,i)=>{
  const n=i+1,row=usable.find(r=>fmt.number(r)===n),active=row&&fmt.active(row);
  if(!row)return '<article class="plan"><h3>Nivel '+n+'</h3><p class="plan-price">Consultar condiciones</p><a class="plan-link" target="_blank" rel="noopener noreferrer" href="'+wa+'">Consultar este nivel</a></article>';
  const groups=fmt.sections(row,cfg);
  const benefits=groups.map(group=>'<section class="plan-benefit-group"><h4>'+esc(group.title)+'</h4><dl>'+
   group.items.map(item=>'<div class="benefit"><dt><strong>'+esc(item.label)+(item.value?': '+esc(item.value):'')+'</strong></dt>'+
    (item.description?'<dd>'+esc(item.description)+'</dd>':'')+'</div>').join('')+'</dl></section>').join('');
  return '<article class="plan"><div class="plan-head"><span class="index">0'+n+'</span><span class="type">'+(n<=2?'Institucional':'Comercial')+'</span></div>'+
  '<h3>Nivel '+n+'</h3>'+(fmt.name(row)?'<p class="plan-desc">'+esc(fmt.name(row))+'</p>':'')+
  (active?priceHtml(details.niveles?.[String(n)]):'<p class="plan-price">No disponible actualmente</p>')+
  (groups.length?'<details class="plan-detail"><summary><strong>Qué incluye este nivel</strong></summary>'+benefits+'</details>':'')+
  '<a class="plan-link" target="_blank" rel="noopener noreferrer" href="'+wa+'">Consultar este nivel <span aria-hidden="true">↗</span></a></article>';
 }).join('');
 if(window.GLD_FUNCIONALIDADES_RESUMEN?.render)window.GLD_FUNCIONALIDADES_RESUMEN.render(payload.funcionalidades_parametros);
 if(window.GLD_SIMULADOR_PUBLICO?.render)window.GLD_SIMULADOR_PUBLICO.render(payload);
 const priceBox=document.getElementById('preciosFuncPublicos');
 if(priceBox){
   const mapped=[['eventos_free','Eventos Free'],['eventos_vip','Eventos VIP'],['actividades','Actividades'],['promociones','Promociones'],['publicidad','Publicidad']];
   const rules=payload.funcionalidades_parametros;
   const code={eventos_free:'EVENTOS_FREE',eventos_vip:'EVENTOS',actividades:'ACTIVIDADES',promociones:'PROMOS',publicidad:'PUBLICIDAD'};
   priceBox.innerHTML=mapped.filter(([k])=>rules?.[code[k]]?.activo!==false).map(([k,title])=>
    '<article class="service"><h3>'+esc(title)+'</h3>'+priceHtml(details.funcionalidades?.[k])+'</article>').join('');
 }
 const notice=document.getElementById('catalogStatus');
 if(notice){notice.hidden=true;notice.textContent='';}
}
function fromStorage(){try{const c=JSON.parse(sessionStorage.getItem(KEY)||'null');if(c&&Date.now()-c.at<MAX_AGE&&c.payload)return c.payload;}catch(_){}return null;}
async function load(){
 const cached=fromStorage();if(cached){render(cached);return;}
 const notice=document.getElementById('catalogStatus');
 try{
  const response=await fetch(API,{mode:'cors',credentials:'omit'});
  if(!response.ok)throw Error('Respuesta '+response.status);
  const data=await response.json();
  if(data.success!==true||!Array.isArray(data.niveles_anunciante))throw Error('Catálogo no disponible');
  try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),payload:data}));}catch(_){}
  render(data);
 }catch(error){
  if(notice){notice.hidden=false;notice.textContent='No se pudo actualizar la información de planes. Consultanos para conocer los valores vigentes.';}
  list.innerHTML='<p class="notice">Los planes no están disponibles en este momento.</p>';
  window.GLD_FUNCIONALIDADES_RESUMEN?.render(null);
  window.GLD_SIMULADOR_PUBLICO?.render(null);
 }
}
load();
})();