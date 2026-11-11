const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile, writeFile, cp, mkdtemp, rm } = require('node:fs/promises');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { tmpdir } = require('node:os');
const { lists } = require('../../plataforma/paquete-ciudad.js');

(async () => {
  const { prepareCityBooks } = await import('../../scripts/preparar-paquete-ciudad.mjs');
  const root = await mkdtemp(join(tmpdir(), 'gld-hosting-'));
  await cp(join(__dirname, '../../plataforma'), join(root, 'plataforma'), { recursive: true });
  const catalog = join(root, 'plataforma/territorio-cache.js');
  const source = await readFile(catalog, 'utf8');
  const city = 'dolores';
  const book = { city, revision: 1, modules: Object.fromEntries(
    Object.entries(lists).map(([name, [field]]) => [name, {success:true,[field]:[]}]),
  )};
  book.modules.guide.results = [{id:'test', anunciante_id:'test', nombre:'Comercio de prueba', activo:true}];
  book.modules.pharmacy.version = 139;
  book.modules.pharmacy.ciudad_id = city;
  async function publish(batches) {
    const territory = {revision:1,data:{success:true,ciudades:[{ciudad_id:city,nombre:'Dolores',pais_id:'ar',provincia_id:'ba'}],paises:[{pais_id:'ar',nombre:'Argentina'}],provincias:[{provincia_id:'ba',nombre:'Buenos Aires',pais_id:'ar'}]}};
    await writeFile(catalog, source.replace('/* GLD_TERRITORY_SNAPSHOT */ null', JSON.stringify(territory)));
    await prepareCityBooks({ initial:[book], batches }, root);
  }
  await publish([]);
  const server = createServer(async (req,res) => {
    const path = new URL(req.url,'http://localhost').pathname;
    const types = {js:'application/javascript',json:'application/json',html:'text/html',css:'text/css'};
    try {
      const body = await readFile(join(root,path));
      res.writeHead(200, {'Content-Type':types[path.split('.').at(-1)] || 'application/octet-stream','Cache-Control':'no-cache'});
      res.end(body);
    } catch {
      res.writeHead(404); res.end();
    }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({executablePath:process.env.GLD_CHROME,headless:true,args:['--no-sandbox']});
  try {
    const ctx = await browser.newContext({serviceWorkers:'block'});
    const attempts = [];
    const packages = [];
    await ctx.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        if (url.pathname.startsWith('/plataforma/paquetes-ciudad/')) packages.push(url.pathname);
        return route.continue();
      }
      if (url.hostname.endsWith('workers.dev')) {
        attempts.push(url.pathname);
        return route.fulfill({json:{success:true,version:169}});
      }
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', error => console.log('PAGE',error.message));
    await page.goto(origin + '/plataforma/carcasa.html?pais_id=ar&provincia_id=ba&ciudad_id=dolores&ciudad=Dolores');
    const frame = page.frameLocator('#moduloCentralFrame');
    const rendered = name => frame.locator('#contenedor').getByText(name).first().waitFor({timeout:7000});
    await rendered('Comercio de prueba');
    await page.waitForTimeout(1200);
    assert.equal(packages.length, 1);
    assert.match(packages.pop(), /completo-1\.json$/);
    const watched = new Set(['/guide','/events-new','/promos','/actividades','/publicidad','/farmacias']);
    assert.deepEqual(attempts.filter(path => watched.has(path)), []);
    console.log('Primera apertura real de la pantalla: un paquete, cero consultas a las seis rutas sustituidas.');
    await page.reload();
    await rendered('Comercio de prueba');
    await page.waitForTimeout(1200);
    assert.deepEqual(packages, []);
    assert.deepEqual(attempts.filter(path => watched.has(path)), []);
    console.log('Recarga en Chromium con IndexedDB: cero pedidos de paquete.');
    await publish([{city,from:1,revision:2,changes:{guide:{upsert:[{id:'test',anunciante_id:'test',nombre:'Comercio actualizado',activo:true}],remove:[]}}}]);
    await page.reload();
    await rendered('Comercio actualizado');
    await page.waitForTimeout(1200);
    assert.equal(packages.length, 1);
    assert.match(packages[0], /cambios-1-2\.json$/);
    assert.deepEqual(attempts.filter(path => watched.has(path)), []);
    console.log('Recarga tras publicar un cambio: un pedido de diferencias, ficha actualizada.');
  } finally {
    await browser.close();
    server.close();
    await rm(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
