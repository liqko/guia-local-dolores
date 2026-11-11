const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const source=readFileSync('plataforma/eventos.html','utf8');
const start=source.indexOf('          (async()=>{',source.indexOf('async function iniciarModuloEventos'));
const end=source.indexOf('})(),',start)+4;
assert(start>=0&&end>start);
const expression=source.slice(start,end);
for(const granted of [false,true])test('Eventos: '+(granted?'la autorización +18 mantiene lectura protegida':'la copia pública evita consultar Eventos'),async()=>{
 let bookReads=0,network=0;
 const publicResponse={success:true,events:[]},protectedResponse={success:true,events:[]};
 const c=vm.createContext({window:{GLD_ADULT:{hasGrant:()=>granted},GLD_PAQUETE_CIUDAD:{get:async()=>{bookReads++;return {modules:{events:publicResponse}};}}},ciudadContexto:{ciudad_id:'DOL (BUE - ARG)'},eventsEndpointCiudad:'https://login.liqkoargentina.workers.dev/events-new',fetchJsonConTimeout:async()=>{network++;return protectedResponse;}});
 assert.equal(await vm.runInContext(expression,c),granted?protectedResponse:publicResponse);
 assert.equal(network,Number(granted));assert.equal(bookReads,Number(!granted));
});
