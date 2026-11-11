import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareCityBooks } from '../../scripts/preparar-paquete-ciudad.mjs';
import { aplicarCorte, ultimoCorte } from '../../scripts/aplicar-corte-paquetes-ciudad.mjs';
import bookTools from '../../plataforma/paquete-ciudad.js';

const source = await readFile(new URL('../../worker/worker187_corregir_parametro_jsdoc_sobre_186.txt', import.meta.url), 'utf8');
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
  const published = await mkdtemp(join(tmpdir(),'corte-publicado-'));
  t.after(() => rm(published,{recursive:true,force:true}));
  await mkdir(join(published,'plataforma'));
  await writeFile(join(published,'plataforma','territorio-cache.js'),'const paquetes = /* GLD_CITY_BOOKS */ {};');
  const oldManifest = await prepareCityBooks({initial,batches:[]},published);
  const previous = {cutoff:ultimoCorte(beforeCut),manifest:oldManifest};
  const readAt = root => async path => JSON.parse(await readFile(join(root,path)));
  const {changed,manifest,cutoff} = await aplicarCorte({
    previous,
    source:{after:previous.cutoff,cutoff:ultimoCorte(afterCut),complete:true,cities:batches},
    readPublished:readAt(published),
    stage,
  });
  assert.equal(changed,true);
  assert.equal(cutoff,Date.parse('2026-11-11T04:00:00Z'));
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

  const nextDay = ultimoCorte(afterCut + 86400000);
  const previousCut = {cutoff,manifest};
  const noFetch = async () => assert.fail('Un corte sin cambios no debe leer paquetes');
  const empty = await aplicarCorte({
    previous:previousCut,source:{after:cutoff,cutoff:nextDay,complete:true,cities:[]},
    readPublished:noFetch,stage,
  });
  assert.equal(empty.changed,false);
  assert.equal(empty.cutoff,nextDay);
  await assert.rejects(aplicarCorte({
    previous:previousCut,source:{after:cutoff,cutoff:nextDay,complete:false,cities:[]},
    readPublished:noFetch,stage,
  }),/Corte incompleto/);

  const later = await mkdtemp(join(tmpdir(),'corte-siguiente-'));
  t.after(() => rm(later,{recursive:true,force:true}));
  await mkdir(join(later,'plataforma'));
  await writeFile(join(later,'plataforma','territorio-cache.js'),'const paquetes = /* GLD_CITY_BOOKS */ {};');
  const nextSource = {after:cutoff,cutoff:nextDay,complete:true,cities:[
    {city:'BALCARCE',changes:{events:{upsert:[],remove:['compartido']}}},
  ]};
  const result = await aplicarCorte({previous:previousCut,source:nextSource,readPublished:readAt(stage),stage:later});
  assert.equal(result.manifest.DOLORES.revision,2);
  assert.equal(result.manifest.BALCARCE.revision,3);
  const prefix = join(later,'plataforma','paquetes-ciudad',result.manifest.BALCARCE.key);
  const combined = JSON.parse(await readFile(join(prefix,'cambios-1-3.json')));
  assert.deepEqual(combined.changes.events.remove,['compartido']);
  assert.equal(combined.changes.activities.upsert[0].nombre,'BALCARCE actualizado');

  const restored = await mkdtemp(join(tmpdir(),'corte-reincorporado-'));
  t.after(() => rm(restored,{recursive:true,force:true}));
  await mkdir(join(restored,'plataforma'));
  await writeFile(join(restored,'plataforma','territorio-cache.js'),'const paquetes = /* GLD_CITY_BOOKS */ {};');
  const restoreRow = {evento_id:'compartido',nombre:'Evento reincorporado'};
  const final = await aplicarCorte({
    previous:{cutoff:nextDay,manifest:result.manifest},
    source:{after:nextDay,cutoff:nextDay+86400000,complete:true,cities:[
      {city:'BALCARCE',changes:{events:{upsert:[restoreRow],remove:[]}}},
    ]},
    readPublished:readAt(later),
    stage:restored,
  });
  const folder = 'plataforma/paquetes-ciudad/' + final.manifest.BALCARCE.key + '/';
  const restoredDelta = await readAt(restored)(folder+'cambios-1-4.json');
  const restoredBook = await readAt(restored)(folder+'completo-4.json');
  const originalBook = await readAt(published)(folder+'completo-1.json');
  assert.deepEqual(restoredDelta.changes.events.remove,['compartido']);
  assert.deepEqual(bookTools.applyDelta(originalBook,restoredDelta),restoredBook);
});

test('el publicador recibe la salida real del Worker aislado, filtra y prepara Hosting', async t => {
  const { default:worker, exportCityBookCut, cityBookIdentity } = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const { publicarPaquetes } = await import('../../scripts/publicar-paquetes-ciudad.mjs');
  const { generateKeyPairSync, sign } = await import('node:crypto');
  const { publicKey, privateKey } = generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk={...publicKey.export({format:'jwk'}),kid:'test-cut',alg:'RS256'};
  const cutoff=Date.parse('2026-11-11T04:00:00Z'),after=cutoff-86400000;
  let clock=cutoff-1000;
  t.mock.method(Date,'now',()=>clock);
  const now=Math.floor(cutoff/1000);
  const claims={iss:'https://token.actions.githubusercontent.com',aud:'guialocal:publicacion-ciudades',
    repository_id:'987998657',repository_owner_id:'199677170',
    workflow_ref:'liqko/guia-local-dolores/.github/workflows/firebase-hosting-merge.yml@refs/heads/main',
    ref:'refs/heads/main',event_name:'schedule',nbf:now-60,exp:now+300};
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  function token(payload){
    const message=enc({alg:'RS256',kid:jwk.kid})+'.'+enc(payload);
    return message+'.'+sign('RSA-SHA256',Buffer.from(message),privateKey).toString('base64url');
  }
  const good=token(claims);
  const request=value=>new Request('https://worker.invalid/internal/city-books',{headers:{Authorization:'Bearer '+value}});
  assert.equal(await cityBookIdentity(request(good),async()=>Response.json({keys:[jwk]}),cutoff),true);
  assert.equal(await cityBookIdentity(request(token({...claims,ref:'refs/heads/otro'})),async()=>assert.fail('No debe pedir llaves'),cutoff),false);
  assert.equal(await cityBookIdentity(request(good+'x'),async()=>assert.fail('No debe pedir llaves'),cutoff),false);

  const raw = new Map([['territorio:public:v1',{ciudades:[{ciudad_id:'DOL'},{ciudad_id:'BAL'}]}]]);
  const actors = new Map(),calls=[];
  const env={GLD_CITY_BOOK_CAPTURE:'1',GLD_CACHE_KV:{get:async key=>raw.has(key)?JSON.stringify(raw.get(key)):null,put:async(key,value)=>raw.set(key,JSON.parse(value))}};
  env.GLD_PUBLIC_CACHE={idFromName:name=>name,get(name){
    if(!actors.has(name)){
      const db=new DatabaseSync(':memory:');
      t.after(()=>db.close());
      actors.set(name,new GldPublicCache119({storage:{sql:{exec(sql,...args){
        const statement=db.prepare(sql);
        if(statement.columns().length){
          const rows=statement.all(...args);
          return Object.assign(rows,{rowsRead:rows.length});
        }
        statement.run(...args);return [];
      }},transactionSync(fn){
        db.exec('BEGIN');try{const x=fn();db.exec('COMMIT');return x;}
        catch(error){db.exec('ROLLBACK');throw error;}
      }}},env));
    }
    return {async fetch(req){calls.push(await req.clone().json());return actors.get(name).fetch(req);}};
  }};
  async function set(key,field,rows){
    const actor=env.GLD_PUBLIC_CACHE.get('public-city-v119:'+key);
    const send=body=>actor.fetch(new Request('https://public-cache.internal/',{method:'POST',body:JSON.stringify({key,...body})}));
    const {value:base}=await (await send({op:'get'})).json();
    const r=await send({op:'put',base,value:{[field]:rows}});
    assert.equal(r.status,200,await r.text());
  }
  const publicRow={anunciante_id:'publico',nombre:'Visible',redes_web_comunes:{habilitado:true,instagram:'perfil'},sedes:[{sede_id:'sede'}]};
  const adult={anunciante_id:'adulto',nombre:'Texto reservado',contenido_adulto:true,revision_adulto:'APROBADO'};
  await set('guide:city:v1:DOL','anunciantes',[publicRow,adult]);
  await set('events:city:v2:VIRTUAL','events',[{evento_id:'virtual',nombre_evento:'Virtual',ciudad_id:'VIRTUAL',alcance_publicacion:{modo:'CIUDAD',ciudad_id:'BAL'}}]);
  await set('activities:city:v2:DOL','actividades',[{actividad_id:'vence',nombre:'Actividad temporal',activo:true,aprobado:true,vigente_hasta:'2026-11-11'}]);
  await set('promos:city:v1:BAL','promos',[{promo_id:'promo',promo:'Descuento',estado_moderacion:'PENDIENTE'}]);
  clock=cutoff+30000;
  await set('guide:city:v1:DOL','anunciantes',[{...publicRow,nombre:'Después del corte'},adult]);
  calls.length=0;
  const cache={get:async key=>raw.get(key)??null};
  const report={};
  const cut=await exportCityBookCut({env,cache,after,cutoff,known:['DOL','BAL'],report});
  assert.equal(cut.complete,true);
  assert.ok(cut.cities.find(x=>x.city==='DOL').changes.guide.upsert.some(x=>x.nombre==='Visible'));
  assert.equal(JSON.stringify(cut).includes('Texto reservado'),false);
  assert.equal(JSON.stringify(cut).includes('Después del corte'),false);
  assert.deepEqual(cut.cities.find(x=>x.city==='DOL').changes.events.upsert,[]);
  assert.equal(cut.cities.find(x=>x.city==='BAL').changes.events.upsert[0].evento_id,'virtual');
  assert.deepEqual(cut.cities.find(x=>x.city==='BAL').changes.promos.upsert,[]);
  assert.equal(cut.cities.find(x=>x.city==='DOL').changes.activities.upsert[0].actividad_id,'vence');
  assert.equal(calls.filter(x=>x.key==='events:city:v2:VIRTUAL'&&x.op==='city-book-changes').length,1);
  assert.ok(calls.some(x=>x.key==='guide:city:v1:DOL'&&x.op==='city-book-read'&&x.ids.length===2));

  const stage=await mkdtemp(join(tmpdir(),'corte-hosting-'));
  t.after(()=>rm(stage,{recursive:true,force:true}));
  await mkdir(join(stage,'plataforma'));
  await writeFile(join(stage,'plataforma','territorio-cache.js'),'const paquetes = /* GLD_CITY_BOOKS */ {};');
  const count={worker:0};
  const staged=await publicarPaquetes({mode:'cut',stage,cutoff,identity:async()=>good,read:async (input,options)=>{
    const url=new URL(input);
    if(url.hostname.endsWith('workers.dev')){
      count.worker++;
      assert.equal(JSON.parse(options.body).op,'read');
      return worker.fetch(new Request(url,options),env);
    }
    assert.match(url.pathname,/publicacion\.json$/);
    return new Response(null,{status:404});
  }});
  assert.equal(count.worker,1);
  assert.equal(staged.changed,true);
  assert.deepEqual(Object.keys(staged.manifest),['DOL','BAL']);
  const path=join(stage,'plataforma','paquetes-ciudad',staged.manifest.DOL.key,'completo-'+staged.manifest.DOL.revision+'.json');
  assert.equal(JSON.parse(await readFile(path)).modules.guide.results.find(x=>x.anunciante_id==='publico').nombre,'Visible');
  const callWorker=body=>worker.fetch(new Request('https://login.liqkoargentina.workers.dev/internal/city-books',{
    method:'POST',headers:{Authorization:'Bearer '+good,'Content-Type':'application/json'},body:JSON.stringify(body),
  }),env);
  assert.equal((await callWorker({op:'commit',cutoff})).status,200);
  const retry=await callWorker({op:'read',cutoff,publishedCutoff:cutoff,known:['DOL','BAL']});
  assert.equal(retry.status,200);
  assert.deepEqual((await retry.json()).cities,[]);

  clock=cutoff+86400000+1000;
  const expiry=await exportCityBookCut({env,cache,after:cutoff,cutoff:cutoff+86400000,known:['DOL','BAL'],report:{}});
  assert.deepEqual(expiry.cities.find(x=>x.city==='DOL').replacements.activities.actividades,[]);

});

test('reanudar promociones usa la configuración tanto en panel como en Gran Hermano', async () => {
  const { createHmac } = await import('node:crypto');
  const testSource = source + '\nexport {promoUpdateV2,routeAdminPromosV91};';
  const {promoUpdateV2,routeAdminPromosV91} = await import('data:text/javascript;base64,' + Buffer.from(testSource).toString('base64'));
  const initial={promo_id:'promo-test',anunciante_id:'anunciante-test',promo:'Promoción',ciudad_id:'DOL',pausado:true};
  const admin={funcionalidades_config:{PROMOS:{cantidad:1}}};
  let promo=initial,patches=0;
  const db={
    get:async collection=>collection==='promos'?promo:admin,
    queryEqual:async()=>[promo],
    patch:async (collection,id,patch)=>{assert.equal(collection,'promos');assert.equal(id,initial.promo_id);patches++;return promo={...promo,...patch};},
  };
  const cache={get:async()=>null,put:async()=>{}};
  const fromPanel=await promoUpdateV2({db,cache,advertiserId:initial.anunciante_id,
    body:{promo_id:initial.promo_id,pausado:false},cupoFromAdmin:()=>1});
  assert.equal(fromPanel.promo.pausado,false);
  promo=initial;
  const secret='fixture-de-prueba-de-promociones';
  const body=Buffer.from(JSON.stringify({sid:'admin-test',rol:'SUPERADMIN_PRINCIPAL',persistent:true})).toString('base64url');
  const sig=createHmac('sha256',secret).update(body).digest('base64url');
  const url=new URL('https://example.invalid/superadmin/promos');
  const request=new Request(url,{method:'POST',headers:{Authorization:'Bearer '+body+'.'+sig},
    body:JSON.stringify({promo_id:initial.promo_id,action:'reanudar'})});
  const env={SERVER_SECRET:secret,GLD_CACHE_KV:{get:async()=>null,put:async()=>{}}};
  const fromAdmin=await routeAdminPromosV91({path:url.pathname,request,env,db,cache,url});
  assert.equal(fromAdmin.status,200);
  assert.equal((await fromAdmin.json()).promo.pausado,false);
  assert.equal(patches,2);
});
