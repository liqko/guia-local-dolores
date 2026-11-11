/* Copia de la publicación pública de una ciudad. */
(function (root) {
  'use strict';

  // Compatibilidad de lectura con libros anteriores al contrato extensible.
  const lists = {
    guide: ['results', 'anunciante_id'], events: ['events', 'evento_id'],
    promos: ['promos', 'promo_id'], activities: ['actividades', 'actividad_id'],
    ads: ['publicidades', 'publicidad_id'], pharmacy: ['ciclos', 'ciclo_id'],
  };
  const safeKey = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(value) &&
    !['__proto__','prototype','constructor'].includes(value);
  const legacySchema = () => Object.fromEntries(Object.entries(lists).map(([name,[field,id]]) =>
    [name,{field,id,metadata:name==='pharmacy'?['version','updated_at','ciudad_id']:[],
      ...(name==='ads'?{family:'ads',context:'GUIA'}:{})}]));
  function schemaOf(book) {
    if(book?.schema === undefined)return legacySchema();
    const schema=book.schema;
    if(!schema || typeof schema!=='object' || Array.isArray(schema) || !Object.keys(schema).length || Object.keys(schema).length>256)throw Error('Contrato público inválido');
    for(const [name,spec] of Object.entries(schema)){
      if(!safeKey(name)||!safeKey(spec?.field)||!safeKey(spec?.id)||!Array.isArray(spec.metadata)||
        spec.metadata.some(key=>!safeKey(key)||['success',spec.field].includes(key))||
        new Set(spec.metadata).size!==spec.metadata.length||
        spec.window!==undefined&&(!spec.window||typeof spec.window!=='object'||Array.isArray(spec.window)||!Object.keys(spec.window).length||Object.entries(spec.window).some(([key,value])=>!['from','until'].includes(key)||!safeKey(value)))||
        Object.keys(spec).some(key=>!['field','id','metadata','family','context','window'].includes(key))||
        spec.family!==undefined&&!safeKey(spec.family)||spec.context!==undefined&&
        (typeof spec.context!=='string'||!spec.context.trim()||spec.context.length>100))throw Error('Contrato público inválido');
    }
    return schema;
  }
  const idOf = (row, idField) => String(row?.[idField] ?? row?.id ?? '');
  const validRevision = value => Number.isSafeInteger(value) && value > 0;
  function validBook(book,city){
    try{
      const schema=schemaOf(book);
      return book?.city===city&&validRevision(book.revision)&&!!book.modules&&
        Object.keys(book.modules).every(name=>Object.hasOwn(schema,name))&&
        Object.entries(schema).every(([name,{field,metadata}])=>book.modules[name]?.success===true&&
          Array.isArray(book.modules[name][field])&&(!book.schema||Object.keys(book.modules[name]).every(key=>['success',field,...metadata].includes(key))));
    }catch{return false;}
  }

  function visibleAt(row,window,now=Date.now()){
    if(!window)return true;
    const parse=(value,end)=>{
      if(value===null||value===undefined||value==='')return null;
      if(typeof value==='number')return Number.isFinite(value)?value:NaN;
      return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+(end?'T23:59:59.999-03:00':'T00:00:00-03:00'):value);
    };
    const from=parse(window.from?row[window.from]:null,false),until=parse(window.until?row[window.until]:null,true);
    return (from===null||Number.isFinite(from)&&now>=from)&&(until===null||Number.isFinite(until)&&now<=until);
  }

  function applyDelta(book, delta) {
    if (delta?.city !== book.city || delta.from !== book.revision ||
        !validRevision(delta.revision) || delta.revision <= book.revision ||
        !delta.changes || typeof delta.changes !== 'object' || Array.isArray(delta.changes)) {
      throw Error('Actualización de ciudad inválida');
    }
    const schema = schemaOf(delta.schema ? {schema:delta.schema} : book);
    const previousSchema=schemaOf(book);
    for(const [name,spec] of Object.entries(previousSchema)){
      if(!schema[name]||schema[name].field!==spec.field||schema[name].id!==spec.id)throw Error('Cambio incompatible de contrato público');
    }
    const modules = { ...book.modules };
    for(const [name,{field}] of Object.entries(schema))if(!modules[name])modules[name]={success:true,[field]:[]};
    for (const [name, change] of Object.entries(delta.changes)) {
      if (!Object.hasOwn(schema, name) || !Array.isArray(change?.upsert) ||
          !Array.isArray(change.remove)) throw Error('Cambios de ciudad inválidos');
      const {field,id:idField,metadata}=schema[name];
      if(Object.keys(change.metadata??{}).some(key=>key!=='success'&&!metadata.includes(key)))throw Error('Metadatos ajenos a la Guía pública');
      if(change.metadata?.success!==undefined&&change.metadata.success!==true)throw Error('Módulo público inválido');
      const rows = new Map(modules[name][field].map(row => [idOf(row, idField), row]));
      if (rows.has('') || rows.size !== modules[name][field].length) throw Error('Identificador inválido');
      for (const id of change.remove) rows.delete(String(id));
      for (const row of change.upsert) {
        const id = idOf(row, idField);
        if (!id) throw Error('Identificador inválido');
        rows.set(id, row);
      }
      const attributes={...modules[name],...change.metadata};
      modules[name] = {success:true,...Object.fromEntries(metadata.filter(key=>attributes[key]!==undefined).map(key=>[key,attributes[key]])),[field]:[...rows.values()]};
    }
    const updated = { city: book.city, revision: delta.revision, modules, ...((book.schema||delta.schema)?{schema}:{}) };
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

    const api = { get(cityId) {
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
    },async module(cityId,family,context){
      const book=await api.get(cityId);if(!book)return null;
      const schema=schemaOf(book);
      const name=Object.keys(schema).find(name=>context===undefined?name===family:
        (schema[name].family||name)===family&&schema[name].context===context);
      if(!name)return null;
      const spec=schema[name],module=book.modules[name];
      return spec.window?{...module,[spec.field]:module[spec.field].filter(row=>visibleAt(row,spec.window))}:module;
    }};
    return api;
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
    module.exports = { applyDelta, client, idOf, lists, validBook, schemaOf, legacySchema, visibleAt };
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
