const { chromium }=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:800,height:600}});const requests=[];
 await page.route('https://images.invalid/**',async route=>{requests.push(route.request().url());await route.fulfill({status:route.request().url().includes('broken')?404:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110"><rect width="110" height="110" fill="blue"/></svg>'})});
 await page.route('https://test.invalid/',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('https://test.invalid/');await page.addScriptTag({content:fs.readFileSync('plataforma/tarjetas-imagenes.js','utf8')});
 await page.evaluate(()=>{
  const a=GLD_CARD_IMAGES.attributes;
  document.body.innerHTML='<img id="visible" width="110" height="110" '+a('https://images.invalid/visible')+'><div style="height:5000px"></div><img id="far" width="110" height="110" '+a('https://images.invalid/far')+'>';
  GLD_CARD_IMAGES.refresh();
 });
 await page.waitForFunction(()=>document.getElementById('visible').complete&&document.getElementById('visible').naturalWidth>0);
 assert.equal(requests.length,1);assert(!requests.some(x=>x.endsWith('/far')));
 await page.locator('#far').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.getElementById('far').naturalWidth>0);
 assert.equal(requests.length,2);console.log('PASS offscreen image is not requested until approached; original URL loads on scroll');
 await page.evaluate(()=>{
  GLD_CARD_IMAGES.reset();document.body.innerHTML='<div id="gallery" style="width:200px;display:flex;overflow:auto">'+Array.from({length:8},(_,i)=>'<img width="110" height="110" style="flex:0 0 110px" '+GLD_CARD_IMAGES.attributes('https://images.invalid/h'+i)+'>').join('')+'</div>';scrollTo(0,0);GLD_CARD_IMAGES.refresh();
 });
 await page.waitForFunction(()=>document.querySelector('#gallery img').naturalWidth>0);
 assert(!requests.some(x=>x.endsWith('/h7')));
 await page.evaluate(()=>document.getElementById('gallery').scrollLeft=1000);
 await page.waitForFunction(()=>[...document.querySelectorAll('#gallery img')].at(-1).naturalWidth>0);console.log('PASS horizontal gallery also defers images beyond the visible portion');
 const outcome=await page.evaluate(async()=>{
  let calls=0;let done;const wait=new Promise(r=>done=r);
  const first=GLD_CARD_IMAGES.resolve('post',async()=>{calls++;await wait;return 'image'});
  const second=GLD_CARD_IMAGES.resolve('post',async()=>{calls++;return 'wrong'});
  await Promise.resolve();done();const values=await Promise.all([first,second]);const cached=await GLD_CARD_IMAGES.resolve('post',()=>{calls++;return 'wrong'});
  let tries=0;await GLD_CARD_IMAGES.resolve('failure',()=>{tries++;return ''});await GLD_CARD_IMAGES.resolve('failure',()=>{tries++;return 'recovered'});
  return {calls,values,cached,tries};
 });assert.deepEqual(outcome,{calls:1,values:['image','image'],cached:'image',tries:2});console.log('PASS simultaneous/repeated Instagram lookups grouped; failures remain retryable');
 await page.evaluate(()=>{GLD_CARD_IMAGES.reset();document.body.innerHTML='<img width="110" height="110" '+GLD_CARD_IMAGES.attributes('https://images.invalid/broken')+'>';GLD_CARD_IMAGES.refresh()});
 await page.waitForFunction(()=>GLD_CARD_IMAGES.snapshot().failed===1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gld_card_image_errors_v142')).length),1);assert.equal(requests.filter(x=>x.endsWith('/broken')).length,1);console.log('PASS load failure recorded locally without network report or automatic retry');
 await page.evaluate(()=>{GLD_CARD_IMAGES.reset();document.body.innerHTML='<img id="modal" src="https://images.invalid/original">'});
 await page.waitForFunction(()=>document.getElementById('modal').naturalWidth>0);console.log('PASS normal original image remains immediate, independent of deferred thumbnails');
 const fallback=await browser.newPage();await fallback.setContent('<body></body>');await fallback.evaluate(()=>window.IntersectionObserver=undefined);await fallback.addScriptTag({content:fs.readFileSync('plataforma/tarjetas-imagenes.js','utf8')});
 assert.equal(await fallback.evaluate(()=>{document.body.innerHTML='<img '+GLD_CARD_IMAGES.attributes('https://images.invalid/fallback')+'>';GLD_CARD_IMAGES.refresh();return document.querySelector('img').src}),'https://images.invalid/fallback');console.log('PASS fallback without IntersectionObserver loads original URL');
 const html=fs.readFileSync('plataforma/anunciantes.html','utf8');assert(html.includes('window.GLD_CARD_IMAGES?.refresh(contenedor)'));assert(html.includes('window.GLD_CARD_IMAGES?.refresh(destacadasBar)'));assert(html.includes('window.GLD_CARD_IMAGES?.refresh(el)'));assert(html.includes('img.src = url; img.alt'));
 console.log('PASS card/gallery integration and original modal source preserved');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
