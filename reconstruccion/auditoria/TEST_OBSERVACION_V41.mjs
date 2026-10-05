import assert from 'node:assert/strict';
import {observeDbV41,observationPathV41} from '../worker/core/db-observation-v41.js';
import worker from '../worker/app-main-v35.js';
const report={operations:{}};
const failure=new Error('test');
let calls=0;
const db=observeDbV41({
  async get(c,id){calls++;return id==='missing'?null:{id,mail:'private@example.test'};},
  async queryEqual(){calls++;return [{id:'one'},{id:'two'}];},
  async patch(){calls++;throw failure;}
},report);
assert.equal((await db.get('suscriptores','secret-id')).id,'secret-id');
assert.equal(await db.get('suscriptores','missing'),null);
assert.equal((await db.queryEqual('suscriptores','mail','private@example.test',5)).length,2);
await assert.rejects(db.patch('suscriptores','secret-id',{clave:'private-password'}),e=>e===failure);
assert.equal(calls,4);
assert.equal(report.operations['get:suscriptores'].documents_returned,1);
assert.equal(report.operations['queryEqual:suscriptores'].documents_returned,2);
assert.equal(report.operations['patch:suscriptores'].failures,1);
assert.doesNotMatch(JSON.stringify(report),/private|secret-id/);
assert.equal(observationPathV41('/superadmin/advertisers/secret-id/profile'),'/superadmin/advertisers/:id/profile');
const logs=[];const oldLog=console.log;const oldFetch=globalThis.fetch;
console.log=s=>logs.push(JSON.parse(s));
globalThis.fetch=()=>{throw Error('Public request must not access Firestore/network');};
try{
 const env={GLD_CACHE_KV:{async get(){return null;},async put(){throw Error('Unexpected KV write');}}};
 for(const path of ['/', '/territory/public','/guide?ciudad_id=test','/promos?ciudad_id=test']){
   const res=await worker.fetch(new Request('https://test.local'+path),env);
   assert.ok(res.headers.get('X-GLD-Request-Id'));
 }
 assert.equal(logs.length,4);
 assert.ok(logs.every(x=>Object.keys(x.operations).length===0));
}finally{console.log=oldLog;globalThis.fetch=oldFetch;}
console.log('V41: observation preserves results/errors, logs no credentials, adds no DB calls; public cold requests log zero DB operations.');
