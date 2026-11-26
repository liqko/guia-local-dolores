'use strict';

const {access, mkdir, writeFile} = require('node:fs/promises');
const {homedir} = require('node:os');
const {join} = require('node:path');
const {createHash,randomUUID} = require('node:crypto');

const origin = 'https://www.guialocal.ar';
const routes = {
  usuario: {path:'/descubrir?ciudad_id=DOL%20%28BUE%20-%20ARG%29', ready:'#moduloCentralFrame', login:'/mi-guia', loginReady:'#personal-tab'},
  anunciante: {path:'/anunciantes', ready:':is(#panel-dashboard, #panel-seleccionar-anunciante):visible'},
  'gran-hermano': {path:'/plataforma/administracion', ready:'#app #btnSalir'},
};
const domains = new Map([
  ['www.guialocal.ar','hosting'], ['guialocal.ar','hosting'],
  ['anunciantes-guialocal.web.app','hosting'],
  ['login.liqkoargentina.workers.dev','worker'],
]);

const publications={
  promociones:{key:'promos',publicLink:'#moduloPromos',publicList:'#cards',privateList:'#promos-list',status:'#promos-status',
    edit:'[data-promo-action="edit"]',input:'#promo-text',cancel:'#promo-cancel',directory:'promos',adminList:'#ghPromosList'},
  eventos:{key:'eventos',publicLink:'#moduloEventos',publicList:'#events',privateList:'#eventos-list',status:'#eventos-status',
    edit:'[data-ev-action="edit"]',input:'#ev-nombre_evento',cancel:'#ev-cancel',directory:'vip',adminList:'#eventosList, #eventosFreeList'},
  actividades:{key:'actividades',publicLink:'#moduloActividades',publicList:'#activities',privateList:'#actividades-list',status:'#actividades-status',
    edit:'[data-act-action="edit"]',input:'#act-nombre',cancel:'#act-cancelar',directory:'actividades',adminList:'#activitiesAll102'},
};

function installMeasurement(context, services=domains, phase=()=>null) {
  const rows = new Map(), pending = [];
  function observe(request) {
    const url = new URL(request.url());
    if (!['https:','http:'].includes(url.protocol)) return;
    const service = services.get(url.hostname) ?? 'externo';
    const row = {service,host:url.hostname,phase:phase(),path:service==='externo'?null:url.pathname,method:request.method(),resource:request.resourceType(),at:new Date().toISOString(),status:null,bodyBytes:null,headerBytes:null,requestBodyBytes:null,requestId:null,workerVersion:null,consumption:null};
    rows.set(request,row);
  }
  context.on('request',observe);
  context.on('response',response=>{
    const row = rows.get(response.request());
    if (!row) return;
    row.status = response.status();
    row.serviceWorker = response.fromServiceWorker();
    const headers = response.headers();
    if(row.service==='hosting'){row.cacheControl=headers['cache-control']??null;row.age=headers.age??null;}
    if(row.service!=='worker')return;
    row.requestId=headers['x-gld-request-id']??null;
    row.workerVersion=headers['x-gld-worker-version']??null;
    row.action=headers['x-gld-action']||null;
    row.source=headers['x-gld-source']||null;
    for(const [field,key] of [['operations','x-gld-operations'],['cacheChecks','x-gld-cache-checks']]){
      if(!headers[key])continue;
      try{row[field]=JSON.parse(decodeURIComponent(headers[key]));}
      catch{row[field]=null;}
    }
    const header=headers['x-gld-consumption'];
    if(!header)return;
    try {
      const {schema,request_id,version,firestore,cloudflare,coverage}=JSON.parse(decodeURIComponent(header));
      row.requestId??=request_id??null;
      row.workerVersion??=version??null;
      row.consumption={schema,firestore,cloudflare,coverage};
    } catch {row.consumptionStatus='encabezado_invalido';}
  });
  context.on('requestfailed',request=>{
    const row = rows.get(request);
    if (row) row.failed = true;
  });
  context.on('requestfinished',request=>{
    const row = rows.get(request);
    if (!row) return;
    pending.push(request.sizes().then(sizes=>{
      row.requestBodyBytes = sizes.requestBodySize >= 0 ? sizes.requestBodySize : null;
      row.bodyBytes = sizes.responseBodySize >= 0 ? sizes.responseBodySize : null;
      row.headerBytes = sizes.responseHeadersSize >= 0 ? sizes.responseHeadersSize : null;
    }).catch(()=>{}));
  });
  return async()=>{
    await Promise.allSettled(pending);
    const requests = [...rows.values()];
    const hosting = requests.filter(row=>row.service==='hosting');
    return {requests,hosting:{requests:hosting.length,bodyBytes:hosting.reduce((sum,row)=>sum+(row.bodyBytes??0),0),
      sizesMissing:hosting.filter(row=>row.bodyBytes===null).length},workerRequests:requests.filter(row=>row.service==='worker').length,
      externalRequests:requests.filter(row=>row.service==='externo').length};
  };
}

async function observeExternalImages(context,page,phase){
  const session=await context.newCDPSession(page),inFlight=new Map(),rows=[];
  session.on('Network.requestWillBeSent',event=>{
    const url=new URL(event.request.url);
    if(event.type!=='Image'||!['http:','https:'].includes(url.protocol)||domains.has(url.hostname))return;
    const resource=createHash('sha256').update(url.href).digest('hex').slice(0,16);
    inFlight.set(event.requestId,{phase:phase(),host:url.hostname,resource,initiator:event.initiator.type,cache:null,encodedBytes:null});
  });
  session.on('Network.requestServedFromCache',event=>{
    const row=inFlight.get(event.requestId);
    if(row)row.cache='browser';
  });
  session.on('Network.responseReceived',event=>{
    const row=inFlight.get(event.requestId);
    if(!row)return;
    const response=event.response;
    row.status=response.status;
    if(response.fromServiceWorker)row.cache='service-worker';
    else if(response.fromDiskCache)row.cache='disk';
    else if(response.fromPrefetchCache)row.cache='prefetch';
  });
  session.on('Network.loadingFinished',event=>{
    const row=inFlight.get(event.requestId);
    if(!row)return;
    row.encodedBytes=event.encodedDataLength;
    rows.push(row);inFlight.delete(event.requestId);
  });
  await session.send('Network.enable');
  return rows;
}

async function main([action, name, sessionOption]) {
  const route = routes[name];
  if (!Object.hasOwn(routes,name)||!['sesion','ejecutar','infraestructura','hosting','seguimiento','consultas','imagenes',...Object.keys(publications)].includes(action)||sessionOption&&sessionOption!=='--con-sesion') {
    throw Error('Uso: node scripts/auditar-en-vivo.cjs <sesion|ejecutar|infraestructura|hosting|seguimiento|consultas|imagenes|promociones|eventos|actividades> <usuario|anunciante|gran-hermano> [--con-sesion]');
  }
  const module=Object.hasOwn(publications,action)?publications[action]:null;
  const fixture=module?JSON.parse(process.env.GLD_AUDIT_PUBLICACION??process.env.GLD_AUDIT_PROMO??'null'):null;
  if(module&&(!fixture?.titulo||!fixture.ciudad||!['presente','ausente'].includes(fixture.esperado)||
      name==='anunciante'&&!fixture.anunciante))throw Error('Definí titulo, ciudad, esperado y, en Anunciante, anunciante en GLD_AUDIT_PUBLICACION.');
  const {chromium} = require('playwright');
  const base = process.env.GLD_AUDIT_DIR || join(homedir(),'.gld-auditoria');
  await mkdir(base,{recursive:true,mode:0o700});
  const state = join(base,name+'.session.json');
  const interactive = action==='sesion';
  const session = !interactive&&(Boolean(module)||action==='consultas'||name!=='usuario'||Boolean(sessionOption));
  let browser, evidence, failure, externalImages, phase='apertura';
  const javascriptErrors = [], steps = [], hostingTimings = [];
  try {
    if (session) await access(state);
    browser = await chromium.launch({headless:!interactive,executablePath:process.env.GLD_CHROME});
    const context = await browser.newContext(session?{storageState:state}:{});
    if (!interactive) evidence = installMeasurement(context,domains,()=>phase);
    const page = await context.newPage();
    page.on('pageerror',error=>javascriptErrors.push(error.name));
    if(['consultas','imagenes'].includes(action)&&name==='usuario')externalImages=await observeExternalImages(context,page,()=>phase);
    if(action!=='infraestructura'){
      const target=new URL(interactive&&route.login?route.login:route.path,origin);
      if(fixture&&name==='usuario')target.searchParams.set('ciudad_id',fixture.ciudad);
      const response = await page.goto(target.href,{waitUntil:'load',timeout:25000});
      if (!response?.ok()) throw Error('La interfaz no respondió correctamente.');
      if (interactive) {
        const {createInterface} = require('node:readline/promises');
        const input = createInterface({input:process.stdin,output:process.stdout});
        try {await input.question('Ingresá en el navegador. Cuando termine, presioná Enter aquí. ');}
        finally {input.close();}
      }
      await page.locator(interactive&&route.loginReady?route.loginReady:route.ready).first().waitFor({state:'visible',timeout:15000});
    }
    if(action==='imagenes'){
      await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
      for(const frame of page.frames()){
        const images=await frame.evaluate(()=>[...document.images].filter(img=>img.currentSrc&&img.naturalWidth).map(img=>{
          const rect=img.getBoundingClientRect();
          return {url:img.currentSrc,intrinsic:[img.naturalWidth,img.naturalHeight],rendered:[Math.round(rect.width),Math.round(rect.height)],
            usage:img.classList.contains('logo-comercio')?'logo':img.classList.contains('thumbnail')?'galer?a':'otro'};
        })).catch(()=>[]);
        for(const {url,...details} of images){
          const resource=createHash('sha256').update(url).digest('hex').slice(0,16);
          const entry=externalImages?.find(row=>row.resource===resource);
          if(entry)entry.placement=details;
        }
      }
    }
    if(action==='consultas'){
      const options={timeout:15000};
      const settle=()=>page.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});
      await settle();
      async function observe(label,callback){
        phase=label;
        try{await callback();await settle();steps.push({phase,status:'aprobado'});}
        catch(error){steps.push({phase,status:'fallo',reason:error.name});}
      }
      if(name==='usuario'){
        const frame=page.frameLocator('#moduloCentralFrame');
        const search=frame.locator('#buscadorGlobal');
        await observe('guia:buscar',async()=>{
          await search.fill('Dolores',options);
          if(await search.inputValue()!=='Dolores')throw Error('Filtro sin aplicar');
          await frame.locator('#contenedor').waitFor(options);
        });
        await observe('guia:limpiar',async()=>{await search.clear(options);});
        await observe('empleo:abrir-y-filtrar',async()=>{
          const link=page.locator('#moduloEmpleo');
          if(!await link.isVisible())await page.locator('.modulos-menu-trigger').click(options);
          await link.click(options);
          const list=frame.locator('#public-list');
          await list.locator(':scope > *').first().waitFor(options);
          const tab=frame.locator('#public-tabs [data-public-type="BUSCO"]');
          await tab.click(options);
          if(await tab.getAttribute('aria-pressed')!=='true')throw Error('Filtro sin aplicar');
          await list.locator(':scope > *').first().waitFor(options);
        });
      }else if(name==='anunciante'){
        await observe('anunciante:seleccionar',async()=>{
          if(await page.locator('#panel-seleccionar-anunciante').isVisible()){
            await page.locator('#anunciantes-autorizados-lista button:visible').first().click(options);
          }
          await page.locator('#panel-dashboard').waitFor(options);
        });
        await observe('actividades:consultar',async()=>{
          if(await page.locator('#dashboard-navigation').getAttribute('open')===null)await page.locator('#dashboard-navigation-label').click(options);
          await page.locator('#tab-actividades').click(options);
          await page.waitForFunction(()=>{const status=document.querySelector('#actividades-status');return status?.textContent.trim()&&!status.textContent.includes('Cargando');},null,options);
          await page.locator('#actividades-list').waitFor(options);
        });
      }else{
        await observe('territorio:abrir',async()=>{
          await page.locator('#ghTabs .gh-main[data-gh-group="administracion"]').click(options);
          await page.locator('#ghTabs [data-view="configuracion"]').click(options);
          await page.locator('#cfgTabs [data-cfg="territorio"]').click(options);
          await page.locator('#ciuQ').waitFor(options);
        });
        await observe('territorio:filtrar',async()=>{
          const filter=page.locator('#ciuQ');
          await filter.fill('Dolores',options);
          if(await filter.inputValue()!=='Dolores')throw Error('Filtro sin aplicar');
          await page.locator('#ciuSelect option').filter({hasText:'Dolores'}).first().waitFor({state:'attached',...options});
        });
        await observe('territorio:actualizar',async()=>{
          const received=page.waitForResponse(r=>new URL(r.url()).pathname==='/superadmin/territory'&&r.request().method()==='GET',options);
          const [response]=await Promise.all([received,page.locator('#btnCiudadesRefresh').click(options)]);
          const data=await response.json();
          if(!response.ok()||!data.success||!Array.isArray(data.ciudades))throw Error('Cat?logo no disponible');
        });
      }
    }
    if(action==='hosting'){
      for(const pass of ['apertura','recarga']){
        phase=pass;
        if(pass==='recarga')await page.reload({waitUntil:'load',timeout:25000});
        await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});
        for(const frame of page.frames()){
          const timing=await frame.evaluate(()=>[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].map(entry=>{
            const url=new URL(entry.name,location.href);
            return {host:url.hostname,path:url.pathname,transferBytes:entry.transferSize,encodedBytes:entry.encodedBodySize,
              decodedBytes:entry.decodedBodySize,deliveryType:entry.deliveryType||null,workerStarted:entry.workerStart>0};
          })).catch(()=>[]);
          hostingTimings.push(...timing.filter(row=>domains.get(row.host)==='hosting').map(row=>({...row,phase:pass})));
        }
      }
    }
    if(['ejecutar','seguimiento'].includes(action)&&name==='usuario'&&!session){
      const menu=page.locator('.modulos-menu-trigger');
      const options={timeout:10000};
      const protectedEntries=action==='seguimiento'?[publications.actividades]:Object.values(publications);
      for(const entry of [...protectedEntries,{key:'empleo',publicLink:'#moduloEmpleo'}]){
        const publicRead=entry.key==='empleo';
        phase=entry.key+(publicRead?':consulta':':control-de-sesion');
        let checkpoint='menu';
        if(publicRead&&steps.some(step=>step.status!=='aprobado'))await page.goto(new URL(route.path,origin).href,{waitUntil:'load',timeout:25000});
        try{
          const link=page.locator(entry.publicLink);
          if(!await link.isVisible())await menu.click(options);
          checkpoint='enlace';
          if(!await link.isVisible()){
            steps.push({phase,status:'no_disponible',reason:await link.count()?'enlace_oculto':'enlace_ausente'});
            continue;
          }
          await link.click(options);
          checkpoint=publicRead?'listado':'solicitud_de_sesion';
          if(publicRead){
            const frame=page.frameLocator('#moduloCentralFrame');
            const results=frame.locator('#public-list');
            await results.locator(':scope > *').first().waitFor(options);
            await frame.locator('#public-tabs [data-public-type="BUSCO"]').click(options);
            if(await frame.locator('#public-tabs [data-public-type="BUSCO"]').getAttribute('aria-pressed')!=='true')throw Error('Filtro sin aplicar');
          }else{
            const overlay=page.locator('#gldSubscriberOverlay.activo');
            await overlay.waitFor(options);
            checkpoint='cerrar_solicitud_de_sesion';
            await page.keyboard.press('Escape');
            await overlay.waitFor({state:'hidden',...options});
          }
          steps.push({phase,status:'aprobado'});
        }catch(error){steps.push({phase,status:'fallo',reason:error.name,checkpoint,controls:await page.evaluate(()=>({menu:!!document.querySelector('.modulos-menu-trigger'),dialog:document.querySelector('#gldSubscriberOverlay')?.className??null,active:document.querySelector('#modulosMenu a.activo')?.id??null})).catch(()=>null)});}
      }
    }
    if(action==='infraestructura'){
      for(const path of ['/__version','/territory/public']){
        phase='worker:'+path;
        try{
          const response=await page.goto('https://login.liqkoargentina.workers.dev'+path,{waitUntil:'load',timeout:15000});
          if(!response?.ok())throw Error('HTTP '+response?.status());
          if(path==='/__version'){
            if(!response.headers()['x-gld-worker-version'])throw Error('Versión ausente');
          }else{
            const data=await response.json();
            if(!data.success||!['paises','provincias','ciudades'].every(key=>Array.isArray(data[key])))throw Error('Catálogo inválido');
          }
          steps.push({phase,status:'aprobado'});
        }catch(error){steps.push({phase,status:'fallo',reason:error.name});}
      }
    }
    if(steps.some(step=>step.status!=='aprobado'))failure='MODULO_NO_DISPONIBLE';
    if(module)await checkPublication(page,name,module,fixture,step=>{phase=step;});
    if (interactive) {
      const snapshot = await context.storageState({indexedDB:true});
      await writeFile(state,JSON.stringify(snapshot),{mode:0o600});
      console.log('Sesión almacenada localmente.');
    }
  } catch (error) {
    failure = error.code==='ENOENT'&&session?'SESION_FALTANTE':error.name==='TimeoutError'?'INTERFAZ_NO_DISPONIBLE':'ERROR_RECORRIDO';
  } finally {
    try {
      if (!interactive) {
        const result = {evidenceType:'installed-browser-observation',date:new Date().toISOString(),interface:name,action,sessionRequested:session,result:failure?'fallo':'aprobado',
          error:failure??null,javascriptErrors,steps,hostingTimings,externalImages,...(await evidence?.())};
        const output=join(base,name+'-'+randomUUID()+'.json');
        await writeFile(output,JSON.stringify(result,null,2),{mode:0o600});
        console.log(output);
      }
    } finally {await browser?.close();}
  }
  if (failure) {
    console.error(failure);
    process.exitCode=1;
  }
}

async function checkPublication(page,name,module,fixture,step=()=>{}){
  const options={timeout:15000};
  let list, search;
  step(module.key+':navegar');
  if(name==='usuario'){
    await page.locator('.modulos-menu-trigger').click(options);
    await page.locator(module.publicLink).click(options);
    const frame=page.frameLocator('#moduloCentralFrame');
    list=frame.locator(module.publicList);
    await list.locator(':scope > :not(.promos-loading)').first().waitFor(options);
    if(/no se pudo|no se pudieron cargar|error al cargar/i.test(await list.innerText()))throw Error('Listado público no disponible.');
    search=frame.locator('#search');
    step(module.key+':filtrar');
    await search.fill(fixture.titulo,options);
  }else if(name==='anunciante'){
    const account=page.locator('#anunciantes-autorizados-lista button').filter({hasText:fixture.anunciante});
    if(await page.locator('#panel-seleccionar-anunciante').isVisible())await account.click(options);
    else await page.locator('#panel-dashboard').getByText(fixture.anunciante,{exact:false}).first().waitFor(options);
    if(await page.locator('#dashboard-navigation').getAttribute('open')===null)await page.locator('#dashboard-navigation-label').click(options);
    await page.locator('#tab-'+module.key).click(options);
    list=page.locator(module.privateList);
    await page.waitForFunction(selector=>{
      const status=document.querySelector(selector)?.textContent?.trim();
      return Boolean(status&&!status.includes('Cargando'));
    },module.status,options);
  }else{
    const menu=page.locator('#ghTabs [data-gh-group="funcionalidades"].gh-main');
    if(await menu.getAttribute('aria-expanded')!=='true')await menu.click(options);
    await page.locator('#ghTabs [data-view="'+module.key+'"]').click(options);
    const classes=module.directory==='vip'?['VIP','FREE']:[''];
    const results=classes.map(clase=>page.waitForResponse(response=>{
      const url=new URL(response.url());
      return url.pathname==='/superadmin/listados'&&url.searchParams.get('tipo')===module.key&&
        url.searchParams.get('q')===fixture.titulo&&(url.searchParams.get('clase')??'')===clase;
    },options));
    step(module.key+':filtrar');
    await page.locator('#dir-'+module.directory+'-q').fill(fixture.titulo,options);
    for(const response of await Promise.all(results)){
      const data=await response.json();
      if(!response.ok()||!data.preparado||!Array.isArray(data.results))throw Error('Listado administrativo no disponible.');
      if(fixture.esperado==='ausente'&&data.results.some(row=>row.titulo===fixture.titulo))throw Error('El listado administrativo aún devuelve la ficha.');
    }
    list=page.locator(module.adminList);
    await list.locator('details, nav').first().waitFor(options);
  }
  const found=list.getByText(fixture.titulo,{exact:name!=='gran-hermano'}).first();
  if(fixture.esperado==='ausente'){
    if(await found.count()||/no se pudieron cargar|cargando|error/i.test((await list.allTextContents()).join(' ')))throw Error('La ausencia de la ficha no quedó comprobada.');
    return;
  }
  await found.waitFor(options);
  if(name==='usuario'){
    await search.fill('gld-auditoria-'+randomUUID(),options);
    await found.waitFor({state:'hidden',...options});
    await search.fill(fixture.titulo,options);
    await found.waitFor(options);
  }else if(name==='anunciante'){
    step(module.key+':editar-y-cancelar');
    await found.click(options);
    const record=list.locator('details[open]').filter({hasText:fixture.titulo});
    await record.locator(module.edit).click(options);
    const field=page.locator(module.input);
    await field.waitFor(options);
    if((await field.inputValue()).trim()!==fixture.titulo)throw Error('El formulario pertenece a otra ficha.');
    await field.fill('Control local de cancelación',options);
    await page.locator(module.cancel).click(options);
    if(await field.inputValue()==='Control local de cancelación')throw Error('Cancelar no limpió la edición.');
    await found.waitFor(options);
  }else{
    step(module.key+':abrir-y-cerrar-ficha');
    await found.click(options);
    const open=list.locator('details[open]').filter({hasText:fixture.titulo});
    await open.first().waitFor(options);
    await found.click(options);
    await open.first().waitFor({state:'hidden',...options});
  }
}

function checkPromo(page,name,fixture,step){
  return checkPublication(page,name,publications.promociones,fixture,step);
}

if (require.main===module) main(process.argv.slice(2)).catch(error=>{
  console.error(error.code==='MODULE_NOT_FOUND'?'Instalá Playwright con npm install --no-save --package-lock=false playwright@1.55.0':error.message);
  process.exitCode=1;
});
module.exports = {installMeasurement,checkPromo,checkPublication,publications};
