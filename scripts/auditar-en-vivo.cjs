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

function installMeasurement(context, services=domains) {
  const rows = new Map(), pending = [];
  function observe(request) {
    const url = new URL(request.url());
    const service = services.get(url.hostname);
    if (!service) return;
    const row = {service,path:url.pathname,method:request.method(),status:null,bodyBytes:null,headerBytes:null,consumption:null};
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
  if (!Object.hasOwn(routes,name)||!['sesion','ejecutar'].includes(action)||sessionOption&&sessionOption!=='--con-sesion') {
    throw Error('Uso: node scripts/auditar-en-vivo.cjs <sesion|ejecutar> <usuario|anunciante|gran-hermano> [--con-sesion]');
  }
  const {chromium} = require('playwright');
  const base = process.env.GLD_AUDIT_DIR || join(homedir(),'.gld-auditoria');
  await mkdir(base,{recursive:true,mode:0o700});
  const state = join(base,name+'.session.json');
  const interactive = action==='sesion';
  const session = !interactive&&(name!=='usuario'||Boolean(sessionOption));
  let browser, evidence, failure;
  const javascriptErrors = [];
  try {
    if (session) await access(state);
    browser = await chromium.launch({headless:!interactive,executablePath:process.env.GLD_CHROME});
    const context = await browser.newContext(session?{storageState:state}:{});
    if (!interactive) evidence = installMeasurement(context);
    const page = await context.newPage();
    page.on('pageerror',error=>javascriptErrors.push(error.name));
    const response = await page.goto(origin+(interactive&&route.login?route.login:route.path),{waitUntil:'load',timeout:25000});
    if (!response?.ok()) throw Error('La interfaz no respondió correctamente.');
    if (interactive) {
      const {createInterface} = require('node:readline/promises');
      const input = createInterface({input:process.stdin,output:process.stdout});
      try {await input.question('Ingresá en el navegador. Cuando termine, presioná Enter aquí. ');}
      finally {input.close();}
    }
    await page.locator(interactive&&route.loginReady?route.loginReady:route.ready).first().waitFor({state:'visible',timeout:15000});
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
        const result = {date:new Date().toISOString(),interface:name,sessionRequested:session,result:failure?'fallo':'aprobado',
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

if (require.main===module) main(process.argv.slice(2)).catch(error=>{
  console.error(error.code==='MODULE_NOT_FOUND'?'Instalá Playwright con npm install --no-save --package-lock=false playwright@1.55.0':error.message);
  process.exitCode=1;
});
module.exports = {installMeasurement};
