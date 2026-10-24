// Local checks using the existing real public snapshot. No production calls,
// synthetic advertisers, account creation, or Cloudflare billing claims.
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {GldPublicCache119 as Original} from '../../worker/login-guia135.mjs';
import {GldPublicCache119 as Candidate} from '../../worker/login-guia136.mjs';
const require=createRequire(import.meta.url),control=require('../../plataforma/consumo-control-v136.js');
const sourcePath=process.argv[2];if(!sourcePath)throw Error('Pass the saved real public guide response.');
const published=JSON.parse(readFileSync(sourcePath));assert.equal(published.success,true);assert.equal(published.results.length,298);
const {results,success,...metadata}=published,packet={...metadata,anunciantes:results},key='guide:city:v1:'+published.ciudad_id;
const folder=mkdtempSync(join(tmpdir(),'gld-meter136-real-'));
function store(name,Type){
 const db=new DatabaseSync(join(folder,name+'.sqlite')),queries=[];
 const sql={exec(statement,...args){queries.push(statement);const p=db.prepare(statement);if(p.columns().length)return p.all(...args);p.run(...args);return [];}};
 const actor=new Type({storage:{sql}},{});actor.metrics={rows_read:NaN,rows_written:NaN,legacy_gets:0};
 db.prepare('INSERT INTO packet(slot,value,deleted) VALUES(1,?,0)').run(JSON.stringify(packet));queries.length=0;
 return {db,queries,actor};
}
const old=store('135',Original),next=store('136',Candidate);
assert.deepEqual(await next.actor.handle({op:'get',key}),await old.actor.handle({op:'get',key}));
assert.deepEqual(next.queries,old.queries,'Telemetry must not add SQL operations.');
assert.equal(next.actor.metrics.read_paths[0].source,'saved-packet');
next.queries.length=0;await next.actor.handle({op:'get',key});assert.equal(next.queries.length,0);
assert.equal(next.actor.metrics.read_paths.at(-1).source,'memory');
assert.deepEqual(next.actor.cached,packet);old.db.close();next.db.close();

const worker=readFileSync(new URL('../../worker/login-guia136.mjs',import.meta.url),'utf8');
const finish=worker.slice(worker.indexOf('function finishObservationV42('),worker.indexOf('\nfunction publicDbGuardV44('));
const measurement=worker.slice(worker.indexOf('function consumption136('),worker.indexOf('\nvar app_main_v35_default =',worker.indexOf('function consumption136(')));
const measure=vm.runInNewContext(finish+'\n'+measurement+'\nconsumption136');
// These quantities replay the observed 14:39 UTC Publicidad report. They are
// parser input from an existing measurement, not new production observations.
const captured={worker_version:'136',request_id:'local-replay-existing-report',operations:{},kv:{get_calls:7,put_calls:0,delete_calls:0,list_calls:0,failures:0},public_store:{calls:1,rows_read:8,rows_written:0,legacy_gets:0,legacy_lists:0,components:[]}};
const payload=JSON.parse(JSON.stringify(measure(captured)));
const row={ruta:'/publicidad',metodo:'GET',accion:'publicas',estado:200,version:'136',request_id:captured.request_id,consumo:payload,prueba:'local-replay'};
assert.equal(control.metrics(row).sql_reads,8);assert.equal(control.metrics(row).kv_reads,7);
const audit=control.audit([row],{id:'local-replay',kind:'guia',authenticated:true,ended_at:'2026-10-24T14:39:40Z'});
assert.equal(audit.status,'INCOMPLETO');assert.ok(audit.issues.includes('Falta /suscriptores:perfil'));assert.ok(audit.issues.includes('Falta /suscriptores:favoritos'));
assert.equal(audit.totals.sql_reads,8);assert.equal(audit.totals.kv_reads,7);
assert.equal(audit.percentages.kv_reads.value,7/10000000*100);
assert.equal(control.metrics({...row,consumo:null}),null);
const missing=control.audit([{...row,consumo:null}],{id:'local-replay',ended_at:'2026-10-24T14:39:40Z'});
assert.equal(missing.status,'INCOMPLETO');assert.equal(missing.totals.sql_reads,null);
assert.equal(control.metrics({...row,request_id:'different-trace'}),null);
const unknown=structuredClone(row);unknown.consumo.cloudflare.public_store.rows_read=null;
assert.equal(control.metrics(unknown).sql_reads,null);
const billedUnknown=structuredClone(row);billedUnknown.consumo.firestore.billed_reads=null;
assert.equal(control.metrics(billedUnknown).fs_reads,null);
assert.equal(control.audit([row],null).status,'INCOMPLETO');
const bundle=readFileSync(new URL('../../plataforma/consumo-v44.js',import.meta.url),'utf8');
assert.ok(bundle.startsWith(readFileSync(new URL('../../plataforma/consumo-control-v136.js',import.meta.url),'utf8')));
assert.match(worker,/X-GLD-Consumption/);assert.match(bundle,/X-GLD-Consumption/);
console.log(JSON.stringify({kind:'LOCAL_REAL_SNAPSHOT_AND_REPLAY_NOT_PRODUCTION_136',records:results.length,public_data_preserved:true,extra_sql_operations:0,saved_packet_and_memory_distinguished:true,missing_and_account_coverage_block_close:true,kv_and_sql_separate:true,unknown_is_not_zero:true,bundle_matches_control:true},null,2));
