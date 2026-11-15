const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const root=readFileSync('plataforma/descubrir-sw.js','utf8');
const pwa=readFileSync('plataforma/pwa-web.js','utf8');
const existing=readFileSync('plataforma/sw.js','utf8');
const config=JSON.parse(readFileSync('firebase.json','utf8'));
test('sólo /descubrir entra a la caché breve del SW público',async()=>{
 assert.match(root,/MAX_AGE_MS=60000/);
 assert.match(root,/request\.method!==['"]GET['"]/);
 assert.match(root,/request\.mode!==['"]navigate['"]/);
 assert(config.hosting.rewrites.some(x=>x.source==='/descubrir-sw.js'&&x.destination==='/plataforma/descubrir-sw.js'));
 const state={html:1,discoverRequests:0,adminRequests:0,privateRequests:0,down:false};
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  res.setHeader('Cache-Control','no-store');
  if(path==='/descubrir-sw.js'){res.setHeader('Content-Type','text/javascript');return res.end(root.replace('MAX_AGE_MS=60000','MAX_AGE_MS=1200'));}
  if(path==='/plataforma/sw.js'){res.setHeader('Content-Type','text/javascript');return res.end(existing);}
  if(path==='/plataforma/pwa-web.js'){res.setHeader('Content-Type','text/javascript');return res.end(pwa);}
  if(path==='/plataforma/offline.html')return res.end('<!doctype html><html><body>Offline</body></html>');
  if(path==='/descubrir'){
   state.discoverRequests++;if(state.down){req.socket.destroy();return;}
   res.setHeader('Content-Type','text/html');
   return res.end('<!doctype html><html><body><div id="version">'+state.html+'</div><script src="/plataforma/pwa-web.js"></script></body></html>');
  }
  if(path==='/plataforma/administracion.html'){
    state.adminRequests++;res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><body>Admin '+state.adminRequests+'</body></html>');
  }
  if(path==='/private'){
    state.privateRequests++;return res.end('PRIVATE-'+state.privateRequests);
  }
  res.writeHead(404).end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.GLD_CHROME||undefined,headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({serviceWorkers:'allow'});
  const page=await ctx.newPage();
  await page.goto(url+'/descubrir?ciudad=Dolores');
  await page.waitForFunction(async()=>{
    const r=await navigator.serviceWorker.getRegistration('/');
    return !!r?.active && !!navigator.serviceWorker.controller;
  },{timeout:12000});
  const registrations=await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname));
  assert(registrations.includes('/'),'SW público de raíz no instalado');
  assert(registrations.includes('/plataforma/'),'SW existente debe permanecer instalado');
  assert.equal(state.discoverRequests,1);
  await page.reload();
  assert.equal(await page.locator('#version').innerText(),'1');
  assert.equal(state.discoverRequests,1,'Recarga dentro del plazo no debe solicitar HTML a Firebase');
  state.html=2;
  await page.reload();
  assert.equal(state.discoverRequests,1,'Cambios HTML en 60 segundos no causan transferencias repetidas');
  await page.waitForTimeout(1600);
  await page.reload();
  assert.equal(state.discoverRequests,2,'Vencimiento vuelve a consultar el origen');
  assert.equal(await page.locator('#version').innerText(),'2','No se conserva HTML viejo después del plazo');
  await page.goto(url+'/plataforma/administracion.html');
  assert.equal(state.adminRequests,1,'Panel administrativo debe seguir usando la red');
  await page.reload();
  assert.equal(state.adminRequests,2,'Panel administrativo nunca se cachea con el SW público');
  const privatePage=await ctx.newPage();
  await privatePage.goto(url+'/descubrir');
  const privateResponse=await privatePage.evaluate(async()=>[await(await fetch('/private')).text(),await(await fetch('/private')).text()]);
  assert.deepEqual(privateResponse,['PRIVATE-1','PRIVATE-2'],'Peticiones privadas no deben cachearse');
  await ctx.close();
  console.log(JSON.stringify({result:'pass',scopes:registrations,htmlRequests:state.discoverRequests,adminRequests:state.adminRequests,privateRequests:state.privateRequests}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
