const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const path=require('node:path');const server=require('node:http').createServer((req,res)=>{const file=path.resolve('.','.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(process.cwd()+'/')){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(8147,'127.0.0.1',r));
 const lambdaChrome=(await import(process.env.GLD_CHROMIUM_MODULE||'/workspace/scratch/5ce421d9d8f2/publicidad-browser-runtime/node_modules/@sparticuz/chromium/build/index.js')).default;
 const browser=await chromium.launch({headless:true,executablePath:await lambdaChrome.executablePath(),args:lambdaChrome.args});const results=[];const context=await browser.newContext();
 for(const width of [390,1280]){
  const page=await context.newPage();await page.setViewportSize({width,height:900});const requests=[];page.setDefaultTimeout(5000);
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8147/plataforma/granhermano.html',{waitUntil:'domcontentloaded',timeout:20000});
  await page.evaluate(()=>{
   GH_CITIES=[{ciudad_id:'D',ciudad_visible:'Dolores',provincia_id:'BA',provincia_visible:'Buenos Aires',pais_id:'AR',pais_visible:'Argentina'},{ciudad_id:'C',ciudad_visible:'Castelli',provincia_id:'BA',provincia_visible:'Buenos Aires',pais_id:'AR',pais_visible:'Argentina'}];GH_PROVINCES=[];
   GH_CATALOG_CACHE.publicidad_ubicaciones=[{ubicacion_id:'U',modulo:'GUIA',nombre_visible:'Guía'},{ubicacion_id:'E',modulo:'EVENTOS',nombre_visible:'Eventos'},{ubicacion_id:'AC',modulo:'ACTIVIDADES',nombre_visible:'Actividades'},{ubicacion_id:'P',modulo:'PROMOCIONES',nombre_visible:'Promociones'}];
   document.querySelectorAll('.view').forEach(x=>x.style.display='none');document.getElementById('view-anunciantes').style.display='block';document.getElementById('anuListado').style.display='none';document.getElementById('anuFicha').classList.remove('hidden');
   document.getElementById('detalle').innerHTML=ghFunctionEditor_({nivel:5,funcionalidades:'PUBLICIDAD',funcionalidades_config:{PUBLICIDAD:{reglas_version:147,activas_max:5,posiciones:3,modalidad:'DIARIA',excepcion_motivo:'Circo',vigente_desde:'2026-11-01',vigente_hasta:'2026-11-14',ciudades_ids:['D'],ubicaciones_ids:['U','E']}}},[],{});
   ghMountProvincePickers_();
  });
  await page.evaluate(()=>{const card=document.querySelector('[data-anu-fun="PUBLICIDAD"]').closest('.function-card');document.body.replaceChildren(card);});
  const gh=await page.evaluate(()=>{const cfg=ghFunctionPayload_().PUBLICIDAD;GLD_AD_RULES147.validate(cfg);return cfg;});
  assert.equal(gh.posiciones,3);assert.equal(gh.activas_max,5);assert.deepEqual(gh.ubicaciones_ids.sort(),['E','U']);assert.equal(await page.locator('[data-gh-ad-choice="ubicaciones_ids"][value="P"]').count(),0);
  await page.locator('[data-gh-limit="PUBLICIDAD"][data-gh-field="posiciones"]').fill('4');
  assert.equal(await page.evaluate(()=>ghFunctionPayload_().PUBLICIDAD.posiciones),4);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert(!overflow,'GH horizontal overflow '+width);
  await page.screenshot({path:'/tmp/publicidad147-gh-'+width+'.png',fullPage:true});
  const defaults=await page.evaluate(()=>{
   ANUNCIANTE_CIUDADES=['D'];
   document.body.innerHTML=ghFunctionEditor_({nivel:5,funcionalidades:'',funcionalidades_config:{}},[],{});
   ghMountProvincePickers_();
   const result={allCities:document.querySelector('[data-gh-ad-any="ciudades_ids"]').checked,cities:[...document.querySelectorAll('[data-gh-ad-choice="ciudades_ids"]:checked')].map(x=>x.value),locations:[...document.querySelectorAll('[data-gh-ad-choice="ubicaciones_ids"]:checked')].map(x=>x.value),legacyUntouched:!ghFunctionPayload_().PUBLICIDAD};
   document.querySelector('[data-anu-fun="PUBLICIDAD"]').checked=true;
   ghContractChanged_(document.querySelector('[data-gh-ad-any="ciudades_ids"]'));
   result.version=ghFunctionPayload_().PUBLICIDAD.reglas_version;
   return result;
  });assert.equal(defaults.allCities,false);assert.deepEqual(defaults.cities,['D']);assert.deepEqual(defaults.locations,['U']);assert.equal(defaults.legacyUntouched,true);assert.equal(defaults.version,147);
  await page.goto('http://127.0.0.1:8147/plataforma/login.html',{waitUntil:'domcontentloaded',timeout:20000});
  await page.evaluate(()=>{
   sesion={id:'A',nivel:5};
   document.querySelectorAll('.panel').forEach(x=>x.style.display='none');document.getElementById('panel-dashboard').style.display='block';document.querySelectorAll('.hidden-panel').forEach(x=>x.style.display='none');const panel=document.getElementById('publicidad-panel');panel.classList.remove('hidden-panel');panel.style.display='block';
   publicidadState={config:{reglas_version:147,posiciones:3,activas_max:5,ciudades_sin_limite:true,ubicaciones_ids:['U','E'],permite_imagen:true,permite_carrusel:true,permite_short:true,modalidad:'DIARIA',vigente_desde:'2026-11-01',vigente_hasta:'2026-11-14'},cupo:{activas:0,activas_max:5,guardadas:0},ciudades:[{ciudad_id:'D',ciudad_visible:'Dolores',pais_id:'AR',pais_visible:'Argentina'}],ubicaciones:[{ubicacion_id:'U',modulo:'GUIA'},{ubicacion_id:'E',modulo:'EVENTOS'},{ubicacion_id:'P',modulo:'PROMOCIONES'}],categorias:[],publicidades:[],loaded:true};
   document.body.replaceChildren(panel);
   document.getElementById('pub-categorias-legacy').hidden=true;pubUiFormatos_();pubUiReset_();initPublicidadUI_();
  });
  assert.equal(await page.locator('#pub-ubicaciones input[value="P"]').count(),0);
  assert(await page.locator('#pub-categorias-legacy').isHidden());
  await page.locator('#pub-formato').selectOption('IMAGEN');await page.locator('#pub-titulo').fill('Zungas');
  await page.evaluate(()=>document.querySelectorAll('#pub-alcance-tecnico details').forEach(x=>x.open=true));
  await page.locator('#pub-ciudades input[value="D"]').check();await page.locator('#pub-ubicaciones input[value="U"]').check();
  const before=await page.evaluate(()=>buildPublicidadPayloadFromForm_());assert.deepEqual(before.ubicaciones,['U']);assert.deepEqual(before.ciudades,['D']);
  await page.evaluate(()=>{const form=document.createElement('form');form.id='form-datos-comercio';form.hidden=true;document.body.append(form);const tags=document.createElement('textarea');tags.name='tags';tags.value='zunga, verano';form.append(tags);});
  const tagDetails=page.locator('details').filter({has:page.locator('#pub-tags')});await tagDetails.evaluate(x=>x.open=true);await page.locator('#pub-tags-perfil').click();assert.equal(await page.locator('#pub-tags').inputValue(),'zunga, verano');
  await page.evaluate(()=>{window.__lastEvents=[{evento_id:'EV1',nombre_evento:'Fiesta de prueba'}];});
  await page.evaluate(()=>document.getElementById('pub-cta-tipo').closest('details').open=true);
  await page.locator('#pub-cta-tipo').selectOption('EVENTO');await page.locator('#pub-contenido').selectOption('EV1');
  const linked=await page.evaluate(()=>buildPublicidadPayloadFromForm_());assert.equal(linked.contenido_id,'EV1');assert.equal(linked.cta_tipo,'EVENTO');
  await page.evaluate(async()=>{const tab=document.createElement('button');tab.id='tab-publicidad';document.body.append(tab);window.loadDashboardModule147=async()=>true;await pubDesdeContenido147('EVENTO','EV1');});
  assert.equal(await page.locator('#pub-contenido').inputValue(),'EV1');assert.equal(await page.locator('#pub-titulo').inputValue(),'Fiesta de prueba');
  const noop=await page.evaluate(async()=>{
   let sent=0;postJson=async()=>{sent++;throw Error('No debe enviarse');};
   const row={publicidad_id:'P147',nombre_interno:'',titulo:'Zungas',formato:'IMAGEN',tags:['zunga'],media:[{url:'https://example.invalid/ad.jpg'}],segmentacion:[{ciudad_id:'D',ubicacion_id:'U',categoria_key:'U:GENERAL'}],estado:'ACTIVA'};
   pubUiEditar_(row);document.getElementById('pub-guardar').click();await new Promise(r=>setTimeout(r,10));
   return {sent,message:document.getElementById('publicidad-msg').textContent};
  });assert.equal(noop.sent,0);assert(noop.message.includes('No hay cambios'));
  await page.screenshot({path:'/tmp/publicidad147-login-'+width+'.png',fullPage:true});
  const over=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(x=>x.getBoundingClientRect().right>innerWidth+2).map(x=>({id:x.id,tag:x.tagName,cls:x.className,right:x.getBoundingClientRect().right})).slice(0,8));if(over.length)console.log('OVER',over);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),'Login horizontal overflow '+width);
  results.push({width,GH:'PASS',login:'PASS',tags:'PASS',linked:'PASS',overflow:false});
 }
 await browser.close();server.close();fs.writeFileSync('docs/evidencias/publicidad149-browser.json',JSON.stringify({environment:'LOCAL_BROWSER_FIXTURES',results},null,2));console.log(results);
})().catch(e=>{console.error(e);process.exit(1)});
