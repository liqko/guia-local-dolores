import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../plataforma/consumo-v44.js',import.meta.url),'utf8');
const storage=new Map();const originalCalls=[];
const response=new Response(JSON.stringify({success:true}),{headers:{'X-GLD-Worker-Version':'44','X-GLD-Request-Id':'test-request','X-GLD-Read-Calls':'2','X-GLD-Documents-Returned':'9','X-GLD-Write-Calls':'0','X-GLD-Delete-Calls':'0','X-GLD-Source':'worker','X-GLD-Public-Blocked':'0'}});
let next=response;
const window={fetch:async(...args)=>{originalCalls.push(args);if(next instanceof Error)throw next;return next},addEventListener(){}};window.parent=window;
const context={window,document:{currentScript:null,readyState:'loading',addEventListener(){}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{href:'https://test.local/plataforma/carcasa.html',origin:'https://test.local',pathname:'/plataforma/carcasa.html'},URL,Date,Set,JSON,Number,String};
vm.runInNewContext(source,context);
const options={method:'POST',body:JSON.stringify({action:'login',mail:'private@example.test',clave:'secret'})};
assert.equal(await window.fetch('https://login.liqkoargentina.workers.dev/suscriptores',options),response);
assert.equal(originalCalls[0][1],options);
let rows=JSON.parse(storage.get('gld_consumo_v44'));assert.equal(rows[0].consultas,2);assert.equal(rows[0].documentos,9);assert.equal(rows[0].accion,'login');
assert.doesNotMatch(storage.get('gld_consumo_v44'),/private|secret/);
assert.equal(await response.json().then(x=>x.success),true);
next=new Response('{}');await window.fetch('https://login.liqkoargentina.workers.dev/guide?ciudad_id=private-id');rows=JSON.parse(storage.get('gld_consumo_v44'));assert.equal(rows[1].consultas,null);assert.equal(rows[1].version,null);assert.doesNotMatch(storage.get('gld_consumo_v44'),/private-id/);
next=new Error('network');await assert.rejects(window.fetch('https://login.liqkoargentina.workers.dev/guide'),/network/);
assert.equal(JSON.parse(storage.get('gld_consumo_v44'))[2].estado,'Error de red');
next=new Response('{}');await window.fetch('https://other.example/test');assert.equal(JSON.parse(storage.get('gld_consumo_v44')).length,3);
for(const name of ['inicio','carcasa','anunciantes','suscriptores','login','granhermano','promos','eventos','actividades','farma_turnos']){
 const html=fs.readFileSync(new URL('../../plataforma/'+name+'.html',import.meta.url),'utf8');
 assert.match(html,/<script src="\/plataforma\/consumo-v44\.js"/);assert.equal(html.match(/consumo-v44\.js/g).length,1);
}
console.log('Consumo V44: preserva respuestas/cuerpos/errores, detecta falta de medición, no registra claves/correo/ciudad y cubre diez HTML.');
