import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import worker from '../worker/WORKER_COMPLETO_V87.js';
const values=new Map();let firestoreCalls=0;
const env={SERVER_SECRET:'test-session-secret',GLD_CACHE_KV:{get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k),list:async()=>({keys:[],list_complete:true})}};
const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url');};
const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>{firestoreCalls++;throw Error('Unexpected external request: session and diagnostics must use KV only.');};
const log=console.log;console.log=()=>{};
const stateKey='subscriber:session-state:v1:S';
async function request(path,token,body){const r=await worker.fetch(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);const j=await r.json();assert.equal(r.headers.get('X-GLD-Read-Calls'),'0');assert.equal(r.headers.get('X-GLD-Write-Calls'),'0');assert.equal(r.headers.get('X-GLD-Delete-Calls'),'0');return {r,j};}
try{
 const legacy=sign({typ:'GLD_SUBSCRIBER',sid:'S',sv:0,auth:[],iat:Date.now(),exp:Date.now()+60000});
 let out=await request('/suscriptores',legacy,{action:'session'});assert.equal(out.r.status,200);
 const upgraded=out.r.headers.get('X-GLD-Session-Token');assert.ok(upgraded);const payload=JSON.parse(Buffer.from(upgraded.split('.')[0],'base64url'));assert.equal(payload.persistent,true);assert.equal(payload.exp,null);
 const now=Date.now;Date.now=()=>now()+365*86400000;
 out=await request('/suscriptores',upgraded,{action:'session'});assert.equal(out.r.status,200);assert.equal(out.j.persistent,true);assert.equal(out.r.headers.get('X-GLD-Session-Token'),null);
 Date.now=now;
 values.set(stateKey,JSON.stringify({version:1,deleted:false}));out=await request('/suscriptores',upgraded,{action:'session'});assert.equal(out.r.status,401);
 values.delete(stateKey);
 const expired=sign({typ:'GLD_SUBSCRIBER',sid:'S',sv:0,exp:Date.now()-1});out=await request('/suscriptores',expired,{action:'session'});assert.equal(out.r.status,401);assert.equal(out.r.headers.get('X-GLD-Session-Token'),null);
 const principal=sign({sid:'S',sv:0,rol:'SUPERADMIN_PRINCIPAL',persistent:true,exp:null});
 out=await request('/superadmin/diagnostics/session',principal,{action:'create'});assert.equal(out.r.status,200);const cap=out.j.capability;assert.ok(cap);
 out=await request('/superadmin/diagnostics/session','',{action:'validate',capability:cap});assert.equal(out.r.status,200);
 // A diagnostics capability must not authorize any administrator operation.
 out=await request('/superadmin/diagnostics/session',cap,{action:'create'});assert.equal(out.r.status,401);
 out=await request('/superadmin/diagnostics/session',sign({sid:'S',rol:'ADMIN_LOCAL',persistent:true,exp:null}),{action:'create'});assert.equal(out.r.status,403);
 out=await request('/superadmin/diagnostics/session','',{action:'validate',capability:cap+'bad'});assert.equal(out.r.status,401);
 values.set('admin:access:v72:S',JSON.stringify({activo:false,revision:'new'}));out=await request('/superadmin/diagnostics/session','',{action:'validate',capability:cap});assert.equal(out.r.status,401);
 values.delete('admin:access:v72:S');values.set(stateKey,JSON.stringify({version:1}));out=await request('/superadmin/diagnostics/session','',{action:'validate',capability:cap});assert.equal(out.r.status,401);
 assert.equal(firestoreCalls,0);
 log('PASS: session upgrade, 365-day reopening, revocation, expired legacy rejection, principal-only diagnostics, forged/revoked capability rejection; zero Firestore calls.');
}finally{console.log=log;globalThis.fetch=nativeFetch;}
