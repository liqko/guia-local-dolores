const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const vm = require('node:vm');

function wrapper(source) {
  const start = source.indexOf('const fields={empleos:');
  const end = source.indexOf('return withPanelCacheV48;', start);
  assert(start >= 0 && end > start);
  return vm.runInNewContext(source.slice(start, end) + '\nwithPanelCacheV48', {
    structuredClone, PUBLICATION_COLLECTIONS: new Set()
  });
}

async function exercise(build) {
  const key = 'panel:query:v48:actividades:A';
  const marker = key + ':changes';
  const delta = key + ':delta:ACT-1';
  const counts = { get: 0, list: 0, put: 0, firestore: 0 };
  const record = { id: 'ACT-1', anunciante_id: 'A' };
  const entries = new Map([[marker, { revision: 'r1', updated_at: Date.now() }]]);
  const db = { async queryEqual() { counts.firestore++; return [record]; } };
  const kv = {
    async get(name) {
      counts.get++;
      const packet = entries.get(name);
      return packet ? JSON.stringify({ version: 48, ...packet }) : null;
    },
    async list() {
      counts.list++;
      if (counts.list === 1) {
        // Another mutation commits its delta and marker after this list started.
        entries.set(delta, { id: record.id, deleted: true });
        entries.set(marker, { revision: 'r2', updated_at: Date.now() });
        return { keys: [], list_complete: true };
      }
      return { keys: [{ name: delta }], list_complete: true };
    },
    async put(name, value) { counts.put++; entries.set(name, JSON.parse(value)); }
  };
  function read() {
    return build(db, { GLD_CACHE_KV: kv }).panelReadDb().queryEqual('actividades', 'anunciante_id', 'A');
  }
  assert.equal((await read()).length, 1);
  const revision = entries.get(key).revision;
  const cold = { ...counts };
  const warm = await read();
  return { cold, revision, remainsVisible: warm.length > 0, total: counts };
}

test('La copia fría conserva la revisión aplicada y la lectura siguiente recibe la baja', async t => {
  const path = 'worker/worker206.txt';
  const result = await exercise(wrapper(readFileSync(path, 'utf8')));
  assert.equal(result.revision, 'r1');
  assert.equal(result.remainsVisible, false);
  assert.deepEqual(result.cold, { get: 2, list: 1, put: 1, firestore: 1 });
  assert.equal(result.total.firestore, 1);
  t.diagnostic('Corte controlado: ' + JSON.stringify(result));
  if (process.env.GLD_COMPARAR_REF) {
    const baseline = execFileSync('git', ['show', process.env.GLD_COMPARAR_REF + ':' + path], {
      encoding: 'utf8', maxBuffer: 4_000_000
    });
    const before = await exercise(wrapper(baseline));
    assert.equal(before.revision, 'r2');
    assert.equal(before.remainsVisible, true);
    assert.deepEqual(before.cold, { get: 3, list: 1, put: 1, firestore: 1 });
    t.diagnostic('Base controlada: ' + JSON.stringify(before));
  }
});
