import {DatabaseSync} from 'node:sqlite';
import {GldPublicCache119} from './worker-instrumentado.mjs';
export function sqliteNamespace(env,Actor=GldPublicCache119){
 const actors=new Map(),counts={calls:0,read:0,written:0};let fail=false;
 function create(){
  const database=new DatabaseSync(':memory:');let tail=Promise.resolve();
  const sql={exec(sql,...args){
   if(fail&&/^(INSERT|UPDATE)/.test(sql))throw Error('Injected public SQL failure');
   const stmt=database.prepare(sql);let rows=[],changed=0;
   if(/^SELECT/.test(sql))rows=stmt.all(...args);else changed=Number(stmt.run(...args).changes);
   counts.read+=rows.length;counts.written+=changed;
   return Object.assign(rows,{rowsRead:rows.length,rowsWritten:changed});
  }};
  const state={storage:{sql,transactionSync(fn){database.exec('BEGIN');try{const out=fn();database.exec('COMMIT');return out;}catch(e){database.exec('ROLLBACK');throw e;}}},blockConcurrencyWhile(fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}};
  return new Actor(state,env);
 }
 return {counts,set fail(value){fail=value;},idFromName:key=>key,get(key){if(!actors.has(key))actors.set(key,create());return {async fetch(request){counts.calls++;return actors.get(key).fetch(request);}};}};
}
