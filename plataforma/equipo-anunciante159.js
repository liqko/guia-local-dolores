/* Delegation belongs to the proprietor. No requests before opening this section. */
(function(){
 'use strict';
 const role=v=>String(v||'').trim().toUpperCase().replace('COADMINISTRADOR','ADMINISTRADOR');
 const split=v=>[...new Set((Array.isArray(v)?v:String(v||'').split(/[;,|\n]/)).map(x=>String(x).trim().toUpperCase()).filter(Boolean))].sort();
 const labels={PUBLICIDAD:'Publicidad',EMPLEO:'Empleo y oportunidades',EVENTOS:'Eventos',EVENTOS_FREE:'Eventos Free',EV_FREE:'Eventos Free',PROMOS:'Promos',ACTIVIDADES:'Actividades',FARMACIAS:'Farmacias de turno',FARMACIA:'Farmacias de turno',TURNOS_FARMA:'Farmacias de turno',EFEMERIDES:'Efemérides',EF_LOCAL:'Efemérides locales',EF_GENERAL:'Efemérides generales',MENU:'Menú',ENTRADAS:'Entradas',RESERVAS:'Reservas',VOUCHERS:'Vouchers',GIFCARDS:'Gifcards',TARJETA_NFC:'NFC',MODIFICAR_DATOS:'Información del anuncio'};
 let context=null,generation=0,loaded=false,pending=false,rows=[],functions=[],revisionNew='',selected=null,searchSeq=0;
 const box=()=>document.getElementById('equipo-contenido159');
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const personText=person=>[person?.nombre,person?.mail].filter(Boolean).join(' · ')||'Usuario registrado sin nombre o correo disponible';
 async function request(path,body,query){
  const current=context,u=new URL('/commerce/team'+path,current.base);u.searchParams.set('advertiserId',current.aid);if(query)u.searchParams.set('q',query);
  const headers=new Headers(current.headers());if(body)headers.set('Content-Type','application/json');
  const response=await fetch(u.href,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify({...body,advertiserId:current.aid})}:{})});
  const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||data.error||'No se pudo completar la operación.');return data;
 }
 function renderList(){
  const list=document.getElementById('equipo-lista159');list.replaceChildren();
  for(const row of rows){
   const card=el('div');card.className='card';const name=el('p',personText(row.persona));card.append(name,el('p',(role(row.rol)==='PROPIETARIO'?'Propietario':role(row.rol)==='ADMINISTRADOR'?'Administrador':'Manager')+' · '+(row.activo?'Habilitado':'Deshabilitado')));
   if(role(row.rol)!=='PROPIETARIO'){const edit=el('button','Editar permisos');edit.type='button';edit.onclick=()=>select(row.persona,row);card.append(edit);}list.append(card);
  }
  if(!rows.length)list.append(el('p','No hay personas vinculadas.'));
 }
 function permissionOptions(){
  const area=document.getElementById('equipo-funciones159'),chosen=new Set([...area.querySelectorAll('input:checked')].map(x=>x.value));area.replaceChildren();
  const selectedRole=document.getElementById('equipo-rol159').value;
  for(const value of [...new Set([...functions,...(selectedRole==='ADMINISTRADOR'?['MODIFICAR_DATOS']:[])])].filter(x=>x!=='MODIFICAR_DATOS'||selectedRole==='ADMINISTRADOR')){
   const label=el('label'),input=el('input');input.type='checkbox';input.value=value;input.checked=chosen.has(value);label.append(input,document.createTextNode(' '+(labels[value]||value)));area.append(label);
  }
 }
 function select(person,row){
  selected={person,row};const form=document.getElementById('equipo-form159');form.hidden=false;
  document.getElementById('equipo-persona159').textContent=personText(person);
  document.getElementById('equipo-rol159').value=role(row?.rol)==='ADMINISTRADOR'?'ADMINISTRADOR':'MANAGER';
  document.getElementById('equipo-activo159').checked=row?row.activo:true;
  document.getElementById('equipo-funciones159').replaceChildren();permissionOptions();
  const granted=new Set(split(row?.permisos));if(row&&role(row.rol)==='ADMINISTRADOR'&&row.permisos_definidos!==true)granted.add('MODIFICAR_DATOS');
  document.querySelectorAll('#equipo-funciones159 input').forEach(input=>{input.checked=granted.has(input.value);});
  document.getElementById('equipo-resultado159').textContent='';
 }
 function render(){
  const root=box();root.innerHTML='<p>Solo el propietario asigna estos permisos. El administrador puede usar las funciones que le otorgues; el manager no puede modificar la información del anuncio. Ninguno puede borrar el anunciante ni delegar permisos.</p><div id="equipo-lista159"></div><label>Correo electrónico de la persona registrada<input id="equipo-buscar159" type="email" autocomplete="off"></label><button id="equipo-boton-buscar159" type="button">Buscar usuario</button><div id="equipo-busqueda159" role="status"></div><form id="equipo-form159" hidden><p id="equipo-persona159"></p><label>Rol<select id="equipo-rol159"><option value="ADMINISTRADOR">Administrador</option><option value="MANAGER">Manager</option></select></label><fieldset><legend>Funciones autorizadas</legend><div id="equipo-funciones159" class="checks vertical-checks"></div></fieldset><label><input id="equipo-activo159" type="checkbox" checked> Acceso habilitado</label><button type="submit">Guardar permisos</button><button id="equipo-cancelar159" type="button" class="secondary">Cancelar</button><p id="equipo-resultado159" role="status"></p></form>';
  renderList();document.getElementById('equipo-rol159').onchange=permissionOptions;
  document.getElementById('equipo-cancelar159').onclick=()=>{selected=null;document.getElementById('equipo-form159').hidden=true;};
  document.getElementById('equipo-boton-buscar159').onclick=async()=>{
   const q=document.getElementById('equipo-buscar159').value.trim(),result=document.getElementById('equipo-busqueda159'),seq=++searchSeq,gen=generation;
   if(!q){result.textContent='Escribí el correo completo de la persona.';return;}result.textContent='Buscando…';
   try{const data=await request('/search',undefined,q);if(gen!==generation||seq!==searchSeq)return;result.replaceChildren();
    for(const person of data.results||[]){const existing=rows.find(x=>x.suscriptor_id===person.suscriptor_id);if(role(existing?.rol)==='PROPIETARIO'){result.textContent='Esta persona es propietaria. Su titularidad no se modifica aquí.';continue;}const button=el('button',personText(person));button.type='button';button.onclick=()=>select(person,existing);result.append(button);}
    if(!data.results?.length)result.textContent='No se encontró un usuario activo con ese correo.';
   }catch(error){if(gen===generation&&seq===searchSeq)result.textContent=error.message;}
  };
  document.getElementById('equipo-form159').onsubmit=async event=>{
   event.preventDefault();if(!selected)return;const gen=generation,chosen=selected,submit=event.submitter||event.currentTarget.querySelector('[type=submit]'),status=document.getElementById('equipo-resultado159');
   const body={suscriptor_id:chosen.person.suscriptor_id,rol:document.getElementById('equipo-rol159').value,activo:document.getElementById('equipo-activo159').checked,permisos:split([...document.querySelectorAll('#equipo-funciones159 input:checked')].map(x=>x.value)),revision:chosen.row?.revision||revisionNew};
   if(body.activo&&body.rol==='MANAGER'&&!body.permisos.length){status.textContent='Seleccioná al menos una función para el manager.';return;}
   if(chosen.row?.permisos_definidos===true&&body.rol===role(chosen.row.rol)&&body.activo===chosen.row.activo&&JSON.stringify(body.permisos)===JSON.stringify(split(chosen.row.permisos))){status.textContent='No hay cambios para guardar.';return;}
   submit.disabled=true;status.textContent='Guardando…';
   try{const data=await request('/responsables',body);if(gen!==generation)return;const updated={...data.relacion,persona:chosen.person,revision:data.revision};rows=rows.filter(x=>x.suscriptor_id!==body.suscriptor_id).concat(updated);renderList();if(selected===chosen){selected={person:chosen.person,row:updated};status.textContent=data.updated===false?'No hay cambios para guardar.':data.message||'Permisos guardados. La persona debe volver a ingresar.';}}
   catch(error){if(gen===generation&&selected===chosen)status.textContent=error.message;}finally{submit.disabled=false;}
  };
 }
 async function load(){
  if(!context||loaded||pending)return;const gen=generation;pending=true;box().textContent='Cargando personas autorizadas…';
  try{const data=await request('');if(gen!==generation)return;rows=data.results||[];functions=split(data.funcionalidades);revisionNew=data.revision_nueva;loaded=true;render();}
  catch(error){if(gen!==generation)return;box().replaceChildren(el('p',error.message));const retry=el('button','Reintentar');retry.type='button';retry.onclick=load;box().append(retry);}finally{if(gen===generation)pending=false;}
 }
 window.GLD_EQUIPO159={mount(next){const section=document.getElementById('equipo-anunciante159');if(!section)return;generation++;searchSeq++;context=null;loaded=false;pending=false;selected=null;rows=[];section.open=false;section.hidden=true;box().replaceChildren();if(next.administrativo||role(next.role)!=='PROPIETARIO')return;context=next;section.hidden=false;section.ontoggle=()=>{if(section.open)load();};}};
})();
