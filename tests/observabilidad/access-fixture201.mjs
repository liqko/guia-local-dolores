import {DatabaseSync} from 'node:sqlite';
// Uses the actual DO dispatcher and SQLite, one database per account.
export function accessBinding201(worker,env,previous,t){
 const actors=new Map(),databases=new Map();
 t.after(()=>{for(const db of databases.values())db.close();});
 return {idFromName:name=>name,get(name){
  if(!name.startsWith('private-access-v201:'))return previous.get(name);
  if(!actors.has(name)){
   const db=databases.get(name)||new DatabaseSync(':memory:');databases.set(name,db);
   const state={storage:{sql:{exec(sql,...args){const p=db.prepare(sql);if(p.columns().length){const rows=p.all(...args);return Object.assign(rows,{rowsRead:rows.length,rowsWritten:0});}const r=p.run(...args);return Object.assign([],{rowsRead:0,rowsWritten:r.changes});}},transactionSync(fn){db.exec('BEGIN');try{const out=fn();db.exec('COMMIT');return out;}catch(error){db.exec('ROLLBACK');throw error;}}}};
   actors.set(name,new worker.GldPublicCache119(state,env));
  }
  return {fetch:req=>actors.get(name).fetch(req)};
 },restart(){actors.clear();}};
}
