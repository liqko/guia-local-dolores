import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('plataforma/terminos-anunciantes.js','utf8');let receipt=null,operations=[];
function page(storage=new Map()){
 const nodes=new Map(['aceptar-terminos-anunciantes','continuar-terminos-anunciantes','volver-terminos-anunciantes','terminos-anunciantes-msg','btnLogin'].map(id=>[id,{checked:false,disabled:false,textContent:'',addEventListener(t,fn){this[t]=fn}}]));
 let panel='';const w={};
 vm.runInNewContext(source,{window:w,document:{getElementById:id=>nodes.get(id)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:()=>null,setItem(){}},mostrarPanel:p=>panel=p,fetch:async(url,opts)=>{operations.push(opts.method);if(opts.method==='POST'){receipt={version:'2026-10-11',usuario_id:'U',fecha:'2026-10-12T15:00:00Z'};}return {ok:true,status:200,json:async()=>({success:true,aceptada:!!receipt,aceptacion:receipt})};}});
 return {w,nodes,storage,panel:()=>panel};
}
const p=page();let entered=false;const first=p.w.GLD_TERMINOS_ANUNCIANTES.aceptarIngreso('U').then(v=>entered=v);await new Promise(r=>setTimeout(r,0));assert.equal(p.panel(),'terminos-anunciantes');assert.deepEqual(operations,['GET']);await p.nodes.get('continuar-terminos-anunciantes').onclick();assert.equal(entered,false);p.nodes.get('aceptar-terminos-anunciantes').checked=true;await p.nodes.get('continuar-terminos-anunciantes').onclick();await first;assert.equal(entered,true);assert.deepEqual(operations,['GET','POST']);
const reloaded=page(p.storage);assert.equal(await reloaded.w.GLD_TERMINOS_ANUNCIANTES.aceptarIngreso('U'),true);assert.equal(operations.length,2);
const otherDevice=page();assert.equal(await otherDevice.w.GLD_TERMINOS_ANUNCIANTES.aceptarIngreso('U'),true);assert.deepEqual(operations,['GET','POST','GET']);
const freshLogin=page();assert.equal(await freshLogin.w.GLD_TERMINOS_ANUNCIANTES.aceptarIngreso('U',receipt),true);assert.equal(operations.length,3);
console.log('PASS: aceptación sin premarcar, POST solo al aceptar, recarga sin consulta, otro dispositivo recupera recibo y login con recibo evita consultas.');
