import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepareCityBooks } from '../scripts/preparar-paquete-ciudad.mjs';
import bookTools from '../plataforma/paquete-ciudad.js';

const { client, lists } = bookTools;

function initial(city) {
  return { city, revision: 1, modules: Object.fromEntries(
    Object.entries(lists).map(([name, [field]]) => [name, { success: true, [field]: [] }]),
  ) };
}

test('primera apertura, recarga vigente, un lote de veinte altas, edición y baja', async t => {
  const root = await mkdtemp(join(tmpdir(), 'guia-ciudad-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'plataforma'));
  const catalog = join(root, 'plataforma', 'territorio-cache.js');
  const source = await readFile(new URL('../plataforma/territorio-cache.js', import.meta.url), 'utf8');
  const dolores = initial('dolores');
  const tandil = initial('tandil');
  dolores.modules.events.events = Array.from({ length: 6980 }, (_, i) => ({ evento_id: 'existente-' + i }));
  dolores.modules.events.data = dolores.modules.events.events;
  const newRows = Array.from({ length: 20 }, (_, i) => ({ evento_id: 'nuevo-' + i, nombre: 'Alta ' + i }));
  const batch = { city: 'dolores', from: 1, revision: 2,
    changes: { events: { upsert: newRows, remove: [] } } };

  const storage = new Map();
  const requests = [];
  let manifest;
  const open = () => client({
    manifest: city => manifest[city],
    storage: { get: city => storage.get(city), put: book => storage.set(book.city, book) },
    async fetchJson(path) {
      requests.push(path);
      return JSON.parse(await readFile(join(root, path.slice(1)), 'utf8'));
    },
  });
  async function publish(batches) {
    await writeFile(catalog, source);
    manifest = await prepareCityBooks({ initial: [dolores, tandil], batches }, root);
  }
  await publish([]);
  const first = open();
  const copies = await Promise.all(Array.from({ length: 6 }, () => first.get('dolores')));
  assert(copies.every(copy => copy.modules.events.events.length === 6980));
  assert.equal(copies[0].modules.events.data, undefined);
  assert.equal(requests.length, 1);
  assert.match(requests.pop(), /completo-1\.json$/);
  assert.equal((await open().get('dolores')).revision, 1);
  assert.equal(requests.length, 0);

  await publish([batch]);
  const updated = await open().get('dolores');
  assert.equal(updated.modules.events.events.length, 7000);
  assert.equal(requests.length, 1);
  const deltaPath = requests.pop();
  assert.match(deltaPath, /cambios-1-2\.json$/);
  const payload = JSON.parse(await readFile(join(root, deltaPath.slice(1)), 'utf8'));
  assert.deepEqual(Object.keys(payload.changes), ['events']);
  assert.deepEqual(payload.changes.events.upsert, newRows);
  assert.equal((await open().get('dolores')).revision, 2);
  assert.equal(requests.length, 0);

  const noChanges = { city: 'dolores', from: 2, revision: 3, changes: {} };
  await publish([batch, noChanges]);
  assert.equal(manifest.dolores.revision, 2);
  assert.equal((await open().get('dolores')).revision, 2);
  assert.equal(requests.length, 0);

  const edited = { ...newRows[0], nombre: 'Editado' };
  await publish([batch, noChanges, { city: 'dolores', from: 3, revision: 4,
    changes: { events: { upsert: [edited], remove: [newRows[1].evento_id] } } }]);
  const latest = await open().get('dolores');
  assert.equal(latest.modules.events.events.length, 6999);
  assert.deepEqual(latest.modules.events.events.at(-19), edited);
  assert.match(requests.pop(), /cambios-2-4\.json$/);
  storage.set('dolores', dolores);
  assert.equal((await open().get('dolores')).revision, 4);
  assert.match(requests.pop(), /cambios-1-4\.json$/);
  assert.equal((await open().get('tandil')).modules.events.events.length, 0);
  assert.match(requests.pop(), /completo-1\.json$/);
  assert.equal(await open().get('sin-publicacion'), null);
  assert.equal(requests.length, 0);
});
