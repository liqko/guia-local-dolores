import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {w,fixture,cutoff,day} from './fixture206.mjs';
import {publicationCutoff} from '../../scripts/publicar-paquetes-ciudad.mjs';

test('arranque interrumpido retoma colecciones completas tras reiniciar sin publicarlas',async t=>{
 const f=fixture(t);let fail=true;
 Object.defineProperty(f.rows,'categorias',{configurable:true,get(){if(fail)throw Error('fuente interrumpida');return [];}});
 await assert.rejects(f.op('stage'));await assert.rejects(f.op('read',{key:'master/A'}));
 const before=f.metrics.sourceLists;assert(before>1);
 fail=false;f.restart();await f.op('stage');
 assert.equal(f.metrics.sourceLists,w.EDITION_COLLECTIONS206.size+1,'sólo se repite la colección fallida');
 await assert.rejects(f.op('read',{key:'master/A'}));await f.op('commit');
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
 assert.equal(f.sql.prepare("SELECT count(*) n FROM edition_records206 WHERE key LIKE 'bootstrap/%'").get().n,0,'checkpoint temporal retirado al confirmar');
});

function interruptedBuild(t){
 const f=fixture(t),original=w.DailyEdition206.prototype.put;let fail=true;
 t.mock.method(w.DailyEdition206.prototype,'put',function(key,...args){if(fail&&key==='daily:entry:195')throw Error('compilación interrumpida');return original.call(this,key,...args);});
 return {f,repair(){fail=false;}};
}

test('captura inicial completa sobrevive al fallo de compilación y a una demora de horas',async t=>{
 const {f,repair}=interruptedBuild(t);await assert.rejects(f.op('stage'));const scans=f.metrics.sourceLists;
 f.now=cutoff+6*3600000;f.restart();repair();await f.op('stage');
 assert.equal(f.metrics.sourceLists,scans,'sin recuperar una instantánea Firestore vencida');
 await f.op('commit');assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Original');
});

test('primer corte fallido se recupera al día siguiente desde captura completa más outbox',async t=>{
 const {f,repair}=interruptedBuild(t);await assert.rejects(f.op('stage'));const scans=f.metrics.sourceLists;
 f.events.push({at:cutoff+1000,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Primera'}}]},
  {at:cutoff+2000,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Última'}}]},
  {at:cutoff+day+1,entries:[{collection:'anunciantes',id:'A',patch:{nombre:'Mañana'}}]});
 f.now=cutoff+day+60000;f.restart();repair();await f.op('stage');
 assert.equal(f.metrics.sourceLists,scans);assert.equal(f.metrics.sourceOutbox,1);
 await assert.rejects(f.op('read',{key:'master/A'}));await f.op('commit');
 assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Última');
 f.now=cutoff+2*day+60000;await f.publish();assert.equal((await f.op('read',{key:'master/A'})).datos.nombre,'Mañana');
});

test('captura incompleta de otro día nunca mezcla instantáneas de cortes diferentes',async t=>{
 const f=fixture(t);let fail=true;
 Object.defineProperty(f.rows,'categorias',{get(){if(fail)throw Error('corte incompleto');return [];}});
 await assert.rejects(f.op('stage'));f.rows.paises[0].nombre='Nombre del corte siguiente';
 f.now=cutoff+day+60000;fail=false;f.restart();await f.publish();
 assert.equal((await f.op('read',{key:'source/paises/AR'})).nombre,'Nombre del corte siguiente');
 assert.equal(f.metrics.sourceOutbox,0,'se requiere captura completa antes de usar outbox');
});

test('los tres pasos del publicador mantienen el corte aunque el reloj cambie de día',t=>{
 let now=cutoff+1000;t.mock.method(Date,'now',()=>now);
 const pinned=publicationCutoff();now=cutoff+day+1000;
 assert.equal(publicationCutoff(String(pinned)),cutoff);
 assert.equal(publicationCutoff(''),cutoff+day);
 for(const invalid of ['NaN','1',String(cutoff+3*day)])assert.throws(()=>publicationCutoff(invalid));
});

test('el trabajo diario existente fija el corte y conserva su único horario e identidad',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/firebase-hosting-merge.yml',import.meta.url),'utf8');
 assert.equal((workflow.match(/cron:/g)||[]).length,1);assert(workflow.includes('cron: "0 4 * * *"'));
 assert(workflow.includes("'GLD_PUBLICATION_CUTOFF='+ultimoCorte()"));
 assert(workflow.indexOf('GLD_PUBLICATION_CUTOFF')<workflow.indexOf('Preparar el catálogo público'));
 assert(workflow.includes('node scripts/publicar-paquetes-ciudad.mjs commit'));
});
