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
