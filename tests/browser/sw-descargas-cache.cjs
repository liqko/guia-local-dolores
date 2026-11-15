// Service Worker real en Chrome aislado: sólo servidor local y sin datos privados.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const sw=readFileSync('plataforma/sw.js','utf8');
const OFFLINE='/plataforma/offline.html';
const SHELL=['inicio.html','carcasa.html','anunciantes.html','eventos.html','promos.html','actividades.html','pwa-web.js'];
test('SW: no precarga otras pantallas; conserva navegación y modo sin conexión',async()=>{
  const accesses=[];
  const server=createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    accesses.push(path);
    res.setHeader('Cache-Control','no-store');
    if(path==='/plataforma/sw.js'){
      res.setHeader('Content-Type','text/javascript');
      return res.end(sw);
    }
    if(path===OFFLINE)return res.end('<!doctype html><html><body>Disponible sin conexión</body></html>');
    if(path.startsWith('/plataforma/') && path.endsWith('.html')){
      res.setHeader('Content-Type','text/html');
      return res.end('<!doctype html><html><body>'+path+'</body></html>');
    }
    res.writeHead(404).end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:process.env.GLD_CHROME||undefined,headless:true,args:['--no-sandbox']});
  try {
    const context=await browser.newContext({serviceWorkers:'allow'});
    const page=await context.newPage();
    await page.goto(origin+'/plataforma/inicio.html');
    await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.register('/plataforma/sw.js',{scope:'/plataforma/'});
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      if(!registration.active)throw Error('SW not active');
    });
    await page.waitForTimeout(350);
    const precached=accesses.slice();
    assert.equal(precached.filter(p=>p===OFFLINE).length,1,'Página offline precargada exactamente una vez');
    for(const name of SHELL.filter(n=>n!=='inicio.html'))
      assert.equal(precached.filter(p=>p==='/plataforma/'+name).length,0,'Precarga inesperada de '+name);
    assert.equal(precached.filter(p=>p==='/plataforma/inicio.html').length,1,'Inicio no se descarga dos veces');
    await page.goto(origin+'/plataforma/eventos.html');
    assert((await page.locator('body').innerText()).includes('/plataforma/eventos.html'));
    await context.setOffline(true);
    await page.reload();
    assert((await page.locator('body').innerText()).includes('/plataforma/eventos.html'),'Evento visitado debe seguir disponible offline');
    await page.goto(origin+'/plataforma/actividades.html');
    assert((await page.locator('body').innerText()).includes('Disponible sin conexión'),'Ruta no visitada usa offline general');
    await context.close();
    console.log(JSON.stringify({verified:true,initialRequests:precached,offlineVisited:true,offlineUnvisitedFallback:true}));
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
