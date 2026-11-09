(function(){
'use strict';
const API='https://login.liqkoargentina.workers.dev/catalogs/public/guide';
const KEY='gld_planes_publicos_catalogo_v1',MAX_AGE=24*60*60*1000;
const list=document.querySelector('.plans');if(!list||!window.GLD_PLANES_RESUMEN)return;
const fmt=window.GLD_PLANES_RESUMEN;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wa='https://wa.me/5491150972086?text='+encodeURIComponent('Hola, quisiera consultar los planes y servicios de Guía Local.');
function render(rows){
 const usable=Array.isArray(rows)?rows.filter(r=>r&&r.eliminado!==true):[];
 if(!usable.length){list.innerHTML='<p class="notice">No se pudo obtener el catálogo de niveles actualizado. Consultanos por WhatsApp para conocer las opciones.</p>';return;}
 list.innerHTML=Array.from({length:6},(_,i)=>{
 const n=i+1,row=usable.find(r=>fmt.number(r)===n);
 if(!row)return '<article class="plan"><div class="plan-head"><span class="index">0'+n+'</span></div><h3>Nivel '+n+'</h3><p class="plan-desc">La configuración de este nivel no está disponible. Consultanos.</p><a class="plan-link" target="_blank" rel="noopener noreferrer" href="'+wa+'">Consultar ↗</a></article>';
 const features=fmt.summary(row);
 const offers=features.filter(x=>x.enabled);
 const hasRules=features.length>0;
 const price=fmt.publishPrice(row)?fmt.price(row):null;
 const name=fmt.name(row);
 const active=fmt.active(row);
 const value=price===null?'Consultá condiciones':price===0?'Gratuito':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(price);
 return '<article class="plan"><div class="plan-head"><span class="index">0'+n+'</span><span class="type">'+(n<=2?'Institucional':'Guía Local')+'</span></div>'+
 '<h3>Nivel '+n+'</h3>'+(name?'<p class="plan-desc">'+esc(name)+'</p>':'')+
 '<p class="plan-price">'+(active?esc(value):'No disponible actualmente')+'</p>'+
 (hasRules?'<details><summary><strong>Qué incluye</strong></summary><ul>'+offers.map(f=>'<li>'+esc(f.label)+(f.value==='Sí'?'':': '+esc(f.value))+'</li>').join('')+'</ul><p class="muted" style="font-size:12px">Los límites corresponden a las reglas de publicación configuradas.</p></details>':'<p class="muted">Prestaciones sujetas a configuración.</p>')+
 '<a class="plan-link" target="_blank" rel="noopener noreferrer" href="'+wa+'">Consultar este nivel <span aria-hidden="true">↗</span></a></article>';
 }).join('');
 const notice=document.querySelector('#catalogStatus');if(notice)notice.textContent='Prestaciones obtenidas del catálogo vigente de Guía Local. Las funcionalidades adicionales tienen condiciones independientes.';
}
function fromStorage(){try{const c=JSON.parse(sessionStorage.getItem(KEY)||'null');if(c&&Date.now()-c.at<MAX_AGE&&Array.isArray(c.rows))return c.rows;}catch(_){}return null;}
async function load(){
 const cached=fromStorage();if(cached){render(cached);return;}
 const notice=document.querySelector('#catalogStatus');if(notice)notice.textContent='Consultando las prestaciones vigentes…';
 try{
  const response=await fetch(API,{mode:'cors',credentials:'omit'});
  if(!response.ok)throw Error('Respuesta '+response.status);
  const data=await response.json();if(data.success!==true||!Array.isArray(data.niveles_anunciante))throw Error('Catálogo no disponible');
  try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),rows:data.niveles_anunciante}));}catch(_){}
  render(data.niveles_anunciante);
 }catch(err){
  if(notice)notice.textContent='No se pudieron consultar las prestaciones en este momento. Podés solicitar el detalle vigente por WhatsApp.';
  list.innerHTML='<p class="notice">El catálogo no está disponible. No mostramos datos supuestos.</p>';
 }
}
load();
})();
