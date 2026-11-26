const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync('plataforma/contenido-adulto.js','utf8');
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url')+'.firma';
test('la concesión local vencida o de otra cuenta no activa el camino remoto',async()=>{
 for(const [sid,offset,expected] of [['A',-1000,false],['B',60000,false],['A',60000,true]]){
  const storage=new Map([['gld_adult_access_v67',encode({typ:'GLD_ADULT_ACCESS',sid,exp:Date.now()+offset})]]);
  const calls=[];
  const window={fetch:async(_url,options)=>{calls.push(options.headers);return new Response();}};
  vm.runInNewContext(source,{window,atob,URL,Headers,Request,location:{href:'https://www.guialocal.ar/'},
   document:{querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({}),head:{appendChild(){}},body:{}},
   MutationObserver:class{observe(){}},sessionStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},
   localStorage:{getItem:()=>encode({typ:'GLD_SUBSCRIBER',sid:'A',persistent:true})}});
  assert.equal(window.GLD_ADULT.hasGrant(),expected);
  await window.fetch('https://login.liqkoargentina.workers.dev/guide');
  assert.equal(calls[0].has('X-GLD-Adult-Token'),expected);
  assert.equal(calls[0].has('Authorization'),expected);
 }
});
