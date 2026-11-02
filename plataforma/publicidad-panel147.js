'use strict';
let pubContenidoActual147=null;
const pubContenidoCargas147=new Map();
async function pubTagsPerfil147(){
 const notice=document.getElementById('pub-tags-perfil-notice'),button=document.getElementById('pub-tags-perfil');
 button.disabled=true;
 try{
  // The profile is loaded only on request, through its existing panel route.
  let input=document.querySelector('#form-datos-comercio [name="tags"]');
  if(!input){if(!await loadCommerceUI())throw Error('No se pudo consultar el perfil.');input=document.querySelector('#form-datos-comercio [name="tags"]');}
  const tags=pubTags107(input?.value||'');
  if(!tags.length){notice.textContent='Completá los tags de tu perfil: están incluidos en tu plan, sin costo adicional. También podés cargar tags específicos para esta campaña.';return;}
  document.getElementById('pub-tags').value=tags.join(', ');pubUiTags107();
  notice.textContent='Se tomaron los tags del perfil. Podés ajustarlos para esta campaña; el perfil no se modifica.';
 }catch(e){notice.textContent=e.message;}finally{button.disabled=false;}
}
function pubContenidoRows147(type){return type==='EVENTO'?(window.__lastEvents||[]):(actividadesState.actividades||[]);}
async function pubContenidoCargar147(type){
 const notice=document.getElementById('pub-contenido-notice');
 try{
  if(!pubContenidoCargas147.has(type)){
   const available=type==='EVENTO'?(window.__lastEvents||[]).length>0:actividadesState.loaded;
   if(!available){
    const task=window.loadDashboardModule147(type==='EVENTO'?'eventos':'actividades').then(()=>{const okay=type==='EVENTO'?Array.isArray(window.__lastEvents):actividadesState.loaded;if(!okay)throw Error('No se pudo cargar el contenido.');}).catch(e=>{pubContenidoCargas147.delete(type);throw e;});
    pubContenidoCargas147.set(type,task);
   }
  }
  await pubContenidoCargas147.get(type);
  if(document.getElementById('pub-cta-tipo').value!==type)return;
  pubContenidoFiltrar147();notice.textContent='Elegí un contenido propio. La publicidad lo abrirá directamente; la pieza visual se carga por separado.';
 }catch(e){notice.textContent=e.message;}
}
function pubContenidoFiltrar147(){
 const type=document.getElementById('pub-cta-tipo').value,select=document.getElementById('pub-contenido'),query=document.getElementById('pub-contenido-buscar').value.toLocaleLowerCase('es');
 const previous=select.value||((pubContenidoActual147?.tipo===type)?pubContenidoActual147.id:'');
 select.replaceChildren(new Option('Seleccioná el contenido',''));
 for(const row of pubContenidoRows147(type)){
  const id=String(type==='EVENTO'?row.evento_id||row.id:row.actividad_id||row.id),name=String(row.nombre_evento||row.nombre||row.actividad||id);
  if(query&&!name.toLocaleLowerCase('es').includes(query)&&id!==previous)continue;
  const option=new Option(name,id);select.add(option);
 }
 select.value=previous;pubContenidoSeleccionar147();
}
function pubContenidoSeleccionar147(){
 const type=document.getElementById('pub-cta-tipo').value,id=document.getElementById('pub-contenido').value;
 if(id)pubContenidoActual147={tipo:type,id};
}
async function pubDesdeContenido147(type,id){
 if(!id){alert('Guardá primero el evento o la actividad para poder vincular su publicidad.');return;}
 const tab=document.getElementById('tab-publicidad');
 if(!tab||tab.disabled||tab.hidden||tab.style.display==='none'){alert('Para sumar publicidad necesitás tener el servicio habilitado y una contratación vigente. Consultá al vendedor por una campaña trimestral o una excepción por día.');return;}
 tab.click();
 // Reuse the dashboard's single loading promise instead of sending a second request.
 await window.loadDashboardModule147('publicidad');
 if(!publicidadState.loaded)return;
 pubUiReset_();pubContenidoActual147={tipo:type,id:String(id)};
 document.getElementById('pub-cta-tipo').value=type;pubUiDestination_();
 await pubContenidoCargar147(type);
 const source=pubContenidoRows147(type).find(row=>String(row.evento_id||row.actividad_id||row.id)===String(id));
 if(source){document.getElementById('pub-titulo').value=String(source.nombre_evento||source.nombre||source.actividad||'').slice(0,100);document.getElementById('pub-cta-texto').value=type==='EVENTO'?'Ver evento':'Ver actividad';}
 document.getElementById('publicidad-form-card').scrollIntoView({block:'start'});
}
