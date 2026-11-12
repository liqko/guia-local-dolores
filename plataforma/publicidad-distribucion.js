(function(){
 'use strict';
 const seed=Math.random().toString(36),normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const hash=v=>{let n=2166136261;for(const c of seed+v)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
 const id=b=>String(b.publicidad_id||b.id||b.titulo||JSON.stringify(b));
 const level=b=>[4,5,6].includes(Number(b.nivel))?Number(b.nivel):4;
 function sequence(rows,slots,context={}){
  if((rows||[]).some(b=>b.reglas_version===147))return sequence147(rows,slots,context);
  slots=Math.max(0,Number(slots)||0);if(!slots)return [];
  const query=normal(context.query),categories=new Set((context.categories||[]).map(normal)),advertisers=new Set((context.advertisers||[]).map(String));
  const constrained=!!context.constrained;
  const relevance=b=>{
   if(!constrained)return 0;
   const cats=[...(b.categoria_ids||[]),...(b.segmentacion||[]).flatMap(s=>[s.categoria_id,s.categoria_nombre].filter(Boolean))].map(normal);
   const matchesCategory=cats.some(c=>categories.has(c));
   const general=b.general===true||cats.some(c=>['*','general','todas','todos'].includes(c));
   if(categories.size&&!matchesCategory)return general?2:99;
   const tags=Array.isArray(b.tags)?b.tags:String(b.tags||'').split(/[,;\n\r]+/);
   const matchesText=!!query&&normal([b.titulo,b.nombre_interno,...tags].join(' ')).includes(query);
   if(matchesCategory)return matchesText||advertisers.has(String(b.anunciante_id))?0:1;
   if(general)return 2;
   if(matchesText||advertisers.has(String(b.anunciante_id)))return 0;
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
 function sequence147(rows,slots,context={}){
  slots=Math.max(0,Math.floor(Number(slots)||0));if(!slots)return [];
  const stem=v=>normal(v).split(/[^a-z0-9+]+/).filter(Boolean).map(t=>t.length>3?t.replace(/s$/,''):t);
  const query=stem(context.query),categories=new Set((context.categories||[]).map(normal)),advertisers=new Set((context.advertisers||[]).map(String));
  const relevance=b=>{
   if(!context.constrained)return 0;
   const data=[b.titulo,...(Array.isArray(b.tags)?b.tags:String(b.tags||'').split(/[,;\n]+/)),b.busqueda147?.texto||''];
   const words=new Set(stem(data.join(' ')));
   if(query.length&&query.every(t=>words.has(t))||advertisers.has(String(b.anunciante_id)))return 0;
   const cats=[...(b.categoria_ids||[]),...(b.busqueda147?.categoria_ids||[]),...(b.segmentacion||[]).flatMap(s=>[s.categoria_id,s.categoria_nombre].filter(Boolean))].map(normal);
   return cats.some(c=>categories.has(c)&&!['general','*'].includes(c))?1:2;
  };
  let pool=[...new Map((rows||[]).map(b=>[id(b),b])).values()];
  if(!pool.length)return [];
  const tier=Math.min(...pool.map(relevance));pool=pool.filter(b=>relevance(b)===tier);
  if(!context.constrained){
   const premium=pool.filter(b=>level(b)===6),other=pool.filter(b=>level(b)!==6);
   if(premium.length&&other.length){const reserve=Math.min(2,slots,new Set(premium.map(b=>String(b.anunciante_id||id(b)))).size);return [...wheel147(premium,reserve,context),...wheel147(other,slots-reserve,context)];}
  }
  return wheel147(pool,slots,context);
 }
 function wheel147(pool,slots,context){
  if(!slots)return [];
  // One advertiser owns its positions, regardless of the number of active pieces.
  const groups=new Map();
  for(const row of pool){const key=String(row.anunciante_id||id(row));if(!groups.has(key))groups.set(key,{key,weight:Math.max(1,Math.floor(Number(row.posiciones)||1)),level:level(row),pieces:[],credit:0,turns:0});groups.get(key).pieces.push(row);}
  const advertisersPool=[...groups.values()].sort((a,b)=>b.level-a.level||hash(a.key)-hash(b.key));
  for(const g of advertisersPool)g.pieces.sort((a,b)=>hash(id(a))-hash(id(b)));
  const total=advertisersPool.reduce((n,g)=>n+g.weight,0),page=Math.max(1,Math.floor(Number(context.page)||1)),perPage=Math.max(slots,Math.floor(Number(context.slotsPerPage)||4));
  const offset=(page-1)*perPage,result=[];
  for(let turn=0;turn<offset+slots;turn++){
   if(turn&&turn%total===0){for(const lvl of [6,5,4]){const indices=advertisersPool.map((g,i)=>g.level===lvl?i:-1).filter(i=>i>=0);if(indices.length<2)continue;const ordered=indices.map(i=>advertisersPool[i]);ordered.push(ordered.shift());indices.forEach((index,i)=>advertisersPool[index]=ordered[i]);}}
   let winner=advertisersPool[0];
   for(const g of advertisersPool){g.credit+=g.weight;if(g.credit>winner.credit)winner=g;}
   winner.credit-=total;
   const piece=winner.pieces[winner.turns++%winner.pieces.length];if(turn>=offset)result.push(piece);
  }
  return result;
 }

function pubInternalDestination106(raw){
 const value=String(raw||'').trim();
 if(!value||/[\\\s]/.test(value))return '';
 try{
  const url=new URL(/^(?:www\.)?guialocal\.ar\//i.test(value)?'https://'+value:value);
  if(url.protocol!=='https:'||!['guialocal.ar','www.guialocal.ar'].includes(url.hostname)||url.port||url.username||url.password||url.pathname==='/')return '';
  url.hostname='www.guialocal.ar';return url.href;
 }catch{return '';}
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
  const ficha=b.cta_tipo==='FICHA_ANUNCIANTE'&&String(b.anunciante_id||'').trim();
  const linked=['EVENTO','ACTIVIDAD'].includes(b.cta_tipo)&&/^https:\/\/anunciantes-guialocal\.web\.app\/plataforma\/(?:eventos|actividades)\.html\?/.test(b.cta||'');
  const href=linked?b.cta:ficha?new URL('anunciantes.html?ciudad_id='+encodeURIComponent(b.ciudad_id||'')+'&anunciante_id='+encodeURIComponent(b.anunciante_id),location.href).href:pubInternalDestination106(b.cta||b.cta_destino||'');
  return '<aside class="banner-tarjeta" data-contenido-adulto="'+(b.contenido_adulto===true)+'" aria-label="Publicidad"><small>Publicidad</small>'+content+(href?'<a class="cta-btn" href="'+esc(href)+'" target="'+(ficha?'_self':'_top')+'">'+esc(b.cta_texto||'Ver anunciante')+'</a>':'')+'</aside>';
 }
 function exceptional(rows,ordinary=[],context={}){
  if(!context.constrained)return [];
  const unique=new Map();
  for(const b of rows||[]){
   if(level(b)!==6||b.bloqueado18)continue;
   const advertiser=String(b.anunciante_id||id(b));
   if(!unique.has(advertiser))unique.set(advertiser,b);
  }
  if(!unique.size)return [];
  const shown=new Set((ordinary||[]).filter(b=>level(b)===6).map(b=>String(b.anunciante_id||id(b))));
  if([...unique.keys()].every(a=>shown.has(a)))return [];
  return [...unique.entries()].sort((a,b)=>hash(a[0])-hash(b[0])).map(([,piece])=>piece);
 }
 function exceptionalHtml(rows,ordinary,context){
  const pieces=exceptional(rows,ordinary,context);if(!pieces.length)return '';
  const content=pieces.map((p,i)=>'<div style="flex:0 0 min(86vw,360px);scroll-snap-align:start">'+render(p,'excepcional-'+i)+'</div>').join('');
  return '<section class="gld-publicidad-excepcional" aria-label="Publicidad Nivel 6" style="width:100%;max-width:100%;margin:14px 0"><h3 style="font-size:1rem;margin:0 0 10px">Publicidad</h3><div role="region" aria-label="Carrusel de publicidad Nivel 6" tabindex="0" style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:5px 2px 12px">'+content+'</div></section>';
 }
 function init(){
  document.querySelectorAll('video[data-gld-publicidad-native]').forEach(video=>{if(video.dataset.wired)return;video.dataset.wired='1';if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.isIntersecting)video.pause();},{threshold:0.01}).observe(video);});
  document.querySelectorAll('[data-gld-publicidad-video]').forEach(frame=>{
   if(frame.dataset.wired)return;frame.dataset.wired='1';const src=frame.getAttribute('src');let seen=false;
   if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){seen=true;if(frame.getAttribute('src')==='about:blank')frame.src=src;}else if(seen)frame.src='about:blank';}},{threshold:0.01}).observe(frame);
  });
 }
 window.GLD_PUBLICIDAD={sequence,render,init,exceptional,exceptionalHtml};
})();
