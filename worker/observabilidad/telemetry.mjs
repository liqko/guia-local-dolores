// Observability is isolated from business data. No Firebase calls or user content.
export const TELEMETRY_VERSION = 1;
export const TELEMETRY_PREFIX = 'telemetry-v1:';
const RETENTION_MS = 72 * 3600000;
const MAX_BODY = 48000;
const UUID = /^[a-f0-9-]{36}$/i;
const ORIGINS = new Set(['https://anunciantes-guialocal.web.app', 'https://anunciantes-guialocal.firebaseapp.com', 'https://www.guialocal.ar', 'https://guialocal.ar', 'https://guialocaldolores.vercel.app']);
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : null;
const token = (v, max = 80) => typeof v === 'string' && /^[a-zA-Z0-9_:. /-]+$/.test(v) ? v.slice(0, max) : '';
const id = v => UUID.test(String(v)) ? String(v) : '';
export function safePath(value) {
  const path = String(value || '').split(/[?#]/)[0];
  return path.split('/').slice(0, 8).map(p => /^[a-zA-Z][a-zA-Z_-]{0,45}(?:\.html|\.js|\.css|\.svg)?$/.test(p) ? p : p ? ':id' : '').join('/').slice(0, 180);
}
export function traceOf(request) {
  const parts = (request.headers.get('X-GLD-Trace') || '').split(';');
  return { action_id: id(parts[0]), session_id: id(parts[1]), view_id: id(parts[2]), page: safePath(parts[3]), interface: ['usuario','anunciante','administrador'].includes(parts[4]) ? parts[4] : 'desconocida' };
}
function headers() { return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}; }
const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:headers()});
function actor(env, day) { return env.GLD_PUBLIC_CACHE.get(env.GLD_PUBLIC_CACHE.idFromName(TELEMETRY_PREFIX + day)); }
export function dayOf(time = Date.now()) { return new Date(time).toISOString().slice(0,10); }
function cleanCounters(c) {
  const fs = c?.firestore, cf = c?.cloudflare;
  const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, count(obj?.[k])]));
  return {firestore:pick(fs,['read_calls','write_calls','delete_calls','billed_reads','billed_writes','billed_deletes']),
    worker_requests:count(cf?.worker_requests), kv:pick(cf?.kv,['get_calls','put_calls','delete_calls','list_calls']),
    sql:pick(cf?.public_store,['rows_read','rows_written']), admin_sql:pick(cf?.admin_store,['rows_read','rows_written']),
    public_store_calls:count(cf?.public_store?.calls), admin_store_calls:count(cf?.admin_store?.calls),
    cpu_ms:null, do_requests:null, do_duration_gbs:null, storage_bytes:null};
}
export function serverRecord(report, request, internal = false) {
  const t = traceOf(request);
  const counters = cleanCounters(report.consumption);
  // An internal invocation is additional work, not another incoming HTTP request.
  counters.worker_requests = internal ? 0 : 1;
  return {id:report.request_id, source:'server', at:Date.now(), ...t,
    request_id:report.request_id, path:safePath(report.path), method:token(report.method,12),
    action:token(report.action), status:count(report.status), version:token(report.worker_version),
    internal, counters, coverage:report.consumption?.coverage?.status || 'INCOMPLETO',
    missing:['cpu-provider','do-billing','persistent-bytes', ...(!report.consumption ? ['operation-counters'] : [])]};
}
export async function persistRecords(env, rows) {
  if (!env.GLD_PUBLIC_CACHE) throw Error('No está disponible el almacenamiento del medidor.');
  const r = await actor(env, dayOf()).fetch(new Request('https://telemetry.internal/', {method:'POST',body:JSON.stringify({op:'append', rows})}));
  const result = await r.json();
  if (!r.ok) throw Error('Telemetry ingest ' + r.status);
  // Log separately: measuring the meter must never recurse into business totals.
  console.log(JSON.stringify({event:'gld_telemetry_overhead', day:dayOf(), ...result.meter}));
  return result;
}
export function publishRecord(env, ctx, row) {
  if (env.GLD_TELEMETRY_ENABLED === '0') return;
  const task = persistRecords(env, [row]).catch(error => console.error(JSON.stringify({event:'gld_telemetry_gap', request_id:row.request_id, reason:'recorder-unavailable'})));
  if (ctx?.waitUntil) ctx.waitUntil(task);
  else return task; // Used by internal invocations which lack ExecutionContext.
}
function browserRows(body) {
  if (!body || !Array.isArray(body.rows) || body.rows.length > 40) throw Error('Invalid batch');
  return body.rows.map(row => {
    if (!id(row.id) || !id(row.action_id) || !id(row.session_id) || !id(row.view_id)) throw Error('Invalid identifiers');
    if (!['action','resource','network_error','runtime_error','gap'].includes(row.kind)) throw Error('Invalid event');
    return {id:row.id, source:'browser', at:Date.now(), client_at:Number.isFinite(row.at)?row.at:null,
      kind:row.kind, action_id:row.action_id, session_id:row.session_id, view_id:row.view_id,
      page:safePath(row.page), interface:['usuario','anunciante','administrador'].includes(row.interface)?row.interface:'desconocida',
      action:token(row.action), control:token(row.control), association:row.association==='explicit'?'explicit':'temporal',
      request_id:id(row.request_id), resource_type:token(row.resource_type,24),
      host:typeof row.host==='string'&&/^[a-zA-Z0-9.-]{1,120}$/.test(row.host)?row.host:'',
      transfer_bytes:count(row.transfer_bytes), resource_ms:Number.isFinite(row.resource_ms)&&row.resource_ms>=0?Math.min(row.resource_ms,3600000):null,
      line:count(row.line), count:count(row.count)};
  });
}
export async function routeTelemetry(context) {
  const {request,env,url,verifyAdmin} = context;
  const path = url.pathname;
  if (!['/telemetry/events','/superadmin/telemetry'].includes(path)) return null;
  if (env.GLD_TELEMETRY_ENABLED === '0') return reply({success:false,message:'El registro automático no está habilitado en este Worker.'},503);
  if (path === '/telemetry/events') {
    if (request.method !== 'POST') return reply({success:false},405);
    if (!ORIGINS.has(request.headers.get('Origin'))) return reply({success:false},403);
    if (Number(request.headers.get('Content-Length')||0)>MAX_BODY) return reply({success:false},413);
    // Stop reading oversized streams rather than buffering an unbounded request.
    const reader=request.body?.getReader(); let text='', size=0;const decoder=new TextDecoder();
    if (!reader) return reply({success:false},400);
    while (true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();return reply({success:false},413);}text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();
    try {const rows=browserRows(JSON.parse(text));if(!rows.length)return reply({success:true,accepted:0});
      const result=await persistRecords(env,rows);return reply({success:true,...result});
    } catch {return reply({success:false,message:'No se pudo registrar el lote.'},400);}
  }
  if (request.method !== 'GET') return reply({success:false},405);
  const auth = await verifyAdmin(env,request);
  if (!auth.ok) return reply({success:false,message:'Ingresá con tu sesión de Gran Hermano.'},401);
  if (auth.rol !== 'SUPERADMIN_PRINCIPAL') return reply({success:false,message:'Acceso reservado al administrador principal.'},403);
  const day = url.searchParams.get('day') || dayOf();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || Date.parse(day)<Date.now()-RETENTION_MS-86400000 || Date.parse(day)>Date.now()) return reply({success:false,message:'Fecha fuera del período conservado.'},400);
  const cursor = Math.max(0,Math.floor(Number(url.searchParams.get('cursor'))||0));
  const before = Math.max(0,Math.floor(Number(url.searchParams.get('before'))||0));
  const action_id = id(url.searchParams.get('action_id'));
  const response = await actor(env,day).fetch(new Request('https://telemetry.internal/',{method:'POST',body:JSON.stringify({op:'read',cursor,before,action_id,limit:300})}));
  return new Response(response.body,{status:response.status,headers:headers()});
}

export class GldTelemetryStore137 {
  constructor(state) {
    this.state=state;this.sql=state.storage.sql;this.rates=new Map();this.initialized=false;
  }
  init() {
    if(this.initialized)return;
    this.sql.exec('CREATE TABLE IF NOT EXISTS telemetry (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL, action_id TEXT NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS telemetry_action ON telemetry(action_id,seq)');
    this.initialized=true;
  }
  async fetch(request) {
    this.init();const body=await request.json();
    const meter={do_requests:1,sql_rows_read:0,sql_rows_written:0,retention_hours:72};
    const run=(sql,...args)=>{const c=this.sql.exec(sql,...args);const rows=[...c];meter.sql_rows_read+=c.rowsRead||0;meter.sql_rows_written+=c.rowsWritten||0;return rows;};
    if(body.op==='read') {
      const limit=Math.min(300,Math.max(1,Number(body.limit)||300));
      const descending=!!body.before||!body.cursor;
      const rows=body.action_id?run('SELECT seq,payload FROM telemetry WHERE action_id=? AND seq>? ORDER BY seq LIMIT ?',body.action_id,body.cursor||0,limit+1):body.before?run('SELECT seq,payload FROM telemetry WHERE seq<? ORDER BY seq DESC LIMIT ?',body.before,limit+1):body.cursor?run('SELECT seq,payload FROM telemetry WHERE seq>? ORDER BY seq LIMIT ?',body.cursor,limit+1):run('SELECT seq,payload FROM telemetry ORDER BY seq DESC LIMIT ?',limit+1);
      const more=rows.length>limit;if(more)rows.pop();
      if(descending&&!body.action_id)rows.reverse();
      return reply({success:true,rows:rows.map(r=>({...JSON.parse(r.payload),seq:r.seq})),cursor:Math.max(body.cursor||0,rows.at(-1)?.seq||0),older_cursor:rows[0]?.seq||0,more:!descending&&more,more_before:descending&&more,meter,retention_hours:72});
    }
    if(body.op!=='append'||!Array.isArray(body.rows)||body.rows.length>40)return reply({success:false},400);
    // Upper bounds protect storage even if an anonymous client floods telemetry.
    const minute=Math.floor(Date.now()/60000);const bucket=this.rates.get(minute)||{all:0,browser:0};
    const browser=body.rows.filter(r=>r.source==='browser').length;
    if(bucket.all+body.rows.length>6000||bucket.browser+browser>4000)return reply({success:false,message:'Capacidad de registro alcanzada; hay una brecha de cobertura.'},429);
    this.rates.clear();bucket.all+=body.rows.length;bucket.browser+=browser;this.rates.set(minute,bucket);
    let accepted=0;
    this.state.storage.transactionSync(()=>{
      const total=run('SELECT MAX(seq) AS last FROM telemetry')[0]?.last||0;
      if(total+body.rows.length>150000)throw Error('Daily telemetry capacity reached');
      for(const row of body.rows) {
        if(typeof row.id!=='string'||JSON.stringify(row).length>7000)throw Error('Invalid row');
        run('INSERT INTO telemetry(id,action_id,at,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING',row.id,row.action_id||'',Date.now(),JSON.stringify(row));accepted++;
      }
    });
    // The name is retained by Cloudflare in alarm context; no extra read on business actors.
    if(!this.expiryScheduled){await this.state.storage.setAlarm(Date.parse(dayOf())+RETENTION_MS);this.expiryScheduled=true;}
    return reply({success:true,accepted,meter});
  }
  async alarm(){await this.state.storage.deleteAll();}
}
