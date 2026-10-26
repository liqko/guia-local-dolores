import {DatabaseSync} from 'node:sqlite';
import {GldPublicCache119} from '../guia/worker-instrumentado.mjs';
export function sqliteNamespace(env,Actor=GldPublicCache119){
 const actors=new Map(),states=new Map(),counts={calls:0,read:0,written:0,sqlRead:0,sqlWritten:0,storageGets:0,storagePuts:0,alarmSets:0,alarmCancels:0};let fail=false;
 function create(){
  const database=new DatabaseSync(':memory:');let tail=Promise.resolve();
  const sql={exec(sql,...args){
   if(fail&&/^(INSERT|UPDATE)/.test(sql))throw Error('Injected public SQL failure');
   const stmt=database.prepare(sql);let rows=[],changed=0;
   if(/^SELECT/.test(sql))rows=stmt.all(...args);else {const result=stmt.run(...args);changed=/^(INSERT|UPDATE|DELETE|REPLACE)/.test(sql.trim())?Number(result.changes):0;}
   counts.read+=rows.length;counts.written+=changed;counts.sqlRead+=rows.length;counts.sqlWritten+=changed;
   return Object.assign(rows,{rowsRead:rows.length,rowsWritten:changed});
  }};
  const values=new Map();let alarm=null;
  const state={storage:{sql,async get(key){counts.storageGets++;return structuredClone(values.get(key));},async put(key,value){counts.storagePuts++;values.set(key,structuredClone(value));counts.written++;},async delete(key){const removed=values.delete(key);if(removed)counts.written++;return removed;},async setAlarm(value){counts.alarmSets++;alarm=value;},async deleteAlarm(){counts.alarmCancels++;alarm=null;},async getAlarm(){return alarm;},transactionSync(fn){database.exec('BEGIN');try{const out=fn();database.exec('COMMIT');return out;}catch(e){database.exec('ROLLBACK');throw e;}}},blockConcurrencyWhile(fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}};
  return {state,actor:new Actor(state,env)};
 }
 return {async businessJob(key){return (await states.get(key)?.storage.get('business-intent-v143'))?.pending||null},async businessReceipts(key){return (await states.get(key)?.storage.get('business-intent-v143'))?.receipts||[]},async alarmAt(key){return states.get(key)?.storage.getAlarm()},counts,set fail(value){fail=value;},idFromName:key=>key,get(key){if(!actors.has(key)){const created=create();states.set(key,created.state);actors.set(key,created.actor);}return {async fetch(request){counts.calls++;return actors.get(key).fetch(request);}};},async runAlarms(){for(const [key,state]of states)if(await state.storage.getAlarm()!==null){await state.storage.deleteAlarm();await actors.get(key).alarm();}},evict(key){if(states.has(key))actors.set(key,new Actor(states.get(key),env));},async job(key){return (await states.get(key)?.storage.get('guide-intent-v132'))?.pending||undefined;}};
}
