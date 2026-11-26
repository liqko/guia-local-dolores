const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const path = 'plataforma/anunciantes.html';
const loader = readFileSync('plataforma/tarjetas-imagenes.js', 'utf8');

async function exercise(browser, source, deferred) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, serviceWorkers: 'block' });
  try {
    const requests = [];
    await page.route('https://fixture.invalid/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/proxy') {
        requests.push(url.searchParams.get('url'));
        return route.fulfill({ json: { image: null } });
      }
      return route.fulfill({
        contentType: 'text/html',
        body: '<style>span{display:inline-block}</style><main id="a" style="margin-top:2500px"></main><main id="b" style="margin-top:2500px"></main>'
      });
    });
    page.setDefaultTimeout(5000);
    await page.goto('https://fixture.invalid/');
    await page.evaluate(() => {
      const originalObserver=IntersectionObserver;
      window.initialVisibility=new Promise(resolve=>{window.gldInitialVisibility=resolve});
      window.IntersectionObserver=class extends originalObserver {
        constructor(callback,options){
          super((entries,observer)=>{callback(entries,observer);window.gldInitialVisibility()},options);
        }
      };
    });
    await page.addScriptTag({ content: loader });
    const start = source.indexOf('function renderGaleria(');
    const end = source.indexOf('function limitePublicacionNivel_', start);
    assert(start >= 0 && end > start);
    await page.addScriptTag({ content: `
      const GLD_CLASSIFICATION={rules:()=>({imagenes_max:3}),flag:()=>true};
      const reglaNivel_=()=>({}),isInstagramPost=()=>true;
      const gldMediaAttribute_=String;
      const fetchInstagramImage=url=>fetch('/proxy?url='+encodeURIComponent(url)).then(r=>r.json()).then(r=>r.image);
      ${source.slice(start,end)}
      for(const id of ['a','b']){
        const item={img1:'https://instagram.example/p/'+id};
        document.getElementById(id).innerHTML=renderGaleria(item,6,id);
      }
    ` });
    if (deferred) await page.evaluate(() => window.initialVisibility);
    else await page.waitForFunction(() => [...document.querySelectorAll('.galeria-placeholder')].every(el => el.textContent.includes('No disponible')));
    const initial = requests.length;
    await page.locator('#instaimg-a-0').scrollIntoViewIfNeeded();
    await page.locator('#instaimg-a-0').getByText('No disponible').waitFor();
    const afterScroll = requests.length;
    if (deferred) assert.deepEqual(requests, ['https://instagram.example/p/a']);
    return { initial, afterScroll };
  } finally { await page.close(); }
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GLD_CHROME, args: ['--no-sandbox'] });
  try {
    const after = await exercise(browser, readFileSync(path, 'utf8'), true);
    assert.deepEqual(after, { initial: 0, afterScroll: 1 });
    console.log('Galería, Chromium con proxy interceptado, candidato:', after);
    if (process.env.GLD_COMPARAR_REF) {
      const before = execFileSync('git', ['show', process.env.GLD_COMPARAR_REF + ':' + path], { encoding: 'utf8', maxBuffer: 1_000_000 });
      const observed = await exercise(browser, before, false);
      assert.deepEqual(observed, { initial: 2, afterScroll: 2 });
      console.log('Galería, misma secuencia en base:', observed);
    }
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
