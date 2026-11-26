const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');

async function run() {
  const html = readFileSync('plataforma/administracion.html', 'utf8');
  const start = html.indexOf('function ghTerrId_(');
  const end = html.indexOf('async function buscarSus(', start);
  const controls = html.match(/<div class="toolbar"><button id="btnCiudadesRefresh">[^\n]+?<\/div><div id="territorioAlta"><\/div>/)?.[0];
  assert(start >= 0 && end > start && controls);
  const browser = await chromium.launch({ executablePath:process.env.GLD_CHROME, args:['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport:{ width:390, height:844 }, serviceWorkers:'block' });
    page.setDefaultTimeout(5000);
    const posts = [];
    await page.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).pathname === '/') return route.fulfill({ contentType:'text/html; charset=utf-8', body:controls });
      assert.equal(new URL(request.url()).pathname, '/superadmin/cities/create');
      const { item } = request.postDataJSON();
      posts.push(item);
      return route.fulfill({ json:{ success:true, ciudad:item } });
    });
    await page.goto('https://fixture.invalid');
    await page.addScriptTag({ content:`
      const GH_COUNTRIES=[{pais_id:'AR',nombre:'Argentina'},{pais_id:'UY',nombre:'Uruguay'}];
      const GH_PROVINCES=[{provincia_id:'BA',pais_id:'AR',nombre:'Buenos Aires'},{provincia_id:'MO',pais_id:'UY',nombre:'Montevideo'}];
      let GH_CITIES=[];
      const esc=String, TOKEN='fixture', TERRITORY_API_ORIGIN=location.origin;
      const ghInvalidarCatalogoPublicoCiudades=()=>{}, ghRenderCiudades=()=>{};
      ${html.slice(start,end)}
    ` });
    const form = page.locator('#territorioAlta');
    for (const name of ['+ País', '+ Provincia / Estado']) {
      await page.getByRole('button', { name, exact:true }).click();
      await form.locator('input').fill('Ensayo');
      const country = form.locator('[data-terr-pais]');
      if (await country.count()) await country.selectOption('AR');
      const alert = page.waitForEvent('dialog');
      const click = form.getByRole('button', { name:'Guardar' }).click();
      const dialog = await alert;
      assert.match(dialog.message(), /País y Provincia se mantienen como contexto existente/);
      await dialog.dismiss();
      await click;
      await form.getByRole('button', { name:'Cancelar' }).click();
      assert.equal(posts.length, 0);
    }
    await page.getByRole('button', { name:'+ Ciudad / Partido', exact:true }).click();
    await form.locator('input').fill('Ciudad de ensayo');
    await form.locator('[data-terr-pais]').selectOption('AR');
    const province = form.locator('[data-terr-prov]');
    assert.deepEqual(await province.locator('option').evaluateAll(options=>options.map(option=>option.value)), ['', 'BA']);
    await province.selectOption('BA');
    await form.getByRole('button', { name:'Guardar' }).click();
    await form.getByRole('button', { name:'Guardar' }).waitFor({ state:'detached' });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].nombre, 'Ciudad de ensayo');
    assert.equal(posts[0].provincia_id, 'BA');
    assert.equal(posts[0].pais_id, 'AR');
    console.log('GH: país y provincia detenidos antes del POST; ciudad filtra provincias y confirma un POST simulado.');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
