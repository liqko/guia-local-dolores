import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../worker/WORKER_COMPLETO_V53.js',import.meta.url),'utf8');
const start=source.indexOf('// reconstruccion/worker/core/panel-cache-v48.js');
const end=source.indexOf('// reconstruccion/worker/app-main-v35.js',start);
const ctx={structuredClone,crypto,setTimeout};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
const values=new Map();let reads=0;
const rows={anunciantes:{id:'A',nombre:'Antes',descripcion:'Completa',img1:'foto'},anunciantes_administracion:{id:'A',funcionalidades:['MODIFICAR']}};
const env={GLD_CACHE_KV:{async get(k){return values.get(k)||null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)}}};
const db={async get(c,id){reads++;return structuredClone(rows[c]||null)},async panelAdministration(){return rows.anunciantes_administracion},async queryEqual(){reads++;return [{id:'SED',anunciante_id:'A',direccion:'Salta'}]},async patch(c,id,p){rows[c]={...rows[c],...p};return structuredClone(rows[c])},async delete(c){delete rows[c];return true}};
async function load(){const d=ctx.withPanelCacheV48(db,env).panelReadDb();return Promise.all([d.get('anunciantes','A'),d.get('anunciantes_administracion','A'),d.queryEqual('anunciantes_sedes','anunciante_id','A',500)]);}
await load();assert.equal(reads,2);await load();assert.equal(reads,2,'Otra solicitud no debe repetir lecturas');
const d=ctx.withPanelCacheV48(db,env);await d.patch('anunciantes','A',{nombre:'Después'});await d.flushLoginCache();const fresh=await load();assert.equal(reads,2);assert.equal(fresh[0].nombre,'Después');assert.equal(fresh[0].img1,'foto');assert.equal(fresh[0].descripcion,'Completa');
const del=ctx.withPanelCacheV48(db,env);await del.delete('anunciantes','A');await del.flushLoginCache();assert.equal((await load())[0],null);assert.equal(reads,2);
assert.match(source,/async function commercePanelDataV3\(\{db,advertiserId,catalogs\}\)\{\s+if\(db.panelReadDb\)db=db.panelReadDb\(\)/);
console.log('PASS: solicitudes distintas, repetición cero, cambio puntual conservado y baja sin dato obsoleto');
