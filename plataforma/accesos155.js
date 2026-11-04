/* General administration. Uses already loaded relationships; searches only on request. */
let GH_ACCESS155=null,GH_ACCESS_SEARCH155=0;
function ghRenderAdvertiserAccess155(data,id){
 if(!['SUPERADMIN_PRINCIPAL','SUPERADMIN'].includes(GH_ADMIN_ACCESS.rol))return;
 if(!data.revision_vinculo_nuevo){const note=document.createElement('p');note.className='notice';note.textContent='El acceso al panel y la gestión de responsables se habilitan al instalar el Worker 158 y volver a abrir esta ficha.';document.getElementById('detalle').prepend(note);return;}
 GH_ACCESS155={id,data};
 const card=document.createElement('details');card.className='card gh-access155';card.open=true;
 card.innerHTML='<summary><b>Acceso al panel y responsables</b></summary><p>Entrá como Gran Hermano para editar la ficha, dirección, web y contenidos. La cuenta del anunciante conserva su contraseña.</p><button type="button" id="ghOpenPanel155">Abrir panel del anunciante</button><div id="ghAccessStatus155" role="status"></div><h3>Personas autorizadas</h3><div id="ghRelations155"></div><h3>Asignar o modificar responsable</h3><label>Buscar usuario registrado por nombre, correo o ID<input id="ghUserQuery155" type="search"></label><button type="button" id="ghUserSearch155">Buscar usuario</button><div id="ghUserResults155"></div><form id="ghRelationForm155" hidden><p id="ghSelectedUser155"></p><label>Rol<select id="ghRole155"><option value="PROPIETARIO">Propietario</option><option value="ADMINISTRADOR">Administrador / coadministrador</option><option value="MANAGER">Manager</option></select></label><p>Propietario y administrador gestionan la ficha y las funciones habilitadas. El manager usa solamente las funciones seleccionadas y no modifica los datos de la ficha.</p><div id="ghManagerFunctions155" class="checks vertical-checks"></div><div class="checks"><label><input type="checkbox" id="ghRelationActive155" checked> Acceso habilitado</label></div><button type="submit">Guardar responsable y permisos</button><div id="ghRelationStatus155" role="status"></div></form>';
 document.getElementById('detalle').prepend(card);
 const list=card.querySelector('#ghRelations155');
 for(const rel of data.relaciones||[]){const row=document.createElement('div');row.className='card';const label=document.createElement('p');label.textContent=rel.suscriptor_id+' · '+rel.rol+' · '+(rel.activo?'Habilitado':'Deshabilitado')+(rel.permisos?' · '+rel.permisos:'');row.appendChild(label);const edit=document.createElement('button');edit.textContent='Editar permisos';edit.onclick=()=>ghSelectResponsible155({suscriptor_id:rel.suscriptor_id,nombre:rel.suscriptor_id});row.appendChild(edit);const recover=document.createElement('button');recover.textContent='Recuperar acceso de esta persona';recover.onclick=()=>{ghGoView('suscriptores');detalleSus(rel.suscriptor_id);};row.appendChild(recover);list.appendChild(row);}
 if(!data.relaciones?.length)list.textContent='Sin responsables asignados.';
 card.querySelector('#ghOpenPanel155').onclick=ghOpenAdvertiserPanel155;
 card.querySelector('#ghUserSearch155').onclick=async()=>{
  const q=card.querySelector('#ghUserQuery155').value.trim(),box=card.querySelector('#ghUserResults155');if(!q){box.textContent='Escribí un nombre, correo o ID.';return;}
  const seq=++GH_ACCESS_SEARCH155;box.textContent='Buscando...';try{const j=await api('buscar_suscriptores',{q,limit:30});if(seq!==GH_ACCESS_SEARCH155||GH_ACCESS155?.id!==id)return;box.replaceChildren();for(const s of j.results||[]){const b=document.createElement('button');b.type='button';b.textContent=(s.nombre||s.suscriptor_id)+' · '+(s.mail||'')+' · '+s.suscriptor_id;b.onclick=()=>ghSelectResponsible155(s);box.appendChild(b);}if(!box.children.length)box.textContent='No hay usuarios registrados que coincidan.';}catch(e){box.textContent=e.message;}
 };
 card.querySelector('#ghRole155').onchange=()=>{card.querySelector('#ghManagerFunctions155').hidden=card.querySelector('#ghRole155').value!=='MANAGER';};
 card.querySelector('#ghRelationForm155').onsubmit=async e=>{
  e.preventDefault();const button=e.submitter,status=card.querySelector('#ghRelationStatus155'),state=GH_ACCESS155;if(!state?.selected)return;button.disabled=true;status.textContent='Guardando...';
  try{const result=await ghAdminRequest_('/advertisers/'+encodeURIComponent(id)+'/responsables',{suscriptor_id:state.selected.suscriptor_id,rol:card.querySelector('#ghRole155').value,activo:card.querySelector('#ghRelationActive155').checked,permisos:[...card.querySelectorAll('[data-manager155]:checked')].map(x=>x.value),revision:state.selected.revision},'POST');status.textContent=result.message||'Permisos guardados.';await detalleAnu(id);}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 };
}
function ghSelectResponsible155(s){
 const state=GH_ACCESS155;if(!state)return;const rel=(state.data.relaciones||[]).find(r=>r.suscriptor_id===s.suscriptor_id);
 state.selected={...s,revision:rel?.revision||state.data.revision_vinculo_nuevo};
 document.getElementById('ghSelectedUser155').textContent=(s.nombre||s.suscriptor_id)+' · '+(s.mail||'')+' · '+s.suscriptor_id;
 const role=document.getElementById('ghRole155');role.value=rel?.rol==='COADMINISTRADOR'?'ADMINISTRADOR':rel?.rol||'MANAGER';document.getElementById('ghRelationActive155').checked=rel?rel.activo:true;
 const raw=state.data.administracion?.funcionalidades,functions=Array.isArray(raw)?raw:String(raw||'').split(/[;,|\n]/),selected=String(rel?.permisos||'').split(/[;,|\n]/).map(x=>x.trim());
 const box=document.getElementById('ghManagerFunctions155');box.replaceChildren();for(const f of functions.map(x=>String(x).trim().toUpperCase()).filter(Boolean)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.manager155='';input.value=f;input.checked=selected.includes(f);label.append(input,document.createTextNode(' '+f));box.appendChild(label);}box.hidden=role.value!=='MANAGER';document.getElementById('ghRelationForm155').hidden=false;
}
async function ghOpenAdvertiserPanel155(){
 const state=GH_ACCESS155;if(!state)return;
 const nonce=crypto.randomUUID(),url=new URL('login.html',location.href);url.searchParams.set('administracion',nonce);
 const panel=window.open(url.href,'_blank');if(!panel){document.getElementById('ghAccessStatus155').textContent='Permití abrir la pestaña del panel.';return;}
 const status=document.getElementById('ghAccessStatus155');status.textContent='Validando acceso administrativo...';let ready=false,grant=null;
 const send=()=>{if(ready&&grant)panel.postMessage({type:'gld-admin-panel155',nonce,grant},url.origin);};
 const receive=e=>{if(e.source!==panel||e.origin!==url.origin||e.data?.nonce!==nonce||e.data.type!=='gld-admin-ready155')return;ready=true;send();};
 window.addEventListener('message',receive);const timer=setTimeout(()=>window.removeEventListener('message',receive),60000);
 try{grant=await ghAdminRequest_('/advertisers/'+encodeURIComponent(state.id)+'/panel-access',{},'POST');send();status.textContent='Panel abierto como Gran Hermano. Acceso válido durante 30 minutos.';}catch(e){status.textContent=e.message;panel.close();clearTimeout(timer);window.removeEventListener('message',receive);}
}
function ghRenderSubscriberRecovery155(data,id){
 if(!['SUPERADMIN_PRINCIPAL','SUPERADMIN'].includes(GH_ADMIN_ACCESS.rol)||!data.revision_acceso)return;
 const form=document.createElement('form');form.className='card gh-access155';form.innerHTML='<h3>Recuperar acceso</h3><p>Restablece la contraseña de esta persona y cierra sus sesiones anteriores. Entregá la nueva clave al titular por un canal verificado.</p><label>Nueva contraseña<input type="password" name="password" autocomplete="new-password" minlength="10" maxlength="200" required></label><label>Repetir contraseña<input type="password" name="confirm" autocomplete="new-password" required></label><label>Motivo y verificación del titular<textarea rows="4" name="reason" minlength="10" maxlength="1000" required></textarea></label><button type="submit">Restablecer contraseña y cerrar sesiones anteriores</button><p role="status"></p>';
 form.onsubmit=async e=>{e.preventDefault();const fields=form.elements,status=form.querySelector('[role=status]');if(fields.password.value!==fields.confirm.value){status.textContent='Las contraseñas no coinciden.';return;}e.submitter.disabled=true;try{const result=await ghAdminRequest_('/subscribers/'+encodeURIComponent(id)+'/reset-access',{nueva_clave:fields.password.value,motivo:fields.reason.value,revision:data.revision_acceso},'POST');form.reset();status.textContent=result.message;}catch(error){status.textContent=error.message;}finally{e.submitter.disabled=false;}};
 document.getElementById('detalleSuscriptor').appendChild(form);
}
