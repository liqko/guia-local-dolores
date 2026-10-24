/* Visor detenido: no consultas automáticas ni manuales. */
const message=document.getElementById('message');if(message)message.textContent='Medidor retirado: su costo propio no estaba verificado. Esta página no consulta registros.';
for(const id of ['refresh','more','live']){const e=document.getElementById(id);if(e){e.disabled=true;if(id==='live')e.checked=false;}}
