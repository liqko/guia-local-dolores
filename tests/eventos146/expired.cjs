const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('plataforma/login.html','utf8');
function fn(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);const next=source.indexOf('\nfunction ',start+10);return source.slice(start,next<0?source.length:next);}
const now=new Date(2026,9,26,18);class Clock extends Date{constructor(...a){super(...(a.length?a:[now.getTime()]));}}
const c=vm.createContext({Date:Clock,isIsoZ:s=>/Z$/.test(s)});
vm.runInContext(['toDateInputValue','publicacionPausada','eventExpired146','eventStatus146','eventExpiryNote146'].map(fn).join('\n'),c);
const past={fecha_desde:'2026-10-25',pausado:false};const before=JSON.stringify(past);
assert.equal(c.eventStatus146(past),'Vencido · sin pausa');assert.equal(c.eventStatus146({...past,pausado:true}),'Vencido · pausado');
assert.equal(c.eventStatus146({fecha_desde:'2026-10-26'}),'Activo');assert.equal(c.eventStatus146({fecha_desde:'2026-10-27'}),'Activo');assert.equal(c.eventStatus146({fecha_desde:'2026-10-27',pausado:true}),'Pausado');
assert(!c.eventExpired146({...past,fecha_hasta:'2026-10-27'}));assert(c.eventExpired146({fecha_desde:'25/10/2026'}));assert(!c.eventExpired146({}));assert(!c.eventExpired146({...past,programacion:[{fecha:'2026-10-27'}]}));assert(c.eventExpired146({...past,programacion:[{fecha:'2026-10-27',activo:false},{fecha:'2026-10-25'}]}));
assert(c.eventExpiryNote146(past,true).includes('Borrar no recupera'));assert(c.eventExpiryNote146({...past,pausado:true}).includes('no ocupa cupo de activos'));assert.equal(JSON.stringify(past),before);
for(const [,attrs,js] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(attrs)&&!/type=["'](?:application\/ld\+json|module)/.test(attrs))new vm.Script(js);
console.log('PASS vencido/sin pausa, vencido/pausado, vigente, último día, fecha final, formato local, sin fecha; nota de cupos; registros intactos; JavaScript parsea. No network/DB APIs available in fixture.');
