const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const config=JSON.parse(readFileSync('firebase.json','utf8'));
const rule=source=>config.hosting.headers.find(h=>h.source===source)?.headers.find(h=>h.key==='Cache-Control')?.value;
test('cache HTML pública queda limitada a 60s, sin alterar autenticación ni assets versionados',()=>{
 assert.equal(rule('/descubrir'),'public, max-age=60, must-revalidate');
 assert.equal(rule('/plataforma/**'),'no-cache, max-age=0, must-revalidate');
 assert.equal(rule('/plataforma/assets/app/**'),'public, max-age=31536000, immutable');
});
test('Chrome reutiliza página pública en navegación común y revalida cuando vence',async()=>{
 let requests=0,version=1;
 const server=createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204).end();return;}
  if(req.url==='/descubrir'){
    requests++;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=2, must-revalidate'});
    res.end('<!doctype html><html><body>Guía '+version+'</body></html>');return;
  }
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end('<!doctype html><html><body>inicio</body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.GLD_CHROME||undefined,headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  const home='http://127.0.0.1:'+server.address().port+'/';
  await page.goto(home+'descubrir');assert.equal(requests,1);
  assert.match(await page.locator('body').innerText(),/Guía 1/);
  await page.goto(home);version=2;
  await page.goto(home+'descubrir');
  assert.equal(requests,1,'Dentro de max-age no debe pedir el HTML otra vez');
  assert.match(await page.locator('body').innerText(),/Guía 1/);
  await page.waitForTimeout(2400);
  await page.goto(home);
  await page.goto(home+'descubrir');
  assert.equal(requests,2,'Después del vencimiento debe solicitar una versión nueva');
  assert.match(await page.locator('body').innerText(),/Guía 2/);
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
