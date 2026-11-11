/* Copia de la publicación pública de una ciudad. */
(function (root) {
  'use strict';

  const lists = {
    guide: ['results', 'anunciante_id'],
    events: ['events', 'evento_id'],
    promos: ['promos', 'promo_id'],
    activities: ['actividades', 'actividad_id'],
    ads: ['publicidades', 'publicidad_id'],
    pharmacy: ['ciclos', 'ciclo_id'],
  };
  const idOf = (row, idField) => String(row?.[idField] ?? row?.id ?? '');
  const validRevision = value => Number.isSafeInteger(value) && value > 0;
  const validBook = (book, city) => book?.city === city && validRevision(book.revision) &&
    Object.entries(lists).every(([name, [field]]) =>
      book.modules?.[name]?.success === true && Array.isArray(book.modules[name][field]));

  function applyDelta(book, delta) {
    if (delta?.city !== book.city || delta.from !== book.revision ||
        !validRevision(delta.revision) || delta.revision <= book.revision ||
        !delta.changes || typeof delta.changes !== 'object' || Array.isArray(delta.changes)) {
      throw Error('Actualización de ciudad inválida');
    }
    const modules = { ...book.modules };
    for (const [name, change] of Object.entries(delta.changes)) {
      if (!Object.hasOwn(lists, name) || !Array.isArray(change?.upsert) ||
          !Array.isArray(change.remove)) throw Error('Cambios de ciudad inválidos');
      const [field, idField] = lists[name];
      const rows = new Map(modules[name][field].map(row => [idOf(row, idField), row]));
      if (rows.has('') || rows.size !== modules[name][field].length) throw Error('Identificador inválido');
      for (const id of change.remove) rows.delete(String(id));
      for (const row of change.upsert) {
        const id = idOf(row, idField);
        if (!id) throw Error('Identificador inválido');
        rows.set(id, row);
      }
      modules[name] = { ...modules[name], ...change.metadata, [field]: [...rows.values()] };
    }
    const updated = { city: book.city, revision: delta.revision, modules };
    if (!validBook(updated, book.city)) throw Error('Paquete de ciudad inválido');
    return updated;
  }

  function client({ manifest, storage, fetchJson }) {
    const pending = new Map();
    async function load(city, info) {
      let previous;
      try { previous = await storage.get(city); } catch (_) {}
      if (!validBook(previous, city)) previous = null;
      if (previous && previous.revision >= info.revision) return previous;

      try {
        const isDelta = previous && info.deltas?.includes(previous.revision);
        const file = isDelta
          ? 'cambios-' + previous.revision + '-' + info.revision
          : 'completo-' + info.revision;
        const payload = await fetchJson('/plataforma/paquetes-ciudad/' + info.key + '/' + file + '.json');
        const book = isDelta ? applyDelta(previous, payload) : payload;
        if (!validBook(book, city) || book.revision !== info.revision) throw Error('Versión inválida');
        try { await storage.put(book); } catch (_) {}
        return book;
      } catch (_) {
        return previous;
      }
    }

    return { get(cityId) {
      const city = String(cityId ?? '').trim();
      const info = manifest(city);
      if (!validRevision(info?.revision) || !/^[\w-]+$/.test(info.key)) return Promise.resolve(null);
      if (!pending.has(city)) {
        const request = load(city, info);
        pending.set(city, request);
        request.then(book => {
          if (!book || book.revision < info.revision) pending.delete(city);
        });
      }
      return pending.get(city);
    }};
  }

  function localBooks() {
    let opened;
    function database() {
      if (!opened) opened = new Promise((resolve, reject) => {
        const request = root.indexedDB.open('gld-paquetes-ciudad', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('ciudades', { keyPath: 'city' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => reject(request.error);
      });
      return opened;
    }
    return {
      async get(city) {
        const db = await database();
        return new Promise((resolve, reject) => {
          const request = db.transaction('ciudades').objectStore('ciudades').get(city);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      async put(book) {
        const db = await database();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('ciudades', 'readwrite');
          const store = transaction.objectStore('ciudades');
          const read = store.get(book.city);
          read.onsuccess = () => {
            if ((read.result?.revision ?? 0) < book.revision) store.put(book);
          };
          transaction.oncomplete = resolve;
          transaction.onabort = () => reject(transaction.error);
        });
      },
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyDelta, client, idOf, lists, validBook };
    return;
  }
  try {
    if (root.parent !== root && root.parent.GLD_PAQUETE_CIUDAD) {
      root.GLD_PAQUETE_CIUDAD = root.parent.GLD_PAQUETE_CIUDAD;
      return;
    }
  } catch (_) {}
  root.GLD_PAQUETE_CIUDAD = client({
    manifest: city => root.GLD_CATALOGO_TERRITORIAL?.paqueteCiudad?.(city),
    storage: localBooks(),
    async fetchJson(path) {
      const response = await root.fetch(path, { signal: AbortSignal.timeout(6500) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      return response.json();
    },
  });
})(globalThis);
