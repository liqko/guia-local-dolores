// Local browser integration: network responses replay public HAR counters.
// These tests establish behavior, not Cloudflare consumption or deployment.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
const js=await readFile(new URL('../../plataforma/telemetria.js',import.meta.url),'utf8');
const fixture=JSON.parse(await readFile(new URL('./public-har-fixture.json',import.meta.url)));
const html='<!doctype html><script src="/plataforma/telemetria.js"></script><input id="buscarCiudad"><button id="entrar">Ingresar</button><script>document.getElementById("entrar").onclick=()=>fetch("https://login.liqkoargentina.workers.dev/territory/public").then(r=>r.json());</script>';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.includes('.js')?'text/javascript':'text/html');res.end(req.url.includes('.js')?js:html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  const batches=[],business=[];
  await page.route('https://login.liqkoargentina.workers.dev/**',async route=>{
    const req=route.request();
    if(req.url().includes('/telemetry/events')){batches.push(...JSON.parse(req.postData()).rows);return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true})});}
    business.push({url:req.url(),method:req.method(),headers:req.headers()});return route.fulfill({contentType:'application/json',headers:{'X-GLD-Consumption':encodeURIComponent(JSON.stringify(fixture.rows[0].consumption))},body:'{"success":true,"ciudades":[]}'});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/plataforma/inicio.html');
  await page.locator('#buscarCiudad').fill('texto privado que no debe registrarse');
  await page.locator('#entrar').click();await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/territory/public')));
  await page.evaluate(()=>window.gldTelemetry.flush());
  assert.equal(business.length,1);assert.equal(business[0].url,'https://login.liqkoargentina.workers.dev/territory/public');assert.equal(business[0].method,'GET');
  assert.match(business[0].headers['x-gld-trace'],/;usuario$/);assert.ok(batches.some(r=>r.kind==='action'&&r.action==='ingresar_ciudad'));
  assert.ok(!JSON.stringify(batches).includes('texto privado'));assert.ok(batches.some(r=>r.kind==='resource'&&r.resource_type==='document'));
  await page.evaluate(()=>{window.dispatchEvent(new ErrorEvent('error',{message:'secret-error-content',lineno:12}));});await page.evaluate(()=>window.gldTelemetry.flush());
  assert.ok(batches.some(r=>r.kind==='runtime_error'));assert.ok(!JSON.stringify(batches).includes('secret-error-content'));
  console.log('PASS browser: action tracing, original URL/method, page resources, no input values, sanitized JS errors');
}finally{await browser?.close();server.close();}
