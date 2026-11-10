/* Simulador de lista público. Reutiliza exclusivamente el paquete de Planes y servicios; no consulta otro endpoint. */
(function(){
'use strict';
const root=document.getElementById('simulador-publico');
if(!root)return;
const select=document.getElementById('simNivel');
const additional=document.getElementById('simAdicionales');
const detail=document.getElementById('simDetalle');
const send=document.getElementById('simEnviar');
const reset=document.getElementById('simLimpiar');
const labels=[['eventos_free','Eventos Free'],['eventos_vip','Eventos VIP'],['actividades','Actividades'],['promociones','Promociones'],['publicidad','Publicidad']];
const ids={eventos_free:'EVENTOS_FREE',eventos_vip:'EVENTOS',actividades:'ACTIVIDADES',promociones:'PROMOS',publicidad:'PUBLICIDAD'};
const ars=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
let packet=null;
const selectable=(p)=>p&&Number.isSafeInteger(p.importe)&&p.importe>=0;
function cost(p){
 if(!selectable(p))return null;
 const d=Number.isInteger(p.descuento_porcentaje)&&p.descuento_porcentaje>=0&&p.descuento_porcentaje<=100?p.descuento_porcentaje:0;
 return Math.round(p.importe*(100-d)/100);
}
function quote(){
 const n=select.value;
 const lines=[],details=[];
 let total=0,missing=false,units=0;
 if(n){
  const item=packet?.precios_detalle?.niveles?.[n],value=cost(item);
  lines.push('Nivel '+n);
  details.push('Nivel '+n+': '+(value===null?'consultar precio':ars(value)));
  if(value===null)missing=true;else total+=value;
  units++;
 }
 for(const [key,label] of labels){
  const el=additional.querySelector('[data-sim-key="'+key+'"]');
  const qty=Number(el?.value||0);
  if(!Number.isSafeInteger(qty)||qty<0||qty>100){missing=true;continue;}
  if(!qty)continue;
  const item=packet?.precios_detalle?.funcionalidades?.[key],value=cost(item);
  lines.push(label+' x '+qty);
  details.push(label+' × '+qty+': '+(value===null?'consultar precio':ars(value*qty)));
  if(value===null)missing=true;else total+=value*qty;
  units+=qty;
 }
 detail.replaceChildren();
 const p=document.createElement('p');
 const b=document.createElement('strong');
 b.textContent=units?(missing?'Estimación incompleta · algunos precios requieren consulta':'Total orientativo de lista: '+ars(total)):'Elegí un nivel o servicios para comenzar.';
 p.append(b);
 detail.append(p);
 for(const line of details){const lineEl=document.createElement('div');lineEl.textContent=line;detail.append(lineEl);}
 const note=document.createElement('p');note.style.marginBottom='0';note.textContent='No incluye beneficios comerciales adicionales ni constituye presupuesto definitivo.';detail.append(note);
 const text='Hola, quisiera consultar una propuesta de Guía Local.\n'+
  (lines.length?lines.map(x=>'- '+x).join('\n'):'Quiero conocer los planes disponibles.')+
  (units&&!missing?'\nReferencia de lista: '+ars(total):'')+
  '\nSolicito una propuesta personalizada con un vendedor.';
 send.href='https://wa.me/5491150972086?text='+encodeURIComponent(text);
}
function render(data){
 packet=data&&typeof data==='object'?data:null;
 const current=select.value;
 select.replaceChildren();
 const blank=document.createElement('option');blank.value='';blank.textContent='Seleccioná un nivel';select.append(blank);
 for(let n=1;n<=6;n++){
  const row=(packet?.niveles_anunciante||[]).find(x=>Number(x.numero??x.nivel_id??x.id)===n&&x.eliminado!==true);
  if(!row||row.activo===false)continue;
  const op=document.createElement('option');op.value=String(n);op.textContent='Nivel '+n+(row.titulo||row.nombre?' · '+String(row.titulo||row.nombre):'');
  select.append(op);
 }
 if([...select.options].some(x=>x.value===current))select.value=current;
 additional.replaceChildren();
 for(const [key,label] of labels){
  if(packet?.funcionalidades_parametros?.[ids[key]]?.activo===false)continue;
  const holder=document.createElement('label');holder.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:14px;margin:8px 0;';
  const span=document.createElement('span');span.textContent=label;
  const input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='1';input.value='0';input.dataset.simKey=key;
  input.setAttribute('aria-label','Cantidad de '+label);input.style.cssText='width:85px;padding:9px;border:1px solid #dae3e7;border-radius:8px;';
  holder.append(span,input);additional.append(holder);
 }
 if(!packet?.precios_detalle){
  const alert=document.createElement('p');alert.className='muted';alert.textContent='Aún no están disponibles los importes públicos para estimar el costo completo.';additional.append(alert);
 }
 quote();
}
select.addEventListener('change',quote);
additional.addEventListener('input',quote);
reset.addEventListener('click',()=>{select.value='';additional.querySelectorAll('[data-sim-key]').forEach(el=>el.value='0');quote();});
window.GLD_SIMULADOR_PUBLICO={render};
})();