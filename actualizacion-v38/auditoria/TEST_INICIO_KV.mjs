import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../../plataforma/inicio.html',import.meta.url),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
async function run(ok){
  const els=new Map(); const calls=[];
  const element=()=>({disabled:true,hidden:true,value:'',textContent:'',style:{},children:[],events:{},addEventListener(t,f){this.events[t]=f},appendChild(e){this.children.push(e)}});
  const context={URL,AbortController,setTimeout,clearTimeout,console,localStorage:{getItem(){return null},setItem(){}},ResizeObserver:class{observe(){}},window:{parent:{postMessage(){}},addEventListener(){}},document:{body:{},documentElement:{scrollHeight:100},getElementById(id){if(!els.has(id))els.set(id,element());return els.get(id)},createElement:element},fetch:async u=>{calls.push(u);return {ok,status:ok?200:503,json:async()=>({success:true,ciudades:[{ciudad_id:'DOL',ciudad_visible:'Dolores',provincia_visible:'Buenos Aires',pais_visible:'Argentina'}]})}}};
  vm.createContext(context);vm.runInContext(source,context);
  await new Promise(r=>setTimeout(r,0));
  assert.deepEqual(calls,['https://login.liqkoargentina.workers.dev/territory/public']);
  if(ok){assert.equal(els.get('buscarCiudad').disabled,false);els.get('buscarCiudad').value='Buenos Aires';els.get('buscarCiudad').events.input();assert.equal(els.get('resultados').children.length,1);assert.equal(calls.length,1)}
  else{assert.equal(els.get('buscarCiudad').disabled,true);assert.equal(els.get('msg').textContent,'No se pudieron cargar las ciudades.')}
}
await run(true);await run(false);console.log('Inicio: una carga KV, búsqueda local y error sin fallback aprobados.');
