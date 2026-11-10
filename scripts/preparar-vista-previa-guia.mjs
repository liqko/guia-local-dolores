import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareCityBooks } from './preparar-paquete-ciudad.mjs';
import { preparePublicTerritory } from './prepare-public-territory.mjs';
import bookTools from '../plataforma/paquete-ciudad.js';

const { idOf, lists } = bookTools;
const root = process.argv[2];
if (!root) throw Error('Falta el directorio de la vista previa');

const origin = 'https://login.liqkoargentina.workers.dev';
async function get(path, params) {
  const url = new URL(path, origin);
  if (params) url.search = new URLSearchParams(params);
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw Error(path + ': HTTP ' + response.status);
  const data = await response.json();
  if (data.success !== true) throw Error(path + ': respuesta pública inválida');
  return data;
}

const territory = await get('/territory/public');
await preparePublicTerritory({
  file: join(root, 'plataforma', 'territorio-cache.js'),
  read: async () => Response.json(territory),
});

const routes = {
  guide: ['/guide', { compact: '1' }],
  events: ['/events-new', {}],
  promos: ['/promos', {}],
  activities: ['/actividades', { action: 'publicas' }],
  ads: ['/publicidad', { action: 'publicas', modulo: 'GUIA' }],
  pharmacy: ['/farmacias', { action: 'ciclo' }],
};
const initial = [];
const batches = [];
const cities = ['DOLORES', 'BALCARCE'].map(name => {
  const city = territory.ciudades.find(row => row.ciudad_visible === name && row.activa);
  if (!city) throw Error('Falta la ciudad ' + name);
  return city;
});

for (const location of cities) {
  const city = location.ciudad_id;
  const modules = Object.fromEntries(await Promise.all(Object.entries(routes).map(async ([name, [path, params]]) => {
    return [name, await get(path, { ...params, ciudad_id: city })];
  })));
  const book = { city, revision: 1, modules };
  if (location.ciudad_visible === 'DOLORES') {
    // The deployed preview contains today's real guide. Hold one real card out
    // of the earlier copy to verify a delta without writing production data.
    const [record, ...rest] = modules.guide.results;
    if (!record || !idOf(record, lists.guide[1])) throw Error('Dolores no devolvió una ficha pública');
    modules.guide.results = rest;
    batches.push({ city, from: 1, revision: 2, changes: { guide: { upsert: [record], remove: [] } } });
  }
  initial.push(book);
}

const manifest = await prepareCityBooks({ initial, batches }, root);
await writeFile(join(root, 'plataforma', 'paquetes-ciudad', 'ciudades-prueba.json'), JSON.stringify(cities.map(city => ({
  city: city.ciudad_id, label: city.ciudad_visible, country: city.pais_id,
  province: city.provincia_id, ...manifest[city.ciudad_id],
}))));
console.log('Vista previa preparada para Dolores y Balcarce con 13 solicitudes públicas de preparación.');
