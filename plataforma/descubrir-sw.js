/* Guía Local: caché del documento público de /descubrir.
   Sólo comprueba la versión cuando el usuario navega, nunca por temporizador.
   No guarda cuentas, respuestas de API, tokens ni páginas privadas. */
const CACHE='gld-public-document-v1';
const PAGE='/descubrir';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('gld-public-document-')&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||request.mode!=='navigate')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname!==PAGE)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const previous=await cache.match(PAGE,{ignoreVary:true});
    if(previous){
      try{
        // HEAD solicita sólo las cabeceras: comprueba actualizaciones sin bajar el HTML.
        const status=await fetch(PAGE,{method:'HEAD',cache:'no-store',credentials:'omit'});
        const oldTag=previous.headers.get('ETag');
        const newTag=status.headers.get('ETag');
        if(status.ok&&oldTag&&newTag&&oldTag===newTag)return previous;
      }catch(_){
        // Una página pública ya visitada puede mostrarse sin conexión.
        return previous;
      }
    }
    try{
      const fresh=await fetch(request,{cache:'no-store'});
      if(fresh.ok&&fresh.status===200&&
         (fresh.headers.get('Content-Type')||'').toLowerCase().includes('text/html')&&
         !fresh.headers.has('Set-Cookie')){
        await cache.put(PAGE,fresh.clone());
      }
      return fresh;
    }catch(error){
      if(previous)return previous;
      throw error;
    }
  })());
});
