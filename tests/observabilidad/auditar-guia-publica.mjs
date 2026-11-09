import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const worker = 'login.liqkoargentina.workers.dev';
const hosting = new Set(['www.guialocal.ar', 'guialocal.ar', 'anunciantes-guialocal.web.app']);
const gldPath = '/descubrir';
const number = n => Number.isFinite(n) && n >= 0 ? n : null;
const sum = (rows, field) => rows.reduce((total, row) => total + (row[field] ?? 0), 0);
const coverage = (rows, field) => rows.filter(row => row[field] === null).length;
const headers = response => new Map(response.headers.map(({name,value}) => [name.toLowerCase(), value]));

function decode(value) {
  try {
    const data = JSON.parse(decodeURIComponent(value));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function bodyBytes(entry) {
  const {response} = entry;
  if (entry.request.method === 'HEAD' || response.status === 304 || response.status === 204 ||
      response._transferSize === 0 || entry._fromCache === 'memory' || entry._fromCache === 'disk') return 0;
  return number(response.bodySize);
}

function counter(data, ...paths) {
  const values = paths.map(path => number(path.split('.').reduce((value, key) => value?.[key], data)));
  return values.includes(null) ? null : values.reduce((total, value) => total + value, 0);
}

export function summarize(har) {
  if (!Array.isArray(har?.log?.entries)) throw new Error('Se esperaba un archivo HAR exportado desde Red.');
  const resources = [], requests = [], versions = new Set(), ids = new Set();
  let mainDocument = 0;
  let firestoreDirecto = 0;
  for (const entry of har.log.entries) {
    const {request, response} = entry;
    if (!request?.url || !response?.headers) continue;
    const url = new URL(request.url);
    if (hosting.has(url.hostname)) {
      if (url.pathname === gldPath && request.method === 'GET' && [200,304].includes(response.status)) mainDocument++;
      resources.push({ruta: url.pathname, bytes: bodyBytes(entry)});
    }
    if (url.hostname === 'firestore.googleapis.com') firestoreDirecto++;
    if (url.hostname !== worker) continue;
    if (entry._fromCache === 'memory' || entry._fromCache === 'disk') continue;
    const h = headers(response);
    const data = decode(h.get('x-gld-consumption'));
    const id = h.get('x-gld-request-id') ?? data?.request_id;
    // A repeated response can be served by a cache with the same Worker request ID.
    if (id && ids.has(id)) continue;
    if (id) ids.add(id);
    const version = h.get('x-gld-worker-version') ?? data?.version;
    if (version) versions.add(version);
    requests.push({
      ruta: url.pathname,
      metodo: request.method,
      worker: counter(data, 'cloudflare.worker_requests'),
      kv: counter(data, 'cloudflare.kv.get_calls', 'cloudflare.public_store.legacy_gets'),
      escriturasKV: counter(data, 'cloudflare.kv.put_calls'),
      sql: counter(data, 'cloudflare.public_store.rows_read', 'cloudflare.admin_store.rows_read'),
      escriturasSQL: counter(data, 'cloudflare.public_store.rows_written', 'cloudflare.admin_store.rows_written'),
      lecturasFirestore: counter(data, 'firestore.read_calls'),
      escriturasFirestore: counter(data, 'firestore.write_calls'),
      bajasFirestore: counter(data, 'firestore.delete_calls'),
    });
  }
  if (mainDocument !== 1) throw new Error('La captura debe contener una sola apertura de /descubrir.');
  const metrics = (rows, field) => ({observado: sum(rows, field), sinMedir: coverage(rows, field)});
  const bytes = metrics(resources, 'bytes');
  const fieldNames = ['worker','kv','escriturasKV','sql','escriturasSQL','lecturasFirestore','escriturasFirestore','bajasFirestore'];
  const operations = Object.fromEntries(fieldNames.map(field => [field, metrics(requests, field)]));
  const cost = (requests, kv, sql) => (requests * 0.30 + kv * 0.50 + sql * 0.001) / 1000;
  return {
    versionesWorker: [...versions],
    hosting: {recursos: resources.length, bytes, porSolicitud: resources},
    cloudflare: {solicitudesObservadas: requests.length, operaciones: operations, solicitudes: requests},
    firestoreDirecto: {solicitudesObservadas: firestoreDirecto, operacionesFacturadas: firestoreDirecto ? null : 0},
    costoMarginalParcialUsdPorMil: {
      tarifaAl: '2026-11-09',
      hosting: bytes.observado * 1000 / 1e9 * 0.15,
      cloudflare: cost(operations.worker.observado, operations.kv.observado, operations.sql.observado),
      sinMedir: ['CPU de Worker', 'solicitudes y duración de Durable Objects', 'escrituras, bajas y listados de Cloudflare', 'cargos de Firestore si hubiera operaciones'],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , first, reload] = process.argv;
  if (!first || !reload) {
    console.error('Uso: node tests/observabilidad/auditar-guia-publica.mjs apertura.har recarga.har');
    process.exitCode = 1;
  } else {
    const from = file => summarize(JSON.parse(readFileSync(file, 'utf8')));
    console.log(JSON.stringify({accion:'guia-publica-dolores-sin-sesion',apertura:from(first),recarga:from(reload)}, null, 2));
  }
}
