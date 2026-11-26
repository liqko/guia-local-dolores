'use strict';

const {access, mkdir, writeFile} = require('node:fs/promises');
const {homedir} = require('node:os');
const {join} = require('node:path');
const {randomUUID} = require('node:crypto');

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
    const service = services.get(url.hostname);
    if (!service) return;
    const row = {service,phase:phase(),path:url.pathname,method:request.method(),status:null,bodyBytes:null,headerBytes:null,consumption:null};
    rows.set(request,row);
  }
  context.on('request',observe);
  context.on('response',response=>{
    const row = rows.get(response.request());
    if (!row) return;
    row.status = response.status();
    row.serviceWorker = response.fromServiceWorker();
    const headers = response.headers();
    const header = headers['x-gld-consumption'];
    if (!header) return;
    try {
      const {firestore,cloudflare} = JSON.parse(decodeURIComponent(header));
      row.consumption = {firestore:firestore ?? null,cloudflare:{
        worker_requests:cloudflare?.worker_requests ?? null, cpu_ms:cloudflare?.cpu_ms ?? null,
        kv:cloudflare?.kv ?? null, public_store:cloudflare?.public_store ?? null,
        admin_store:cloudflare?.admin_store ?? null,
      }};
    } catch {}
  });
  context.on('requestfailed',request=>{
    const row = rows.get(request);
    if (row) row.failed = true;
  });
  context.on('requestfinished',request=>{
    const row = rows.get(request);
    if (!row) return;
    pending.push(request.sizes().then(sizes=>{
      row.bodyBytes = sizes.responseBodySize;
      row.headerBytes = sizes.responseHeadersSize;
    }).catch(()=>{}));
  });
  return async()=>{
    await Promise.allSettled(pending);
    const requests = [...rows.values()];
    const hosting = requests.filter(row=>row.service==='hosting');
    return {requests,hosting:{requests:hosting.length,bodyBytes:hosting.reduce((sum,row)=>sum+(row.bodyBytes??0),0),
      sizesMissing:hosting.filter(row=>row.bodyBytes===null).length},workerRequests:requests.length-hosting.length};
  };
}

async function main([action, name, sessionOption]) {
  const route = routes[name];
  if (!Object.hasOwn(routes,name)||!['sesion','ejecutar',...Object.keys(publications)].includes(action)||sessionOption&&sessionOption!=='--con-sesion') {
    throw Error('Uso: node scripts/auditar-en-vivo.cjs <sesion|ejecutar|promociones|eventos|actividades> <usuario|anunciante|gran-hermano> [--con-sesion]');
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
  const session = !interactive&&(Boolean(module)||name!=='usuario'||Boolean(sessionOption));
  let browser, evidence, failure, phase='apertura';
  const javascriptErrors = [];
  try {
    if (session) await access(state);
    browser = await chromium.launch({headless:!interactive,executablePath:process.env.GLD_CHROME});
    const context = await browser.newContext(session?{storageState:state}:{});
    if (!interactive) evidence = installMeasurement(context,domains,()=>phase);
    const page = await context.newPage();
    page.on('pageerror',error=>javascriptErrors.push(error.name));
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
        const result = {date:new Date().toISOString(),interface:name,action,sessionRequested:session,result:failure?'fallo':'aprobado',
          error:failure??null,javascriptErrors,...(await evidence?.())};
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
