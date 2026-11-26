const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');
const vm = require('node:vm');

const source = readFileSync('plataforma/administracion.html', 'utf8');
function section(from, until, text = source) {
  const start = text.indexOf(from), end = text.indexOf(until, start);
  assert(start >= 0 && end > start);
  return text.slice(start, end);
}

function catalogFixture() {
  const worker = readFileSync('worker/worker206.txt', 'utf8');
  const origin = { nivel_id: 'CONFIG_GENERAL_ANUNCIANTES', carga_comercial_sedes_max: 2 };
  const catalogs = { prestaciones: [], niveles_anunciante: [origin] };
  const documents = new Map([['niveles_anunciante/' + origin.nivel_id, origin]]);
  const projections = new Map([['admin:catalogs:v2', catalogs], ['commerce', catalogs]]);
  const counts = { firestoreWrites: 0, kvReads: 0, kvWrites: 0, kvDeletes: 0 };
  const save = vm.runInNewContext(
    section('function comparable(', '// reconstruccion/worker/modules/promos-v2.js', worker) +
    section('const GLD_PRESTACIONES_DEFAULT200=', '// PRECIOS UNIFICADOS:', worker) +
    '\nsaveAdminCatalogV2',
    { KEYS: { commerce: 'commerce' }, GH_FIXED_CATALOGS169: ['prestaciones', 'niveles_anunciante'], GH_FIXED_PACKET_KEY169: 'gh-fixed' }
  );
  const cache = {
    async get(key) { counts.kvReads++; return projections.get(key); },
    async put(key, value) { counts.kvWrites++; projections.set(key, value); },
    async del(key) { counts.kvDeletes++; projections.delete(key); }
  };
  const db = {
    async patch(collection, id, patch, { mustExist }) {
      const key = collection + '/' + id;
      assert.equal(documents.has(key), mustExist);
      const saved = { ...documents.get(key), ...patch };
      documents.set(key, saved);
      counts.firestoreWrites++;
      return saved;
    }
  };
  return { counts, projections, save: request => save({ cache, db, ...request }) };
}

async function run() {
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.GLD_CHROME, args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const requests = [], prompts = [], alerts = [];
    let fail = true;
    const backend = catalogFixture();
    page.on('dialog', dialog => {
      if (dialog.type() === 'prompt') return dialog.accept(prompts.shift());
      alerts.push(dialog.message());
      return dialog.dismiss();
    });
    await page.route('https://fixture.invalid/**', async route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ contentType: 'text/html', body: '<main id="prestaciones"></main><aside id="cupos"></aside>' });
      }
      const request = route.request().postDataJSON();
      requests.push(request);
      const json = fail ? { success: false } : await backend.save(request);
      await route.fulfill({ json });
    });
    await page.goto('https://fixture.invalid/');
    await page.addScriptTag({ content: `
      const GH_CATALOGOS=[{tipo:'prestaciones',idField:'prestacion_id',box:'prestaciones'}];
      const GH_CATALOG_CACHE={prestaciones:[],niveles_anunciante:[{nivel_id:'CONFIG_GENERAL_ANUNCIANTES',carga_comercial_sedes_max:2}]};
      const GH_FIXED_PACKET169={catalogos:{}};
      const GLD_CLASSIFICATION={active:row=>row.activo!==false};
      const esc=String;
      async function api(action,data,method){
        return (await fetch('/'+action,{method,body:JSON.stringify(data)})).json();
      }
      ${section('const GH_CARGA_GENERAL_ID=', '// Inventario de datos:')}
      ${section('function ghInfoAnuncianteCuposRender_', 'function ghCargaGeneralRender')}
      ${section('function ghRenderCatalogo(def,rows)', 'const GH_REGLAS_OPCIONES=')}
      ${section('let GH_PRESTACION_CREANDO=', 'function ghNodoTipoOptions')}
      ghRenderCatalogo(GH_CATALOGOS[0], GH_CATALOG_CACHE.prestaciones);
      document.getElementById('cupos').innerHTML=ghInfoAnuncianteCuposRender_(GH_CATALOG_CACHE.niveles_anunciante);
    ` });
    const add = page.getByRole('button', { name: '+ Agregar prestación' });
    prompts.push('Conexión wifi', 'wifi', 'wifi');
    await add.click();
    await page.waitForFunction(() => !GH_PRESTACION_CREANDO);
    assert.equal(requests.length, 1);
    assert.equal(alerts.length, 1);
    assert.equal(await page.locator('#prestaciones details').count(), 0);
    assert.equal(await page.evaluate(() => GH_CATALOG_CACHE.prestaciones.length), 0);

    fail = false;
    prompts.push('Conexión wifi', 'wifi', 'wifi');
    await add.click();
    await page.getByText('Conexión wifi', { exact: true }).click();
    assert.deepEqual(requests[1], {
      tipo: 'prestaciones', item: { prestacion_id: 'wifi', nombre: 'Conexión wifi', activo: true, icono: 'wifi' }
    });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    assert.equal(requests.length, 2);
    const icon = page.locator('[data-cat-icono="wifi"]');
    await icon.fill('square');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.waitForFunction(() => GH_CATALOG_CACHE.prestaciones[0]?.icono === 'square');
    assert.equal(requests.length, 3);
    assert.equal(requests[2].item.icono, 'square');

    await page.locator('#cupos summary').click();
    const seats = page.locator('[data-info-cupo="sedes_max"]');
    assert.equal(await seats.getAttribute('min'), '-1');
    await seats.fill('-1');
    const save = page.locator('#ghInfoAnuncianteCuposSave');
    await save.click();
    const status = page.locator('#ghInfoAnuncianteCuposMsg');
    await page.waitForFunction(() => document.querySelector('#ghInfoAnuncianteCuposMsg').textContent.includes('guardad'));
    assert.deepEqual(requests[3], {
      tipo: 'niveles_anunciante', item: { nivel_id: 'CONFIG_GENERAL_ANUNCIANTES', carga_comercial_sedes_max: -1 }
    });
    await save.click();
    assert.equal(await status.textContent(), 'Sin cambios.');
    await page.locator('[data-info-cupo="categorias_max"]').fill('-1');
    await save.click();
    assert.match(await status.textContent(), /Cupo no válido/);
    assert.equal(requests.length, 4);
    const shared = backend.projections.get('commerce');
    assert.equal(shared.prestaciones.find(row => row.prestacion_id === 'wifi').icono, 'square');
    assert.equal(shared.niveles_anunciante[0].carga_comercial_sedes_max, -1);
    assert.deepEqual(backend.counts, { firestoreWrites: 3, kvReads: 6, kvWrites: 6, kvDeletes: 3 });
    console.log('Contratos Worker y catálogo de Anunciante, servicios simulados:', backend.counts);
    console.log('PASS Prestaciones: rechazo, reintento, edición y guardado sin cambios. Cupos: sedes ilimitadas, descarte de categoría inválida y guardado sin cambios. 4 POST interceptados en Chromium.');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
