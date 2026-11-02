(function(root){
 'use strict';
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 function section(row){
  const code=normalize([row.modulo,row.ubicacion_id,row.nombre_visible,row.nombre].filter(Boolean).join(' '));
  if(/PROMO/.test(code))return '';
  if(/GUIA|ANUNCIANTE|COMERCIO/.test(code))return 'Guía';
  if(/ACTIVIDAD/.test(code))return 'Actividades';
  if(/EVENTO/.test(code))return 'Eventos';
  return '';
 }
 function date(value){try{return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}}
 function validate(c){
  if(c.reglas_version!==147)return;
  if(!Number.isSafeInteger(c.posiciones)||c.posiciones<1)throw Error('Indicá al menos una posición publicitaria.');
  if(!Number.isSafeInteger(c.activas_max)||c.activas_max<0)throw Error('Indicá un máximo válido de piezas activas.');
  if(!['TRIMESTRAL','DIARIA'].includes(c.modalidad))throw Error('Elegí contratación trimestral o excepción por día.');
  if(!date(c.vigente_desde)||!date(c.vigente_hasta)||c.vigente_hasta<c.vigente_desde)throw Error('Completá las fechas de inicio y fin de la contratación.');
  if(c.modalidad==='DIARIA'&&!String(c.excepcion_motivo||'').trim())throw Error('Indicá el motivo de la contratación excepcional por día.');
  if(String(c.excepcion_motivo||'').length>500)throw Error('El motivo admite hasta 500 caracteres.');
  if(!['CIUDADES','TODAS'].includes(c.cobertura_tipo))throw Error('Elegí la cobertura geográfica.');
  if(!Array.isArray(c.ciudades_ids)||(c.cobertura_tipo==='CIUDADES'&&!c.ciudades_ids.length))throw Error('Seleccioná al menos una ciudad contratada.');
  if(!Array.isArray(c.ubicaciones_ids)||!c.ubicaciones_ids.length)throw Error('Seleccioná al menos una sección (funcionalidad).');
 }
 function days(c){return date(c.vigente_desde)&&date(c.vigente_hasta)?Math.floor((Date.parse(c.vigente_hasta)-Date.parse(c.vigente_desde))/86400000)+1:0;}
 function countryPicker({host,cities,selection,apply}){
  if(!host)return;const groups=new Map();
  for(const city of cities||[]){const country=String(city.pais_id||city.pais||'');if(!country)continue;if(!groups.has(country))groups.set(country,{name:city.pais_visible||city.pais||country,ids:[]});groups.get(country).ids.push(String(city.ciudad_id||city.id));}
  if(!groups.size)return;
  const label=document.createElement('label');label.textContent='Elegir ciudades por país';const select=document.createElement('select');select.add(new Option('Seleccioná un país',''));for(const [id,group]of groups)select.add(new Option(group.name,id));label.append(select);host.append(label);
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Agregar ciudades de este país';button.onclick=()=>{const group=groups.get(select.value);if(group)apply([...new Set([...selection(),...group.ids])]);};host.append(button);
 }
 root.GLD_AD_RULES147={section,validate,days,countryPicker};
})(typeof window!=='undefined'?window:globalThis);
