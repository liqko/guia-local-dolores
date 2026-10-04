import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {panelFixture} from './helpers/panel-fixture.mjs';
import {routePanelV15} from '../worker/routes/panel-v15.js';
import {routePublicV12} from '../worker/routes/public-v12.js';
import {json} from '../worker/core/http.js';
import {syncGuideAdvertiserV2} from '../worker/core/guide-read-model-v2.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.GLD_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.GLD_CHROMIUM_PATH,args:['--no-sandbox']});
const f=panelFixture(),errors=[],requests=[];
f.seed('suscriptores','SUB',{suscriptor_id:'SUB',nombre:'Persona',mail:'persona@prueba.test',clave:'secreto1',activo:true,email_verificado:true});
f.seed('suscriptor_anunciante','REL',{suscriptor_id:'SUB',anunciante_id:'ADV',rol:'PROPIETARIO',activo:true,permisos:'PROMOS;EVENTOS;EVENTOS_FREE;ACTIVIDADES;PUBLICIDAD;EFEMERIDES;TURNOS_FARMA'});
f.seed('anunciantes','ADV',{nombre:'Anunciante',categoria_ids:['CAT']});
const admin=await f.db.get('anunciantes_administracion','ADV');
f.seed('anunciantes_administracion','ADV',{...admin,nivel:'5',funcionalidades:[...admin.funcionalidades,'TURNOS_FARMA'],turnos_farma:'DOL',farmacias_ciudades:['DOL']});
f.seed('anunciantes_sedes','SED',{sede_id:'SED',anunciante_id:'ADV',nombre_sede:'Principal',ciudad_id:'DOL',direccion:'Centro',img1:''});
f.cache.put('catalogs:commerce:v1',{segmentos:[],categorias:[{categoria_id:'CAT',nombre:'Gastronomía'}],acciones:[],nodos:[],actividades_clave:[]});
f.cache.put('territorio:public:v1',{ciudades:[{ciudad_id:'DOL',ciudad_visible:'Dolores',provincia_id:'BA',provincia_visible:'Buenos Aires'},{ciudad_id:'CAS',ciudad_visible:'Castelli',provincia_id:'BA',provincia_visible:'Buenos Aires'}]});
await syncGuideAdvertiserV2({...f,advertiserId:'ADV'});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='login.liqkoargentina.workers.dev'){
   requests.push({method:req.method(),path:url.pathname,body:req.postData(),query:url.search});
   const request=new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.postData()?{body:req.postData()}:{})});
   let response;try{const ctx={...f,path:url.pathname,url,request};response=await routePublicV12(ctx)||await routePanelV15(ctx)||json({success:false,message:'Ruta no encontrada'},404)}catch(e){response=json({success:false,message:e.message},400)}
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(url.hostname==='ui.prueba.test')return route.fulfill({status:200,contentType:'text/html',body:await fs.readFile('reconstruccion/plataforma/login-modular-v11.html','utf8')});
  return route.fulfill({status:200,body:'',contentType:req.resourceType()==='stylesheet'?'text/css':'text/plain'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('https://ui.prueba.test/panel.html');
 await page.fill('#login-mail','persona@prueba.test');await page.fill('#clave','secreto1');await page.click('#btnLogin');
 await page.locator('#tab-modificar-datos').waitFor({state:'visible'});
 await page.click('#tab-modificar-datos');
 await page.locator('#campos-datos-comercio [name="descripcion"]').waitFor({state:'visible'});
 assert.equal(await page.locator('[name="categoria_id_item"][value="CAT"]').isChecked(),true,'Categoría guardada no aparece seleccionada');
 const before=f.stats.writes,requestStart=requests.length;
 await page.fill('#campos-datos-comercio [name="descripcion"]','Descripción guardada en navegador');
 await page.fill('#campos-datos-comercio [name="img1"]','https://prueba.test/imagen.jpg');
 await page.click('#btnGuardarDatosComercio');
 await page.waitForFunction(()=>document.querySelector('#msg-datos-comercio').textContent.includes('Cambios guardados'));
 assert.equal(f.stats.writes-before,2);
 assert.equal(requests.slice(requestStart).filter(r=>r.method==='GET'&&r.path==='/commerce').length,0,'Guardar recarga datos completos');
 await page.click('.btn-eliminar-sede');await page.waitForFunction(()=>!document.querySelector('.commerce-sede-card'));
 assert.ok(await f.db.get('anunciantes','ADV'));
 assert.equal((await f.publicRows('/guide','DOL','anunciantes'))[0].sedes.length,0);
 await page.click('.btn-agregar-sede');
 await page.selectOption('.commerce-sede-card [name="ciudad_id"]','DOL');
 assert.match(await page.locator('.commerce-sede-card [name="ciudad_id"] option:checked').textContent(),/Dolores/);
 await page.fill('.commerce-sede-card [name="direccion"]','Nueva sede');
 const addStart=requests.length,addWrites=f.stats.writes;
 await page.click('#btnGuardarDatosComercio');
 await page.waitForFunction(()=>!!document.querySelector('.commerce-sede-card [name="sede_id"]')?.value);
 assert.equal(f.stats.writes-addWrites,1);
 assert.equal(requests.slice(addStart).filter(r=>r.path==='/commerce'&&r.method==='GET').length,0,'Agregar sede relee todo el comercio');
 const noChange=requests.length;
 await page.click('#btnGuardarDatosComercio');await page.waitForFunction(()=>document.querySelector('#msg-datos-comercio').textContent.includes('No hay cambios'));
 assert.equal(requests.length,noChange,'Guardar sin cambios hace llamadas');
 for(const [tab,status]of [['promos','promos-status'],['eventos','eventos-status'],['eventos-free','eventos-free-status'],['actividades','actividades-status'],['publicidad','publicidad-status'],['efemerides','efem-status'],['turnos-farma','farma-status']]){
  await page.click('#tab-'+tab);
  await page.waitForFunction(id=>{const t=document.getElementById(id)?.textContent||'';return !/Cargando/i.test(t)},status,{timeout:10000});
  const text=await page.locator('#'+status).textContent();assert.ok(!/Error|No se pudo|No tenés|No tienes/i.test(text),`${tab}: ${text}`);
  await page.click('#tab-inicio');const reopen=requests.length;await page.click('#tab-'+tab);assert.equal(requests.length,reopen,'Reabrir '+tab+' repite consultas');
 }
 assert.deepEqual(errors,[]);
 await fs.mkdir('/tmp/gld-v35-ui',{recursive:true});await page.screenshot({path:'/tmp/gld-v35-ui/panel-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.click('#tab-modificar-datos');
 await page.screenshot({path:'/tmp/gld-v35-ui/panel-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Panel con desborde móvil');
 console.log('PANEL VISUAL V35 OK: login real, datos/imágenes, última sede y carga de siete módulos; Firestore/KV aislados');
}catch(e){console.error('PANEL VISUAL FALLÓ:',e.message,errors,requests.slice(-4));throw e}finally{await browser.close()}
