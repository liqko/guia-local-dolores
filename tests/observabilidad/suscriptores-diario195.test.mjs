// Calendar/UI compatibility after migrating the single publisher to DailyEdition206.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {w,fixture,cutoff,day} from '../arquitectura/fixture206.mjs';
const people=[{id:'A',suscriptor_id:'A',nombre:'Ana',fecha_nacimiento:'1990-11-12',activo:true},{id:'B',nombre:'Bea',fecha_nacimiento:'1980-11-18',activo:true},{id:'C',nombre:'Caro',fecha_nacimiento:'1970-11-19',activo:true},{id:'D',nombre:'Dani',fecha_nacimiento:'2000-11-13',activo:false}];
test('cumpleaños es una lista de personas de hoy y los seis días siguientes, sin resúmenes de edad',()=>{
 const r=w.birthdayList195({preparado:true,results:people},new Date('2026-11-12T14:00:00Z'));
 assert.equal(r.periodo_dias,7);assert.equal(r.desde,'2026-11-12');assert.equal(r.hasta,'2026-11-18');assert.deepEqual(r.results.map(x=>x.nombre),['Ana','Bea']);assert(!JSON.stringify(r).includes('mayores18'));
 const tomorrow=w.birthdayList195({preparado:true,results:people},new Date('2026-11-13T14:00:00Z'));assert.deepEqual(tomorrow.results.map(x=>x.nombre),['Bea','Caro']);
});

test('ventana de siete días cruza año usando fecha argentina y conserva homónimos',()=>{
 const rows=[{id:'1',nombre:'Juan',fecha_nacimiento:'1980-12-31'},{id:'2',nombre:'Juan',fecha_nacimiento:'2000-01-01'},{id:'3',nombre:'Fuera',fecha_nacimiento:'2000-01-04'}];
 const r=w.birthdayList195({preparado:true,results:rows},new Date('2027-01-01T01:00:00Z'));assert.equal(r.desde,'2026-12-31');assert.equal(r.results.length,3);
 const r2=w.birthdayList195({preparado:true,results:rows},new Date('2027-01-01T04:00:00Z'));assert.equal(r2.results.length,2);
});

test('pantalla muestra nombres y fechas sin pedir datos; una respuesta antigua no se interpreta como lista vacía',async()=>{
 const nodes=new Map();const node=()=>({children:[],hidden:false,textContent:'',replaceChildren(){this.children=[];this.textContent='';},appendChild(c){this.children.push(c);}});
 for(const id of ['ghBirthdayContent','ghBirthdayPrepare','ghBirthdaySummary'])nodes.set(id,node());
 const context={window:{},GH_ADMIN_ACCESS:{rol:'SUPERADMIN_PRINCIPAL'},document:{getElementById:id=>nodes.get(id),createElement:()=>node()},fetch(){throw Error('La presentación no debe consultar datos');}};
 vm.runInNewContext(await readFile(new URL('../../plataforma/gh-calendario.js',import.meta.url),'utf8'),context);
 context.window.ghCalendarDashboardV83(w.birthdayList195({preparado:true,results:people},new Date('2026-11-12T14:00:00Z')));
 assert(nodes.get('ghBirthdayContent').children.some(x=>x.textContent.includes('Ana')));assert(!nodes.get('ghBirthdayContent').children.some(x=>x.textContent.includes('Caro')));
 context.window.ghCalendarDashboardV83({preparado:false,periodo_dias:7});assert.equal(nodes.get('ghBirthdayPrepare').hidden,true);
 context.window.ghCalendarDashboardV83({preparado:true,total:2,dias:[]});assert(nodes.get('ghBirthdayContent').textContent.includes('Falta activar'));assert(!nodes.get('ghBirthdayContent').textContent.includes('No hay cumpleaños'));
});

test('cumpleaños y configuración comparten la misma edición diaria de las tres interfaces',async t=>{
 const h=fixture(t);h.rows.suscriptores=people;await h.publish();
 const packet=await h.op('read',{key:'daily:entry:195'});assert.equal(packet.results.length,4);assert(packet.admin.fixed);assert(packet.admin.territory);
 assert.equal(w.birthdayList195(packet,new Date('2026-11-12T14:00:00Z')).results.length,2);
 const scans=h.metrics.sourceLists;h.restart();await h.op('read',{key:'daily:entry:195'});assert.equal(h.metrics.sourceLists,scans);
});
test('nueva fecha se incorpora al corte siguiente conservando la anterior mientras sólo hay stage',async t=>{
 const h=fixture(t);h.rows.suscriptores=people;await h.publish();h.events.push({at:cutoff+1,entries:[{collection:'suscriptores',id:'A',patch:{fecha_nacimiento:'1990-12-01'}}]});h.now=cutoff+day+60000;
 await h.op('stage');assert.equal((await h.op('read',{key:'daily:entry:195'})).results.find(x=>x.suscriptor_id==='A').fecha_nacimiento,'1990-11-12');await h.op('commit');assert.equal((await h.op('read',{key:'daily:entry:195'})).results.find(x=>x.suscriptor_id==='A').fecha_nacimiento,'1990-12-01');
});
test('un moderador nunca recibe soporte privado, contenido adulto ni configuración global',async t=>{
 const h=fixture(t);await h.publish();const packet=await h.op('read',{key:'daily:entry:195'});packet.admin.inbox.support={success:true,results:[{secreto:'privado'}]};packet.admin.inbox.adult=[{nombre:'Adulto'}];
 const inbox=await w.dailyInboxForAuth195(packet,{ok:true,rol:'ADMIN_LOCAL',ciudades:['D'],permisos:{}});assert.deepEqual(inbox.support.results,[]);assert.deepEqual(inbox.adult,[]);
});
test('la copia inexistente o el stage fallido no se convierten en un listado vacío',async t=>{
 const h=fixture(t);await assert.rejects(h.op('read',{key:'daily:entry:195'}));await assert.rejects(h.op('initial'));assert.equal(h.metrics.sourceLists,0);
});
