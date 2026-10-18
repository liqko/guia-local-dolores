(function(){
'use strict';
const el=id=>document.getElementById(id),state={key:'',rows:[],reviews:[],page:0,loaded:false,sequence:0};
const identity=()=>String(sesionSuscriptor?.suscriptor_id||'')+':'+String(sesion?.id||'');
function seen(){try{return JSON.parse(localStorage.getItem('gld_notifications_read102:'+identity())||'{}');}catch{return {};}}
function fingerprint(r){return String(r.fecha||'')+'|'+String(r.detalle||'');}
function paint(){const reads=seen(),count=state.rows.filter(r=>reads[r.id]!==fingerprint(r)).length;document.querySelectorAll('[data-notifications102]').forEach(b=>b.textContent='Notificaciones'+(count?' ('+count+' sin leer)':''));}
function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
function button(text,action){const n=node('button',text);n.type='button';n.className='secondary';n.onclick=action;return n;}
function render(){const box=el('notifications102-list');if(!box)return;box.replaceChildren();for(const r of state.rows.slice(state.page*10,state.page*10+10)){
 const detail=node('details'),summary=node('summary',r.titulo);detail.append(summary,node('p',r.detalle),node('p',r.fecha));
 detail.ontoggle=()=>{if(!detail.open)return;const reads=seen();reads[r.id]=fingerprint(r);try{localStorage.setItem('gld_notifications_read102:'+identity(),JSON.stringify(reads));}catch{}paint();};
 if(r.solicitud_id)detail.append(button('Ver solicitud y respuestas',async()=>{await abrirMisSolicitudesV74_();await abrirConversacionSoporteV74_(r.solicitud_id);}));
 if(r.tipo==='TERMINOS')detail.append(button('Ver términos y condiciones',()=>document.getElementById('btnTerminosAnunciante')?.click()));
 box.append(detail);
 }if(!state.rows.length)box.append(node('p','No hay notificaciones para este anunciante.'));
 const nav=node('div');if(state.page)nav.append(button('Anterior',()=>{state.page--;render();}));nav.append(node('span',' Página '+(state.page+1)+' '));if((state.page+1)*10<state.rows.length)nav.append(button('Siguiente',()=>{state.page++;render();}));box.append(nav);paint();
}
async function load(force=false){
 const key=identity();if(!sesionSuscriptor?.suscriptor_id||!sesion?.id)return;if(state.key!==key){state.key=key;state.rows=[];state.reviews=[];state.page=0;state.loaded=false;paint();}if(state.loaded&&!force)return;
 const seq=++state.sequence,aid=String(sesion.id);
 try{const [feed,support]=await Promise.all([soporteFetchV74_('/notifications?anunciante_id='+encodeURIComponent(aid)),soporteFetchV74_('/support/mine?anunciante_id='+encodeURIComponent(aid))]);if(identity()!==key||state.sequence!==seq)return;state.rows=feed.results||[];state.reviews=support.revisiones||[];window.GLD_REVIEWS102={key,rows:state.reviews};state.loaded=true;paint();document.querySelectorAll('[data-publication-review]').forEach(b=>{const r=state.reviews.find(r=>r.tipo===b.dataset.reviewType&&r.id===b.dataset.reviewId);if(r){const note=node('strong',r.estado==='CERRADA'?'Bloqueada · revisión rechazada definitivamente':'Revisión solicitada · '+r.estado);note.className='publication-review-state';b.replaceWith(note);}});render();}
 catch(e){if(identity()===key&&el('notifications102-list'))el('notifications102-list').textContent=e.message;}
}
window.GLD_NOTIFICATIONS102={load,open(){mostrarPanel('notificaciones');el('notifications102-title').textContent='Notificaciones de '+String(sesion?.nombre||'este anunciante');load(true).then(render);},review(tipo,id){if(window.GLD_REVIEWS102?.key!==identity())return null;return state.reviews.find(r=>r.tipo===tipo&&r.id===id);}};
document.addEventListener('click',e=>{if(e.target.closest('[data-notifications102]'))window.GLD_NOTIFICATIONS102.open();});
})();
