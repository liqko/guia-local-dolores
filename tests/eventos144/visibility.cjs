const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname+'/../..';
const html=fs.readFileSync(root+'/plataforma/eventos.html','utf8');
function fn(source,name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);const body=source.indexOf('{',start);let depth=1,i=body+1;for(;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
const now=new Date(2026,9,26,18);
class Clock extends Date{constructor(...args){super(...(args.length?args:[now.getTime()]));}static now(){return now.getTime();}}
const ctx=vm.createContext({Date:Clock});
vm.runInContext(['parseToDate','isPastDate','getFechaDesdeRaw','getFechaHastaRaw','eventMatchesCity'].map(n=>fn(html,n)).join('\n'),ctx);
const city='DOL (BUE - ARG)';
const visible=e=>!ctx.isPastDate(ctx.getFechaDesdeRaw(e),ctx.getFechaHastaRaw(e))&&ctx.eventMatchesCity(e,city);
assert(visible({ciudad_id:'VIRTUAL',fecha_desde:'2027-02-23'}));
assert(!visible({ciudad_id:city,fecha_desde:'2026-10-24',fecha_hasta:''}));
assert(!visible({ciudad_id:'VIRTUAL',fecha_desde:'2026-10-25'}));
assert(visible({ciudad_id:city,fecha_desde:'2026-10-26'}));
assert(visible({ciudad_id:city,fecha_desde:'2026-10-24',fecha_hasta:'2026-10-28'}));
assert(!visible({ciudad_id:'OTRA CIUDAD',fecha_desde:'2027-02-23'}));
assert.equal((html.match(/eventMatchesCity\(ev, /g)||[]).length,3); // declaration + both screen filters
for(const file of ['anunciantes.html','carcasa.html']){
 const source=fs.readFileSync(root+'/plataforma/'+file,'utf8');
 const c=vm.createContext({Date:Clock});
 vm.runInContext(fn(source,'parseEventDate')+'\n'+fn(source,'eventIsActive'),c);
 assert(!c.eventIsActive({fecha_desde:'2026-10-24',fecha_hasta:''}));
 assert(c.eventIsActive({fecha_desde:'2027-02-23',ciudad_id:'VIRTUAL'}));
}
for(const [,script]of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(script.trim())new vm.Script(script);
console.log('PASS: future virtual event visible; expired physical/virtual hidden; today and ongoing retained; other physical city excluded; both filters shared; advertiser cards agree; inline JavaScript parses.');
