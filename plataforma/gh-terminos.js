let GH_TERMS_PROOF=null;
async function ghCargarTerminos(){
 const msg=document.getElementById('ghTerminosMsg');msg.textContent='Cargando términos…';
 try{const j=await ghAdminRequest_('/advertiser-terms');document.getElementById('ghTerminosTitulo').value=j.actual.titulo;document.getElementById('ghTerminosTexto').value=j.actual.contenido;document.getElementById('ghTerminosVersion').textContent='Versión vigente: '+j.actual.version;document.getElementById('ghTerminosHistorial').innerHTML=(j.historial||[]).map(x=>'<p><a target="_blank" rel="noopener" href="/plataforma/terminos-anunciantes.html?version='+encodeURIComponent(x.version)+'">'+esc(x.version)+' · Ver texto de esta versión</a></p>').join('');msg.textContent='Las versiones publicadas se conservan. Editar este borrador no cambia los términos vigentes.';}
 catch(e){msg.textContent=e.message;}informarAltura();
}
async function ghPublicarTerminos(){
 if(!confirm('¿Publicar esta nueva versión? Se conservará la anterior y los anunciantes deberán aceptar los términos actualizados.'))return;
 const button=document.getElementById('ghTerminosPublicar'),msg=document.getElementById('ghTerminosMsg');button.disabled=true;
 try{const j=await ghAdminRequest_('/advertiser-terms',{action:'publicar',titulo:document.getElementById('ghTerminosTitulo').value,contenido:document.getElementById('ghTerminosTexto').value},'POST');await ghCargarTerminos();msg.textContent=j.sin_cambios?'El texto no cambió. Se mantiene la versión vigente, sin pedir otra aceptación.':j.message;}
 catch(e){msg.textContent=e.message;}finally{button.disabled=false;informarAltura();}
}
async function ghVerAceptacionesTerminos(){
 const id=document.getElementById('ghTerminosSuscriptor').value.trim(),box=document.getElementById('ghTerminosRegistro');if(!id){box.textContent='Indicá el ID de la cuenta del suscriptor.';return;}
 box.textContent='Buscando registro…';GH_TERMS_PROOF=null;document.getElementById('ghTerminosDescargar').hidden=true;
 try{const j=await ghAdminRequest_('/advertiser-terms',{suscriptor_id:id});GH_TERMS_PROOF=j;box.textContent=j.registros.length?JSON.stringify(j,null,2):'Esta cuenta no tiene aceptaciones registradas.';document.getElementById('ghTerminosDescargar').hidden=!j.registros.length;}
 catch(e){box.textContent=e.message;}informarAltura();
}
function ghDescargarAceptacionesTerminos(){
 if(!GH_TERMS_PROOF)return;const blob=new Blob([JSON.stringify(GH_TERMS_PROOF,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Aceptacion_terminos_'+GH_TERMS_PROOF.suscriptor_id.replace(/[^A-Za-z0-9_-]/g,'')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
