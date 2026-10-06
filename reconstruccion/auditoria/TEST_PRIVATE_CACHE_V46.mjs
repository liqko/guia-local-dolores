import assert from 'node:assert/strict';
import {withPrivateCacheV46} from '../worker/core/private-cache-v46.js';
import {observeDbV41,finishObservationV42} from '../worker/core/db-observation-v41.js';
import {subscriberLoginV2} from '../worker/modules/suscriptor-login-v2.js';
import {listFavoritesV2,addFavoriteV2,removeFavoriteV2} from '../worker/modules/suscriptor-favoritos-v2.js';
const values=new Map();let lists=0;
const env={SERVER_SECRET:'test-only',GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v,options){assert.equal(options,undefined);values.set(k,v)},async delete(k){values.delete(k)},async list({prefix,cursor}){lists++;const keys=[...values.keys()].filter(k=>k.startsWith(prefix)).sort();const offset=Number(cursor||0);return {keys:keys.slice(offset,offset+2).map(name=>({name})),list_complete:offset+2>=keys.length,cursor:String(offset+2)}}}};
const favorites=new Map(Array.from({length:11},(_,i)=>['F'+i,{id:'F'+i,favorito_id:'F'+i,suscriptor_id:'S',tipo:i%2?'CIUDAD':'ANUNCIANTE',referencia_id:'REF'+i,activo:true}]));
let account={id:'S',mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true};
const raw={async queryEqual(c,f,v){if(c==='suscriptores')return account?[{...account}]:[];if(c==='suscriptor_anunciante')return [];assert.equal(c,'suscriptor_favoritos');return [...favorites.values()].filter(r=>r[f]===v).map(r=>({...r}))},async get(c,id){assert.equal(c,'suscriptor_favoritos');return favorites.get(id)||null},async patch(c,id,p){assert.equal(c,'suscriptor_favoritos');const r={id,...favorites.get(id),...p};favorites.set(id,r);return {...r}},async delete(c,id){if(c==='suscriptores')account=null;else favorites.delete(id)},async listCollection(){throw Error('No barridos Firestore')}};
function request(){const report={operations:{}};return {db:withPrivateCacheV46(observeDbV41(raw,report),env),totals:()=>finishObservationV42(report).totals}}
let req=request();const login=await subscriberLoginV2({env,db:req.db,body:{mail:account.mail,clave:account.clave}});assert.equal(login.success,true);
const auth=new Request('https://test.invalid/suscriptores',{headers:{Authorization:'Bearer '+login.token}});
async function list(type=''){const r=request();const out=await listFavoritesV2({env,request:auth,db:r.db,type});await r.db.flushLoginCache();return {...out,...r.totals()}}
let out=await list();assert.equal(out.document_count,undefined);assert.equal(out.documents_returned,11);assert.equal(out.read_calls,1);
out=await list();assert.equal(out.documents_returned,0);assert.equal(out.read_calls,0);assert.equal(out.favoritos.length,11);assert.equal(lists,0);
// No vence tras una hora ni un día. Los tokens sí mantienen su vencimiento normal.
const originalNow=Date.now;Date.now=()=>originalNow()+2*3600*1000;
try{out=await list();assert.equal(out.read_calls,0);req=request();const again=await subscriberLoginV2({env,db:req.db,body:{mail:account.mail,clave:account.clave}});assert.equal(again.success,true);assert.equal(req.totals().read_calls,1)}finally{Date.now=originalNow}
req=request();await addFavoriteV2({env,request:auth,db:req.db,body:{tipo:'EVENTO',referencia_id:'E',suscriptor_id:'AJENO'}});await req.db.flushLoginCache();assert.equal(req.totals().read_calls,0);assert.equal(req.totals().write_calls,1);out=await list('EVENTO');assert.equal(out.read_calls,0);assert.equal(out.favoritos.length,1);assert.equal(out.favoritos[0].suscriptor_id,'S');
req=request();await removeFavoriteV2({env,request:auth,db:req.db,body:{tipo:'EVENTO',referencia_id:'E'}});await req.db.flushLoginCache();assert.equal(req.totals().read_calls,1);assert.equal(req.totals().delete_calls,1);out=await list();assert.equal(out.read_calls,0);assert.equal(out.favoritos.length,11);
// Dos mutaciones concurrentes de favoritos distintos se conservan ambas.
const a=request(),b=request();await Promise.all([addFavoriteV2({env,request:auth,db:a.db,body:{tipo:'PROMO',referencia_id:'P'}}),addFavoriteV2({env,request:auth,db:b.db,body:{tipo:'ACTIVIDAD',referencia_id:'A'}})]);await Promise.all([a.db.flushLoginCache(),b.db.flushLoginCache()]);out=await list();assert.equal(out.read_calls,0);assert.equal(out.favoritos.length,13);
// Una vez propagados los cambios, navegar no vuelve a listar el índice KV.
Date.now=()=>originalNow()+120000;try{await list();const before=lists;await list();assert.equal(lists,before)}finally{Date.now=originalNow}
const originalPut=env.GLD_CACHE_KV.put;env.GLD_CACHE_KV.put=async(k,v,o)=>{if(k.endsWith(':changes'))throw Error('Fallo KV simulado');return originalPut(k,v,o)};
const failed=request();await addFavoriteV2({env,request:auth,db:failed.db,body:{tipo:'EVENTO',referencia_id:'FAIL'}});await assert.rejects(failed.db.flushLoginCache(),/Fallo KV/);env.GLD_CACHE_KV.put=originalPut;out=await list();assert.ok(out.favoritos.some(r=>r.referencia_id==='FAIL'));
const outsider=request();assert.deepEqual(await outsider.db.subscriberFavorites('OTRO'),[]);assert.equal(outsider.totals().documents_returned,0);
await assert.rejects(listFavoritesV2({env,request:new Request('https://test.invalid'),db:request().db}),/Sesión/);
const loginKey='login:relations:v45:S:initial';values.set(loginKey,JSON.stringify({version:45,expires_at:Date.now()+3600000,data:[]}));
req=request();await subscriberLoginV2({env,db:req.db,body:{mail:account.mail,clave:account.clave}});assert.equal(req.totals().read_calls,1);assert.equal(JSON.parse(values.get(loginKey)).version,46);assert.equal(JSON.parse(values.get(loginKey)).expires_at,undefined);
req=request();await req.db.delete('suscriptores','S');await req.db.flushLoginCache();const bad=await subscriberLoginV2({env,db:request().db,body:{mail:'persona@test.invalid',clave:'test-password'}});assert.equal(bad.success,false);assert.ok(![...values.keys()].some(k=>k.startsWith('subscriber:favorites:v46:S:')));
assert.ok(![...values.values()].join('').includes('test-password'));
console.log('V46: favoritos frío 1/11, repetido 0/0, sin caducidad horaria; alta 1PATCH/0lecturas, baja 1GET+1DELETE, filtro/aislamiento y concurrencia conservados; login fresco 1/1.');
