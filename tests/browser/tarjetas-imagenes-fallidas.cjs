const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');

function section(file, start, end) {
  const source = readFileSync(file, 'utf8');
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert(first >= 0 && last > first, file);
  return source.slice(first, last);
}

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.GLD_CHROME, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const images = [];
    await page.route('**/*', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType:'text/html', body:'<main id="efem"></main><main id="cards"></main>' });
      assert(['efem.jpg','promo.jpg','logo.jpg'].includes(path.slice(1)));
      images.push(path);
      return route.fulfill({ status: 404 });
    });
    await page.goto('https://fixture.invalid');
    await page.addScriptTag({ content: `
      ${section('plataforma/carcasa.html','function efemEsc(','const efemCalendars=')}
      ${section('plataforma/promos.html','function renderCards(','function toggleExtras(')}
      const itemsPerPage=10, hasMeaningfulData=()=>true, buildBannerSequence=()=>[];
      const safeUrl=String, escapeHtml=efemEsc, GLD_MEDIA={imageUrl:String};
      const buildCatLabel=()=>'', getWhatsAppForCom=()=>'', makeMapLink=()=>'';
      const initPromoBanners=()=>{}, renderPaginator=()=>{};
      document.querySelector('#efem').innerHTML=efemHoyCardHtml({
        nombre:'Aniversario', descripcion:'Descripción histórica', imagen:'/efem.jpg'
      });
      renderCards([{anunciante:'Comercio',promo:'Oferta vigente',otros:'Información adicional',img:'/promo.jpg',logo:'/logo.jpg'}]);
    ` });
    for (const selector of ['.efem-hoy-img','.promo-img-wrap','.logo-comercio']) {
      const locator = page.locator(selector);
      await locator.waitFor({ state:'attached' });
      await page.waitForFunction(selector => document.querySelector(selector)?.style.display === 'none', selector);
      assert.equal(await locator.count(), 1);
    }
    for (const text of ['Aniversario','Descripción histórica','Comercio','Oferta vigente','Información adicional']) {
      await page.getByText(text, { exact:true }).waitFor();
    }
    assert.deepEqual(images.sort(), ['/efem.jpg','/logo.jpg','/promo.jpg']);
    console.log('Usuario: tres imágenes con HTTP 404, una solicitud por imagen y texto de ambas tarjetas visible.');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });

