// Prueba integral de navegación: navegador real, servidor aislado, ningún dato de producción.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const {URL}=require('node:url');
const swPublic=readFileSync('plataforma/descubrir-sw.js');
const swPrivate=readFileSync('plataforma/sw.js');
const register=readFileSync('plataforma/pwa-web.js');
test('reutiliza HTML sin intervalos y actualiza al cambiar versión; datos privados siempre frescos',async()=>{
 const counter={documentGET:0,documentHEAD:0,administration:0,private:0},state={revision:1,offline:false};
 const server=createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/favicon.ico'){res.writeHead(204).end();return;}
  if(p==='/descubrir-sw.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'}).end(swPublic);return;}
  if(p==='/plataforma/sw.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'}).end(swPrivate);return;}
  if(p==='/plataforma/pwa-web.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'}).end(register);return;}
  if(p==='/plataforma/offline.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<html>sin conexión</html>');return;}
  if(p==='/descubrir'){
   if(req.method==='HEAD')counter.documentHEAD++;else counter.documentGET++;
   if(state.offline){req.socket.destroy();return;}
   res.setHeader('Content-Type','text/html; charset=utf-8');
   res.setHeader('Cache-Control','no-cache, max-age=0, must-revalidate');
   res.setHeader('ETag','"version-'+state.revision+'"');
   if(req.method==='HEAD'){res.writeHead(200).end();return;}
   res.writeHead(200).end('<!doctype html><html><body><span id="revision">'+state.revision+'</span><script src="/plataforma/pwa-web.js"></script></body></html>');
   return;
  }
  if(p==='/plataforma/administracion.html'){
   counter.administration++;
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end('<html><body>administrador '+counter.administration+'</body></html>');return;
  }
  if(p==='/api-private'){
   counter.private++;
   res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('dato-'+counter.private);return;
  }
  res.writeHead(404).end('No existe');
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.GLD_CHROME||undefined,args:['--no-sandbox']});
  const ctx=await browser.newContext({serviceWorkers:'allow'});
  const page=await ctx.newPage();
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/descubrir?ciudad=Dolores',{waitUntil:'load'});
  await page.waitForFunction(async()=>{
   const r=await navigator.serviceWorker.getRegistration('/descubrir');
   return !!r?.active && !!navigator.serviceWorker.controller;
  },null,{timeout:18000});
  const registrations=await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname));
  assert(registrations.includes('/'), 'Falta caché pública');
  assert(registrations.includes('/plataforma/'), 'No debe perderse el Service Worker privado');
  await page.reload({waitUntil:'load'});
  const requestsBeforeCache=counter.documentGET;
  await page.reload({waitUntil:'load'});
  assert.equal(counter.documentGET,requestsBeforeCache,'El mismo HTML no debe descargarse de nuevo');
  assert(counter.documentHEAD>=1,'Al entrar hay que comprobar versión por cabeceras');
  assert.equal(await page.locator('#revision').innerText(),'1');
  state.revision=2;
  await page.reload({waitUntil:'load'});
  assert.equal(counter.documentGET,requestsBeforeCache+1,'Al cambiar versión sí debe descargarse');
  assert.equal(await page.locator('#revision').innerText(),'2','Nueva página disponible inmediatamente al entrar');
  const headBefore=counter.documentHEAD;
  await page.waitForTimeout(700);
  assert.equal(counter.documentHEAD,headBefore,'No hay consultas periódicas por el paso del tiempo');
  await page.goto(base+'/plataforma/administracion.html',{waitUntil:'load'});
  await page.reload({waitUntil:'load'});
  assert.equal(counter.administration,2,'El panel administrativo nunca queda retenido por caché pública');
  const privateResult=await page.evaluate(async()=>[await(await fetch('/api-private')).text(),await(await fetch('/api-private')).text()]);
  assert.deepEqual(privateResult,['dato-1','dato-2'],'Respuestas privadas siempre pasan por la red');
  await page.goto(base+'/descubrir',{waitUntil:'load'});
  state.offline=true;
  await page.reload({waitUntil:'load'});
  assert.equal(await page.locator('#revision').innerText(),'2','Sin conexión recupera última versión pública');
  await ctx.close();
  console.log('COMPROBACION_PUBLICA_PRIVADA',JSON.stringify({registrations,counter,noPeriodicRequests:true,offlinePublic:true}));
 }finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
 }
});
