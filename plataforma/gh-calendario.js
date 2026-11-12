(function(){
'use strict';
const requests=new Map();
const el=id=>document.getElementById(id);
const localDay=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
const dateLabel=raw=>raw.split('-').reverse().join('/');
async function get(path,force=false){
 const key=localDay()+':'+path;if(force)requests.delete(key);
 if(!requests.has(key))requests.set(key,(async()=>{const r=await fetch(TERRITORY_API_ORIGIN+path,{headers:{Authorization:'Bearer '+TOKEN}});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'No se pudo consultar.');return j;})().catch(e=>{requests.delete(key);throw e;}));
 return requests.get(key);
}
function birthdays(data){
 const box=el('ghBirthdayContent');if(!box)return;
 if(data?.periodo_dias!==7){el('ghBirthdayPrepare').hidden=true;box.textContent='Falta activar la versión del listado general diario. La versión anterior devuelve otro resumen.';return;}
 el('ghBirthdayPrepare').hidden=!!data?.preparado;
 if(!data?.preparado){box.textContent='El listado general diario todavía no está preparado. No se consultan cuentas al abrir esta pantalla.';return;}
 box.replaceChildren();
 const range=document.createElement('p');range.textContent=dateLabel(data.desde)+' al '+dateLabel(data.hasta);box.appendChild(range);
 if(!data.results?.length){const empty=document.createElement('p');empty.textContent='No hay cumpleaños en estos siete días dentro de la copia diaria.';box.appendChild(empty);}
 for(const person of data.results||[]){const row=document.createElement('div');row.className='item';row.textContent=dateLabel(person.fecha)+' · '+(person.nombre||person.suscriptor_id);box.appendChild(row);}
 if(data.preparado_en){const updated=document.createElement('p');updated.className='muted';updated.textContent='Listado general preparado: '+new Date(data.preparado_en).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'});box.appendChild(updated);}
 window.informarAltura?.();
}
window.ghCalendarDashboardV83=function(data){el('ghBirthdaySummary').hidden=GH_ADMIN_ACCESS.rol==='ADMIN_LOCAL';birthdays(data);};
window.ghBirthdayRefreshV83=async function(){try{birthdays(await get('/superadmin/birthdays',true));}catch(e){el('ghBirthdayContent').textContent=e.message;}};
window.ghBirthdayPrepareV83=async function(){
 const btn=el('ghBirthdayPrepare');btn.disabled=true;el('ghBirthdayContent').textContent='Preparando el resumen de las cuentas existentes…';
 try{let j,cursor;do{const r=await fetch(TERRITORY_API_ORIGIN+'/superadmin/birthdays/prepare',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},body:JSON.stringify({cursor})});j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'No se pudo preparar el resumen.');cursor=j.cursor;}while(j.continuar);requests.clear();birthdays(j);}catch(e){el('ghBirthdayContent').textContent=e.message;}finally{btn.disabled=false;window.informarAltura?.();}
};
window.ghCalendarOpenV83=async function(force=false){
 const box=el('ghEphemeridesList'),select=el('ghEphemeridesCity');
 try{
  if(!GH_CITIES.length)await ghCargarCiudades();
  if(select.options.length===1){select.innerHTML='<option value="">Todas las ciudades</option>'+GH_CITIES.map(c=>'<option value="'+esc(c.ciudad_id||c.id)+'">'+esc(c.ciudad_visible||c.nombre||c.ciudad_id||c.id)+'</option>').join('');}
  box.textContent='Consultando efemérides…';const city=select.value;
  const data=await get('/superadmin/ephemerides/upcoming'+(city?'?ciudad_id='+encodeURIComponent(city):''),force);
  if(select.value!==city)return;
  box.innerHTML='<p>'+esc(dateLabel(data.desde))+' al '+esc(dateLabel(data.hasta))+'</p>'+(data.incompleto?'<p class="error">La caché territorial está incompleta. Este listado puede omitir efemérides; no significa que no existan.</p>':'')+(data.results.length?data.results.map(x=>'<div class="item"><strong>'+esc(dateLabel(x.fecha))+' · '+esc(x.nombre)+'</strong><div class="muted">'+esc(x.tipo)+(x.ciudad_id?' · '+esc(x.ciudad_id):x.provincia_id?' · '+esc(x.provincia_id):'')+'</div><p>'+esc(x.descripcion)+'</p></div>').join(''):data.incompleto?'<p>No hay coincidencias en la parte disponible.</p>':'<p>No hay efemérides para este período.</p>');
 }catch(e){box.textContent=e.message;}finally{window.informarAltura?.();}
};
})();

