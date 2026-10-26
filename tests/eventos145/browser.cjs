const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});let network=0;
  await page.route('https://test.invalid/',r=>r.fulfill({contentType:'text/html',body:'<html><body><script data-adult-editor></script><div id="vip"></div><div id="free"></div></body></html>'}));
  await page.route('https://login.liqkoargentina.workers.dev/',r=>{network++;return r.fulfill({contentType:'application/json',body:JSON.stringify({version:'145',event_scope_version:1})});});
  await page.goto('https://test.invalid/');
  const fragment=fs.readFileSync('worker/events-ui145.fragment.js','utf8'),html=fs.readFileSync('plataforma/login.html','utf8');assert(html.includes(fragment.trim()));
  await page.addScriptTag({content:`let evLists={ciudades:[{ciudad_id:'D',ciudad_visible:'Dolores',provincia_id:'BA',provincia_visible:'Buenos Aires',pais_id:'ARG',pais_visible:'Argentina'},{ciudad_id:'E',ciudad_visible:'Otra ciudad',provincia_id:'BA',pais_id:'ARG'},{ciudad_id:'B',ciudad_visible:'São Paulo',provincia_id:'SP',provincia_visible:'São Paulo',pais_id:'BRA',pais_visible:'Brasil'}]};const evGet=id=>String(document.getElementById(id)?.value||'').trim();let mode='VIRTUAL';const eventModeValue_=()=>mode;const eventModeFromRow_=r=>r.modalidad||'VIRTUAL';const readEventProgramacionFromUI_=()=>[];const gldRefreshAllSearchableSelects_=()=>{};`+fragment});
  await page.evaluate(()=>{eventScopeAdvertiserCity145='D';eventScopeMount145('ev',document.getElementById('vip'));eventScopeMount145('evf',document.getElementById('free'));eventScopeLoad145('ev');eventScopeLoad145('evf');});
  assert(await page.locator('#ev-scope-mode').isDisabled());
  await page.addScriptTag({content:fs.readFileSync('plataforma/contenido-adulto.js','utf8')});
  await page.waitForFunction(()=>window.GLD_EVENT_SCOPE_SUPPORTED===true);
  for(const prefix of ['ev','evf']){
   assert.equal(await page.locator('#'+prefix+'-scope-city').inputValue(),'D');
   await page.selectOption('#'+prefix+'-scope-mode','CIUDADES');await page.selectOption('#'+prefix+'-scope-cities',['D','B']);
   assert.deepEqual(await page.evaluate(p=>eventScopeRead145(p).ciudades,prefix),['B','D']);
   await page.selectOption('#'+prefix+'-scope-mode','PROVINCIA');await page.selectOption('#'+prefix+'-scope-country','ARG');await page.selectOption('#'+prefix+'-scope-province','BA');
   assert.deepEqual(await page.evaluate(p=>eventScopeRead145(p),prefix),{version:1,modo:'PROVINCIA',pais_id:'ARG',provincia_id:'BA'});
   await page.selectOption('#'+prefix+'-scope-mode','PAIS');await page.selectOption('#'+prefix+'-scope-country','BRA');
   assert.equal((await page.evaluate(p=>eventScopeRead145(p),prefix)).pais_id,'BRA');
   await page.selectOption('#'+prefix+'-scope-mode','TODAS');assert.deepEqual(await page.evaluate(p=>eventScopeRead145(p),prefix),{version:1,modo:'TODAS'});
  }
  await page.evaluate(()=>{eventScopeLoad145('ev',{evento_id:'legacy',modalidad:'VIRTUAL'});eventScopeLoad145('evf',{evento_id:'saved',modalidad:'VIRTUAL',alcance_publicacion:{version:1,modo:'CIUDADES',ciudades:['B','D']}});});
  assert.equal(await page.locator('#ev-scope-mode').inputValue(),'TODAS');assert.deepEqual(await page.evaluate(()=>eventScopeRead145('evf').ciudades),['B','D']);
  assert.equal(network,1);console.log('PASS Chrome mobile: FREE/VIP scopes, default city, manual cities, province, country, global, edit/legacy roundtrip, old-worker gating; only existing capability request');
  await page.setViewportSize({width:1440,height:900});assert(await page.locator('#ev-scope-mode').isVisible());console.log('PASS desktop scope controls visible');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
