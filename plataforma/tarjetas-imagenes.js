(function(global){
  'use strict';
  const watched=new WeakSet(), pending=new Map(), resolved=new Map();
  const stats={requested:0,loaded:0,failed:0,deferred:0};
  const failures=new Map();
  const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function noteFailure(img){
    const url=img.currentSrc||img.src||img.dataset.gldImageSrc||'';
    stats.failed++;
    if(failures.has(url))return;
    if(failures.size>=50)failures.delete(failures.keys().next().value);
    failures.set(url,{url,time:new Date().toISOString()});
    console.warn('gld_card_image_error',{url});
    try{localStorage.setItem('gld_card_image_errors_v142',JSON.stringify([...failures.values()]));}catch(_){}
  }
  function load(img){
    const url=img.dataset.gldImageSrc;
    if(!url)return;
    delete img.dataset.gldImageSrc;
    stats.requested++;stats.deferred=Math.max(0,stats.deferred-1);
    // IntersectionObserver decides when to start; do not apply a second lazy gate.
    img.loading='eager';img.src=url;
  }
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);load(entry.target);}
  },{rootMargin:'160px',threshold:0}):null;
  function refresh(root=document){
    for(const img of root.querySelectorAll('img[data-gld-image-src]')){
      if(watched.has(img))continue;
      watched.add(img);stats.deferred++;
      img.addEventListener('load',()=>stats.loaded++,{once:true});
      img.addEventListener('error',()=>noteFailure(img),{once:true});
      if(observer)observer.observe(img);else load(img);
    }
  }
  async function resolve(url,loader){
    if(resolved.has(url))return resolved.get(url);
    if(pending.has(url))return pending.get(url);
    const promise=Promise.resolve().then(loader).then(value=>{
      if(value){if(resolved.size>=200)resolved.delete(resolved.keys().next().value);resolved.set(url,value);}
      return value;
    });
    pending.set(url,promise);
    try{return await promise;}finally{if(pending.get(url)===promise)pending.delete(url);}
  }
  global.GLD_CARD_IMAGES={
    attributes:url=>'decoding="async" data-gld-image-src="'+escape(url)+'"',
    refresh,resolve,
    snapshot:()=>({...stats,errors:[...failures.values()]}),
    // A re-render must not retain detached images through the observer.
    reset:()=>{observer?.disconnect();stats.deferred=0;}
  };
})(window);
