'use strict';
// P4-0003: eventos finalizados salen del paquete público en el primer corte de las 01:00 posterior a su fin.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const w=fs.readFileSync(path.join(__dirname,'../../worker/worker206.txt'),'utf8');
const src=w.slice(w.indexOf('function eventPublicEnd206(row){'),w.indexOf('function cityEvent(event, programacion, city) {'));
const {eventPublicEnd206:end,eventActiveAt206:active}=new Function('text7',src+';return {eventPublicEnd206,eventActiveAt206};')(v=>String(v??'').trim());
const cut=iso=>Date.parse(iso);
test('fin de la última función activa, con cruce de medianoche y varias fechas',()=>{
 assert.equal(end({programacion:[{fecha:'2026-12-01',hora_desde:'20:00',hora_hasta:'22:00'},{fecha:'2026-12-03',hora_desde:'18:00',hora_hasta:'19:00'}]}),'2026-12-03T22:00:59.999Z');
 assert.equal(end({programacion:[{fecha:'2026-12-05',hora_desde:'22:00',hora_hasta:'02:30'}]}),'2026-12-06T05:30:59.999Z','cruza la medianoche');
 assert.equal(end({programacion:[{fecha:'2026-12-05',hora_desde:'22:00',hora_hasta:'00:00'}]}),'2026-12-06T03:00:59.999Z');
 assert.equal(end({programacion:[{fecha:'2026-12-05',hora_desde:'10:00'}]}),'2026-12-06T02:59:59.999Z','sin hora de fin: termina el día');
 assert.equal(end({programacion:[{fecha:'2026-12-09',hora_hasta:'23:00',activo:false},{fecha:'2026-12-04',hora_hasta:'12:00'}]}),'2026-12-04T15:00:59.999Z','ignora funciones inactivas');
 assert.equal(end({fecha_hasta:'2026-12-07'}),'2026-12-08T02:59:59.999Z');
 assert.equal(end({}),'','sin fechas no vence');
});
test('el corte retira sólo los finalizados antes de las 01:00 y las consultas sin corte no cambian',()=>{
 const tarde={programacion:[{fecha:'2026-12-05',hora_desde:'20:00',hora_hasta:'22:00'}]};
 const medianoche={programacion:[{fecha:'2026-12-05',hora_desde:'23:00',hora_hasta:'00:30'}]};
 const madrugada={programacion:[{fecha:'2026-12-05',hora_desde:'23:00',hora_hasta:'01:30'}]};
 const c6=cut('2026-12-06T01:00:00-03:00'),c7=cut('2026-12-07T01:00:00-03:00');
 assert.equal(active(tarde,c6),false);assert.equal(active(medianoche,c6),false);
 assert.equal(active(madrugada,c6),true,'termina después del corte: sigue hasta el corte siguiente');assert.equal(active(madrugada,c7),false);
 assert.equal(active(tarde,cut('2026-12-05T01:00:00-03:00')),true);assert.equal(active(tarde,null),true);assert.equal(active({},c7),true);
});
test('el publicador usa el corte y agenda la reproyección del día de fin',()=>{
 assert.match(w,/getEventsCityV2\(\{ cache, cityId: city, at: cityBookCutoff \}\)/);
 assert.match(w,/filter\(row=>eventActiveAt206\(row,at\)\)/);
 assert.match(w,/name==='events'&&definition\?\.module==='events'\)for\(const row of value\?\.\[definition\.field\]\|\|\[\]\)rememberDate\(eventPublicEnd206\(row\),name,city,true\)/);
});
