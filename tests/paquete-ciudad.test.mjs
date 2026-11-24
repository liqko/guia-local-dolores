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

test('el mismo lector adopta una nueva edición una vez y la comparte entre secciones',async()=>{
 const copies=new Map(),requests=[];let revision=1;
 const original=initial('dolores');original.modules.guide.results=[{anunciante_id:'A',nombre:'Anterior'}];
 const updated={city:'dolores',from:1,revision:2,changes:{guide:{upsert:[{anunciante_id:'A',nombre:'Actualizado'}],remove:[]}}};
 const api=client({manifest:()=>({key:'dolores',revision,deltas:[1]}),storage:{get:city=>copies.get(city),put:book=>copies.set(book.city,book)},fetchJson:async path=>{requests.push(path);return path.includes('completo')?original:updated;}});
 assert.equal((await api.get('dolores')).revision,1);revision=2;
 const [book,guide,events]=await Promise.all([api.get('dolores'),api.module('dolores','guide'),api.module('dolores','events')]);
 assert.equal(book.revision,2);assert.equal(guide.results[0].nombre,'Actualizado');assert.deepEqual(events.events,[]);
 assert.equal(requests.length,2,'una descarga inicial y una de cambios, no una por sección');
 for(let i=0;i<20;i++)await api.get('dolores');assert.equal(requests.length,2);
});

test('quinientas fichas en el mismo paquete se reutilizan sin una solicitud por ficha o sección',async()=>{
 const book=initial('dolores');book.modules.guide.results=Array.from({length:500},(_,i)=>({anunciante_id:'A'+i,nombre:'Anunciante '+i,descripcion:'Descripción completa de ensayo '+i}));
 const copies=new Map();let downloads=0;const make=()=>client({manifest:()=>({key:'dolores',revision:1,deltas:[]}),storage:{get:city=>copies.get(city),put:packet=>copies.set(packet.city,packet)},fetchJson:async()=>{downloads++;return book;}});
 const api=make();await Promise.all(Object.keys(lists).map(name=>api.module('dolores',name)));
 const cached=await api.module('dolores','guide');for(const row of cached.results)assert(row.nombre);
 assert.equal(downloads,1);assert.equal(cached.results.length,500);
 await make().module('dolores','guide');assert.equal(downloads,1,'volver a entrar reutiliza la copia persistente');
});

test('el fallo de una descarga anterior no elimina una nueva descarga en curso',async()=>{
 const original=initial('dolores'),copies=new Map([['dolores',original]]);let revision=2,rejectOld,resolveNew;const requests=[];
 const api=client({manifest:()=>({key:'dolores',revision,deltas:[]}),storage:{get:city=>copies.get(city),put:book=>copies.set(book.city,book)},fetchJson:path=>{requests.push(path);return new Promise((resolve,reject)=>{if(path.includes('completo-2'))rejectOld=reject;else resolveNew=resolve;});}});
 const old=api.get('dolores');await Promise.resolve();revision=3;const newer=api.get('dolores');await Promise.resolve();
 rejectOld(Error('interrupción'));await old;
 assert.strictEqual(api.get('dolores'),newer,'se conserva la descarga más nueva');
 resolveNew({...initial('dolores'),revision:3});assert.equal((await newer).revision,3);assert.equal(requests.length,2);
});

test('P4-0006: delta ausente o inválido recupera una sola copia estática para todos los módulos',async()=>{
 for(const fail of ['404','wrong-city','wrong-revision']){
  const original=initial('dolores'),current={...initial('dolores'),revision:2};
  current.modules.events.events=[{evento_id:'E2'}];current.modules.promos.promos=[{promo_id:'P2'}];
  const copies=new Map([['dolores',original]]),requests=[];let writes=0;
  const api=client({manifest:()=>({key:'dolores',revision:2,deltas:[1]}),
   storage:{get:city=>copies.get(city),put:book=>{writes++;copies.set(book.city,book);}},
   fetchJson:async path=>{requests.push(path);if(path.includes('cambios')){
    if(fail==='404')throw Error('404');
    return {city:fail==='wrong-city'?'tandil':'dolores',from:1,revision:fail==='wrong-revision'?3:2,changes:{}};
   }return current;}});
  const [events,promos,book]=await Promise.all([api.module('dolores','events'),api.module('dolores','promos'),api.get('dolores')]);
  assert.equal(book.revision,2);assert.equal(events.events[0].evento_id,'E2');assert.equal(promos.promos[0].promo_id,'P2');
  assert.equal(requests.length,2);assert.equal(writes,1);
  await api.get('dolores');assert.equal(requests.length,2);
 }
});

test('P4-0006: dos archivos fallidos no reemplazan una copia válida y permiten reintento',async()=>{
 const original=initial('dolores'),current={...initial('dolores'),revision:2};
 let fail=true,requests=0,writes=0;const copies=new Map([['dolores',original]]);
 const api=client({manifest:()=>({key:'dolores',revision:2,deltas:[1]}),
  storage:{get:city=>copies.get(city),put:book=>{writes++;copies.set(book.city,book);}},
  fetchJson:async path=>{requests++;if(fail||path.includes('cambios'))throw Error('offline');return current;}});
 assert.equal((await api.get('dolores')).revision,1);assert.equal(writes,0);assert.equal(requests,2);
 fail=false;assert.equal((await api.get('dolores')).revision,2);assert.equal(writes,1);assert.equal(requests,4);
});
