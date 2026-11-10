import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const origin = new DatabaseSync(':memory:');
origin.exec(`
  CREATE TABLE eventos (id TEXT PRIMARY KEY, ciudad TEXT, actualizado INTEGER, datos TEXT);
  CREATE INDEX eventos_por_ciudad_y_hora ON eventos(ciudad, actualizado);
`);
const insert = origin.prepare('INSERT INTO eventos VALUES (?, ?, ?, ?)');
const select = 'SELECT datos FROM eventos WHERE ciudad = ? AND actualizado >= ? AND actualizado < ?';
const city = 'Dolores';
const previousCut = Date.parse('2026-11-10T04:00:00Z');
const cutoff = Date.parse('2026-11-11T04:00:00Z');
const sample = n => ({
  id: 'evento-' + String(n).padStart(4, '0'),
  anunciante: 'anunciante-' + n,
  ciudad: city,
  nombre: 'Evento público ' + n,
  fecha: '2026-11-15',
  horario: '19:00',
  descripcion: 'Descripción ficticia para probar el tamaño de la ficha. Los datos de esta simulación no son eventos reales.'
});
const bytes = obj => Buffer.byteLength(JSON.stringify(obj));
const stats = () => ({ consultasOrigen: 0, documentosLeidos: 0, escriturasOrigen: 0, lecturasKV: 0, escriturasKV: 0 });

// Preparar el catálogo que ya está publicado, fuera de la ventana medida.
const previous = Array.from({length: 6980}, (_, index) => sample(index + 1));
origin.exec('BEGIN');
for (const record of previous) insert.run(record.id, city, previousCut - 1000, JSON.stringify(record));
origin.exec('COMMIT');
const cache = new Map([[city, JSON.stringify({version: 1, cutoff: previousCut, events: previous})]]);
const get = (city, count) => {
  count.lecturasKV++;
  return JSON.parse(cache.get(city));
};
const put = (city, value, count) => {
  assert.ok(bytes(value) <= 25 * 1024 * 1024, 'El paquete simulado debe caber en un valor de KV');
  cache.set(city, JSON.stringify(value));
  count.escriturasKV++;
};

// Cada alta guarda el evento original una vez. La marca del corte forma parte de esa escritura.
const save = stats();
for (let i = 6981; i <= 7000; i++) {
  const event = sample(i);
  insert.run(event.id, city, previousCut + i * 1000, JSON.stringify(event));
  save.escriturasOrigen++;
}
assert.equal(origin.prepare('SELECT count(*) AS n FROM eventos').get().n, 7000);
const plan = origin.prepare('EXPLAIN QUERY PLAN ' + select).all(city, previousCut, cutoff);
assert.match(plan[0].detail, /SEARCH .*eventos_por_ciudad_y_hora/);

function publish(count) {
  const current = get(city, count);
  if (current.cutoff >= cutoff) return null;
  count.consultasOrigen++;
  const changed = origin.prepare(select).all(city, current.cutoff, cutoff).map(row => JSON.parse(row.datos));
  count.documentosLeidos += changed.length;
  if (!changed.length) return null;
  const merged = new Map(current.events.map(event => [event.id, event]));
  for (const event of changed) merged.set(event.id, event);
  const next = {
    version: current.version + 1,
    cutoff,
    events: [...merged.values()],
    delta: { from: current.version, events: changed }
  };
  put(city, next, count);
  return next;
}

function open(version, count) {
  const published = get(city, count);
  if (version === published.version) return {version, unchanged: true};
  if (version === published.delta?.from) return {version: published.version, events: published.delta.events};
  return {version: published.version, events: published.events};
}

const batch = stats();
const published = publish(batch);
assert.equal(published.events.length, 7000);
assert.equal(published.delta.events.length, 20);
assert.equal(published.delta.events.some(event => event.id === 'evento-6980'), false);
assert.deepEqual(batch, {consultasOrigen: 1, documentosLeidos: 20, escriturasOrigen: 0, lecturasKV: 1, escriturasKV: 1});

const retry = stats();
assert.equal(publish(retry), null);
assert.equal(retry.escriturasKV, 0);
assert.equal(retry.consultasOrigen, 0);

const withChanges = stats(), withoutChanges = stats(), firstVisit = stats();
const delta = open(1, withChanges), unchanged = open(2, withoutChanges), complete = open(null, firstVisit);
assert.equal(delta.events.length, 20);
assert.equal(Object.hasOwn(unchanged, 'events'), false);
assert.equal(complete.events.length, 7000);
const browser = new Map(previous.map(event => [event.id, event]));
for (const event of delta.events) browser.set(event.id, event);
assert.deepEqual([...browser.values()], complete.events);
assert.equal(withChanges.lecturasKV, 1);
assert.equal(withoutChanges.lecturasKV, 1);
origin.close();

console.log(JSON.stringify({
  origen: save,
  corte: {...batch, eventosConservados: previous.length, eventosNuevos: published.delta.events.length, eventosTotales: published.events.length, bytesKV: bytes(published)},
  reintento: retry,
  visitanteConCopiaAnterior: {...withChanges, eventosRecibidos: delta.events.length, bytesRespuesta: bytes(delta)},
  visitanteConCopiaVigente: {...withoutChanges, eventosRecibidos: 0, bytesRespuesta: bytes(unchanged)},
  visitanteSinCopia: {...firstVisit, eventosRecibidos: complete.events.length, bytesRespuesta: bytes(complete)},
  indiceUsado: plan[0].detail
}, null, 2));
