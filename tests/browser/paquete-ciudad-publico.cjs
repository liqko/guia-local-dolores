const assert = require('node:assert/strict');
const {readFile,access} = require('node:fs/promises');
const {chromium} = require('playwright');
const {validBook} = require('../../plataforma/paquete-ciudad.js');

(async () => {
  const origin = process.env.GLD_PUBLIC_ORIGIN || 'https://anunciantes-guialocal.web.app';
  const root = '/plataforma/paquetes-ciudad/';
  async function get(path) {
    const response = await fetch(origin + root + path, {signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,path);
    return response.json();
  }
  const published = await get('publicacion.json');
  const staged = JSON.parse(await readFile('hosting-public' + root + 'publicacion.json','utf8'));
  assert.deepEqual(published,staged,'La versión alojada debe coincidir con el corte preparado');
  const scope = process.env.GLD_URGENT_SCOPE ? new Set(JSON.parse(process.env.GLD_URGENT_SCOPE).map(entry=>entry.city)) : null;
  const cities = [];
  for (const entry of Object.entries(published.manifest)){
    const [city,{key,revision}]=entry;
    if(scope&&!scope.has(city))continue;
    const exists=await access('hosting-public'+root+key+'/completo-'+revision+'.json').then(()=>true,error=>{
      if(error.code!=='ENOENT')throw error;
      return false;
    });
    if(exists)cities.push(entry);
  }
  if(!cities.length){console.log('Se verificó el índice publicado. No generó paquetes nuevos.');return;}
  const browser = await chromium.launch({executablePath:process.env.GLD_CHROME,headless:true,args:['--no-sandbox']});
  try {
    for (const [city,{key,revision}] of cities) {
      const file = key + '/completo-' + revision + '.json';
      const expected = JSON.parse(await readFile('hosting-public' + root + file,'utf8'));
      assert(validBook(expected,city));
      const context = await browser.newContext({serviceWorkers:'block'});
      const packages = [], worker = [];
      context.on('request',request => {
        const url = new URL(request.url());
        if (url.pathname.startsWith(root)) packages.push(url.pathname);
        if (url.hostname.endsWith('workers.dev')) worker.push(url.pathname);
      });
      const page = await context.newPage();
      const target = new URL('/descubrir',origin);
      target.searchParams.set('ciudad_id',city);
      await page.goto(target.href,{waitUntil:'domcontentloaded'});
      async function check() {
        await page.waitForFunction(() => !!window.GLD_PAQUETE_CIUDAD);
        const actual = await page.evaluate(city => window.GLD_PAQUETE_CIUDAD.get(city),city);
        assert.deepEqual(actual,expected,'Copia de navegador de ' + city);
        await page.frameLocator('#moduloCentralFrame').locator('#contenedor').waitFor({state:'attached',timeout:20000});
        await page.waitForTimeout(1500);
        const replaced = new Set(['/guide','/events-new','/promos','/actividades','/publicidad','/farmacias']);
        assert.deepEqual(worker.filter(path=>replaced.has(path)),[],'Rutas antiguas de '+city);
      }
      await check();
      assert.deepEqual(packages,[root+'publicacion.json',root+file],'Primera descarga de '+city);
      packages.length = 0;
      await page.reload({waitUntil:'domcontentloaded'});
      await check();
      assert.deepEqual(packages,[root+'publicacion.json'],'Recarga sin cambios de '+city);
      console.log(JSON.stringify({city,revision,modules:6,firstPackageRequests:1,reloadPackageRequests:0,replacedWorkerRequests:0}));
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('Comprobación pública aprobada: '+cities.length+' ciudades. No mide factura ni el consumo total de página.');
})().catch(error=>{console.error(error);process.exit(1);});
