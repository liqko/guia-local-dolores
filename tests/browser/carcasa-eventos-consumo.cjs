// Navegador aislado, datos públicos reales; no crea cuentas ni modifica fichas.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile,writeFile,mkdir}=require('node:fs/promises');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const path=require('node:path');
const LIVE='https://anunciantes-guialocal.web.app';
const CITY='DOL (BUE - ARG)';
const query='?pais_id=ARG&provincia_id=BUE&ciudad_id='+encodeURIComponent(CITY)+'&ciudad=Dolores';
const mode=process.argv[2]||'public';
const candidate=mode==='candidate';
const report={mode,started:new Date().toISOString(),scope:'Carcasa y Eventos públicos sin sesión, Chrome aislado, service worker habilitado. No mide autenticación ni facturación.',steps:[]};
const remote=new Map();
async function fromLive(p){
 if(!remote.has(p))remote.set(p,(async()=>{
  const r=await fetch(LIVE+p,{signal:AbortSignal.timeout(30000)});
  assert(r.ok,'Origen público '+p+' HTTP '+r.status);
  return {body:Buffer.from(await r.arrayBuffer()),type:r.headers.get('content-type')};
 })());
 return remote.get(p);
}
(async()=>{
 let server,origin=LIVE;
 if(candidate){
  // El servidor usa archivos candidatos y la publicación real, sin fichas ficticias.
  server=createServer(async(req,res)=>{
   try{
    let p=new URL(req.url,'http://localhost').pathname;
    if(p==='/descubrir')p='/plataforma/carcasa.html';
    let body,type;
    if(p==='/plataforma/territorio-cache.js'||p.startsWith('/plataforma/paquetes-ciudad/')){
     ({body,type}=await fromLive(p));
    }else{
     body=await readFile(path.join(process.cwd(),p));
     type=({'html':'text/html','js':'text/javascript','json':'application/json','css':'text/css'})[p.split('.').at(-1)]||'application/octet-stream';
    }
    const etag='"'+createHash('sha256').update(body).digest('hex')+'"';
    const headers={'Content-Type':type,'ETag':etag,'Cache-Control':'no-cache, max-age=0, must-revalidate'};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
    res.writeHead(200,headers);res.end(body);
   }catch(error){res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
 }
 const browser=await chromium.launch({executablePath:process.env.GLD_CHROME,headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  let rows=[],pending=[],errors=[];
  context.on('requestfinished',request=>{
   const row={url:request.url(),method:request.method(),resource:request.resourceType(),serviceWorker:!!request.serviceWorker()};
   rows.push(row);
   pending.push((async()=>{
    try{
     const r=await request.response();row.status=r.status();row.fromServiceWorker=r.fromServiceWorker();
     const sizes=await request.sizes();row.bodyBytes=sizes.responseBodySize;row.headerBytes=sizes.responseHeadersSize;
     const h=await r.allHeaders();row.workerVersion=h['x-gld-worker-version']||null;
     row.requestId=h['x-gld-request-id']||null;
     row.consumption=h['x-gld-consumption']?JSON.parse(decodeURIComponent(h['x-gld-consumption'])):null;
    }catch(e){row.measurementError=String(e);}
   })());
  });
  context.on('requestfailed',r=>rows.push({url:r.url(),method:r.method(),failed:r.failure()?.errorText}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  async function finish(action){
   await page.waitForTimeout(1800);await Promise.all(pending);
   const worker=rows.filter(r=>new URL(r.url).hostname==='login.liqkoargentina.workers.dev');
   const hosting=rows.filter(r=>new URL(r.url).origin===origin);
   const step={action,at:new Date().toISOString(),workerRequests:worker.length,workerPaths:worker.map(r=>new URL(r.url).pathname),hostingRequests:hosting.length,hostingBodyBytes:hosting.reduce((n,r)=>n+(r.bodyBytes||0),0),rows,errors:[...errors]};
   report.steps.push(step);console.log(JSON.stringify({...step,rows:undefined}));rows=[];pending=[];errors=[];
   return step;
  }
  async function guideReady(){
   await page.frameLocator('#moduloCentralFrame').locator('#contenedor').waitFor({state:'attached',timeout:30000});
   await page.waitForFunction(()=>window.GLD_PAQUETE_CIUDAD?.get);
   const book=await page.evaluate(city=>window.GLD_PAQUETE_CIUDAD.get(city),CITY);
   assert(book?.modules?.events?.success===true,'Libro real de Dolores');
   return book;
  }
  await page.goto(origin+'/descubrir'+query,{waitUntil:'load',timeout:60000});
  const book=await guideReady();report.revision=book.revision;
  await finish('carcasa: primera apertura sin copia');
  await page.reload({waitUntil:'load'});await guideReady();
  const reload=await finish('carcasa: recarga con copia vigente');
  if(candidate){
   assert(!reload.workerPaths.includes('/'),'Sin consulta de versión al Worker');
   assert(!reload.rows.some(r=>r.url.includes('/paquetes-ciudad/')),'Sin nuevo paquete');
   assert(!reload.rows.some(r=>new URL(r.url).searchParams.has('_v')),'Sin URL aleatoria');
  }
  // No se fabrican credenciales. Se comprueba la barrera y después se navega al
  // documento público dentro del marco para comprobar su lectura compartida.
  await page.locator('#modulosMenu').evaluate(el=>el.open=true);
  await page.locator('#moduloEventos').click();
  await page.locator('#gldSubscriberOverlay.activo').waitFor({timeout:5000});
  assert.equal(await page.locator('#moduloCentralFrame').getAttribute('data-modulo'),'guia');
  await page.locator('#gldSubscriberClose').click();
  const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame()&&f.url().includes('anunciantes'));
  assert(frame,'Marco público de Guía');
  await frame.goto(origin+'/plataforma/eventos.html'+query,{waitUntil:'load'});
  await frame.waitForFunction(()=>!document.body.classList.contains('gld-modulo-preparando'),{timeout:20000});
  const count=await frame.evaluate(()=>eventosData.length);report.eventsShown=count;
  const events=await finish('eventos: abrir documento público en carcasa (sin login sintético)');
  if(candidate){
   assert(!events.workerPaths.includes('/events-new'),'Eventos usa el libro');
   assert(!events.rows.some(r=>r.url.includes('/paquetes-ciudad/')),'Comparte el libro de Carcasa');
   const ids=new Set(book.modules.events.events.map(e=>String(e.evento_id||e.id)));
   assert((await frame.evaluate(()=>eventosData.map(e=>String(e.evento_id||e.id)))).every(id=>ids.has(id)),'Fichas de la publicación real');
  }
  await frame.locator('#search').fill('Dolores');await frame.locator('#search').fill('');
  const options=await frame.locator('#categoryFilter option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
  if(options.length){await frame.locator('#categoryFilter').selectOption(options[0]);await frame.locator('#categoryFilter').selectOption('');}
  const filters=await finish('eventos: buscar y filtrar');assert.equal(filters.workerRequests,0);
  await frame.goto(origin+'/plataforma/eventos.html'+query,{waitUntil:'load'});
  await frame.waitForFunction(()=>!document.body.classList.contains('gld-modulo-preparando'));
  const again=await finish('eventos: volver a abrir');
  if(candidate)assert(!again.workerPaths.includes('/events-new'));
  // Apertura directa con almacenamiento vacío, fuera de la carcasa.
  await context.close();
  const direct=await browser.newContext({serviceWorkers:'block'});const dp=await direct.newPage();let eventReads=0,books=0;
  direct.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/events-new')eventReads++;if(u.pathname.includes('/paquetes-ciudad/'))books++;});
  await dp.goto(origin+'/plataforma/eventos.html'+query,{waitUntil:'load'});
  await dp.waitForFunction(()=>!document.body.classList.contains('gld-modulo-preparando'));
  if(candidate){assert.equal(eventReads,0);assert.equal(books,1);}
  report.direct={eventReads,books,events:await dp.evaluate(()=>eventosData.length)};
  await direct.close();
 }finally{
  await browser.close();server?.close();
  report.finished=new Date().toISOString();
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/carcasa-eventos-'+mode+'.json',JSON.stringify(report,null,2));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
