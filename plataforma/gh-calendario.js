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
 if(!data){box.textContent='Requiere desplegar el Worker B83 para mostrar este resumen.';el('ghBirthdayPrepare').hidden=true;return;}
 el('ghBirthdayPrepare').hidden=data.preparado;
 if(!data.preparado){box.textContent='Resumen todavía sin preparar. La carga inicial lee las cuentas existentes una sola vez; las consultas posteriores usan caché.';return;}
 box.innerHTML='<div class="grid"><div class="stat"><span>Cumpleaños</span><b>'+esc(data.total)+'</b></div><div class="stat"><span>Cumplen 18 o más</span><b>'+esc(data.mayores18)+'</b></div><div class="stat"><span>Cumplen menos de 18</span><b>'+esc(data.menores18)+'</b></div></div><p>'+esc(dateLabel(data.desde))+' al '+esc(dateLabel(data.hasta))+'</p>'+'<details><summary>Ver cantidades por día</summary>'+data.dias.map(d=>'<div class="item">'+esc(dateLabel(d.fecha))+' · '+esc(d.total)+' persona(s)</div>').join('')+'</details>';
 window.informarAltura?.();
}
window.ghCalendarDashboardV83=function(data){el('ghBirthdaySummary').hidden=GH_ADMIN_ACCESS.rol==='ADMIN_LOCAL';birthdays(data);};
window.ghBirthdayRefreshV83=async function(){try{birthdays(await get('/superadmin/birthdays',true));}catch(e){el('ghBirthdayContent').textContent=e.message;}};
window.ghBirthdayPrepareV83=async function(){
 const btn=el('ghBirthdayPrepare');btn.disabled=true;el('ghBirthdayContent').textContent='Preparando el resumen de las cuentas existentes…';
 try{const r=await fetch(TERRITORY_API_ORIGIN+'/superadmin/birthdays/prepare',{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'No se pudo preparar el resumen.');birthdays(j);}catch(e){el('ghBirthdayContent').textContent=e.message;}finally{btn.disabled=false;window.informarAltura?.();}
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
