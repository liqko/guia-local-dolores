import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareCityBooks } from '../../scripts/preparar-paquete-ciudad.mjs';
import bookTools from '../../plataforma/paquete-ciudad.js';

const source = await readFile(new URL('../../worker/worker169_paquete_gran_hermano.txt', import.meta.url), 'utf8');
const { GldPublicCache119 } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { lists } = bookTools;
const key = 'guide:city:v1:DOLORES';

test('el corte de las 01:00 conserva el último cambio de cada ficha, incluidas las bajas', async t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  t.mock.method(Date, 'now', () => clock);
  let clock = Date.parse('2026-11-10T03:59:59Z');
  const sql = { exec(statement, ...args) {
    const prepared = db.prepare(statement);
    if (prepared.columns().length) {
      const rows = prepared.all(...args);
      return Object.assign(rows, {rowsRead: rows.length});
    }
    prepared.run(...args);
    return [];
  } };
  const state = { storage: { sql, transactionSync(fn) {
    db.exec('BEGIN');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } } };
  const initialRows = Array.from({length: 6980}, (_, i) => ({id:'existente-' + i,nombre:'Ficha ' + i}));
  const env = { GLD_CITY_BOOK_CAPTURE: '1', GLD_CACHE_KV: {get: async () => JSON.stringify({anunciantes:initialRows})} };
  let actor = new GldPublicCache119(state,env);
  async function request(op, fields = {}) {
    const response = await actor.fetch(new Request('https://public-cache.internal', {
      method:'POST', body:JSON.stringify({key,op,...fields}),
    }));
    const data = await response.json();
    assert.equal(response.status,200,data.error);
    return data;
  }
  const start = Math.floor((Date.parse('2026-11-10T04:00:00Z') - 4 * 3600000) / 86400000);
  const end = start + 1;
  const rows = new Map(initialRows.map(row => [row.id,row]));
  async function put() {
    const {value:base} = await request('get');
    return request('put',{base,value:{anunciantes:[...rows.values()]}});
  }
  await put();
  clock = Date.parse('2026-11-10T15:00:00Z');
  for(let i=0;i<20;i++) rows.set('nuevo-' + i,{id:'nuevo-' + i,nombre:'Alta ' + i});
  rows.delete('existente-1');
  await put();
  rows.set('existente-2',{id:'existente-2',nombre:'Edición antes del corte'});
  await put();

  clock = Date.parse('2026-11-11T04:01:00Z');
  rows.set('existente-2',{id:'existente-2',nombre:'Edición después del corte'});
  await put();
  actor = new GldPublicCache119(state,env);
  const observed = await request('city-book-changes',{from:start,to:end});
  assert.equal(observed.changes.length,22);
  assert.equal(observed.changes.find(c=>c.id==='existente-1').value,null);
  assert.equal(observed.changes.find(c=>c.id==='existente-2').value.nombre,'Edición antes del corte');
  assert.equal(observed.metrics.legacy_gets,0);
  const plan = db.prepare('EXPLAIN QUERY PLAN SELECT id,book_history FROM entities WHERE book_day>=? ORDER BY book_day,id').all(start);
  assert.match(plan[0].detail,/SEARCH .*entities_book_day/);
  assert.deepEqual((await request('city-book-changes',{from:start-1,to:start})).changes,[]);
  assert.deepEqual((await request('city-book-changes',{from:start,to:end})).changes,observed.changes);

  const stage = await mkdtemp(join(tmpdir(),'corte-guia-'));
  t.after(() => rm(stage,{recursive:true,force:true}));
  await mkdir(join(stage,'plataforma'));
  await writeFile(join(stage,'plataforma','territorio-cache.js'),'const paquetes = /* GLD_CITY_BOOKS */ {};');
  const modules = Object.fromEntries(Object.entries(lists).map(([name,[field]])=>[name,{success:true,[field]:[]}]));
  modules.guide.results = initialRows;
  const initial = [{city:'DOLORES',revision:1,modules}];
  const changes = {guide:{upsert:observed.changes.filter(c=>c.value).map(c=>c.value),
    remove:observed.changes.filter(c=>c.value===null).map(c=>c.id)}};
  const batches = [{city:'DOLORES',from:1,revision:2,changes}];
  const manifest = await prepareCityBooks({initial,batches},stage);
  const delta = JSON.parse(await readFile(join(stage,'plataforma','paquetes-ciudad',manifest.DOLORES.key,'cambios-1-2.json')));
  assert.equal(delta.changes.guide.upsert.length,21);
  assert.deepEqual(delta.changes.guide.remove,['existente-1']);
});

test('un solo lote por ciudad combina las seis familias y conserva la separación territorial', async t => {
  const sources = {
    guide:['guide:city:v1:','anunciantes'],
    events:['events:city:v2:','events'],
    promos:['promos:city:v1:','promos'],
    activities:['activities:city:v2:','actividades'],
    ads:['publicity:city:v2:','publicidades'],
    pharmacy:['farmacias:city:v2:','ciclos'],
  };
  const stage = await mkdtemp(join(tmpdir(),'corte-ciudades-'));
  t.after(() => rm(stage,{recursive:true,force:true}));
  await mkdir(join(stage,'plataforma'));
  await writeFile(join(stage,'plataforma','territorio-cache.js'),'const paquetes = /* GLD_CITY_BOOKS */ {};');
  const beforeCut = Date.parse('2026-11-11T03:59:59Z');
  const afterCut = beforeCut + 2000;
  const from = Math.floor((beforeCut - 4 * 3600000) / 86400000);
  const to = from + 1;
  let clock = beforeCut;
  t.mock.method(Date,'now',()=>clock);
  const initial = [];
  const batches = [];

  for(const city of ['DOLORES','BALCARCE']){
    const modules = {};
    const changes = {};
    for(const [module,[prefix,field]] of Object.entries(sources)){
      const [publicField,idField]=lists[module];
      const oldRow = {[idField]:'compartido',nombre:city + ' original'};
      const newRow = {[idField]:'compartido',nombre:city + ' actualizado'};
      modules[module] = {success:true,[publicField]:[oldRow]};
      const db = new DatabaseSync(':memory:');
      t.after(()=>db.close());
      const state = {storage:{sql:{exec(statement,...args){
        const prepared=db.prepare(statement);
        return prepared.columns().length?prepared.all(...args):(prepared.run(...args),[]);
      }},transactionSync(fn){
        db.exec('BEGIN');
        try{const value=fn();db.exec('COMMIT');return value;}
        catch(error){db.exec('ROLLBACK');throw error;}
      }}};
      const key=prefix+city;
      const env={GLD_CITY_BOOK_CAPTURE:'1',GLD_CACHE_KV:{get:async()=>JSON.stringify({[field]:[oldRow]})}};
      const actor=new GldPublicCache119(state,env);
      const call=async(op,fields)=>{
        const response=await actor.fetch(new Request('https://public-cache.internal',{method:'POST',body:JSON.stringify({key,op,...fields})}));
        const data=await response.json();
        assert.equal(response.status,200,data.error);
        return data;
      };
      clock=beforeCut;
      if(city==='DOLORES'||['events','activities'].includes(module)){
        await call('put',{base:{[field]:[oldRow]},value:{[field]:[newRow]}});
      }
      clock=afterCut;
      const source=await call('city-book-changes',{from,to});
      if(source.changes.length)changes[module]={upsert:source.changes.map(row=>row.value),remove:[]};
    }
    initial.push({city,revision:1,modules});
    batches.push({city,from:1,revision:2,changes});
  }
  const manifest=await prepareCityBooks({initial,batches},stage);
  for(const [city,expected] of [
    ['DOLORES',Object.keys(sources)],
    ['BALCARCE',['events','activities']],
  ]){
    const dir=join(stage,'plataforma','paquetes-ciudad',manifest[city].key);
    const delta=JSON.parse(await readFile(join(dir,'cambios-1-2.json')));
    const full=JSON.parse(await readFile(join(dir,'completo-2.json')));
    assert.deepEqual(Object.keys(delta.changes),expected);
    assert.equal(Object.keys(full.modules).length,6);
    assert.ok(Object.values(delta.changes).every(change=>change.upsert[0].nombre===city+' actualizado'));
  }
});
