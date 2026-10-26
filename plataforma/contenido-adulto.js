(function(){
 const origin='https://login.liqkoargentina.workers.dev',key='gld_adult_access_v67',nativeFetch=window.fetch.bind(window);
 const editor=!!document.querySelector('script[data-adult-editor]');
 if(editor){
  nativeFetch(origin+'/').then(r=>r.json()).then(j=>{window.GLD_EVENT_SCOPE_SUPPORTED=Number(j.version)>=145&&Number(j.event_scope_version)===1;window.GLD_ADULT_SUPPORTED=Number(j.version)>=67;window.GLD_PROMOS_MODERATION_SUPPORTED=Number(j.version)>=108;window.GLD_EVENT_VIRTUAL_SUPPORTED=Number(j.version)>=70;const enable=()=>{document.querySelectorAll('[data-adult-selector]').forEach(x=>{x.disabled=x.id==='promo-adulto'?!window.GLD_PROMOS_MODERATION_SUPPORTED:!window.GLD_ADULT_SUPPORTED;x.title=x.disabled?'La actualización de esta función todavía no está disponible.':'';});document.querySelectorAll('[data-event-selector],[data-event-virtual-option]').forEach(x=>{x.disabled=!window.GLD_EVENT_VIRTUAL_SUPPORTED;x.title=x.disabled?'Requiere Worker V70':'';});document.querySelectorAll('[data-event-scope-selector]').forEach(x=>{x.disabled=!window.GLD_EVENT_SCOPE_SUPPORTED;x.title=x.disabled?'Requiere instalar el Worker145':'';});};enable();new MutationObserver(enable).observe(document.body,{childList:true,subtree:true});}).catch(()=>{});return;
 }
 const style=document.createElement('style');
 style.textContent=`
 .gld-adult-surface{font-family:inherit;font-style:normal;color:#0f2e58;box-sizing:border-box}
 .card.adult-locked{display:flex;flex-direction:column;align-items:flex-start;gap:14px;min-height:240px;padding:24px;border:1px solid #e7bda9;border-radius:var(--card-radius,16px);background:linear-gradient(135deg,#fffaf7,#f5e1d4);box-shadow:var(--shadow,0 10px 30px rgba(28,43,78,.07))}
 .gld-adult-eyebrow{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:750;letter-spacing:.04em;color:#715047}
 .gld-adult-badge{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:9px;background:#0f2e58;color:white;font-size:14px;font-weight:850;letter-spacing:0}
 .gld-adult-surface h3{margin:0;font:inherit;font-size:clamp(20px,3vw,25px);font-weight:850;line-height:1.2;letter-spacing:-.02em;color:#0f2e58}
 .gld-adult-surface p{margin:0;font:inherit;font-size:14px;line-height:1.6;color:#52637a;max-width:48ch}
 .gld-adult-surface .gld-adult-button{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 18px;margin:2px 0 0;border:0;border-radius:12px;background:#1f5fb8;color:white;font:inherit;font-size:14px;font-weight:750;line-height:1.4;cursor:pointer;box-shadow:0 4px 12px #1f5fb820;text-decoration:none}
 .gld-adult-surface .gld-adult-button:hover{background:#174d96}
 .gld-adult-surface .gld-adult-button:focus-visible,.gld-adult-surface a:focus-visible{outline:3px solid #1f5fb8;outline-offset:3px}
 .gld-adult-notice{position:fixed;bottom:16px;left:16px;right:16px;z-index:100000;max-width:680px;margin:auto;display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:22px;border:1px solid #d7e1f7;border-radius:16px;background:#fff;box-shadow:0 12px 40px #0f2e5826}
 .gld-adult-notice a{display:inline-block;color:#1f5fb8;font-weight:750;margin-top:8px}
 .gld-adult-notice [role=status]:empty{display:none}
 @media(max-width:540px){.card.adult-locked{padding:20px;min-height:220px}.gld-adult-notice{left:10px;right:10px;bottom:10px;padding:18px}.gld-adult-surface .gld-adult-button{width:100%}}
 `;document.head.appendChild(style);
 window.GLD_ADULT={open(){show();banner.querySelector('button').click();},card(tipo){return '<article class="card adult-locked gld-adult-surface" data-adult-decorated="1"><div class="gld-adult-eyebrow"><span class="gld-adult-badge">+18</span><span>ACCESO RESTRINGIDO</span></div><h3>'+ (tipo==='evento'?'Evento con contenido +18':tipo==='promo'?'Promoción con contenido +18':tipo==='empleo'?'Publicación de empleo con contenido +18':'Contenido para mayores de 18 años') +'</h3><p>Ingresá con tu cuenta personal y confirmá tu edad para visualizar esta publicación.</p><button class="gld-adult-button" type="button" onclick="window.GLD_ADULT.open()">Ingresar y visualizar</button></article>';}};
 let banner;
 function accountLink(datos){const a=document.createElement('a');a.href='https://guialocal.ar/suscriptores/?vista='+(datos?'mi-guia&seccion=datos':'login');a.target='_top';a.textContent=datos?'Completar mis datos':'Ingresar a mi cuenta personal';return a;}
 function show(){
  if(banner)return;banner=document.createElement('aside');banner.className='gld-adult-notice gld-adult-surface';
  banner.innerHTML='<div class="gld-adult-eyebrow"><span class="gld-adult-badge">+18</span><span>ACCESO RESTRINGIDO</span></div><h3>Confirmá el acceso al contenido +18</h3><p>Estas publicaciones requieren iniciar sesión, tener 18 años o más y confirmar que querés visualizarlas.</p><button class="gld-adult-button" type="button">Visualizar contenido +18</button><p role="status"></p>';
  banner.querySelector('button').onclick=async()=>{
   const token=localStorage.getItem('gld_suscriptor_token_v2'),status=banner.querySelector('[role=status]');
   if(!token){status.textContent='Iniciá sesión en tu cuenta personal y volvé a esta página. ';status.append(accountLink(false));return;}
   if(!confirm('¿Querés visualizar contenido para mayores de 18 años?'))return;
   try{const r=await nativeFetch(origin+'/adult/access',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({confirmar:true})}),j=await r.json();if(!j.success){status.textContent=(j.message||'No se pudo verificar el acceso.')+' ';if(j.code==='AGE_UNKNOWN')status.append(accountLink(true));else if(j.code==='LOGIN_REQUIRED')status.append(accountLink(false));return;}sessionStorage.setItem(key,j.token);location.reload();}catch{status.textContent='No se pudo verificar el acceso. Reintentá.';}
  };document.body.append(banner);
 }
 window.fetch=async function(input,init){
  const u=new URL(input instanceof Request?input.url:String(input),location.href);
  if(u.origin===origin){const headers=new Headers(input instanceof Request?input.headers:undefined);new Headers(init?.headers).forEach((value,name)=>headers.set(name,value));const token=sessionStorage.getItem(key);const subscriber=localStorage.getItem('gld_suscriptor_token_v2');if(token&&subscriber){const auth=headers.get('Authorization');if(!auth||auth==='Bearer '+subscriber){headers.set('X-GLD-Adult-Token',token);if(!auth)headers.set('Authorization','Bearer '+subscriber);}}else if(token)sessionStorage.removeItem(key);init={...init,headers};}
  const response=await nativeFetch(input,init);
  return response;
 };
 // The icon accompanies both locked and authorized cards, without exposing adult data.
 const decorate=()=>document.querySelectorAll('.card,.activity-card,[data-contenido-adulto="true"]').forEach(card=>{if(card.dataset.adultDecorated)return;if(card.dataset.contenidoAdulto==='true'||/\+18/.test(card.textContent)){card.dataset.adultDecorated='1';const badge=document.createElement('strong');badge.textContent='+18';badge.style.cssText='display:block;color:#8b0035;padding:8px';card.prepend(badge);}});
 new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});decorate();
})();



