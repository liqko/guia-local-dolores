import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const worker = 'login.liqkoargentina.workers.dev';
const hosting = new Set(['www.guialocal.ar', 'guialocal.ar', 'anunciantes-guialocal.web.app']);
const gldPath = '/descubrir';
const number = n => Number.isFinite(n) && n >= 0 ? n : null;
const sum = (rows, field) => rows.reduce((total, row) => total + (row[field] ?? 0), 0);
const coverage = (rows, field) => rows.filter(row => row[field] === null).length;
const headers = response => new Map(response.headers.map(({name,value}) => [name.toLowerCase(), value]));
const isGuideDocument = entry => {
  const url = new URL(entry.request.url);
  return hosting.has(url.hostname) && url.pathname === gldPath && entry.request.method === 'GET' &&
    [200,304].includes(entry.response.status);
};

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

export function splitVisits(har) {
  const entries = har?.log?.entries;
  if (!Array.isArray(entries)) throw new Error('Se esperaba un archivo HAR exportado desde Red.');
  const time = entry => Date.parse(entry.startedDateTime);
  const starts = entries.filter(isGuideDocument).map(time).sort((a,b) => a-b);
  if (starts.length !== 2 || !Number.isFinite(starts[0]) || !(starts[0] < starts[1])) {
    throw new Error('La captura conjunta debe contener la apertura y una recarga de /descubrir.');
  }
  // Requests made by a service worker may have no pageref.
  return starts.map((start,index) => ({log:{entries:entries.filter(entry =>
    time(entry) >= start && (index === 1 || time(entry) < starts[1]))}}));
}

export function summarize(har) {
  if (!Array.isArray(har?.log?.entries)) throw new Error('Se esperaba un archivo HAR exportado desde Red.');
  const resources = [], requests = [], versions = new Set(), ids = new Set(), providers = new Map();
  let mainDocument = 0;
  let firestoreDirecto = 0;
  for (const entry of har.log.entries) {
    const {request, response} = entry;
    if (!request?.url || !response?.headers) continue;
    const url = new URL(request.url);
    const transferred = number(response._transferSize);
    const provider = providers.get(url.hostname) ?? [];
    provider.push({transferred});
    providers.set(url.hostname, provider);
    if (hosting.has(url.hostname)) {
      if (isGuideDocument(entry)) mainDocument++;
      resources.push({ruta: url.pathname, bytes: bodyBytes(entry), transferred});
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
      doPublicos: counter(data, 'cloudflare.public_store.calls'),
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
  const transfer = metrics(resources, 'transferred');
  const fieldNames = ['worker','doPublicos','kv','escriturasKV','sql','escriturasSQL','lecturasFirestore','escriturasFirestore','bajasFirestore'];
  const operations = Object.fromEntries(fieldNames.map(field => [field, metrics(requests, field)]));
  const cost = (requests, kv, sql, durable) => (requests * 0.30 + kv * 0.50 + sql * 0.001 + durable * 0.15) / 1000;
  return {
    versionesWorker: [...versions],
    hosting: {recursos: resources.length, bytes, transfer, porSolicitud: resources},
    transferenciaPorHost: Object.fromEntries([...providers].map(([host, rows]) => [host, metrics(rows, 'transferred')])),
    cloudflare: {solicitudesObservadas: requests.length, operaciones: operations, solicitudes: requests},
    firestoreDirecto: {solicitudesObservadas: firestoreDirecto, operacionesFacturadas: firestoreDirecto ? null : 0},
    costoMarginalParcialUsdPorMil: {
      tarifaAl: '2026-11-09',
      hosting: (bytes.sinMedir ? transfer.observado : bytes.observado) * 1000 / 1e9 * 0.15,
      baseHosting: bytes.sinMedir ? 'transferencia HAR, incluye cabeceras' : 'cuerpos HTTP',
      cloudflare: cost(operations.worker.observado, operations.kv.observado, operations.sql.observado, operations.doPublicos.observado),
      sinMedir: ['CPU de Worker', 'duración de Durable Objects', 'escrituras, bajas y listados de Cloudflare', 'cargos de Firestore si hubiera operaciones', 'tarifas de terceros'],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , first, reload] = process.argv;
  if (!first) {
    console.error('Uso: node tests/observabilidad/auditar-guia-publica.mjs visitas.har | apertura.har recarga.har');
    process.exitCode = 1;
  } else {
    const from = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    const [open,refresh] = reload ? [from(first),from(reload)] : splitVisits(from(first));
    console.log(JSON.stringify({accion:'guia-publica-dolores-sin-sesion',apertura:summarize(open),recarga:summarize(refresh)}, null, 2));
  }
}
