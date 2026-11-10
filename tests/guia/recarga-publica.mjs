import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const hosting = JSON.parse(read('firebase.json')).hosting;
const brand = read('plataforma/marca-global.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const logoPath = manifest.icons[0].src;
const assets = hosting.headers.filter(rule => rule.source.startsWith('/recursos/marca/'));
assert.equal(assets.length, 2);
for (const { source, headers } of assets) {
  const [filename, fingerprint, format] = source.split('/').at(-1).split('.');
  const contents = readFileSync('.' + source);
  assert.equal(fingerprint, createHash('sha256').update(contents).digest('hex').slice(0, 12));
  assert.ok(brand.includes(source));
  assert.equal(headers.find(h => h.key === 'Cache-Control').value, 'public, max-age=31536000, immutable');
  const previous = 'plataforma/assets/marca/' + filename + '.' + format;
  assert.ok(hosting.ignore.includes(previous));
  assert.ok(hosting.rewrites.some(rule => rule.source === '/' + previous && rule.destination === source));
}
assert.ok(assets.some(rule => rule.source === logoPath));

const origin = 'https://www.guialocal.ar';
const swHandlers = {};
const cached = new Map();
let network = 0;
runInNewContext(read('plataforma/sw.js'), {
  URL,
  self: { location: { origin }, addEventListener(type, fn) { swHandlers[type] = fn; } },
  caches: { open: async () => ({
    match: async request => cached.get(request.url),
    put: async (request, response) => cached.set(request.url, response)
  }) },
  fetch: async () => { network++; return new Response('image'); }
});
async function getAsset(path) {
  let response;
  const jobs = [];
  swHandlers.fetch({
    request: new Request(origin + path),
    respondWith(promise) { response = promise; },
    waitUntil(job) { jobs.push(job); }
  });
  assert.ok((await response).ok);
  await Promise.all(jobs);
}
for (const { source } of assets) {
  await getAsset(source);
  await getAsset(source);
}
assert.equal(network, 2, 'Solo una descarga por imagen mientras no cambie su huella');
const changed = logoPath.replace(/\.[a-f0-9]{12}\./, '.000000000000.');
await getAsset(changed);
assert.equal(network, 3, 'Una imagen nueva se obtiene con su nueva URL');
await getAsset('/plataforma/marca-global.js');
await getAsset('/plataforma/marca-global.js');
assert.equal(network, 5, 'Los recursos con URL estable siguen validándose');

const html = read('plataforma/carcasa.html');
const navigation = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('function cargarCentro('));
const handlers = new Map();
const controls = new Map();
const getControl = id => {
  if (!controls.has(id)) controls.set(id, {
    dataset: {}, classList: { add() {}, remove() {} },
    addEventListener(type, fn) { handlers.set(id + ':' + type, fn); }
  });
  return controls.get(id);
};
function openGuide() {
  const location = new URL(origin + '/descubrir?ciudad_id=dolores&anunciante_id=ficha&sede_id=local');
  const window = { location, addEventListener() {} };
  controls.clear();
  runInNewContext(navigation, {
    URL, URLSearchParams, window,
    document: { getElementById: getControl, addEventListener() {} },
    localStorage: { getItem: () => '{"ciudad_id":"tandil","ciudad":"Tandil"}' },
    gldRequireSubscriber: () => true,
    gldModuloCargando: 'guia', gldSetModuloCargando() {}, setTimeout() {},
    fetch: () => assert.fail('La apertura no consulta la versión')
  });
  return getControl('moduloCentralFrame');
}
const first = openGuide().src;
const frame = openGuide();
assert.equal(frame.src, first);
assert.equal(first, origin + '/plataforma/anunciantes.html?ciudad_id=dolores&anunciante_id=ficha&sede_id=local');
handlers.get('gldBloqueoReintentar:click')();
assert.ok(new URL(frame.src).searchParams.has('_v'), 'El reintento conserva la posibilidad de forzar la carga');

console.log('PASS Guía pública: imágenes reutilizadas, URL estable, ciudad y ficha conservadas, reintento disponible');
