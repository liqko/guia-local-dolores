let GH_PUBLICIDAD_ROWS=[];
async function ghPublicidadLoad101(){
 const message=document.getElementById('ghPublicidadMessage');message.textContent='Cargando publicidades…';
 try{let cursor='',rows=[],ready=false;do{const result=await ghAdminRequest_('/publicidad'+(cursor?'?cursor='+encodeURIComponent(cursor):''));rows.push(...result.results||[]);ready=result.preparado;cursor=result.next_cursor||'';}while(cursor);GH_PUBLICIDAD_ROWS=rows;document.getElementById('ghPublicidadPrepare').hidden=ready;ghPublicidadRender101();message.textContent='Listado cargado desde caché.';}catch(e){message.textContent=e.message;}
}
async function ghPublicidadPrepare101(){
 const b=document.getElementById('ghPublicidadPrepare'),message=document.getElementById('ghPublicidadMessage');b.disabled=true;message.textContent='Preparando publicidades existentes…';
 try{await ghAdminRequest_('/publicidad/prepare',{},'POST');await ghPublicidadLoad101();}catch(e){message.textContent=e.message;}finally{b.disabled=false;}
}
function ghPublicidadRender101(){
 const q=ghNorm(document.getElementById('ghPublicidadSearch').value),state=document.getElementById('ghPublicidadState').value;
 const status=p=>[p.estado_moderacion,p.revision_adulto].some(s=>['RECHAZADO','RECHAZADA'].includes(s))?'RECHAZADA':p.estado_moderacion==='PENDIENTE'||p.revision_adulto==='PENDIENTE'?'PENDIENTE':p.estado==='ACTIVA'?'ACTIVA':'PAUSADA';
 const rows=GH_PUBLICIDAD_ROWS.filter(p=>(!q||ghNorm([p.titulo,p.nombre_interno,p.anunciante_nombre,p.anunciante_id].join(' ')).includes(q))&&(!state||status(p)===state));
 document.getElementById('ghPublicidadSummary').textContent=GH_PUBLICIDAD_ROWS.length+' piezas · '+GH_PUBLICIDAD_ROWS.filter(p=>status(p)==='ACTIVA').length+' activas · '+GH_PUBLICIDAD_ROWS.filter(p=>status(p)==='PENDIENTE').length+' pendientes';
 const box=document.getElementById('ghPublicidadList');box.innerHTML=rows.map(p=>'<details class="card"><summary><strong>'+esc(p.nombre_interno||p.titulo||'Publicidad')+'</strong> · '+esc(status(p))+'</summary><p>'+esc(p.anunciante_nombre||p.anunciante_id)+' · '+esc(p.formato)+' · Nivel '+esc(p.nivel||'—')+'</p><p>'+esc((p.segmentacion||[]).map(s=>s.ciudad_id+' · '+s.categoria_id).filter((x,i,a)=>a.indexOf(x)===i).join(' / '))+'</p><div class="actions"><button data-gh-pub="pausar" data-id="'+esc(p.publicidad_id||p.id)+'" '+(p.estado==='ACTIVA'?'':'disabled')+'>Pausar</button><button class="danger" data-gh-pub="eliminar" data-id="'+esc(p.publicidad_id||p.id)+'" '+(p.estado==='ACTIVA'?'disabled':'')+'>Borrar</button></div></details>').join('')||'<p>No hay publicidades para mostrar.</p>';
 box.querySelectorAll('[data-gh-pub]').forEach(button=>button.onclick=async()=>{
  const id=button.dataset.id,action=button.dataset.ghPub;
  if(action==='eliminar'&&!window.confirm('Confirmar borrado\n\n¿Querés borrar esta publicidad? Esta acción no se puede deshacer.'))return;
  button.disabled=true;try{await ghAdminRequest_('/publicidad',{publicidad_id:id,action},'POST');if(action==='eliminar')GH_PUBLICIDAD_ROWS=GH_PUBLICIDAD_ROWS.filter(p=>String(p.publicidad_id||p.id)!==id);else GH_PUBLICIDAD_ROWS=GH_PUBLICIDAD_ROWS.map(p=>String(p.publicidad_id||p.id)===id?{...p,estado:'INACTIVA'}:p);ghPublicidadRender101();document.getElementById('ghPublicidadMessage').textContent=action==='eliminar'?'Publicidad borrada.':'Publicidad pausada.';}catch(e){button.disabled=false;document.getElementById('ghPublicidadMessage').textContent=e.message;}
 });
}
