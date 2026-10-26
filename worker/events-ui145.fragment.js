// Uses the territory already loaded by both event forms; no network requests.
let eventScopeAdvertiserCity145='';
const eventScopeState145={};
function eventScopeRead145(prefix){
 const mode=evGet(prefix+'-scope-mode')||'CIUDAD';
 const scope={version:1,modo:mode};
 if(mode==='CIUDAD')scope.ciudad_id=evGet(prefix+'-scope-city');
 if(mode==='CIUDADES')scope.ciudades=Array.from(document.getElementById(prefix+'-scope-cities')?.selectedOptions||[]).map(o=>o.value).sort();
 if(mode==='PAIS'||mode==='PROVINCIA')scope.pais_id=evGet(prefix+'-scope-country');
 if(mode==='PROVINCIA')scope.provincia_id=evGet(prefix+'-scope-province');
 return scope;
}
function eventScopeRender145(prefix,scope=eventScopeState145[prefix]){
 const box=document.getElementById(prefix+'-scope-box');if(!box)return;
 scope ||= {version:1,modo:'CIUDAD',ciudad_id:eventScopeAdvertiserCity145};
 eventScopeState145[prefix]=scope;
 const mode=document.getElementById(prefix+'-scope-mode');mode.value=scope.modo;
 const cities=(evLists.ciudades||[]).filter(c=>String(c.ciudad_id||'')!=='VIRTUAL');
 const one=document.getElementById(prefix+'-scope-city'),many=document.getElementById(prefix+'-scope-cities'),country=document.getElementById(prefix+'-scope-country'),province=document.getElementById(prefix+'-scope-province');
 function fill(select,rows,valueKey,labelKey,chosen,multiple=false){
  select.replaceChildren();if(!multiple)select.add(new Option('Seleccioná una opción',''));
  for(const row of rows){const val=String(row[valueKey]||'').trim();if(!val)continue;const option=new Option(String(row[labelKey]||val),val);option.selected=multiple?(chosen||[]).includes(val):val===chosen;select.add(option);}
 }
 if(scope.modo==='CIUDAD')fill(one,cities,'ciudad_id','ciudad_visible',scope.ciudad_id||eventScopeAdvertiserCity145);
 if(scope.modo==='CIUDADES')fill(many,cities,'ciudad_id','ciudad_visible',scope.ciudades||[],true);
 const countries=[...new Map(cities.filter(c=>c.pais_id).map(c=>[c.pais_id,{id:c.pais_id,nombre:c.pais_visible||c.pais||c.pais_id}])).values()];
 fill(country,countries,'id','nombre',scope.pais_id||'');
 const provinces=[...new Map(cities.filter(c=>c.pais_id===scope.pais_id&&c.provincia_id).map(c=>[c.provincia_id,{id:c.provincia_id,nombre:c.provincia_visible||c.provincia||c.provincia_id}])).values()];
 fill(province,provinces,'id','nombre',scope.provincia_id||'');
 for(const [id,show]of [['city',scope.modo==='CIUDAD'],['cities',scope.modo==='CIUDADES'],['country',['PAIS','PROVINCIA'].includes(scope.modo)],['province',scope.modo==='PROVINCIA']])document.getElementById(prefix+'-scope-'+id+'-wrap').hidden=!show;
 box.hidden=eventModeValue_(prefix)!=='VIRTUAL'&&!(prefix==='ev'&&readEventProgramacionFromUI_().some(p=>p.ciudad_id==='VIRTUAL'));
 gldRefreshAllSearchableSelects_();
}
function eventScopeLoad145(prefix,row={}){
 const virtual=eventModeFromRow_(row)==='VIRTUAL'||row.ciudad_id==='VIRTUAL'||(row.programacion||[]).some(p=>p.ciudad_id==='VIRTUAL');
 eventScopeRender145(prefix,row.alcance_publicacion||(virtual&&row.evento_id?{version:1,modo:'TODAS'}:{version:1,modo:'CIUDAD',ciudad_id:eventScopeAdvertiserCity145}));
}
function eventScopeMount145(prefix,anchor){
 const box=document.createElement('div');box.id=prefix+'-scope-box';box.className='full';box.hidden=true;
 box.innerHTML=`<label for="${prefix}-scope-mode">Dónde mostrar el evento virtual</label><select data-event-scope-selector disabled id="${prefix}-scope-mode"><option value="CIUDAD">Una ciudad · inicialmente la del anunciante</option><option value="CIUDADES">Elegir ciudades manualmente</option><option value="PROVINCIA">Una provincia</option><option value="PAIS">Un país</option><option value="TODAS">Todas las ciudades de todos los países</option></select><div id="${prefix}-scope-city-wrap"><label>Ciudad de publicación</label><select data-event-scope-selector disabled id="${prefix}-scope-city"></select></div><div id="${prefix}-scope-cities-wrap" hidden><label>Ciudades de publicación · hasta 500</label><select data-event-scope-selector disabled multiple size="6" id="${prefix}-scope-cities"></select></div><div id="${prefix}-scope-country-wrap" hidden><label>País</label><select data-event-scope-selector disabled id="${prefix}-scope-country"></select></div><div id="${prefix}-scope-province-wrap" hidden><label>Provincia</label><select data-event-scope-selector disabled id="${prefix}-scope-province"></select></div><div class="events-small">Define en qué guías aparece. La ubicación del evento sigue siendo virtual. Provincia y país incluyen sus ciudades actuales y las que se incorporen después. Los eventos anteriores conservan su alcance hasta que lo cambies.</div>`;
 anchor.after(box);
 box.addEventListener('change',e=>{
  eventScopeState145[prefix]=eventScopeRead145(prefix);
  if(e.target.id===prefix+'-scope-mode'||e.target.id===prefix+'-scope-country')eventScopeRender145(prefix);
 });
}
