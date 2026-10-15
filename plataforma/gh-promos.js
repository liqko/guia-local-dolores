(function(){
'use strict';
let rows=[],prepared=false,loaded=false,loading=null,mutating=false;
const el=id=>document.getElementById(id);
async function request(path,body){
 const r=await fetch(TERRITORY_API_ORIGIN+'/superadmin'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'No se pudo consultar Promos.');return j;
}
function state(p){if(p.estado_panel)return p.estado_panel;if(p.estado_moderacion==='PENDIENTE'||(p.contenido_adulto&&p.revision_adulto==='PENDIENTE'))return 'PENDIENTE';if(p.estado_moderacion==='RECHAZADO')return 'RECHAZADA';return p.pausado===true||String(p.pausado)==='true'||String(p.pausado)==='1'?'PAUSADA':'ACTIVA';}
function expired(p){const day=String(p.hasta||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(day)&&day<new Date(Date.now()-3*3600000).toISOString().slice(0,10);}
function render(){
 const box=el('ghPromosList'),summary=el('ghPromosSummary'),jump=el('ghPromosJump');if(!box)return;
 const pending=rows.filter(p=>state(p)==='PENDIENTE').length;
 if(jump){jump.textContent='Promos: '+(loaded&&prepared?pending+' pendiente(s)':'Sin comprobar');jump.className=pending?'needs-attention':'clear-status';}
 el('ghPromosPrepare').hidden=prepared;
 if(!prepared){summary.textContent=loaded?'Listado todavía sin preparar.':'Sin consultar';box.textContent=loaded?'La preparación inicial consulta los registros existentes. Después, los listados usan caché. No se muestra un cero como si la lista estuviera vacía.':'Abrí Promos para consultar su estado.';return;}
 const city=el('ghPromosCity').value,q=ghNorm(el('ghPromosSearch').value),filter=el('ghPromosState').value;
 const cities=[...new Set(rows.map(p=>String(p.ciudad_id||'')).filter(Boolean))];
 const select=el('ghPromosCity');select.innerHTML='<option value="">Todas las ciudades</option>'+cities.map(id=>{const c=GH_CITIES.find(c=>String(c.ciudad_id||c.id)===id);return '<option value="'+esc(id)+'">'+esc(c?.ciudad_visible||id)+'</option>';}).join('');select.value=cities.includes(city)?city:'';
 summary.textContent=rows.length+' guardada(s) · '+rows.filter(p=>state(p)==='ACTIVA').length+' activa(s) · '+rows.filter(p=>state(p)==='PAUSADA').length+' pausada(s) · '+pending+' pendiente(s) · '+rows.filter(expired).length+' vencida(s) por fecha';
 const filtered=rows.filter(p=>(!select.value||String(p.ciudad_id)===select.value)&&(!filter||state(p)===filter)&&(!q||ghNorm([p.promo,p.promo_id,p.anunciante_id,p.ciudad_id].join(' ')).includes(q)));
 box.innerHTML=filtered.map(p=>{
  const id=String(p.promo_id||p.id),status=state(p),action=(value,label)=>'<button type="button" data-promo-id="'+esc(id)+'" data-promo-action="'+value+'">'+label+'</button>';
  return '<details class="item"><summary><b>'+esc(p.promo||id)+'</b> · '+esc(status)+(expired(p)?' · Vencida por fecha':'')+'</summary><p class="muted">ID: '+esc(id)+' · Anunciante: '+esc(p.anunciante_id||p.id_comercio||'')+' · Ciudad: '+esc(p.ciudad_id||'')+'</p><p>'+esc(p.otros||'')+'</p><p>'+esc(p.desde||'')+' al '+esc(p.hasta||'')+'</p><div class="actions">'+(status==='PENDIENTE'?action('aprobar','Aprobar publicación'+(p.contenido_adulto?' y clasificación +18':''))+action('rechazar','Rechazar'):'')+action(status==='PAUSADA'?'reanudar':'pausar',status==='PAUSADA'?'Reanudar':'Pausar')+action('borrar','Borrar')+'</div></details>';
 }).join('')||'<p>No hay promociones para estos filtros.</p>';
 box.querySelectorAll('[data-promo-action]').forEach(b=>{b.disabled=mutating;b.onclick=()=>act(b.dataset.promoId,b.dataset.promoAction);});
 window.informarAltura?.();
}
window.ghPromosLoadV91=function(force=false){
 if(loading)return loading;if(loaded&&!force){render();return Promise.resolve();}
 loading=(async()=>{const all=[];let cursor;do{const j=await request('/promos'+(cursor?'?cursor='+encodeURIComponent(cursor):''));prepared=j.preparado===true;if(!prepared){loaded=true;rows=[];render();return;}all.push(...j.results||[]);cursor=j.next_cursor;}while(cursor);rows=all;loaded=true;render();})().catch(e=>{el('ghPromosSummary').textContent=e.message+' No se pudo comprobar el listado completo.';}).finally(()=>{loading=null;});return loading;
};
window.ghPromosPrepareV91=async function(){
 if(mutating||loading)return;if(!confirm('¿Preparar el listado existente? Esta carga inicial consulta las promociones guardadas; las próximas consultas usarán caché.'))return;
 mutating=true;el('ghPromosPrepare').disabled=true;
 try{let j;do{j=await request('/promos/prepare',{});el('ghPromosSummary').textContent='Preparando '+(j.procesadas||0)+' promoción(es)…';}while(j.continuar);loaded=false;await window.ghPromosLoadV91(true);}catch(e){el('ghPromosMessage').textContent=e.message;}finally{mutating=false;el('ghPromosPrepare').disabled=false;render();}
};
async function act(id,action){
 if(mutating)return;
 if(!confirm(({borrar:'¿Borrar definitivamente esta promoción?',aprobar:'¿Aprobar la publicación y su clasificación +18, si corresponde?',rechazar:'¿Rechazar esta promoción?',pausar:'¿Pausar esta promoción?',reanudar:'¿Reanudar esta promoción respetando el cupo del anunciante?'})[action]))return;
 mutating=true;render();
 try{const j=await request('/promos',{promo_id:id,action});if(j.deleted)rows=rows.filter(p=>String(p.promo_id||p.id)!==id);else if(j.promo)rows=rows.map(p=>String(p.promo_id||p.id)===id?j.promo:p);el('ghPromosMessage').textContent=j.unchanged?'No hay cambios para guardar.':'Operación completada.';}catch(e){el('ghPromosMessage').textContent=e.message;}finally{mutating=false;render();}
}
window.ghPromosFilterV91=render;
})();
