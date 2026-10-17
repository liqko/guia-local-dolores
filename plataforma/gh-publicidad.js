let GH_PUBLICIDAD_ROWS=[];
const GH_PUBLICIDAD_NAMES=new Map();
async function ghPublicidadReferences101(rows){
 if(!rows.length)return rows;
 if(!GH_CITIES.length){const territory=await ghFetchJson(TERRITORY_API_ORIGIN+'/territory/public');GH_CITIES=territory.ciudades||[];}
 const ids=[...new Set(rows.filter(p=>!p.anunciante_nombre).map(p=>String(p.anunciante_id||'')).filter(Boolean))];
 for(const id of ids){
  if(GH_PUBLICIDAD_NAMES.has(id))continue;
  const result=await ghAdminRequest_('/advertisers/search',{q:id,limit:250});
  const advertiser=(result.results||[]).find(a=>String(a.id||a.anunciante_id)===id);
  GH_PUBLICIDAD_NAMES.set(id,advertiser?.nombre||id);
 }
 return rows.map(p=>({...p,anunciante_nombre:p.anunciante_nombre||GH_PUBLICIDAD_NAMES.get(String(p.anunciante_id))||p.anunciante_id}));
}
function ghPublicidadCities101(p){
 const ids=[...new Set([p.ciudad_id,...(p.segmentacion||[]).map(s=>s.ciudad_id)].filter(Boolean).map(String))];
 return ids.map(id=>{const city=GH_CITIES.find(c=>String(c.ciudad_id||c.id)===id);return {id,nombre:city?.ciudad_visible||city?.nombre||city?.ciudad||id};});
}

async function ghPublicidadLoad101(){
 const message=document.getElementById('ghPublicidadMessage');message.textContent='Cargando publicidades…';
 try{let cursor='',rows=[],ready=false;do{const result=await ghAdminRequest_('/publicidad'+(cursor?'?cursor='+encodeURIComponent(cursor):''));rows.push(...result.results||[]);ready=result.preparado;cursor=result.next_cursor||'';}while(cursor);GH_PUBLICIDAD_ROWS=await ghPublicidadReferences101(rows);document.getElementById('ghPublicidadPrepare').hidden=ready;ghPublicidadRender101();message.textContent=ready?'Listado cargado desde caché.':'Falta incorporar las publicidades anteriores. Usá «Preparar publicidades existentes» una sola vez.';}catch(e){message.textContent=e.message;}
}
async function ghPublicidadPrepare101(){
 const b=document.getElementById('ghPublicidadPrepare'),message=document.getElementById('ghPublicidadMessage');b.disabled=true;message.textContent='Preparando publicidades existentes…';
 try{await ghAdminRequest_('/publicidad/prepare',{},'POST');await ghPublicidadLoad101();}catch(e){message.textContent=e.message;}finally{b.disabled=false;}
}
function ghPublicidadRender101(){
 const q=ghNorm(document.getElementById('ghPublicidadSearch').value),state=document.getElementById('ghPublicidadState').value;
 const status=p=>[p.estado_moderacion,p.revision_adulto].some(s=>['RECHAZADO','RECHAZADA'].includes(s))?'RECHAZADA':p.estado_moderacion==='PENDIENTE'||p.revision_adulto==='PENDIENTE'?'PENDIENTE':p.estado==='ACTIVA'?'ACTIVA':'PAUSADA';
 const rows=GH_PUBLICIDAD_ROWS.filter(p=>(!q||ghNorm([p.anunciante_nombre,p.anunciante_id,...ghPublicidadCities101(p).flatMap(c=>[c.id,c.nombre])].join(' ')).includes(q))&&(!state||status(p)===state));
 document.getElementById('ghPublicidadSummary').textContent=GH_PUBLICIDAD_ROWS.length+' piezas · '+GH_PUBLICIDAD_ROWS.filter(p=>status(p)==='ACTIVA').length+' activas · '+GH_PUBLICIDAD_ROWS.filter(p=>status(p)==='PENDIENTE').length+' pendientes';
 const box=document.getElementById('ghPublicidadList');box.innerHTML=rows.map(p=>'<details class="card"><summary><strong>'+esc(p.nombre_interno||p.titulo||'Publicidad')+'</strong> · '+esc(status(p))+'</summary><p>'+esc(p.anunciante_nombre||p.anunciante_id)+' · '+esc(p.formato)+' · Nivel '+esc(p.nivel||'—')+'</p><p>'+esc(ghPublicidadCities101(p).map(c=>c.nombre).join(' / '))+'</p><div class="actions"><button data-gh-pub="pausar" data-id="'+esc(p.publicidad_id||p.id)+'" '+(p.estado==='ACTIVA'?'':'disabled')+'>Pausar</button><button class="danger" data-gh-pub="eliminar" data-id="'+esc(p.publicidad_id||p.id)+'" '+(p.estado==='ACTIVA'?'disabled':'')+'>Borrar</button></div></details>').join('')||'<p>No hay publicidades para mostrar.</p>';
 box.querySelectorAll('[data-gh-pub]').forEach(button=>button.onclick=async()=>{
  const id=button.dataset.id,action=button.dataset.ghPub;
  if(action==='eliminar'&&!window.confirm('Confirmar borrado\n\n¿Querés borrar esta publicidad? Esta acción no se puede deshacer.'))return;
  button.disabled=true;try{await ghAdminRequest_('/publicidad',{publicidad_id:id,action},'POST');if(action==='eliminar')GH_PUBLICIDAD_ROWS=GH_PUBLICIDAD_ROWS.filter(p=>String(p.publicidad_id||p.id)!==id);else GH_PUBLICIDAD_ROWS=GH_PUBLICIDAD_ROWS.map(p=>String(p.publicidad_id||p.id)===id?{...p,estado:'INACTIVA'}:p);ghPublicidadRender101();document.getElementById('ghPublicidadMessage').textContent=action==='eliminar'?'Publicidad borrada.':'Publicidad pausada.';}catch(e){button.disabled=false;document.getElementById('ghPublicidadMessage').textContent=e.message;}
 });
}
