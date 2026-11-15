/* Cache exclusivamente para el documento HTML público de /descubrir.
   No intercepta otras páginas, datos del Worker, sesiones ni POST. */
const CACHE='gld-descubrir-document-v1';
const PAGE='/descubrir';
const STAMP='/descubrir?__gld_cache_timestamp__=1';
const MAX_AGE_MS=60000;
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.mode!=='navigate')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname!==PAGE)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const [cached,stamp]=await Promise.all([cache.match(PAGE),cache.match(STAMP)]);
  const stored=stamp?Number(await stamp.text()):NaN;
  const age=Date.now()-stored;
  if(cached&&Number.isFinite(age)&&age>=0&&age<MAX_AGE_MS)return cached;
  try{
   const response=await fetch(request,{cache:'no-store'});
   if(response.ok&&response.type!=='opaque'&&response.status===200){
    const headers=response.headers;
    // Cachear sólo HTML público, nunca una redirección, error o API.
    if((headers.get('content-type')||'').toLowerCase().includes('text/html')){
     try{
      await cache.put(PAGE,response.clone());
      await cache.put(STAMP,new Response(String(Date.now()),{headers:{'Content-Type':'text/plain'}}));
     }catch(err){/* Sin almacenamiento, siempre se sigue navegando por red. */}
    }
   }
   return response;
  }catch(error){
   if(cached)return cached;
   throw error;
  }
 })());
});
