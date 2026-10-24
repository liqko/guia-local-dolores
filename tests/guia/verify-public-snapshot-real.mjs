// Local compatibility check using published records and SQLite on disk.
// This does not measure Cloudflare billed rows, CPU, or production traffic.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { GldPublicCache119 as Original } from '../../worker/login-guia133.mjs';
import { GldPublicCache119 as Candidate } from '../../worker/login-guia135.mjs';

const sourcePath=process.argv[2];
if(!sourcePath)throw Error('Pass a JSON response read from the real public /guide?compact=1 endpoint.');
const sourceBytes=readFileSync(sourcePath),published=JSON.parse(sourceBytes);
assert.equal(published.success,true);
assert.ok(Array.isArray(published.results)&&published.results.length>0);
assert.ok(published.ciudad_id);
const {results,success,...metadata}=published;
const packet={...metadata,anunciantes:results};
const key='guide:city:v1:'+published.ciudad_id;
const folder=mkdtempSync(join(tmpdir(),'gld-real-snapshot-'));

function openStore(path){
 const db=new DatabaseSync(path),trace=[];
 const sql={exec(statement,...args){
  trace.push(statement);
  const prepared=db.prepare(statement);
  if(prepared.columns().length)return prepared.all(...args);
  prepared.run(...args);return [];
 }};
 const state={storage:{sql,transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const value=fn();db.exec('COMMIT');return value;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }}};
 function actor(Type){
  const instance=new Type(state,{});
  // SQLite here has no Cloudflare rowsRead/rowsWritten counters. NaN prevents
  // these unmeasured values from being mistaken for zero provider consumption.
  instance.metrics={rows_read:NaN,rows_written:NaN,legacy_gets:0};
  return instance;
 }
 function measure(){return {
  packet_selects:trace.filter(s=>/^SELECT .* FROM packet\b/.test(s)).length,
  entity_list_selects:trace.filter(s=>/^SELECT value FROM entities\b/.test(s)).length,
  writes:trace.filter(s=>/^(INSERT|UPDATE|DELETE)\b/.test(s)).length
 };}
 return {db,trace,actor,measure};
}
function seed(Type,name){
 const path=join(folder,name+'.sqlite'),store=openStore(path),instance=store.actor(Type);
 store.db.prepare('INSERT INTO packet(slot,value,deleted) VALUES(1,?,0)').run(JSON.stringify(metadata));
 const insert=store.db.prepare('INSERT INTO entities(id,value,stamp,position) VALUES(?,?,?,?)');
 store.db.exec('BEGIN');
 for(const [position,row]of results.entries())insert.run(String(row.anunciante_id||row.id),JSON.stringify(row),'',position);
 store.db.exec('COMMIT');store.trace.length=0;
 return {path,store,instance};
}
const base=seed(Original,'original');
const expected=(await base.instance.handle({op:'get',key})).value;
const originalRead=base.store.measure();
base.store.trace.length=0;
await base.instance.handle({op:'put',key,base:expected,value:expected});
const originalUpdate=base.store.measure();
base.store.db.close();

const candidate=seed(Candidate,'candidate');
assert.equal(candidate.instance.guideSnapshot135(packet,1),null,'Real payload over the specified byte budget must not be stored as a single row.');
const promoted=(await candidate.instance.handle({op:'get',key})).value;
assert.deepEqual(promoted,expected,'The one-time conversion must preserve every public field and its ordering.');
const conversion=candidate.store.measure();
assert.equal(conversion.writes,1,'Exactly one initial packet conversion, not a write for each visitor.');
candidate.store.db.close();

// Reopen the actual on-disk database with a fresh actor: no memory cache survives.
const restarted=openStore(candidate.path),fresh=restarted.actor(Candidate);
restarted.trace.length=0;
assert.deepEqual((await fresh.handle({op:'get',key})).value,expected);
const persistentRead=restarted.measure();
assert.equal(persistentRead.packet_selects,1);
assert.equal(persistentRead.entity_list_selects,0);
assert.equal(persistentRead.writes,0);

restarted.trace.length=0;
await fresh.handle({op:'put',key,base:expected,value:expected});
const candidateUpdate=restarted.measure();
assert.equal(candidateUpdate.writes,originalUpdate.writes,'An existing update must not gain another write.');
assert.deepEqual(JSON.parse(restarted.db.prepare('SELECT value FROM packet WHERE slot=1').get().value),expected);
assert.equal(restarted.db.prepare('SELECT COUNT(*) AS n FROM entities').get().n,results.length);
restarted.db.close();

const finalStore=openStore(candidate.path),finalActor=finalStore.actor(Candidate);
finalStore.trace.length=0;
assert.deepEqual((await finalActor.handle({op:'get',key})).value,expected);
const afterUpdateRestart=finalStore.measure();
assert.equal(afterUpdateRestart.entity_list_selects,0);
assert.equal(afterUpdateRestart.writes,0);
// The previous runtime must still read the packet correctly after a rollback.
assert.deepEqual((await finalStore.actor(Original).handle({op:'get',key})).value,expected);
finalStore.db.close();

// Compare the unchanged merge algorithm using omissions of two existing public
// records in isolated SQLite copies. No invented advertiser or field is used.
assert.ok(expected.anunciantes.length>=2);
const ids=expected.anunciantes.slice(0,2).map(r=>String(r.anunciante_id||r.id));
const updates=ids.map(id=>({...expected,anunciantes:expected.anunciantes.filter(r=>String(r.anunciante_id||r.id)!==id)}));
async function compareIndependentUpdates(Type,name){
 const run=seed(Type,name);
 await run.instance.handle({op:'put',key,base:expected,value:updates[0]});
 await run.instance.handle({op:'put',key,base:expected,value:updates[1]});
 const combined=(await run.instance.handle({op:'get',key})).value;
 assert.equal(combined.anunciantes.length,expected.anunciantes.length-2);
 await run.instance.handle({op:'put',key,base:combined,value:expected});
 run.store.db.close();
 const reopened=openStore(run.path);
 assert.deepEqual((await reopened.actor(Type).handle({op:'get',key})).value,expected);
 reopened.db.close();return combined;
}
assert.deepEqual(await compareIndependentUpdates(Candidate,'merge-candidate'),await compareIndependentUpdates(Original,'merge-original'));

// A real read-only SQLite database rejects the optional conversion write.
// Existing public data must remain readable in that case.
const readOnly=seed(Candidate,'read-only');
readOnly.store.db.exec('PRAGMA query_only=ON');
assert.deepEqual((await readOnly.instance.handle({op:'get',key})).value,expected);
readOnly.store.db.close();

console.log(JSON.stringify({
 kind:'LOCAL_SQLITE_WITH_REAL_PUBLISHED_RECORDS_NOT_CLOUDFLARE_BILLING',
 source_sha256:createHash('sha256').update(sourceBytes).digest('hex'),
 ciudad_id:published.ciudad_id,source_updated_at:published.updated_at,records:results.length,
 exact_public_data_preserved:true,previous_runtime_can_read_new_format:true,
 snapshot_size_budget_enforced:true,conversion_write_failure_preserves_read:true,
 independent_public_updates_preserved:true,original_read:originalRead,one_time_conversion:conversion,
 read_after_database_reopen:persistentRead,original_existing_update:originalUpdate,
 candidate_existing_update:candidateUpdate,read_after_update_and_reopen:afterUpdateRestart,
 sqlite_files:folder
},null,2));
