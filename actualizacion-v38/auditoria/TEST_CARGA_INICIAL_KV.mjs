import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../../plataforma/granhermano.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const source=script.slice(script.indexOf('let GH_KV_INITIAL_BUSY=false;'),script.indexOf('let GH_EDIT_BASE=null;'));
async function test(fail){
 const els=new Map(['btnInicializarKV','kvInicialMsg'].map(k=>[k,{disabled:false,textContent:''}]));let calls=0;let complete;
 const request=new Promise((resolve,reject)=>{complete=()=>fail?reject(new Error('prueba')):resolve({success:true})});
 const ctx={document:{getElementById:id=>els.get(id)},ghAdminRequest_:async(path,data,method)=>{calls++;assert.equal(path,'/rebuild-all-cache');assert.equal(method,'POST');assert.equal(Object.keys(data).length,0);return request}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 assert.equal(calls,0,'No hay carga al abrir la página');
 const first=ctx.ghInicializarKV();await ctx.ghInicializarKV();assert.equal(calls,1);assert.equal(els.get('btnInicializarKV').disabled,true);
 complete();await first;
 assert.equal(calls,1);assert.equal(els.get('btnInicializarKV').disabled,true);
 assert.match(els.get('kvInicialMsg').textContent,fail?/no confirmó/:/Carga completada/);
 if(!fail){await ctx.ghInicializarKV();assert.equal(calls,1)}
}
await test(false);await test(true);
console.log('Carga KV: sintaxis completa, cero carga automática, POST autenticado compartido, bloqueo doble clic y resultado/error aprobados.');
