(function(){
'use strict';
const API='https://login.liqkoargentina.workers.dev/catalogs/public/guide';
const KEY='gld_planes_publicos_catalogo_v1',MAX_AGE=24*60*60*1000;
const list=document.querySelector('.plans');if(!list||!window.GLD_PLANES_RESUMEN)return;
const fmt=window.GLD_PLANES_RESUMEN;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wa='https://wa.me/5491150972086?text='+encodeURIComponent('Hola, quisiera consultar los planes y servicios de Guía Local.');

const gloss=document.getElementById('glosarioPlanes');
if(gloss&&Array.isArray(fmt.glossary)){
 gloss.innerHTML=fmt.glossary.map(g=>'<article class="glossary-item"><h3>'+esc(g.term)+'</h3><p>'+esc(g.meaning)+'</p></article>').join('');
}

function render(rows){
 const usable=Array.isArray(rows)?rows.filter(r=>r&&r.eliminado!==true):[];
 const cfg=(rows||[]).find(r=>String(r.nivel_id||r.id||'')==='CONFIG_GENERAL_ANUNCIANTES')||{};
 if(!usable.length){list.innerHTML='<p class="notice">Consultanos por WhatsApp para conocer nuestros planes.</p>';return;}
 list.innerHTML=Array.from({length:6},(_,i)=>{
 const n=i+1,row=usable.find(r=>fmt.number(r)===n);
 if(!row)return '<article class="plan"><div class="plan-head"><span class="index">0'+n+'</span></div><h3>Nivel '+n+'</h3><p class="plan-desc">Consultanos por las condiciones de este nivel.</p><a class="plan-link" target="_blank" rel="noopener noreferrer" href="'+wa+'">Consultar ↗</a></article>';
 const groups=fmt.sections(row,cfg);
 const hasRules=groups.length>0;
 const benefits=groups.map(group=>'<section class="plan-benefit-group"><h4>'+esc(group.title)+'</h4><dl>'+
  group.items.map(item=>'<div class="benefit"><dt><strong>'+esc(item.label)+(item.value?': '+esc(item.value):'')+'</strong></dt>'+
   (item.description?'<dd>'+esc(item.description)+'</dd>':'')+'</div>').join('')+'</dl></section>').join('');
 const price=fmt.publishPrice(row)?fmt.price(row):null;
 const name=fmt.name(row);
 const active=fmt.active(row);
 const value=price===null?'Consultá condiciones':price===0?'Gratuito':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(price);
 return '<article class="plan"><div class="plan-head"><span class="index">0'+n+'</span><span class="type">'+(n<=2?'Institucional':'Comercial')+'</span></div>'+
 '<h3>Nivel '+n+'</h3>'+(name?'<p class="plan-desc">'+esc(name)+'</p>':'')+
 '<p class="plan-price">'+(active?esc(value):'No disponible actualmente')+'</p>'+
 (hasRules?'<details class="plan-detail"><summary><strong>Qué incluye este nivel</strong></summary>'+benefits+'</details>':'<p class="muted">Consultá qué prestaciones están habilitadas.</p>')+
 '<a class="plan-link" target="_blank" rel="noopener noreferrer" href="'+wa+'">Consultar este nivel <span aria-hidden="true">↗</span></a></article>';
 }).join('');


 const funcKeys=['eventos_free','eventos_vip','actividades','promociones','publicidad'];
 document.querySelectorAll('[data-gld-funcionalidades-resumen] .plan-module').forEach((node,i)=>{
  const key=funcKeys[i];if(!key)return;
  node.querySelector('[data-func-importe]')?.remove();
  const raw=cfg['precio_func_'+key];
  if(fmt.flag(cfg['precio_func_visible_'+key])!==true||raw===null||raw===undefined||raw===''||!Number.isSafeInteger(Number(raw))||Number(raw)<0)return;
  const p=document.createElement('p');p.dataset.funcImporte=key;p.className='plan-price';
  p.textContent=Number(raw)===0?'Gratuito':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(raw));
  node.appendChild(p);
 });
 const notice=document.querySelector('#catalogStatus');if(notice){notice.textContent='';notice.hidden=true;}
}
function fromStorage(){try{const c=JSON.parse(sessionStorage.getItem(KEY)||'null');if(c&&Date.now()-c.at<MAX_AGE&&Array.isArray(c.rows))return c.rows;}catch(_){}return null;}
async function load(){
 const cached=fromStorage();if(cached){render(cached);return;}
 const notice=document.querySelector('#catalogStatus');if(notice){notice.textContent='';notice.hidden=true;}
 try{
  const response=await fetch(API,{mode:'cors',credentials:'omit'});
  if(!response.ok)throw Error('Respuesta '+response.status);
  const data=await response.json();if(data.success!==true||!Array.isArray(data.niveles_anunciante))throw Error('Catálogo no disponible');
  try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),rows:data.niveles_anunciante}));}catch(_){}
  render(data.niveles_anunciante);
 }catch(err){
  if(notice){notice.textContent='No pudimos actualizar los planes. Consultanos por WhatsApp para conocer las condiciones disponibles.';notice.hidden=false;}
  list.innerHTML='<p class="notice">En este momento no podemos mostrar los planes. Consultanos para recibir información.</p>';
 }
}
load();
})();
