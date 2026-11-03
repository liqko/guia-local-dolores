(function(){
'use strict';
const R=['ADMINISTRADOR','MODERADOR','VENDEDOR'];
let policy=null;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function refresh(){
 const box=document.getElementById('ghRoleConfig155');if(!box)return;
 box.textContent='Cargando...';
 try{
  const data=await ghAdminRequest_('/roles');policy=data;
  let html='<p>Establecé las acciones máximas de cada rol. «En preparación» indica que todavía no se puede autorizar esa operación.</p><div class="role-head"><b>Acción</b>'+R.map(r=>'<b>'+r+'</b>').join('')+'</div>';
  for(const [area,ops] of Object.entries(data.catalogo)){
   html+='<h3>'+safe(area)+'</h3>';
   for(const op of ops){const key=area+'.'+op;html+='<div class="role-line"><span>'+safe(op)+(data.operativos.includes(key)?'':' · En preparación')+'</span>'+R.map(role=>'<label><input type="checkbox" data-role="'+role+'" data-action="'+safe(key)+'" '+((data.roles[role]||[]).includes(key)?'checked':'')+'></label>').join('')+'</div>';}
  }
  box.innerHTML=html+'<button type="button" id="saveRoles155">Guardar roles</button><p id="roleMessage155" role="status"></p>';
  if(GH_ADMIN_ACCESS.rol!=='SUPERADMIN_PRINCIPAL')box.querySelectorAll('input,button').forEach(c=>c.disabled=true);
  box.querySelector('#saveRoles155').onclick=saveRoles;
 }catch(e){box.textContent=e.message;}
 informarAltura();
}
async function saveRoles(){
 const button=document.getElementById('saveRoles155'),msg=document.getElementById('roleMessage155');button.disabled=true;
 try{
  const roles=Object.fromEntries(R.map(role=>[role,[...document.querySelectorAll('[data-role="'+role+'"]:checked')].map(x=>x.dataset.action)]));
  const j=await ghAdminRequest_('/roles',{roles},'POST');policy.roles=j.roles;msg.textContent='Configuración guardada.';
 }catch(e){msg.textContent=e.message;}finally{button.disabled=false;}
}
async function search(role){
 const key=role==='ADMINISTRADOR'?'Admin':role==='VENDEDOR'?'Vendedor':'Moderador';
 const box=document.getElementById('gh'+key+'Results155');
 const q=document.getElementById('gh'+key+'Q155').value.trim();if(!q){box.textContent='Ingresá un nombre o correo.';return;}
 box.textContent='Buscando...';
 try{
  const result=await api('buscar_suscriptores',{q,limit:30});
  box.replaceChildren();
  for(const row of result.results||result.suscriptores||[]){
   const b=document.createElement('button');b.type='button';b.className='sec';b.textContent=(row.nombre||row.suscriptor_id||row.id)+' · '+(row.mail||'');
   b.onclick=()=>edit(row,role);box.append(b);
  }
 }catch(e){box.textContent=e.message;}
}
async function edit(person,role){
 const key=role==='ADMINISTRADOR'?'Admin':role==='VENDEDOR'?'Vendedor':'Moderador';
 const box=document.getElementById('gh'+key+'Edit155');box.hidden=false;box.textContent='Cargando permisos...';box.scrollIntoView({block:'start'});
 const sid=String(person.suscriptor_id||person.id);
 try{
  const conf=policy||await ghAdminRequest_('/roles');policy=conf;
  const p=(await ghAdminRequest_('/access',{suscriptor_id:sid})).personal||{};
  if(p.perfil&&p.perfil!==role){box.textContent='La persona pertenece a otro perfil: '+p.perfil;return;}
  const terr=await fetch(TERRITORY_API_ORIGIN+'/territory/public').then(r=>r.json());
  const legacy=Object.entries({EVENTO:"Eventos",ACTIVIDAD:"Actividades",ANUNCIANTE:"Anunciantes"}).flatMap(([k,a])=>p.moderacion?.[k]?[a+".aprobar",a+".rechazar"]:[]);
   const selected=new Set((p.acciones?.length?p.acciones:legacy)),assigned=new Set(p.ciudades||[]);
  let html='<h2>'+safe(person.nombre||sid)+'</h2><p>Rol: '+role+'</p><p>Estado guardado: '+(p.activo?'Habilitado':'Pausado')+'</p><label class="role-check"><input type="checkbox" data-active '+(p.activo?'checked':'')+'> Habilitar persona</label>';
  html+='<h3>Ciudades</h3><label class="role-check"><input type="checkbox" data-all> Seleccionar todas</label>';
  const groups=new Map();
  for(const city of terr.ciudades||[]){const group=String(city.pais_id||'Sin país')+' / '+String(city.provincia_id||'Sin provincia');if(!groups.has(group))groups.set(group,[]);groups.get(group).push(city);}
  for(const [group,items] of groups){
   html+='<details class="role-group"><summary>'+safe(group)+'</summary><label class="role-check"><input type="checkbox" data-group="'+safe(group)+'"> Seleccionar grupo</label>';
   for(const c of items){const id=String(c.ciudad_id||c.id);html+='<label class="role-check"><input type="checkbox" data-city="'+safe(id)+'" data-city-group="'+safe(group)+'" '+(assigned.has(id)?'checked':'')+'> '+safe(c.ciudad_visible||c.nombre||id)+'</label>';}
   html+='</details>';
  }
  html+='<h3>Permisos individuales</h3>';
  for(const [area,ops] of Object.entries(conf.catalogo)){
   const choices=ops.map(a=>area+'.'+a).filter(a=>(conf.roles[role]||[]).includes(a));if(!choices.length)continue;
   html+='<details class="role-group"><summary>'+safe(area)+'</summary>';
   for(const action of choices)html+='<label class="role-check"><input type="checkbox" data-permission="'+safe(action)+'" '+(selected.has(action)?'checked':'')+' '+(conf.operativos.includes(action)?'':'disabled')+'> '+safe(action.slice(area.length+1))+(conf.operativos.includes(action)?'':' — En preparación')+'</label>';
   html+='</details>';
  }
  box.innerHTML=html+'<button type="button" data-save>Guardar permisos</button><p role="status" data-status></p>';
  box.onchange=e=>{
   const input=e.target;
   if(input.hasAttribute('data-all'))box.querySelectorAll('[data-city]').forEach(c=>c.checked=input.checked);
   if(input.hasAttribute('data-group'))box.querySelectorAll('[data-city-group]').forEach(c=>{if(c.dataset.cityGroup===input.dataset.group)c.checked=input.checked;});
  };
  box.querySelector('[data-save]').onclick=async()=>{
   const button=box.querySelector('[data-save]'),msg=box.querySelector('[data-status]');button.disabled=true;msg.textContent='Guardando...';
   try{
    const data={suscriptor_id:sid,perfil:role,activo:box.querySelector('[data-active]').checked,ciudades:[...box.querySelectorAll('[data-city]:checked')].map(x=>x.dataset.city),acciones:[...box.querySelectorAll('[data-permission]:checked:not(:disabled)')].map(x=>x.dataset.permission)};
    const out=await ghAdminRequest_('/access',data,'POST');msg.textContent=out.message;
   }catch(e){msg.textContent=e.message;}finally{button.disabled=false;}
  };
 }catch(e){box.textContent=e.message;}
 informarAltura();
}
window.ghRoles155={refresh,search,edit};
})();