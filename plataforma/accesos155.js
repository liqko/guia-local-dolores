/* Panel de administración general opens the advertiser panel and identifies its proprietor. */
let GH_ACCESS155=null;
function ghRenderAdvertiserAccess155(data,id){
 if(!['SUPERADMIN_PRINCIPAL','SUPERADMIN'].includes(GH_ADMIN_ACCESS.rol))return;
 GH_ACCESS155={id,data};
 const card=document.createElement('section');card.className='card gh-access155';
 const title=document.createElement('h3');title.textContent='Panel del anunciante';
 const button=document.createElement('button');button.type='button';button.id='ghOpenPanel155';button.textContent='Abrir panel del anunciante';button.onclick=ghOpenAdvertiserPanel155;
 const status=document.createElement('p');status.id='ghAccessStatus155';status.setAttribute('role','status');
 const heading=document.createElement('h3');heading.textContent='Propietario';
 card.append(title,button,status,heading);
 if(Array.isArray(data.propietarios)){
  for(const person of data.propietarios){
   const row=document.createElement('p');row.textContent=[person.nombre,person.mail,person.whatsapp].filter(Boolean).join(' · ')||'Titular registrado sin datos de contacto.';card.append(row);
  }
  if(!data.propietarios.length){const row=document.createElement('p');row.textContent='Sin propietario habilitado.';card.append(row);}
 }else{const row=document.createElement('p');row.textContent='Los datos del propietario estarán disponibles al instalar el Worker actualizado y volver a abrir esta ficha.';card.append(row);}
 if(typeof data.revision_titularidad==='string')ghOwnershipControls155(card,GH_ACCESS155);
 document.getElementById('detalle').prepend(card);
}
async function ghOpenAdvertiserPanel155(){
 const state=GH_ACCESS155;if(!state)return;
 const nonce=crypto.randomUUID(),url=new URL('/plataforma/login.html',location.origin);url.searchParams.set('administracion',nonce);
 const panel=window.open(url.href,'_blank');if(!panel){document.getElementById('ghAccessStatus155').textContent='Permití abrir la pestaña del panel.';return;}
 const status=document.getElementById('ghAccessStatus155');status.textContent='Validando acceso administrativo...';let ready=false,grant=null;
 const send=()=>{if(ready&&grant)panel.postMessage({type:'gld-admin-panel155',nonce,grant},url.origin);};
 const receive=e=>{if(e.source!==panel||e.origin!==url.origin||e.data?.nonce!==nonce)return;if(e.data.type==='gld-admin-ready155'){ready=true;send();}else if(e.data.type==='gld-admin-open159'){status.textContent='Panel abierto como Panel de administración general. Acceso válido durante 30 minutos.';clearTimeout(timer);window.removeEventListener('message',receive);}else if(e.data.type==='gld-admin-error159'){status.textContent=String(e.data.message||'No se pudo abrir el panel.');clearTimeout(timer);window.removeEventListener('message',receive);}};
 window.addEventListener('message',receive);const timer=setTimeout(()=>window.removeEventListener('message',receive),60000);
 try{grant=await ghAdminRequest_('/advertisers/'+encodeURIComponent(state.id)+'/panel-access',{},'POST');send();status.textContent='Acceso autorizado. Abriendo el panel del anunciante…';}catch(e){status.textContent=e.message;panel.close();clearTimeout(timer);window.removeEventListener('message',receive);}
}

function ghOwnershipControls155(card,state){
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Administrar titularidad';details.append(summary);
 const status=document.createElement('p');status.setAttribute('role','status');
 const list=document.createElement('div'),search=document.createElement('input'),find=document.createElement('button'),results=document.createElement('div');
 search.type='email';search.placeholder='Correo electrónico del nuevo titular';search.setAttribute('aria-label','Correo electrónico del titular');find.type='button';find.textContent='Buscar usuario';
 details.append(list,search,find,results,status);card.append(details);
 let busy=false,seq=0;
 const live=()=>GH_ACCESS155===state&&card.isConnected;
 const role=row=>String(row.rol||'').toUpperCase();
 const ownerRows=()=>state.data.relaciones.filter(row=>role(row)==='PROPIETARIO'&&row.activo===true);
 const names=new Map((state.data.propietarios||[]).map(p=>[String(p.suscriptor_id),[p.nombre,p.mail].filter(Boolean).join(' · ')]));
 const label=sid=>names.get(String(sid))||String(sid);
 async function save(sid,active,person){
  if(busy||!live())return;
  const matches=state.data.relaciones.filter(r=>String(r.suscriptor_id)===String(sid));
  if(matches.length>1){status.textContent='Hay vínculos duplicados. Requieren revisión antes de modificar titularidad.';return;}
  const row=matches[0],owners=ownerRows();
  const message=active?(owners.length?'Confirmá asignar la titularidad exclusiva a ':'Confirmá asignar la titularidad a ')+person+'. Se conservarán las delegaciones existentes.':'Confirmá revocar la titularidad de '+person+'. El anuncio conservará su información y permisos delegados.';
  if(!window.confirm(message))return;
  busy=true;status.textContent='Guardando titularidad…';
  try{
   await ghAdminRequest_('/advertisers/'+encodeURIComponent(state.id)+'/responsables',{suscriptor_id:sid,rol:'PROPIETARIO',activo:active,revision:row?.revision||state.data.revision_vinculo_nuevo,revision_titularidad:state.data.revision_titularidad},'POST');
   if(live()){status.textContent='Titularidad guardada. Actualizando ficha…';await detalleAnu(state.id);}
  }catch(error){if(live())status.textContent=error.message;}finally{busy=false;}
 }
 for(const row of ownerRows()){
  const p=document.createElement('p');p.textContent=label(row.suscriptor_id)+' ';
  const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revocar titularidad';revoke.onclick=()=>save(row.suscriptor_id,false,label(row.suscriptor_id));p.append(revoke);list.append(p);
 }
 if(ownerRows().length>1){const note=document.createElement('p');note.textContent='Existen varios titulares históricos. Asigná expresamente un único propietario para corregirlos.';list.prepend(note);}
 find.onclick=async()=>{
  if(busy||!live())return;
  const q=search.value.trim().toLowerCase(),ticket=++seq;
  if(!q||!search.checkValidity()){status.textContent='Ingresá el correo completo del usuario.';return;}
  results.replaceChildren();status.textContent='Buscando…';
  try{
   const data=await ghAdminRequest_('/advertisers/'+encodeURIComponent(state.id)+'/responsables',{q});
   if(!live()||ticket!==seq)return;
   const rows=(data.results||[]).filter(p=>String(p.mail||'').trim().toLowerCase()===q&&p.activo!==false);
   if(rows.length!==1){status.textContent=rows.length?'El correo tiene varias coincidencias. Revisá el registro.':'No se encontró un usuario activo con ese correo.';return;}
   const p=rows[0],sid=String(p.suscriptor_id||p.id||'');if(!sid){status.textContent='El registro no tiene identificador válido.';return;}
   const person=[p.nombre,p.mail].filter(Boolean).join(' · '),button=document.createElement('button');button.type='button';button.textContent='Asignar titularidad a '+person;button.onclick=()=>save(sid,true,person);results.append(button);status.textContent='';
  }catch(error){if(live()&&ticket===seq)status.textContent=error.message;}
 };
}
