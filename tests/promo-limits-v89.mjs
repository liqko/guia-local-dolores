import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import worker from '../worker/WORKER_COMPLETO_V89.js';
const env={SERVER_SECRET:'promo-test',GLD_CACHE_KV:{get:async()=>null,put:async()=>{},list:async()=>({keys:[],list_complete:true}),delete:async()=>{}}};
const body=Buffer.from(JSON.stringify({typ:'GLD_SUBSCRIBER',sid:'S',sv:0,persistent:true,exp:null,auth:[{anunciante_id:'A',rol:'PROPIETARIO',permisos:'PROMOS'}]})).toString('base64url');const token=body+'.'+createHmac('sha256',env.SERVER_SECRET).update(body).digest('base64url');
const native=fetch,log=console.log;let external=0;globalThis.fetch=async()=>{external++;throw Error('Unexpected Firestore/network access.');};console.log=()=>{};
try{
 for(const action of ['createPromo','updatePromo'])for(const payload of [{otros:'x'.repeat(121)},{promo:'x'.repeat(301)}]){
  const r=await worker.fetch(new Request('https://test.invalid/promos',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,advertiserId:'A',payload:{promo_id:action==='updatePromo'?'P':'',...payload}})}),env);const j=await r.json();assert.equal(r.status,400,JSON.stringify(j));assert.ok(/120|300/.test(j.message));
  for(const h of ['X-GLD-Read-Calls','X-GLD-Write-Calls','X-GLD-Delete-Calls'])assert.equal(r.headers.get(h),'0');
 }
 assert.equal(external,0);log('PASS: create/update reject 121-character clarification and 301-character promo before any Firestore read/write/delete.');
}finally{globalThis.fetch=native;console.log=log;}
