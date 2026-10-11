(function(){
 const version='2026-10-11';
 let pending=null;
 const check=document.getElementById('aceptar-terminos-anunciantes');
 const enter=document.getElementById('continuar-terminos-anunciantes');
 const back=document.getElementById('volver-terminos-anunciantes');
 check.addEventListener('change',()=>{enter.disabled=!check.checked;});
 window.GLD_TERMINOS_ANUNCIANTES={aceptarIngreso(usuarioId){
  const key='gld_terms_advertiser:'+version+':'+usuarioId;
  try{if(usuarioId&&sessionStorage.getItem(key)==='aceptado')return Promise.resolve(true);}catch{}
  if(pending)return pending;
  check.checked=false;enter.disabled=true;mostrarPanel('terminos-anunciantes');
  pending=new Promise(resolve=>{
   enter.onclick=()=>{if(!check.checked)return;try{if(usuarioId)sessionStorage.setItem(key,'aceptado');}catch{}pending=null;resolve(true);};
   back.onclick=()=>{pending=null;mostrarPanel('login');const login=document.getElementById('btnLogin');if(login){login.disabled=false;login.textContent='Ingresar';}resolve(false);};
  });return pending;
 }};
})();
