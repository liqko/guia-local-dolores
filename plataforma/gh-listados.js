(function(){
'use strict';
const el=id=>document.getElementById(id),states=new Map(),searchStates=new Map();
const defs={vip:{kind:'eventos',clase:'VIP',box:'eventosList'},free:{kind:'eventos',clase:'FREE',box:'eventosFreeList'},actividades:{kind:'actividades',box:'activitiesAll102'},promos:{kind:'promos',box:'ghPromosList'},publicidad:{kind:'publicidad',box:'ghPublicidadList'},moderadores:{kind:'moderadores',box:'moderadoresAll102'}};
function node(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
function button(text,fn,disabled=false){const b=node('button',text,'sec');b.type='button';b.disabled=disabled;b.onclick=fn;return b;}
function navigation(box,page,total,previous,next){const n=node('nav','','actions');n.setAttribute('aria-label','Páginas del listado');n.append(button('Anterior',previous,!previous),node('span','Página '+(page+1)+' · '+total+' resultado(s)'),button('Siguiente',next,!next));box.append(n);}
function localPage(box,key,signature,render){let state=states.get('local:'+key);if(!state||state.signature!==signature){state={page:0,signature};states.set('local:'+key,state);}const items=[...box.children];const count=items.length;if(count<=10)return;state.page=Math.min(state.page,Math.floor((count-1)/10));items.forEach((n,i)=>n.hidden=i<state.page*10||i>=(state.page+1)*10);navigation(box,state.page,count,state.page?()=>{state.page--;render();}:null,(state.page+1)*10<count?()=>{state.page++;render();}:null);}
window.GH_DIRECTORY_LOCAL102=localPage;
function ensure(){
 const publicityReview=el('publicidadesRevisionArea');if(publicityReview&&publicityReview.parentElement.id!=='view-publicidad')el('view-publicidad').prepend(publicityReview);
 if(!el('activitiesAll102')){const card=node('div','','card');card.append(node('h3','Todas las actividades'),node('div'));card.lastChild.id='activitiesAll102';el('view-actividades').prepend(card);}
 if(!el('moderadoresAll102')){const card=node('div','','card');card.append(node('h3','Moderadores asignados'),node('div'));card.lastChild.id='moderadoresAll102';el('view-moderadores').prepend(card);}
 for(const [key,d]of Object.entries(defs)){
  if(key==='free')continue;if(el('dir-'+key))continue;
  const target=el(d.box);if(!target)continue;
  const toolbar=node('div','','toolbar');toolbar.id='dir-'+key;
  const q=node('input');q.type='search';q.id='dir-'+key+'-q';q.placeholder=key==='moderadores'?'Buscar por nombre o ciudad':'Buscar por anunciante, organizador o ciudad';q.setAttribute('aria-label',q.placeholder);
  const city=node('select');city.id='dir-'+key+'-city';city.setAttribute('aria-label','Ciudad');
  const status=node('select');status.id='dir-'+key+'-state';status.setAttribute('aria-label','Estado');
  for(const [v,label]of [['','Todos los estados'],['ACTIVA','Activas'],['PAUSADA','Pausadas'],['VENCIDA','Vencidas'],['PENDIENTE','Pendientes'],['RECHAZADA','Rechazadas'],['BLOQUEADA','Bloqueadas']]){const o=node('option',label);o.value=v;status.append(o);}
  let timer;const change=()=>{clearTimeout(timer);timer=setTimeout(()=>{load(key,true);if(key==='vip')load('free',true);},250);};q.oninput=change;city.onchange=change;status.onchange=change;
  toolbar.append(q,city,status,button('Actualizar listado',()=>{load(key,true,true);if(key==='vip')load('free',true,true);}));target.before(toolbar);
  updateCities(key);
 }
 for(const id of ['ghPromosSearch','ghPublicidadSearch','evQ']){const old=el(id)?.closest('.toolbar,.filters');if(old){old.hidden=true;old.style.display='none';}}
 for(const id of ['ghPromosPrepare','ghPublicidadPrepare'])if(el(id))el(id).hidden=true;
}
function updateCities(key){const select=el('dir-'+key+'-city');if(!select)return;const value=select.value;select.replaceChildren();const all=node('option','Todas las ciudades');all.value='';select.append(all);for(const c of GH_CITIES){const o=node('option',c.ciudad_visible||c.nombre||c.ciudad_id);o.value=c.ciudad_id||c.id;select.append(o);}select.value=value;}
function filters(key){const k=key==='free'?'vip':key;return {q:el('dir-'+k+'-q')?.value||'',ciudad_id:el('dir-'+k+'-city')?.value||'',estado:el('dir-'+k+'-state')?.value||''};}
function render(key,s){
 const d=defs[key],box=el(d.box);box.replaceChildren();
 if(!s.data.preparado){box.append(node('p','Falta preparar el listado existente. Esta primera carga consulta los registros; después se consulta la caché.'),button('Preparar listado existente',()=>prepare(key)));return;}
 const rows=s.data.results||[];
 for(const p of rows){const detail=node('details','','item'),summary=node('summary',p.titulo+' · '+p.estado);detail.append(summary,node('p',p.anunciante_nombre||''),node('p',(p.ciudades||[]).join(' / ')),node('p',p.fecha||''));
  const r=p.row||{},description=r.descripcion||r.otros||r.actividad||'';if(description)detail.append(node('p',String(description)));
  const actions=node('div','','actions');
  if(p.anunciante_id)actions.append(button('Ver anunciante',()=>{ghGoView('anunciantes',{pendingOnly:true});detalleAnu(p.anunciante_id);}));
  if(key==='moderadores')actions.append(button('Editar permisos',()=>ghEditarModerador({suscriptor_id:r.suscriptor_id||p.id,nombre:r.nombre||p.titulo})));
  if(p.estado==='PENDIENTE')actions.append(button('Ir a revisión',()=>ghGoPending(d.kind==='eventos'?(d.clase==='FREE'?'EVENTO_FREE':'EVENTO'):({actividades:'ACTIVIDAD',promos:'PROMO',publicidad:'PUBLICIDAD'})[d.kind])));
  if(key==='promos'||key==='publicidad'){
   const action=async(value)=>{if(!confirm(value==='borrar'||value==='eliminar'?'¿Borrar definitivamente esta publicación?':'¿Confirmar el cambio de estado?'))return;actions.querySelectorAll('button').forEach(b=>b.disabled=true);try{const result=await ghAdminRequest_(key==='promos'?'/promos':'/publicidad',{[key==='promos'?'promo_id':'publicidad_id']:p.id,action:value},'POST');if(key==='promos'&&['aprobar','rechazar','borrar'].includes(value)&&typeof ghAplicarRevisionResuelta_==='function')ghAplicarRevisionResuelta_('PROMO',p.id,value==='aprobar'?'APROBAR':'RECHAZAR',{item:result.promo||{},deleted:result.deleted});await load(key,true,true);}catch(e){actions.after(node('p',e.message,'error'));actions.querySelectorAll('button').forEach(b=>b.disabled=false);}};
   if(key==='promos'&&p.estado==='PENDIENTE')actions.append(button('Aprobar publicación',()=>action('aprobar')),button('Rechazar publicación',()=>action('rechazar')));
   if(p.estado!=='BLOQUEADA')actions.append(button(p.estado==='PAUSADA'&&key==='promos'?'Reanudar':'Pausar',()=>action(p.estado==='PAUSADA'&&key==='promos'?'reanudar':'pausar'),key==='publicidad'&&p.estado!=='ACTIVA'));
   actions.append(button('Borrar',()=>action(key==='promos'?'borrar':'eliminar'),key==='publicidad'&&p.estado==='ACTIVA'));
  }
  detail.append(actions);box.append(detail);
 }
 if(!rows.length)box.append(node('p','No hay registros para estos filtros.'));
 navigation(box,s.page,s.data.total,s.page?()=>load(key,false,false,s.page-1):null,s.data.next_cursor?()=>load(key,false,false,s.page+1):null);
 for(const id of [key==='promos'?'ghPromosSummary':key==='publicidad'?'ghPublicidadSummary':''])if(el(id))el(id).textContent=s.data.total+' resultado(s) · hasta 10 por página';
 informarAltura();
}
async function prepare(key){const d=defs[key],box=el(d.box);if(!confirm('La preparación inicial consulta los registros existentes. ¿Continuar?'))return;box.textContent='Preparando listado…';try{let j;do{j=await ghAdminRequest_('/listados/prepare?tipo='+d.kind,{},'POST');box.textContent='Preparando '+j.procesadas+' registro(s)…';}while(j.continuar);await load(key,true,true);}catch(e){box.textContent=e.message;}}
async function load(key,reset=false,force=false,page=0){
 if(GH_ADMIN_ACCESS.rol==='ADMIN_LOCAL')return;ensure();const d=defs[key],f=filters(key),signature=JSON.stringify(f);let s=states.get(key);
 if(!s||s.signature!==signature||force){s={signature,page:0,pages:new Map(),cursors:[''],seq:0};states.set(key,s);}if(reset)page=0;
 if(s.pending===page)return;const seq=++s.seq;const box=el(d.box);if(s.pages.has(page)&&!force){s.page=page;s.data=s.pages.get(page);render(key,s);return;}s.pending=page;
 box.textContent='Cargando listado…';
 try{const data=await ghAdminRequest_('/listados',{tipo:d.kind,clase:d.clase||'',...f,cursor:s.cursors[page]||''});if(states.get(key)!==s||s.seq!==seq)return;s.page=page;s.data=data;s.pages.set(page,data);s.cursors[page+1]=data.next_cursor;render(key,s);}
 catch(e){if(states.get(key)===s&&s.seq===seq)box.textContent=e.message;}finally{if(s.seq===seq)s.pending=null;}
}
const oldGo=ghGoView,oldEvents=ghRenderEventos;
ghRenderEventos=function(){if(GH_ADMIN_ACCESS.rol==='ADMIN_LOCAL')return oldEvents();};
ghGoView=function(name,options){oldGo(name,options);if(GH_ADMIN_ACCESS.rol==='ADMIN_LOCAL')return;ensure();if(!GH_CITIES.length)ghCargarCiudades().then(()=>Object.keys(defs).forEach(updateCities));
 if(name==='eventos'){load('vip');load('free');}else if(defs[name])load(name);else if(name==='anunciantes')search('anunciantes');else if(name==='suscriptores')search('suscriptores');
};
ghPublicidadLoad101=()=>load('publicidad');ghPublicidadPrepare101=()=>prepare('publicidad');window.ghPromosLoadV91=(force=false)=>load('promos',false,force);window.ghPromosPrepareV91=()=>prepare('promos');
async function search(kind,page=0){
 const advertiser=kind==='anunciantes',box=el(advertiser?'resAnu':'resSus'),params={q:el(advertiser?'qAnu':'qSus').value,ciudad_id:el(advertiser?'anuCiudad':'susCiudad').value,...(!advertiser?{tipo:el('susTipo').value}:{})},signature=JSON.stringify(params);let state=searchStates.get(kind);
 if(!state||state.signature!==signature){state={signature,pages:new Map(),seq:0};searchStates.set(kind,state);}if(state.pending===page)return;state.pending=page;const seq=++state.seq;box.textContent='Cargando…';
 try{const j=state.pages.get(page)||await ghAdminRequest_(advertiser?'/advertisers/search':'/subscribers/search',{...params,offset:page*10,limit:10});if(searchStates.get(kind)!==state||state.seq!==seq)return;state.pages.set(page,j);box.replaceChildren();for(const r of j.results||[]){const item=node('details','','item'),summary=node('summary');summary.append(node('strong',r.nombre||r.mail||r.id||r.suscriptor_id||'Sin nombre'));item.append(summary);const cityIds=r.ciudad_ids||[];const cities=cityIds.map(id=>{const c=GH_CITIES.find(c=>String(c.ciudad_id||c.id)===String(id));return c?.ciudad_visible||c?.nombre||String(id);});const info=advertiser?[r.nivel!==undefined&&r.nivel!==''?'Nivel '+r.nivel:'',cities.join(' / ')].filter(Boolean).join(' · '):r.mail||'';if(info)item.append(node('p',info,'muted'));const actions=node('div','','actions');actions.append(button(advertiser?'Ver ficha y permisos':'Ver ficha',()=>advertiser?detalleAnu(r.id||r.anunciante_id):detalleSus(r.suscriptor_id||r.id)));item.append(actions);box.append(item);}if(!j.results?.length)box.append(node('p','Sin resultados.'));navigation(box,page,j.total??j.results.length,page?()=>search(kind,page-1):null,j.next_offset!==null&&j.next_offset!==undefined?()=>search(kind,page+1):null);informarAltura();}catch(e){if(searchStates.get(kind)===state&&state.seq===seq)box.textContent=e.message;}finally{if(state.seq===seq)state.pending=null;}
}
buscarAnu=()=>search('anunciantes');buscarSus=()=>search('suscriptores');
})();

