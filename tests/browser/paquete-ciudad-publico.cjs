const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
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
  const cities = Object.entries(published.manifest);
  assert(cities.length > 0);
  const browser = await chromium.launch({executablePath:process.env.GLD_CHROME,headless:true,args:['--no-sandbox']});
  try {
    for (const [city,{key,revision}] of cities) {
      const file = key + '/completo-' + revision + '.json';
      const expected = await get(file);
      assert(validBook(expected,city));
      assert.deepEqual(expected,JSON.parse(await readFile('hosting-public' + root + file,'utf8')));
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
      assert.equal(packages.length,1,'Primera descarga de '+city);
      assert(packages[0].endsWith('/'+file));
      packages.length = 0;
      await page.reload({waitUntil:'domcontentloaded'});
      await check();
      assert.deepEqual(packages,[],'Recarga sin cambios de '+city);
      console.log(JSON.stringify({city,revision,modules:6,firstPackageRequests:1,reloadPackageRequests:0,replacedWorkerRequests:0}));
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('Comprobación pública aprobada: '+cities.length+' ciudades. No mide factura ni el consumo total de página.');
})().catch(error=>{console.error(error);process.exit(1);});
