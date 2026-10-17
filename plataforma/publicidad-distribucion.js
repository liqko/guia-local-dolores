(function(){
 'use strict';
 const seed=Math.random().toString(36),normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const hash=v=>{let n=2166136261;for(const c of seed+v)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
 const id=b=>String(b.publicidad_id||b.id||b.titulo||JSON.stringify(b));
 const level=b=>[4,5,6].includes(Number(b.nivel))?Number(b.nivel):4;
 function sequence(rows,slots,context={}){
  slots=Math.max(0,Number(slots)||0);if(!slots)return [];
  const query=normal(context.query),categories=new Set((context.categories||[]).map(normal)),advertisers=new Set((context.advertisers||[]).map(String));
  const constrained=!!context.constrained;
  const relevance=b=>{
   if(!constrained)return 0;
   if(query&&normal([b.titulo,b.nombre_interno,...(b.tags||[])].join(' ')).includes(query)||advertisers.has(String(b.anunciante_id)))return 0;
   const cats=[...(b.categoria_ids||[]),...(b.segmentacion||[]).flatMap(s=>[s.categoria_id,s.categoria_nombre].filter(Boolean))].map(normal);
   if(cats.some(c=>categories.has(c)))return 1;
   if(b.general===true||cats.some(c=>['*','general','todas','todos'].includes(c)))return 2;
   return 99;
  };
  const pool=[...new Map((rows||[]).filter(b=>relevance(b)<99).map(b=>[id(b),b])).values()];
  pool.sort((a,b)=>relevance(a)-relevance(b)||level(b)-level(a)||hash(id(a))-hash(id(b)));
  const page=Math.max(1,Number(context.page)||1),perPage=Math.max(slots,Number(context.slotsPerPage)||4);
  const take=(group,n,offset)=>{const result=[];for(let i=0;i<Math.min(n,group.length);i++)result.push(group[(offset+i)%group.length]);return result;};
  if(constrained)return take(pool,slots,(page-1)*perPage);
  const premium=pool.filter(b=>level(b)===6),other=pool.filter(b=>level(b)!==6);
  const reserve=premium.length?Math.min(2,slots,premium.length):0;
  const result=take(premium,reserve,(page-1)*2);
  result.push(...take(other,slots-result.length,(page-1)*Math.max(1,perPage-2)));
  if(result.length<slots){const seen=new Set(result.map(id));result.push(...take(premium.filter(b=>!seen.has(id(b))),slots-result.length,(page-1)*2));}
  return result;
 }
 function safeUrl(raw){if(!String(raw||'').trim())return '';try{const u=new URL(raw,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
 function youtube(raw){try{const u=new URL(raw);if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname))return '';const v=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];return /^[\w-]{11}$/.test(v||'')?'https://www.youtube.com/embed/'+v+'?autoplay=0&mute=0&controls=1&fs=0&rel=0&playsinline=1':'';}catch{return '';}}
 function render(b,index){
  if(b.bloqueado18)return window.GLD_ADULT?.card()||'';
  const media=Array.isArray(b.media_items)?b.media_items:Array.isArray(b.media)?b.media:[],format=String(b.formato||'').toUpperCase();
  const fallback=b.img||typeof b.media==='string'&&b.media||'',first=media[0]?.url||fallback;
  let content='';
  if(/\.(mp4|webm|ogg)(?:$|[?#])/i.test(first)&&safeUrl(first)){
   content='<div class="banner-media" style="width:min(100%,360px);max-width:100%;aspect-ratio:9/16;margin:auto"><video data-gld-publicidad-native src="'+esc(safeUrl(first))+'" controls playsinline preload="metadata" style="display:block;width:100%;height:100%;object-fit:contain"></video></div>';
  }else if(format==='SHORT'||youtube(first)){
   const src=youtube(first);if(!src)return '';
   content='<div class="banner-media" style="width:min(100%,360px);max-width:100%;aspect-ratio:9/16;margin:auto;overflow:hidden"><iframe data-gld-publicidad-video src="'+esc(src)+'" title="Video de la publicidad" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" style="display:block;width:100%;height:100%;border:0"></iframe></div>';
  }else{
   const images=(media.length?media:[{url:first}]).map(m=>safeUrl(m.url)).filter(Boolean);
   if(!images.length)return '';
   content='<div class="banner-media" style="width:min(100%,360px);max-width:100%;aspect-ratio:auto;height:auto;display:flex;overflow-x:auto;scroll-snap-type:x mandatory">'+images.map(url=>'<img src="'+(window.GLD_MEDIA?.imageAttr?window.GLD_MEDIA.imageAttr(url):esc(url))+'" alt="Publicidad" loading="lazy" style="flex:0 0 100%;width:100%;height:auto;max-height:640px;object-fit:contain;scroll-snap-align:start">').join('')+'</div>';
  }
  const href=safeUrl(b.cta||b.cta_destino||'');
  return '<aside class="banner-tarjeta" data-contenido-adulto="'+(b.contenido_adulto===true)+'" aria-label="Publicidad"><small>Publicidad</small>'+content+(href?'<a class="cta-btn" href="'+esc(href)+'" target="_top">'+esc(b.cta_texto||'Ver anunciante')+'</a>':'')+'</aside>';
 }
 function init(){
  document.querySelectorAll('video[data-gld-publicidad-native]').forEach(video=>{if(video.dataset.wired)return;video.dataset.wired='1';if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.isIntersecting)video.pause();},{threshold:0.01}).observe(video);});
  document.querySelectorAll('[data-gld-publicidad-video]').forEach(frame=>{
   if(frame.dataset.wired)return;frame.dataset.wired='1';const src=frame.getAttribute('src');let seen=false;
   if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){seen=true;if(frame.getAttribute('src')==='about:blank')frame.src=src;}else if(seen)frame.src='about:blank';}},{threshold:0.01}).observe(frame);
  });
 }
 window.GLD_PUBLICIDAD={sequence,render,init};
})();
