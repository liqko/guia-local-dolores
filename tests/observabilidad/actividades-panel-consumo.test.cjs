const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const vm = require('node:vm');

async function readPanel(source, status) {
  const start = source.indexOf('async function actividadesPanelData(');
  const end = source.indexOf('// reconstruccion/worker/modules/actividades-v2', start);
  assert(start >= 0 && end > start);
  const calls = { master: 0, activities: 0, schedules: 0 };
  const admin = { enabled: status === 'enabled', slots: 4 };
  const panel = vm.runInNewContext(source.slice(start, end) + '\nactividadesPanelData', {
    async commerceMaster205() {
      calls.master++;
      if (status === 'missing') throw Error('Copia no disponible');
      return { advertiser: { administracion: admin, sedes: [], datos: { id: 'A' } } };
    },
    rejectedActivity: () => false,
    getPreparedRelationsV1: ({ load }) => load(),
    cupoGuardado: max => max * 2
  });
  const db = {
    panelReadDb() { return this; },
    async queryEqual(collection, field, id, limit) {
      assert.equal(limit, 500);
      if (collection === 'actividades') {
        assert.deepEqual([field, id], ['anunciante_id', 'A']);
        calls.activities++;
        return [{ actividad_id: 'ACT-1' }];
      }
      assert.deepEqual([collection, field, id], ['actividad_horarios', 'actividad_id', 'ACT-1']);
      calls.schedules++;
      return [{ id: 'H-1' }];
    }
  };
  const options = { db, advertiserId: 'A', featureAllowed: a => a.enabled, cupoMax: a => a.slots };
  if (status === 'missing') {
    await assert.rejects(panel(options), /Copia no disponible/);
    return { calls };
  }
  const response = await panel(options);
  return { calls, response: JSON.parse(JSON.stringify(response)) };
}

test('Actividades sólo lee fichas y horarios si la copia maestra habilita el módulo', async t => {
  const file = 'worker/worker206.txt';
  const after = readFileSync(file, 'utf8');
  const disabled = await readPanel(after, 'disabled'), missing = await readPanel(after, 'missing');
  const allowed = await readPanel(after, 'enabled');
  assert.equal(disabled.response.success, false);
  for (const result of [disabled, missing]) assert.deepEqual(result.calls, { master: 1, activities: 0, schedules: 0 });
  assert.deepEqual(allowed.calls, { master: 1, activities: 1, schedules: 1 });
  assert.deepEqual(allowed.response.actividades[0].horarios, [{ id: 'H-1' }]);
  t.diagnostic('Candidato: ' + JSON.stringify({ disabled: disabled.calls, missing: missing.calls, enabled: allowed.calls }));
  if (process.env.GLD_COMPARAR_REF) {
    const before = execFileSync('git', ['show', process.env.GLD_COMPARAR_REF + ':' + file], {
      encoding: 'utf8', maxBuffer: 4_000_000
    });
    const prevDisabled = await readPanel(before, 'disabled'), prevMissing = await readPanel(before, 'missing');
    assert.deepEqual(prevDisabled.calls, { master: 1, activities: 1, schedules: 0 });
    assert.deepEqual(prevMissing.calls, prevDisabled.calls);
    assert.deepEqual(await readPanel(before, 'enabled'), allowed);
    t.diagnostic('Base sin habilitación y sin copia: ' + JSON.stringify(prevDisabled.calls));
  }
});
