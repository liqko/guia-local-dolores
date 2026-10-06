import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import worker from '../../worker/WORKER_COMPLETO_V46.js';
const values=new Map();
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SERVER_SECRET:'test-only',FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@test.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}};
function doc(c,id,data){return {name:'projects/test/databases/(default)/documents/'+c+'/'+id,fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:{stringValue:String(v)}]))}}
const account=doc('suscriptores','S',{mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true});
const relations=Array.from({length:8},(_,i)=>doc('suscriptor_anunciante','R'+i,{suscriptor_id:'S',anunciante_id:'A'+i,anunciante_nombre:'Comercio '+i,rol:'ADMIN',activo:true}));
const favorites=Array.from({length:11},(_,i)=>doc('suscriptor_favoritos','F'+i,{suscriptor_id:'S',tipo:'ANUNCIANTE',referencia_id:'A'+i,activo:true}));
let fsCalls=0;
const original=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(String(url)==='https://oauth2.googleapis.com/token')return Response.json({access_token:'test-only',expires_in:3600});
 assert.ok(String(url).startsWith('https://firestore.googleapis.com/'));fsCalls++;
 if(String(url).endsWith(':runQuery')){const body=JSON.parse(options.body);const c=body.structuredQuery.from[0].collectionId;return Response.json((c==='suscriptores'?[account]:c==='suscriptor_favoritos'?favorites:relations).map(document=>({document})))}
 assert.match(String(url),/anunciantes_administracion\/A\d$/);return Response.json(doc('anunciantes_administracion',String(url).split('/').pop(),{funcionalidades:'PROMOS, EVENTOS'}));
};
async function login(password='test-password'){
 const response=await worker.fetch(new Request('https://test.invalid/suscriptores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',mail:'persona@test.invalid',clave:password})}),env);
 assert.equal(response.status,password==='test-password'?200:401);assert.equal(response.headers.get('X-GLD-Worker-Version'),'46');return {body:await response.json(),calls:Number(response.headers.get('X-GLD-Read-Calls')),docs:Number(response.headers.get('X-GLD-Documents-Returned'))};
}
try{
 let cold=await login();assert.equal(cold.body.success,true);assert.equal(cold.calls,10);assert.equal(cold.docs,17);assert.equal(fsCalls,10);
 fsCalls=0;let warm=await login();assert.equal(warm.calls,1);assert.equal(warm.docs,1);assert.equal(fsCalls,1);assert.deepEqual(warm.body.anunciantes,cold.body.anunciantes);
 fsCalls=0;const favRequest=()=>new Request('https://test.invalid/suscriptores?action=favoritos',{headers:{Authorization:'Bearer '+warm.body.token}});
 let fav=await worker.fetch(favRequest(),env);assert.equal(fav.status,200,await fav.clone().text());assert.equal(fav.headers.get('X-GLD-Documents-Returned'),'11');assert.equal((await fav.json()).favoritos.length,11);assert.equal(fsCalls,1);
 fsCalls=0;fav=await worker.fetch(favRequest(),env);assert.equal(fav.headers.get('X-GLD-Read-Calls'),'0');assert.equal((await fav.json()).favoritos.length,11);assert.equal(fsCalls,0);
 fsCalls=0;let bad=await login('incorrecta');assert.equal(bad.body.success,false);assert.equal(fsCalls,1);
 fsCalls=0;const publicResponse=await worker.fetch(new Request('https://test.invalid/territory/public'),env);assert.equal(publicResponse.headers.get('X-GLD-Documents-Returned'),'0');assert.equal(fsCalls,0);
}finally{globalThis.fetch=original}
console.log('Bundle V46: favoritos frío 1/11 y repetido 0/0; login frío 10/17, repetido 1/1, contraseña incorrecta rechazada, público sin Firestore.');
