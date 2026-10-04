import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {panelFixture} from './helpers/panel-fixture.mjs';
import {routeAdminV11} from '../worker/routes/admin-v11.js';
import {routePublicV12} from '../worker/routes/public-v12.js';
import {syncGuideAdvertiserV2} from '../worker/core/guide-read-model-v2.js';
import {json} from '../worker/core/http.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.GLD_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.GLD_CHROMIUM_PATH,args:['--no-sandbox']});
const f=panelFixture(),requests=[],errors=[];
f.seed('anunciantes','ADV',{nombre:'Anunciante',categoria_ids:['CAT'],eco:false});
const adm=f.collection('anunciantes_administracion').get('ADV');adm.nivel='3';
f.seed('anunciantes_sedes','SED',{sede_id:'SED',anunciante_id:'ADV',ciudad_id:'DOL',direccion:'Centro',actividad_ids:['ACT'],accion_ids:[],nodo_ids:[]});
const catalogs={categorias:[{categoria_id:'CAT',nombre:'Comercio'}],segmentos:[],niveles_anunciante:[{nivel_id:'3',nombre:'Presencia',numero:3}],funcionalidades:adm.funcionalidades.map(x=>({funcionalidad_id:x,nombre:x})),actividades_clave:[{actividad_id:'ACT',nombre:'Original'},{actividad_id:'NEW',nombre:'Nueva'}],acciones:[],nodos:[]};
await f.cache.put('admin:catalogs:v2',catalogs);await f.cache.put('catalogs:commerce:v1',catalogs);
await f.cache.put('admin:index:advertisers:v2',{results:[{id:'ADV',nombre:'Anunciante',ciudad_ids:['DOL'],search:'anunciante'}]});
await f.cache.put('territorio:admin:v1',{ciudades:[{ciudad_id:'DOL',ciudad_visible:'Dolores'}],paises:[],provincias:[]});
await syncGuideAdvertiserV2({...f,advertiserId:'ADV'});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addInitScript(token=>localStorage.setItem('gld_superadmin_token',token),f.admin);
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='login.liqkoargentina.workers.dev'){
   requests.push({path:url.pathname,method:req.method(),body:req.postData()});
   const request=new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.postData()?{body:req.postData()}:{})});
   let response;try{const ctx={...f,path:url.pathname,url,request};response=await routePublicV12(ctx)||await routeAdminV11(ctx)||json({success:false,message:'Ruta no encontrada'},404)}catch(e){response=json({success:false,message:e.message},400)}
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(url.hostname==='ui.prueba.test')return route.fulfill({status:200,contentType:'text/html',body:await fs.readFile('reconstruccion/plataforma/granhermano-v2.html','utf8')});
  return route.fulfill({status:200,body:'',contentType:req.resourceType()==='stylesheet'?'text/css':'text/plain'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://ui.prueba.test/admin.html');
 await page.waitForFunction(()=>document.getElementById('app')&&!document.getElementById('app').classList.contains('hidden'));
 await page.evaluate(async()=>{ghGoView('anunciantes');await detalleAnu('ADV')});
 await page.locator('#btnGuardarAnu').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-anu-cat="CAT"]').isChecked(),true);
 let start=requests.length,before={...f.stats};
 await page.click('#btnGuardarAnu');await page.waitForFunction(()=>document.getElementById('anuGuardarMsg').textContent==='Sin cambios');
 assert.equal(requests.length,start);assert.deepEqual(f.stats,before);
 await page.check('#anuEco');start=requests.length;before={...f.stats};
 await page.click('#btnGuardarAnu');await page.waitForFunction(()=>document.getElementById('anuGuardarMsg').textContent==='Guardado');
 let sent=requests.slice(start);assert.equal(sent.length,1);assert.equal(sent[0].path,'/superadmin/advertisers/ADV/profile');
 assert.deepEqual(JSON.parse(sent[0].body),{payload:{eco:true}});
 assert.equal(f.stats.reads,before.reads);assert.equal(f.stats.queries,before.queries);assert.equal(f.stats.writes-before.writes,1);
 assert.equal((await f.publicRows('/guide','DOL','anunciantes'))[0].eco,true);
 await page.fill('#anuSubnivel','Nuevo');start=requests.length;before={...f.stats};
 await page.click('#btnGuardarAnu');await page.waitForFunction(()=>document.getElementById('anuGuardarMsg').textContent==='Guardado');
 sent=requests.slice(start);assert.equal(sent.length,1);assert.equal(sent[0].path,'/superadmin/advertisers/ADV/commercial');
 assert.deepEqual(JSON.parse(sent[0].body),{payload:{subnivel:'Nuevo'}});
 assert.equal(f.stats.reads,before.reads);assert.equal(f.stats.queries,before.queries);assert.equal(f.stats.writes-before.writes,1);
 await page.evaluate(()=>document.querySelector('[data-rel-act="NEW"]').checked=true);
 start=requests.length;before={...f.stats};
 await page.click('#btnGuardarAnu');await page.waitForFunction(()=>document.getElementById('anuGuardarMsg').textContent==='Guardado');
 sent=requests.slice(start);assert.equal(sent.length,1);assert.equal(sent[0].path,'/superadmin/advertisers/ADV/sedes/relations');
 const body=JSON.parse(sent[0].body);body.sedes[0].actividad_ids.sort();
 assert.deepEqual(body,{sedes:[{sede_id:'SED',actividad_ids:['ACT','NEW']}]});
 assert.equal(f.stats.reads-before.reads,1);assert.equal(f.stats.queries,before.queries);assert.equal(f.stats.writes-before.writes,1);
 start=requests.length;await page.click('#btnGuardarAnu');await page.waitForFunction(()=>document.getElementById('anuGuardarMsg').textContent==='Sin cambios');assert.equal(requests.length,start);
 assert.deepEqual(errors,[]);assert.ok(!requests.some(r=>r.path==='/superadmin'),'Se llamó la ruta antigua');
 await fs.mkdir('/tmp/gld-v37-ui',{recursive:true});await page.screenshot({path:'/tmp/gld-v37-ui/admin-desktop.png',fullPage:true});
 console.log('GRAN HERMANO V37 OK: ficha y catálogos desde rutas reales, guardados de perfil/relaciones puntuales, publicación KV y guardar sin cambios sin llamadas; navegador con datos aislados');
}finally{await browser.close()}
