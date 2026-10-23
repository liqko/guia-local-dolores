const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../plataforma/anunciantes.html'),'utf8');
const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);};
let calls=0;
const context={URL,AbortController,setTimeout,clearTimeout,GLD_WORKER_ORIGIN:'https://example.invalid',localStorage:{getItem:()=>JSON.stringify({ts:Date.now(),data:{results:[{id:'A',gold:true}]}}),setItem:()=>{}},fetch:async(url,options)=>{calls++;assert.equal(options.cache,'no-store');assert.equal(new URL(url).searchParams.get('compact'),'1');return {ok:true,json:async()=>({success:true,results:[{id:'A',gold:false}]})};},limpiarCampos:x=>({...x}),metaPorIdGlobal:{A:{gold:true,verificado:true}},relacionesSedesGlobales:{S:{actividades:[],acciones:[{accion_id:'VIEJA'}],nodos:[]}},catalogosGlobales:{actividades:[],acciones:[],nodos:[]},relKey:x=>x};
vm.createContext(context);
vm.runInContext(slice('    async function jsonpApi','    async function gldFetchJson')+slice('    const guiaPrefetchCache =','    const urlAnunciantes =')+slice('        function hidratarItem(item)','        const anunciantesData ='),context);
(async()=>{
 const results=await Promise.all(Array.from({length:10},()=>context.prefetchGuia('P','V','D')));
 assert.equal(calls,1,'One fresh request per city in this document, even with concurrent prefetch');
 assert(results.every(x=>x.results[0].gold===false),'The browser two-hour cache cannot hide a published change');
 const card=context.hidratarItem({id:'A',gold:false,verificado:false,sedes:[{sede_id:'S',actividades:[],acciones:[],nodos:[]}]});
 assert.equal(card.gold,false);assert.equal(card.verificado,false);assert.equal(card.acciones.length,0,'Stale bootstrap relations cannot revive a removed characteristic');
 const legacy=context.hidratarItem({id:'A',sedes:[{sede_id:'S'}]});
 assert.equal(legacy.gold,true);assert.equal(legacy.acciones.length,1,'Legacy data still receives missing metadata');
 console.log('PASS fresh public guide uses one request; current flags and relations override stale browser/bootstrap data; legacy fallback remains.');
})().catch(error=>{console.error(error);process.exitCode=1;});
