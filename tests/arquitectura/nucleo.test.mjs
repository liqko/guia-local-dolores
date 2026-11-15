import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCore,createMeter}=require('../../arquitectura-nueva/nucleo.js');
const tracked=(data,usage={kv_reads:1,kv_writes:0,kv_deletes:0})=>({ok:true,data,usage});
test('500 anunciantes: el ingreso no descarga 500 fichas; páginas de 50 y detalle a demanda',async()=>{
 const calls=[];
 const core=createCore({transport:async q=>{
  calls.push(q);
  if(q.operation==='bootstrap')return tracked({principal_id:'u1',managed_count:500,permissions_revision:'7'});
  if(q.operation==='managed_page')return tracked({items:Array.from({length:50},(_,i)=>({id:String(i)})),next:'50'});
  if(q.operation==='advertiser_detail')return tracked({id:q.advertiser,nombre:'Ejemplo'});
  throw Error('Llamada no prevista '+q.operation);
 }});
 await core.bootstrap('token');
 assert.equal(calls.length,1);assert.equal(calls[0].operation,'bootstrap');
 await core.managedPage();assert.equal(calls.length,2);assert.equal(calls[1].limit,50);
 await Promise.all([core.detail('14'),core.detail('14')]);
 assert.equal(calls.filter(x=>x.operation==='advertiser_detail').length,1);
 await core.detail('14');assert.equal(calls.length,3);
});
test('cambio de permisos impide reutilizar detalles anteriores',async()=>{
 let reads=0;
 const core=createCore({transport:async q=>{
  if(q.operation==='bootstrap')return tracked({principal_id:'u1',managed_count:3,permissions_revision:'1'});
  if(q.operation==='advertiser_detail'){reads++;return tracked({id:q.advertiser});}
 }});
 await core.bootstrap('s');await core.detail('2');await core.detail('2');
 assert.equal(reads,1);core.permissionsChanged('u1','2');await core.detail('2');
 assert.equal(reads,2);
});
test('cambio de cuenta separa datos y descarta respuesta tardía',async()=>{
 let resolve;
 const core=createCore({transport:async q=>{
  if(q.operation==='bootstrap')return tracked({principal_id:q.session,permissions_revision:'1'});
  if(q.operation==='advertiser_detail')return new Promise(r=>{resolve=r;});
 }});
 await core.bootstrap('u1');
 const pending=core.detail('private');await new Promise(r=>setImmediate(r));
 await core.bootstrap('u2');resolve(tracked({secret:'u1'}));
 await assert.rejects(pending,/sesión cambió/);
});
test('revisión de publicación evita leer de nuevo una versión idéntica',async()=>{
 let reads=0;
 const core=createCore({transport:async q=>{
  if(q.operation==='public_city'){reads++;return tracked({city:q.city,revision:q.revision});}
 }});
 await core.publicCity('dolores','1');await core.publicCity('dolores','1');
 await core.publicCity('dolores','2');assert.equal(reads,2);
});
test('costos desconocidos NO se muestran como cero y se proyectan unidades medidas',()=>{
 const meter=createMeter({rates:{kv_reads:0.5/1e6},quotaLimits:{kv_reads:1e6}});
 meter.add('ver_ciudad',{kv_reads:3,kv_writes:0});
 const item=meter.forecast('ver_ciudad',1000),report=meter.report();
 assert.equal(item.projectedUnits.kv_reads,3000);
 assert.equal(item.knownUSD,0.0015);
 assert.equal(item.complete,false);assert.equal(report.complete,false);
 assert.equal(report.quotas.kv_reads.used,3);
 assert.ok(item.missing.includes('cpu_ms'));
});
test('las escrituras invalidan índice y ficha, sin recargar otras cuentas',async()=>{
 let detailReads=0,pageReads=0;
 const core=createCore({transport:async q=>{
  if(q.operation==='bootstrap')return tracked({principal_id:'u1'});
  if(q.operation==='advertiser_detail'){detailReads++;return tracked({id:q.advertiser});}
  if(q.operation==='managed_page'){pageReads++;return tracked({items:[]});}
  if(q.operation==='mutate')return tracked({revision:'2'},{kv_reads:2,kv_writes:1,kv_deletes:0});
 }});
 await core.bootstrap('u1');await core.managedPage();await core.detail('x');
 await core.mutate({advertiser:'x',command:'actualizar',revision:'1',changes:{nombre:'X'}});
 await core.managedPage();await core.detail('x');
 assert.equal(pageReads,2);assert.equal(detailReads,2);
 assert.equal(core.meter.report().units.kv_writes,1);
});
