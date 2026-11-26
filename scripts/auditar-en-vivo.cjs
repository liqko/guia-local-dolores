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
  if (!Object.hasOwn(routes,name)||!['sesion','ejecutar','promociones'].includes(action)||sessionOption&&sessionOption!=='--con-sesion') {
    throw Error('Uso: node scripts/auditar-en-vivo.cjs <sesion|ejecutar|promociones> <usuario|anunciante|gran-hermano> [--con-sesion]');
  }
  const promo=action==='promociones'?JSON.parse(process.env.GLD_AUDIT_PROMO??'null'):null;
  if(action==='promociones'&&(!promo?.titulo||!promo.ciudad||!['presente','ausente'].includes(promo.esperado)||
      name==='anunciante'&&!promo.anunciante))throw Error('Definí titulo, ciudad, esperado y, en Anunciante, anunciante en GLD_AUDIT_PROMO.');
  const {chromium} = require('playwright');
  const base = process.env.GLD_AUDIT_DIR || join(homedir(),'.gld-auditoria');
  await mkdir(base,{recursive:true,mode:0o700});
  const state = join(base,name+'.session.json');
  const interactive = action==='sesion';
  const session = !interactive&&(Boolean(promo)||name!=='usuario'||Boolean(sessionOption));
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
    if(promo&&name==='usuario')target.searchParams.set('ciudad_id',promo.ciudad);
    const response = await page.goto(target.href,{waitUntil:'load',timeout:25000});
    if (!response?.ok()) throw Error('La interfaz no respondió correctamente.');
    if (interactive) {
      const {createInterface} = require('node:readline/promises');
      const input = createInterface({input:process.stdin,output:process.stdout});
      try {await input.question('Ingresá en el navegador. Cuando termine, presioná Enter aquí. ');}
      finally {input.close();}
    }
    await page.locator(interactive&&route.loginReady?route.loginReady:route.ready).first().waitFor({state:'visible',timeout:15000});
    if(promo){
      phase='promociones';
      await checkPromo(page,name,promo);
    }
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

async function checkPromo(page,name,promo){
  const options={timeout:15000};
  let list;
  if(name==='usuario'){
    await page.locator('.modulos-menu-trigger').click(options);
    await page.locator('#moduloPromos').click(options);
    const frame=page.frameLocator('#moduloCentralFrame');
    await frame.locator('#promosTitle').waitFor(options);
    list=frame.locator('#cards');
    await list.locator('.promos-loading').waitFor({state:'hidden',...options});
    if(/no se pudieron cargar/i.test(await list.innerText()))throw Error('Listado público no disponible.');
    await frame.locator('#search').fill(promo.titulo,options);
  }else if(name==='anunciante'){
    const account=page.locator('#anunciantes-autorizados-lista button').filter({hasText:promo.anunciante});
    if(await page.locator('#panel-seleccionar-anunciante').isVisible())await account.click(options);
    else await page.locator('#panel-dashboard').getByText(promo.anunciante,{exact:false}).first().waitFor(options);
    if(await page.locator('#dashboard-navigation').getAttribute('open')===null)await page.locator('#dashboard-navigation-label').click(options);
    await page.locator('#tab-promos').click(options);
    list=page.locator('#promos-list');
    await page.waitForFunction(()=>{
      const status=document.querySelector('#promos-status')?.textContent?.trim();
      return Boolean(status&&!status.includes('Cargando'));
    },null,options);
  }else{
    const menu=page.locator('#ghTabs [data-gh-group="funcionalidades"].gh-main');
    if(await menu.getAttribute('aria-expanded')!=='true')await menu.click(options);
    await page.locator('#ghTabs [data-view="promos"]').click(options);
    const matches=response=>{
      const url=new URL(response.url());
      return url.pathname==='/superadmin/listados'&&url.searchParams.get('tipo')==='promos'&&url.searchParams.get('q')===promo.titulo;
    };
    const [response]=await Promise.all([
      page.waitForResponse(matches,options),page.locator('#dir-promos-q').fill(promo.titulo,options),
    ]);
    const result=await response.json();
    if(!response.ok()||!result.preparado)throw Error('Listado administrativo no disponible.');
    list=page.locator('#ghPromosList');
    await list.locator('details, nav').first().waitFor(options);
  }
  const found=list.getByText(promo.titulo,{exact:name!=='gran-hermano'}).first();
  if(promo.esperado==='presente')await found.waitFor(options);
  else if(await found.count()||/no se pudieron cargar|cargando promos|error/i.test(await list.innerText()))throw Error('La ausencia de la promoción no quedó comprobada.');
}

if (require.main===module) main(process.argv.slice(2)).catch(error=>{
  console.error(error.code==='MODULE_NOT_FOUND'?'Instalá Playwright con npm install --no-save --package-lock=false playwright@1.55.0':error.message);
  process.exitCode=1;
});
module.exports = {installMeasurement,checkPromo};
