(function(){
 const origin='https://login.liqkoargentina.workers.dev',key='gld_adult_access_v67',nativeFetch=window.fetch.bind(window);
 const editor=!!document.querySelector('script[data-adult-editor]');
 if(editor){
  nativeFetch(origin+'/').then(r=>r.json()).then(j=>{window.GLD_ADULT_SUPPORTED=Number(j.version)>=67;window.GLD_EVENT_VIRTUAL_SUPPORTED=Number(j.version)>=70;const enable=()=>{document.querySelectorAll('[data-adult-selector]').forEach(x=>{x.disabled=!window.GLD_ADULT_SUPPORTED;x.title=x.disabled?'Requiere Worker V67':'';});document.querySelectorAll('[data-event-selector],[data-event-virtual-option]').forEach(x=>{x.disabled=!window.GLD_EVENT_VIRTUAL_SUPPORTED;x.title=x.disabled?'Requiere Worker V70':'';});};enable();new MutationObserver(enable).observe(document.body,{childList:true,subtree:true});}).catch(()=>{});return;
 }
 window.GLD_ADULT={open(){show();banner.querySelector('button').click();},card(){return '<article class="card adult-locked"><strong>+18</strong><p>Esta publicación está restringida a mayores de 18 años.</p><button type="button" onclick="window.GLD_ADULT.open()">Iniciar sesión / Visualizar contenido</button></article>';}};
 let banner;
 function show(){
  if(banner)return;banner=document.createElement('aside');banner.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;z-index:100000;background:#fff;border:2px solid #006999;border-radius:12px;padding:16px;color:#222;box-shadow:0 4px 20px #0003';
  banner.innerHTML='<strong>+18 · Contenido restringido</strong><p>Estas publicaciones requieren iniciar sesión, tener 18 años o más y confirmar que querés visualizarlas.</p><button type="button">Visualizar contenido +18</button><p role="status"></p>';
  banner.querySelector('button').onclick=async()=>{
   const token=localStorage.getItem('gld_suscriptor_token_v2'),status=banner.querySelector('[role=status]');
   if(!token){status.innerHTML='Iniciá sesión en <a href="/plataforma/login">tu cuenta</a> y volvé a esta página.';return;}
   if(!confirm('¿Querés visualizar contenido para mayores de 18 años?'))return;
   try{const r=await nativeFetch(origin+'/adult/access',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({confirmar:true})}),j=await r.json();if(!j.success){status.textContent=j.message;return;}sessionStorage.setItem(key,j.token);location.reload();}catch{status.textContent='No se pudo verificar el acceso. Reintentá.';}
  };document.body.append(banner);
 }
 function inspect(value){if(!value||typeof value!=='object')return; if(value.bloqueado18)show();for(const child of Object.values(value))inspect(child);}
 window.fetch=async function(input,init){
  const u=new URL(input instanceof Request?input.url:String(input),location.href);
  if(u.origin===origin){const headers=new Headers(input instanceof Request?input.headers:init?.headers);const token=sessionStorage.getItem(key);const subscriber=localStorage.getItem('gld_suscriptor_token_v2');if(token&&subscriber){headers.set('X-GLD-Adult-Token',token);headers.set('Authorization','Bearer '+subscriber);}else if(token)sessionStorage.removeItem(key);init={...init,headers};}
  const response=await nativeFetch(input,init);
  if(u.origin===origin&&response.headers.get('content-type')?.includes('application/json'))response.clone().json().then(inspect).catch(()=>{});
  return response;
 };
 // The icon accompanies both locked and authorized cards, without exposing adult data.
 const decorate=()=>document.querySelectorAll('.card,.activity-card,[data-contenido-adulto="true"]').forEach(card=>{if(card.dataset.adultDecorated)return;if(card.dataset.contenidoAdulto==='true'||/\+18/.test(card.textContent)){card.dataset.adultDecorated='1';const badge=document.createElement('strong');badge.textContent='+18';badge.style.cssText='display:block;color:#8b0035;padding:8px';card.prepend(badge);}});
 new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});decorate();
})();
