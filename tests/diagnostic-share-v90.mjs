import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import worker from '../worker/WORKER_COMPLETO_V90.mjs';
const values=new Map(),puts=[];
const env={SERVER_SECRET:'share-test-only',GLD_CACHE_KV:{get:async k=>values.get(k)||null,put:async(k,v,options)=>{values.set(k,v);puts.push({k,options});},delete:async k=>values.delete(k)}};
const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url');};
const principal=sign({sid:'OWNER',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:0,exp:null});
const other=sign({sid:'OTHER',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:0,exp:null});
let external=0;const native=globalThis.fetch,log=console.log;globalThis.fetch=async()=>{external++;throw Error('Firestore/network forbidden');};console.log=()=>{};
const row={fecha:'2026-10-13T20:33:00Z',hora:'17:33:00',pagina:'/plataforma/carcasa.html',ruta:'/advertisers/test@example.com?token=secret',accion:'session',estado:200,version:'90',consultas:0,documentos:null,escrituras:0,eliminaciones:0,resultado:'<script>alert(1)</script>',authorization:'DO NOT SHARE',body:{password:'DO NOT SHARE'},operaciones:[{collection:'anunciantes',operation:'get',calls:0,documents_returned:null,secret:'DO NOT SHARE'}],cache:[{collection:'anunciantes',result:'hit',key:'DO NOT SHARE'}]};
async function req(path,token,body){const r=await worker.fetch(new Request('https://test.invalid'+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);for(const h of ['Read','Write','Delete'])assert.equal(r.headers.get('X-GLD-'+h+'-Calls'),'0');return r;}
try{
 assert.equal((await req('/superadmin/diagnostics/share','',{action:'create',rows:[row]})).status,401);
 assert.equal((await req('/superadmin/diagnostics/share',sign({sid:'LOCAL',rol:'ADMIN_LOCAL',persistent:true,exp:null}),{action:'create',rows:[row]})).status,403);
 assert.equal((await req('/superadmin/diagnostics/share',principal,null)).status,400);
 assert.equal((await req('/superadmin/diagnostics/share',principal,{action:'create',rows:[]})).status,400);
 assert.equal(puts.length,0);
 const created=await (await req('/superadmin/diagnostics/share',principal,{action:'create',rows:[row]})).json();assert(created.success);assert.match(created.token,/^[a-f0-9]{64}$/);assert.equal(puts.at(-1).options.expirationTtl,3600);
 const key='diagnostics:share:v90:'+created.token;assert(!values.get(key).includes('DO NOT SHARE'));assert(!values.get(key).includes('test@example.com'));
 assert.equal((await req('/superadmin/diagnostics/share',created.token,{action:'create',rows:[row]})).status,401);
 const url=new URL(created.url);const response=await req(url.pathname);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert(response.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));const html=await response.text();assert(!html.includes('<script>'));assert(html.includes('Sin medición'));assert(html.includes('<td>0</td>'));assert(!html.includes(principal));
 const shared=await(await req(url.pathname+'?format=json')).json();assert.equal(shared.rows[0].documentos,null);assert.equal(shared.rows[0].consultas,0);assert(!('owner' in shared));assert(!('authorization' in shared.rows[0]));
 assert.equal((await req('/superadmin/diagnostics/share',other,{action:'revoke',token:created.token})).status,404);
 const updated=await(await req('/superadmin/diagnostics/share',principal,{action:'update',token:created.token,rows:[{...row,escrituras:1}]})).json();assert.equal(updated.url,created.url);assert.equal(updated.expires_at,created.expires_at);assert.equal((await(await req(url.pathname+'?format=json')).json()).rows[0].escrituras,1);
 assert.equal((await req(url.pathname,'',{action:'create'})).status,405);
 await req('/superadmin/diagnostics/share',principal,{action:'revoke',token:created.token});assert.equal((await req(url.pathname)).status,404);
 const expiring=await(await req('/superadmin/diagnostics/share',principal,{action:'create',rows:[row]})).json();const expired=JSON.parse(values.get('diagnostics:share:v90:'+expiring.token));expired.expires_at=Date.now()-1;values.set('diagnostics:share:v90:'+expiring.token,JSON.stringify(expired));assert.equal((await req(new URL(expiring.url).pathname)).status,404);
 assert.equal(external,0);
 log('PASS: principal-only sharing, sanitized snapshot, read-only HTML/JSON, zero/null distinction, same-URL update, owner-only revoke, expiry, KV TTL and zero Firestore/external requests.');
}finally{globalThis.fetch=native;console.log=log;}
