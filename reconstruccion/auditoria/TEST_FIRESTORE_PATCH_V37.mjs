import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createDb} from '../worker/core/db.js';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const env={FIREBASE_PROJECT_ID:'solo-pruebas',FIREBASE_CLIENT_EMAIL:'prueba@prueba.invalid',FIREBASE_PRIVATE_KEY:privateKey};
const originalFetch=globalThis.fetch,calls=[];
globalThis.fetch=async(url,options)=>{
 const u=new URL(url);
 if(u.hostname==='oauth2.googleapis.com')return new Response(JSON.stringify({access_token:'prueba',expires_in:3600}),{status:200});
 assert.equal(u.hostname,'firestore.googleapis.com');calls.push({url:u,options});
 return new Response(JSON.stringify({name:u.origin+u.pathname,fields:JSON.parse(options.body).fields}),{status:200});
};
try{
 const saved=await createDb(env).patch('anunciantes','ADV',{nombre:'Cambio.',actualizado_en:'fecha',ignorado:undefined},{mustExist:true});
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'PATCH');
 assert.deepEqual(calls[0].url.searchParams.getAll('updateMask.fieldPaths').sort(),['actualizado_en','nombre']);
 assert.equal(calls[0].url.searchParams.get('currentDocument.exists'),'true');
 assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body).fields).sort(),['actualizado_en','nombre']);
 assert.equal(saved.nombre,'Cambio.');
 console.log('FIRESTORE PATCH V37 OK: transporte real con red simulada; un PATCH, máscara exacta, sin GET/consulta previa');
}finally{globalThis.fetch=originalFetch}

