import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {GldTelemetryStore137,serverRecord,routeTelemetry,dayOf,safePath,publishRecord} from '../../worker/observabilidad/telemetry.mjs';
const fixture=JSON.parse(await readFile(new URL('./public-har-fixture.json',import.meta.url)));
const uuid=()=>crypto.randomUUID();
function state(){
  const db=new DatabaseSync(':memory:');let alarm=null;
  return {db,id:{name:'telemetry-v1:'+dayOf()},storage:{sql:{exec(sql,...args){const statement=db.prepare(sql);const result=statement.columns().length?statement.all(...args):[];if(!statement.columns().length)statement.run(...args);return Object.assign(result,{rowsRead:result.length,rowsWritten:0});}},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},async setAlarm(value){alarm=value;},async deleteAll(){db.exec('DROP TABLE IF EXISTS telemetry');},get alarm(){return alarm;}}};
}
function binding(store){return {idFromName:name=>name,get:()=>({fetch:r=>store.fetch(r)})};}
const post=body=>new Request('https://telemetry.internal/',{method:'POST',body:JSON.stringify(body)});
const read=(store,body={})=>store.fetch(post({op:'read',...body})).then(r=>r.json());
function row(){return {id:uuid(),source:'server',action_id:uuid(),at:Date.now(),path:'/territory/public'};}
test('real HAR counters retain 0 Firestore, 4 KV and 985 SQL without mixing units',()=>{
  const records=fixture.rows.map(x=>serverRecord({request_id:x.request_id,path:x.path,method:'GET',status:200,worker_version:'136',consumption:x.consumption},new Request('https://login.example'+x.path)));
  assert.equal(records.reduce((n,r)=>n+r.counters.firestore.read_calls,0),0);
  assert.equal(records.reduce((n,r)=>n+r.counters.kv.get_calls,0),4);
  assert.equal(records.reduce((n,r)=>n+r.counters.sql.rows_read,0),985);
  assert.ok(records.every(r=>r.counters.cpu_ms===null));
});
test('internal execution does not double count incoming Worker request',()=>{
  const x=fixture.rows[0];const r=serverRecord({request_id:uuid(),consumption:x.consumption},new Request('https://a.example/'),true);
  assert.equal(r.counters.worker_requests,0);assert.equal(r.counters.kv.get_calls,1);
});
test('missing counters stay null instead of becoming zero',()=>{
  const r=serverRecord({request_id:uuid()},new Request('https://a.example/'));
  assert.equal(r.counters.firestore.read_calls,null);assert.equal(r.counters.sql.rows_read,null);
});
test('query strings, email and dynamic identifiers are removed from stored paths',()=>{
  assert.equal(safePath('/superadmin/advertisers/123aabcdef0123456789?token=secret'),'/superadmin/advertisers/:id');
  assert.equal(safePath('/users/a@example.com'),'/users/:id');
});
test('central SQL deduplicates retries and survives recorder recreation',async()=>{
  const s=state(),a=new GldTelemetryStore137(s),r=row();
  await a.fetch(post({op:'append',rows:[r]}));await a.fetch(post({op:'append',rows:[r]}));
  const b=new GldTelemetryStore137(s),result=await read(b);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].id,r.id);
  assert.ok(s.storage.alarm<=Date.now()+72*3600000);
});
test('latest page, older pages and live cursor neither skip nor duplicate records',async()=>{
  const s=state(),store=new GldTelemetryStore137(s);const data=Array.from({length:7},row);
  await store.fetch(post({op:'append',rows:data}));
  const recent=await read(store,{limit:3});assert.deepEqual(recent.rows.map(r=>r.seq),[5,6,7]);assert.equal(recent.more_before,true);
  const older=await read(store,{before:recent.older_cursor,cursor:recent.cursor,limit:3});assert.deepEqual(older.rows.map(r=>r.seq),[2,3,4]);
  await store.fetch(post({op:'append',rows:[row()]}));const live=await read(store,{cursor:recent.cursor});assert.deepEqual(live.rows.map(r=>r.seq),[8]);
});
test('read requires principal role; client cannot choose an administrative role',async()=>{
  for(const [auth,expected] of [[{ok:false},401],[{ok:true,rol:'ADMIN_LOCAL'},403],[{ok:true,rol:'SUPERADMIN'},403]]){
    const r=await routeTelemetry({request:new Request('https://a.example/superadmin/telemetry'),url:new URL('https://a.example/superadmin/telemetry'),env:{},verifyAdmin:async()=>auth});assert.equal(r.status,expected);
  }
});
test('browser ingestion rejects unexpected origins and excessive bodies',async()=>{
  const url=new URL('https://a.example/telemetry/events');
  const r=await routeTelemetry({request:new Request(url,{method:'POST',headers:{Origin:'https://other.example'},body:'{}'}),url,env:{}});assert.equal(r.status,403);
  const r2=await routeTelemetry({request:new Request(url,{method:'POST',headers:{Origin:'https://www.guialocal.ar'},body:'x'.repeat(48001)}),url,env:{}});assert.equal(r2.status,413);
});
test('browser event whitelist drops entered values, credentials, identity and counters',async()=>{
  const s=state(),store=new GldTelemetryStore137(s),url=new URL('https://a.example/telemetry/events');
  const ids={id:uuid(),action_id:uuid(),session_id:uuid(),view_id:uuid()};
  const r=await routeTelemetry({url,env:{GLD_PUBLIC_CACHE:binding(store)},request:new Request(url,{method:'POST',headers:{Origin:'https://www.guialocal.ar'},body:JSON.stringify({rows:[{...ids,kind:'action',page:'/plataforma/inicio',action:'buscar_ciudad',password:'private',email:'private',value:'private',counters:{worker_requests:999}}]})})});
  assert.equal(r.status,200);const out=await read(store);assert.equal(out.rows[0].password,undefined);assert.equal(out.rows[0].email,undefined);assert.equal(out.rows[0].value,undefined);assert.equal(out.rows[0].counters,undefined);
});
test('recorder failure is contained and never rejects business execution',async()=>{
  const promises=[];publishRecord({GLD_PUBLIC_CACHE:{idFromName(){throw Error('unavailable');}}},{waitUntil:p=>promises.push(p)},row());
  await assert.doesNotReject(()=>Promise.all(promises));
});
test('expiry destroys only the isolated recorder database',async()=>{
  const s=state(),a=new GldTelemetryStore137(s);await a.fetch(post({op:'append',rows:[row()]}));await a.alarm();
  assert.equal(s.db.prepare("SELECT name FROM sqlite_master WHERE name='telemetry'").all().length,0);
});
