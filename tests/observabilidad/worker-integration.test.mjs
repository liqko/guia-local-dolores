import test from 'node:test';
import assert from 'node:assert/strict';
import original from '../../worker/base-observado136.mjs';
import current from '../../worker/login-observabilidad137.mjs';
const kv={get:async()=>null,put:async()=>{},delete:async()=>{},list:async()=>({keys:[]})};
test('ordinary Worker root and missing routes preserve status and response contract',async()=>{
  for(const path of ['/','/missing']){
    const env={GLD_CACHE_KV:kv,GLD_TELEMETRY_ENABLED:'0'};
    const before=await original.fetch(new Request('https://worker.example'+path),env),after=await current.fetch(new Request('https://worker.example'+path),env);
    assert.equal(after.status,before.status);const a=await before.json(),b=await after.json();delete a.version;delete b.version;assert.deepEqual(a,b);
  }
});
test('business response does not wait for recorder and its counters are persisted separately',async()=>{
  const jobs=[],records=[];
  const env={GLD_CACHE_KV:kv,GLD_PUBLIC_CACHE:{idFromName:n=>n,get:()=>({fetch:async request=>{records.push(...(await request.json()).rows);return Response.json({success:true,meter:{do_requests:1}});}})}};
  const r=await current.fetch(new Request('https://worker.example/'),env,{waitUntil:p=>jobs.push(p)});
  assert.equal(r.status,200);await Promise.all(jobs);assert.equal(records.length,1);assert.equal(records[0].counters.worker_requests,1);assert.equal(records[0].counters.firestore.read_calls,0);
});
test('CORS allows the trace and exposes consumption without changing API URL',async()=>{
  const r=await current.fetch(new Request('https://worker.example/',{method:'OPTIONS'}),{GLD_CACHE_KV:kv,GLD_TELEMETRY_ENABLED:'0'});
  assert.equal(r.status,204);assert.match(r.headers.get('Access-Control-Allow-Headers'),/X-GLD-Trace/);assert.match(r.headers.get('Access-Control-Expose-Headers'),/X-GLD-Consumption/);
});
