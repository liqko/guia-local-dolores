(function(){
'use strict';
const API='https://login.liqkoargentina.workers.dev/catalogs/public/guide';
const KEY='gld_planes_publicos_catalogo_v5',MAX_AGE=5*60*1000;
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
function cantidad(rule,key){
 const n=rule?.[key];
 return Number.isSafeInteger(n)&&n>=0?n:null;
}
function resumenFuncionalidad(id,rule){
 const simultaneos=cantidad(rule,'activas_max'),mes=cantidad(rule,'altas_mensuales_max');
 const total=(num,singular,plural)=>num===1?num+' '+singular:num+' '+plural;
 if(id==='EVENTOS_FREE'||id==='EVENTOS'){
  const parts=[];
  if(simultaneos!==null)parts.push('hasta '+total(simultaneos,'evento simultáneo','eventos simultáneos'));
  if(mes!==null)parts.push(total(mes,'alta mensual','altas mensuales'));
  return parts.length?parts.join(' · '):'Publicación de eventos con los cupos establecidos';
 }
 if(id==='ACTIVIDADES'||id==='PROMOS'){
  const noun=id==='ACTIVIDADES'?['actividad simultánea','actividades simultáneas']:['promoción simultánea','promociones simultáneas'];
  return simultaneos!==null?'Hasta '+total(simultaneos,...noun):id==='ACTIVIDADES'?'Publicación de actividades':'Publicación de promociones y descuentos';
 }
 if(id==='PUBLICIDAD')return 'Elegí entre imagen individual, carrusel propio o Short';
 if(id==='EMPLEO'){
  const offers=cantidad(rule,'ofertas_activas_max');
  return offers!==null?'Hasta '+total(offers,'oferta activa','ofertas activas'):'Publicación de ofertas y búsquedas laborales';
 }
 return 'Consultá las condiciones de esta prestación';
}
function detalleFuncionalidad(id,rule){
 const fields=window.GLD_FUNCIONALIDADES_RESUMEN?.fields?.[id]||[];
 const rows=fields.filter(([key])=>Number.isSafeInteger(rule?.[key])).map(([key,label])=>{
  const n=rule[key];return '<li><strong>'+esc(label)+':</strong> '+esc(n===-1?'Ilimitado':String(n))+'</li>';
 });
 return rows.length?'<ul>'+rows.join('')+'</ul>':'<p class="muted">Consultá las condiciones particulares de esta funcionalidad.</p>';
}
function cardFuncionalidad(title,summary,price,details){
 return '<article class="service"><h3>'+esc(title)+'</h3><p class="plan-desc">'+esc(summary)+'</p>'+
  price+'<details class="plan-detail"><summary><strong>Detalle</strong></summary>'+details+'</details></article>';
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
  const rules=payload.funcionalidades_parametros||{};
  const configured=details.funcionalidades||{};
  const mapped=[
   ['eventos_free','Eventos Free','EVENTOS_FREE'],
   ['eventos_vip','Eventos VIP','EVENTOS'],
   ['actividades','Actividades','ACTIVIDADES'],
   ['promociones','Promociones','PROMOS'],
   ['publicidad','Publicidad','PUBLICIDAD'],
   ['empleo','Empleo','EMPLEO']
  ];
  priceBox.innerHTML=mapped.filter(([, ,id])=>rules[id]?.activo!==false).map(([key,title,id])=>{
   const rule=rules[id]||{};
   const detail=detalleFuncionalidad(id,rule);
   if(id==='PUBLICIDAD'){
    const formats=[
     ['publicidad_imagen','Imagen individual','Una imagen dentro de un carrusel compartido de hasta tres piezas, una por anunciante.'],
     ['publicidad_carrusel','Carrusel propio','Una pieza con 3 a 5 imágenes del mismo anunciante.'],
     ['publicidad_short','Short','Una pieza audiovisual en formato YouTube Shorts.']
    ];
    const pricing=formats.map(([format,label,description])=>'<section class="plan-benefit-group"><h4>'+esc(label)+'</h4><p class="muted">'+esc(description)+'</p>'+priceHtml(configured[format])+'</section>').join('');
    return cardFuncionalidad(title,resumenFuncionalidad(id,rule),pricing,detail);
   }
   const price=id==='EVENTOS_FREE'?'<p class="plan-price">Gratuito</p>':priceHtml(configured[key]);
   return cardFuncionalidad(title,resumenFuncionalidad(id,rule),price,detail);
  }).join('');
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