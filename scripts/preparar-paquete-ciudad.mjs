import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import bookTools from '../plataforma/paquete-ciudad.js';

const { applyDelta, idOf, lists, validBook } = bookTools;
const marker = '/* GLD_CITY_BOOKS */ {}';

function index(rows, field) {
  const result = new Map(rows.map(row => [idOf(row, field), row]));
  if (result.has('') || result.size !== rows.length) throw Error('Identificador inválido en publicación');
  return result;
}

function publicBook(book) {
  const modules = Object.fromEntries(Object.entries(lists).map(([name, [field]]) => [
    name, { success: true, [field]: book.modules[name][field] },
  ]));
  const { version, updated_at } = book.modules.pharmacy;
  modules.pharmacy.ciudad_id = book.city;
  if (version !== undefined) modules.pharmacy.version = version;
  if (updated_at !== undefined) modules.pharmacy.updated_at = updated_at;
  return { city: book.city, revision: book.revision, modules };
}

function changesBetween(previous, book) {
  const changes = {};
  for (const [name, [field, idField]] of Object.entries(lists)) {
    const { [field]: before, ...beforeMeta } = previous.modules[name];
    const { [field]: after, ...metadata } = book.modules[name];
    const oldRows = index(before, idField);
    const newRows = index(after, idField);
    const upsert = after.filter(row => !isDeepStrictEqual(oldRows.get(idOf(row, idField)), row));
    const remove = [...oldRows.keys()].filter(id => !newRows.has(id));
    if (upsert.length || remove.length || !isDeepStrictEqual(beforeMeta, metadata)) {
      changes[name] = { upsert, remove, metadata };
    }
  }
  return changes;
}

// The input contains only public projections. Publication never polls data sources.
export async function prepareCityBooks({ initial, batches }, hostingDir) {
  const root = join(hostingDir, 'plataforma');
  const catalogPath = join(root, 'territorio-cache.js');
  const catalog = await readFile(catalogPath, 'utf8');
  if (!catalog.includes(marker)) throw Error('Falta el marcador de paquetes');
  const history = new Map();
  const processed = new Map();
  for (const book of initial) {
    const city = book.city;
    if (typeof city !== 'string' || !city.trim() || history.has(city) ||
        !validBook(book, city)) throw Error('Paquete inicial inválido');
    for (const [name, [field, idField]] of Object.entries(lists)) {
      index(book.modules[name][field], idField);
    }
    const projected = publicBook(book);
    history.set(city, [projected]);
    processed.set(city, projected);
  }
  for (const batch of batches) {
    const versions = history.get(batch.city);
    if (!versions) throw Error('Falta el paquete inicial de la ciudad');
    const previous = processed.get(batch.city);
    const book = publicBook(applyDelta(previous, batch));
    processed.set(batch.city, book);
    if (!isDeepStrictEqual(book.modules, previous.modules)) versions.push(book);
  }
  const entries = [];
  for (const [city, versions] of history) {
    const book = versions.at(-1);
    const key = Buffer.from(city).toString('base64url');
    const dir = join(root, 'paquetes-ciudad', key);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'completo-' + book.revision + '.json'), JSON.stringify(book));
    const prior = versions.slice(0, -1);
    for (const previous of prior) {
      const delta = { city, from: previous.revision, revision: book.revision,
        changes: changesBetween(previous, book) };
      await writeFile(join(dir, 'cambios-' + previous.revision + '-' + book.revision + '.json'), JSON.stringify(delta));
    }
    entries.push([city, { key, revision: book.revision, deltas: prior.map(value => value.revision) }]);
  }
  const manifest = Object.fromEntries(entries);
  // JSON.parse also treats a city ID equal to "__proto__" as ordinary data.
  const expression = 'JSON.parse(' + JSON.stringify(JSON.stringify(manifest)) + ')';
  await writeFile(catalogPath, catalog.replace(marker, () => '/* GLD_CITY_BOOKS */ ' + expression));
  return manifest;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [input, hostingDir] = process.argv.slice(2);
  if (!input || !hostingDir) throw Error('Uso: node scripts/preparar-paquete-ciudad.mjs <publicaciones.json> <directorio-hosting>');
  await prepareCityBooks(JSON.parse(await readFile(input, 'utf8')), hostingDir);
}
