import assert from 'node:assert/strict';
import {observeDbV41,observationPathV41,finishObservationV42,publicDbGuardV44} from '../worker/core/db-observation-v41.js';
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
const summary=finishObservationV42({...report,method:'POST',path:'/test',status:500});
assert.deepEqual(summary.totals,{read_calls:3,documents_returned:3,write_calls:1,delete_calls:0,failures:1});
assert.match(summary.message,/consultas 3, documentos 3, escrituras 1/);
assert.doesNotMatch(summary.message,/private|secret-id/);
const logs=[];const oldLog=console.log;const oldFetch=globalThis.fetch;
const blockedReport={};
for(const operation of ['get','queryEqual','listCollection','patch','delete']){
 await assert.rejects(publicDbGuardV44(blockedReport)[operation]('any','id'),/bloqueado/);
}
assert.equal(blockedReport.public_blocked,5);
console.log=s=>logs.push(JSON.parse(s));
globalThis.fetch=()=>{throw Error('Public request must not access Firestore/network');};
try{
 const env={GLD_CACHE_KV:{async get(){return null;},async put(){throw Error('Unexpected KV write');}}};
 for(const path of ['/', '/territory/public','/guide?ciudad_id=test','/promos?ciudad_id=test']){
   const res=await worker.fetch(new Request('https://test.local'+path),env);
   assert.ok(res.headers.get('X-GLD-Request-Id'));
   assert.equal(res.headers.get('X-GLD-Worker-Version'),'46');
   for(const name of ['Read-Calls','Documents-Returned','Write-Calls','Delete-Calls','Public-Blocked'])assert.equal(res.headers.get('X-GLD-'+name),'0');
   assert.match(res.headers.get('Access-Control-Expose-Headers'),/X-GLD-Read-Calls/);
   if(path!=='/')assert.equal(res.headers.get('X-GLD-Source'),'public-kv');
 }
 assert.equal(logs.length,4);
 assert.ok(logs.every(x=>Object.keys(x.operations).length===0));
 assert.ok(logs.every(x=>x.worker_version==='46' && x.started_at && x.message.includes('consultas 0, documentos 0')));
 assert.equal(logs[0].status,200);
 assert.equal(logs[1].status,503);
}finally{console.log=oldLog;globalThis.fetch=oldFetch;}
console.log('V41: observation preserves results/errors, logs no credentials, adds no DB calls; public cold requests log zero DB operations.');
