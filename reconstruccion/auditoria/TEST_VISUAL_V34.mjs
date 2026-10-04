import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {subscriberFixture} from './helpers/subscriber-fixture.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GLD_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.GLD_CHROMIUM_PATH,args:['--no-sandbox']});
const f=subscriberFixture(),originalFetch=globalThis.fetch;
globalThis.fetch=f.mailFetch;
const source=process.env.GLD_SUBSCRIBER_UI||'suscriptores-v3.html';
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='login.liqkoargentina.workers.dev'){
   const response=await f.handle(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.postData()?{body:req.postData()}:{})}));
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(url.hostname==='ui.prueba.test'){
   const filename=url.pathname==='/suscriptores.html'?source:path.basename(url.pathname);
   try{return route.fulfill({status:200,contentType:'text/html',body:await fs.readFile('reconstruccion/plataforma/'+filename,'utf8')})}catch{}
  }
  return route.fulfill({status:200,body:'',contentType:req.resourceType()==='stylesheet'?'text/css':'text/plain'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://ui.prueba.test/suscriptores.html?vista=registro');
 await page.waitForFunction(()=>document.querySelector('#reg-origen option[value="DOL"]'));
 await page.fill('#reg-nombre','Persona de prueba');
 await page.fill('#reg-mail','persona@prueba.test');
 await page.fill('#reg-clave','secreto1');
 await page.selectOption('#reg-tipo','residente');
 await page.selectOption('#reg-origen','DOL');
 await page.click('#register-btn');
 await page.waitForFunction(()=>!document.querySelector('#verify-box').classList.contains('hidden'));
 await page.fill('#verify-code','123456');await page.click('#verify-btn');
 await page.waitForFunction(()=>!document.querySelector('#login-panel').classList.contains('hidden'));
 await page.fill('#login-mail','persona@prueba.test');await page.fill('#login-clave','secreto1');await page.click('#login-btn');
 await page.waitForFunction(()=>!!localStorage.getItem('gld_suscriptor_token_v2'));
 await page.selectOption('#profile-city','CAS');
 await page.click('#save-city-btn');
 await page.waitForFunction(()=>document.querySelector('#profile-msg').textContent.includes('guardada'));
 await page.click('#logout-btn');
 await page.fill('#login-mail','persona@prueba.test');await page.click('#forgot-btn');
 await page.fill('#recovery-mail','persona@prueba.test');await page.click('#recovery-btn');
 await page.waitForFunction(()=>!document.querySelector('#recovery-step2').classList.contains('hidden'));
 await page.fill('#recovery-code','123456');await page.fill('#recovery-new-pass','secreto2');await page.click('#recovery-reset-btn');
 await page.waitForFunction(()=>document.querySelector('#recovery-msg').textContent.includes('Contraseña actualizada'));
 await page.fill('#login-mail','persona@prueba.test');await page.fill('#login-clave','secreto2');await page.click('#login-btn');
 await page.waitForFunction(()=>!!localStorage.getItem('gld_suscriptor_token_v2'));
 // Cuenta no verificada: el login debe abrir el paso de verificación visible.
 await page.click('#logout-btn');
 const created=await f.api({action:'crear',nombre:'Sin verificar',mail:'pendiente@prueba.test',clave:'secreto1'});assert.equal(created.success,true);
 await page.fill('#login-mail','pendiente@prueba.test');await page.fill('#login-clave','secreto1');await page.click('#login-btn');
 await page.waitForFunction(()=>!document.querySelector('#verify-box').classList.contains('hidden')&&!document.querySelector('#register-panel').classList.contains('hidden'));
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Desborde horizontal móvil');
 await fs.mkdir('/tmp/gld-v34-ui',{recursive:true});
 await page.screenshot({path:'/tmp/gld-v34-ui/suscriptores-mobile.png',fullPage:true});
 await page.setViewportSize({width:1280,height:900});
 await page.screenshot({path:'/tmp/gld-v34-ui/suscriptores-desktop.png',fullPage:true});
 f.kv.set('catalogs:commerce:v1',{segmentos:[],categorias:[],actividades_clave:[],acciones:[],nodos:[]});
 f.kv.set('guide:city:v1:DOL',{anunciantes:[{id:'ADV',nombre:'Comercio de prueba',nivel:'1',aprobado:true,ciudad_id:'DOL',sedes:[{sede_id:'SED',ciudad_id:'DOL',direccion:'Centro'}]}]});
 const valid=await f.api({action:'login',mail:'persona@prueba.test',clave:'secreto2'});
 await context.addInitScript(({token,suscriptor})=>{localStorage.setItem('gld_suscriptor_token_v2',token);localStorage.setItem('gld_suscriptor_session_v2',JSON.stringify(suscriptor))},{token:valid.token,suscriptor:valid.suscriptor});
 const carcasa=await context.newPage();carcasa.on('pageerror',e=>errors.push(e.message));
 await carcasa.goto('https://ui.prueba.test/carcasa-territorio-v3.html?ciudad_id=DOL&provincia_id=BA&pais_id=AR&ciudad=Dolores');
 await carcasa.waitForFunction(()=>document.querySelector('#moduloCentralFrame')?.dataset.modulo==='guia'&&!gldModuloCargando);
 await carcasa.frameLocator('#moduloCentralFrame').getByText('Comercio de prueba',{exact:true}).first().waitFor();
 for(const [button,module] of [['moduloPromos','promos'],['moduloEventos','eventos'],['moduloActividades','actividades'],['moduloGuia','guia']]){
  if(button!=='moduloGuia'&&!await carcasa.locator('#'+button).isVisible())await carcasa.click('.modulos-menu-trigger');
  await carcasa.click('#'+button);
  try{await carcasa.waitForFunction(m=>document.querySelector('#moduloCentralFrame')?.dataset.modulo===m&&!gldModuloCargando,module,{timeout:12000});}catch(e){await carcasa.screenshot({path:'/tmp/gld-v34-ui/carcasa-fail.png',fullPage:true});console.error('ESTADO',await carcasa.evaluate(()=>({frame:document.querySelector('#moduloCentralFrame').src,modulo:document.querySelector('#moduloCentralFrame').dataset.modulo,carga:gldModuloCargando,texto:document.querySelector('#gldBloqueoTexto').textContent})),errors);throw e;}
 }
 await carcasa.screenshot({path:'/tmp/gld-v34-ui/carcasa-desktop.png',fullPage:true});
 await carcasa.setViewportSize({width:390,height:844});
 assert.equal(await carcasa.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Desborde horizontal en Carcasa móvil');
 const guideFrame=carcasa.frames().find(f=>f.url().includes('anunciantes-publico-v4.html'));
 assert.equal(await guideFrame.evaluate(()=>['#buscadorGlobal','#paginador-abajo'].some(selector=>document.querySelector(selector).getBoundingClientRect().right>innerWidth)),false,'Controles recortados dentro de la Guía móvil');
 await carcasa.screenshot({path:'/tmp/gld-v34-ui/carcasa-mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'Errores JS en navegador');
 console.log('VISUAL V34 OK: Suscriptores completo, Carcasa y navegación Guía/Promos/Eventos/Actividades, escritorio y móvil; correo simulado');
}catch(e){console.error('VISUAL FALLÓ:',e.message);throw e}finally{globalThis.fetch=originalFetch;await browser.close()}
