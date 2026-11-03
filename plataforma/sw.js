/* Guía Local: versión pública consultada, disponible sin conexión.
   Nunca guardar tokens, favoritos, cuentas, turnos vigentes ni respuestas privadas. */
const SHELL_CACHE='gld-shell-v3';
const PUBLIC_CACHE='gld-guide-public-v2';
const OFFLINE_PAGE='/plataforma/offline.html';
const SHELL=['/plataforma/offline.html','/plataforma/inicio.html','/plataforma/carcasa.html','/plataforma/anunciantes.html','/plataforma/eventos.html','/plataforma/promos.html','/plataforma/actividades.html','/plataforma/pwa-web.js'];
const API_ORIGIN='https://login.liqkoargentina.workers.dev';
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
   const cache=await caches.open(SHELL_CACHE);
   // Descargar solo la página mínima sin conexión; las demás secciones se guardan
   // al visitarlas. Evita transferir toda Guía Local a cada visitante nuevo.
   await cache.add(OFFLINE_PAGE);
   await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   for(const name of await caches.keys()){
     if((name.startsWith('gld-shell-')&&name!==SHELL_CACHE)||
        (name.startsWith('gld-guide-public-')&&name!==PUBLIC_CACHE)||
        name.startsWith('gld-offline-'))await caches.delete(name);
   }
   await self.clients.claim();
 })());
});
function isPublicGuide(request,url){
 return request.method==='GET'&&url.origin===API_ORIGIN&&
   url.pathname==='/guide'&&url.searchParams.get('compact')==='1'&&
   !!url.searchParams.get('ciudad_id')&&!request.headers.has('Authorization');
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(isPublicGuide(request,url)){
   event.respondWith((async()=>{
     const cache=await caches.open(PUBLIC_CACHE);
     try{
       const response=await fetch(request);
       if(response.ok&&response.type!=='opaque')event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
       return response;
     }catch(err){
       const previous=await cache.match(request,{ignoreSearch:false});
       if(previous)return previous;
       throw err;
     }
   })());
   return;
 }
 if(request.method!=='GET'||url.origin!==self.location.origin||
    !url.pathname.startsWith('/plataforma/'))return;
 if(request.mode==='navigate'){
   event.respondWith((async()=>{
     const cache=await caches.open(SHELL_CACHE);
     try{
       const response=await fetch(request);
       const pathname=url.pathname;
       if(response.ok&&SHELL.includes(pathname))event.waitUntil(cache.put(pathname,response.clone()).catch(()=>{}));
       return response;
     }catch(err){
       return await cache.match(url.pathname)||await cache.match(OFFLINE_PAGE)||Response.error();
     }
   })());
   return;
 }
 // Recursos estáticos GET de Firebase: persistencia bajo demanda, sin solicitudes extras.
 if(/\.(js|css|woff2?|svg|png|jpe?g|webp)$/i.test(url.pathname)){
   event.respondWith((async()=>{
     const cache=await caches.open(SHELL_CACHE);
     try{
       const response=await fetch(request);
       if(response.ok&&response.type!=='opaque')event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
       return response;
     }catch(err){return await cache.match(request)||Response.error();}
   })());
 }
});
/* El receptor de push no habilita suscripciones ni envíos por sí mismo. */
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json()||{};}catch{data={body:event.data?.text()||''};}
  if(!data.title||typeof data.title!=='string')return;
  const url=typeof data.url==='string'&&data.url.startsWith('/plataforma/')?data.url:'/plataforma/inicio.html';
  event.waitUntil(self.registration.showNotification(data.title.slice(0,120),{
    body:String(data.body||'').slice(0,250),tag:String(data.tag||'guia-local').slice(0,64),
    data:{url}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const destination=new URL(event.notification.data?.url||'/plataforma/inicio.html',self.location.origin).href;
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const found=clients.find(c=>c.url===destination);
    if(found)return found.focus();
    return self.clients.openWindow(destination);
  })());
});
