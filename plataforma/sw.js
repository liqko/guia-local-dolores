/* Guía Local — contingencia sin conexión, sin cachear datos privados ni consultas. */
const OFFLINE_VERSION='gld-offline-v1';
const OFFLINE_PAGE='/plataforma/offline.html';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(OFFLINE_VERSION).then(cache=>cache.add(OFFLINE_PAGE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name.startsWith('gld-offline-')&&name!==OFFLINE_VERSION)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.mode!=='navigate'||event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith('/plataforma/'))return;
  event.respondWith(fetch(event.request).catch(async()=>await caches.match(OFFLINE_PAGE)||Response.error()));
});
/* El receptor de push no habilita suscripciones ni envíos por sí mismo. */
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json()||{};}catch{data={body:event.data?.text()||''};}
  if(!data.title||typeof data.title!=='string')return;
  const url=typeof data.url==='string'&&data.url.startsWith('/plataforma/')?data.url:'/plataforma/inicio.html';
  event.waitUntil(self.registration.showNotification(data.title.slice(0,120),{
    body:String(data.body||'').slice(0,250),icon:'/plataforma/icono.png',tag:String(data.tag||'guia-local').slice(0,64),
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
