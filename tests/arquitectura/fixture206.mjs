import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {source} from '../observabilidad/worker-source.mjs';
export const w=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
export const cutoff=Date.parse('2026-11-13T04:00:00Z'),day=86400000;
export function fixture(t){
 let now=cutoff+60000;t.mock.method(Date,'now',()=>now);
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 const metrics={calls:0,sourceLists:0,sourceOutbox:0};
 const state={storage:{sql:{exec(query,...args){const s=sql.prepare(query);if(s.columns().length){const rows=s.all(...args);return Object.assign(rows,{rowsRead:rows.length,rowsWritten:0});}const r=s.run(...args);return Object.assign([],{rowsRead:0,rowsWritten:Number(r.changes)});}},transactionSync(fn){sql.exec('BEGIN');try{const v=fn();sql.exec('COMMIT');return v;}catch(e){sql.exec('ROLLBACK');throw e;}}}};
 const rows={anunciantes:[{id:'A',nombre:'Original',campo_futuro:{x:1}}],anunciantes_administracion:[{id:'A',funcionalidades:'EVENTOS,PROMOS,ACTIVIDADES'}],anunciantes_sedes:[{id:'S',sede_id:'S',anunciante_id:'A',ciudad_id:'D'}],paises:[{id:'AR',pais_id:'AR',nombre:'Argentina'}],provincias:[{id:'BA',provincia_id:'BA',pais_id:'AR',nombre:'Buenos Aires'}],ciudades:[{id:'D',ciudad_id:'D',provincia_id:'BA',pais_id:'AR',nombre:'Dolores',activa:true}]};
 const events=[];
 class Actor extends w.DailyEdition206 {source(){return {listCollection:async c=>{metrics.sourceLists++;return structuredClone(rows[c]||[]);},editionOutbox206:async(after,cut)=>{metrics.sourceOutbox++;return structuredClone(events.filter(e=>e.at>after&&e.at<=cut));}};}}
 let actor=new Actor(state,{});
 const env={GLD_CACHE_KV:{get(){throw Error('Lectura KV de trabajo');},put(){throw Error('Escritura KV de trabajo');},list(){throw Error('Listado KV de trabajo');}},GLD_PUBLIC_CACHE:{idFromName:x=>x,get(){return {fetch:async request=>{metrics.calls++;return actor.fetch(await request.json());}};}}};
 const op=async(action,extra={})=>{const r=await actor.fetch({action,cutoff:Math.floor((now-4*3600000)/day)*day+4*3600000,...extra});const result=await r.json();assert.equal(r.status,200,result.error);return result.value;};
 return {env,rows,events,op,metrics,sql,set now(v){now=v;},restart(){actor=new Actor(state,{});},async publish(){await op('stage');await op('commit');}};
}
