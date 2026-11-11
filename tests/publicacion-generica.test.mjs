import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import bookTools from '../plataforma/paquete-ciudad.js';
import {aplicarCorte} from '../scripts/aplicar-corte-paquetes-ciudad.mjs';
const workerSource=await readFile(new URL('../worker/worker190_roles_multiples_sobre_189.txt',import.meta.url),'utf8');
const worker=await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'));
const {applyDelta,validBook,legacySchema,client}=bookTools;
const oldBook=city=>({city,revision:1,modules:Object.fromEntries(Object.entries(bookTools.lists).map(([name,[field]])=>[name,{success:true,[field]:[]}]))});
const readAt=root=>async path=>JSON.parse(await readFile(join(root,path),'utf8'));
async function stage(t){const root=await mkdtemp(join(tmpdir(),'gld-generic-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'plataforma'));await writeFile(join(root,'plataforma/territorio-cache.js'),'const paquetes=/* GLD_CITY_BOOKS */ {};');return root;}
function actors(t,raw){
 const actors=new Map();
 const env={GLD_CITY_BOOK_CAPTURE:'1',GLD_CACHE_KV:{get:async key=>raw.has(key)?JSON.stringify(raw.get(key)):null,put:async(key,value)=>raw.set(key,JSON.parse(value)),list:async({prefix})=>({keys:[...raw.keys()].filter(name=>name.startsWith(prefix)).map(name=>({name})),list_complete:true})}};
 env.GLD_PUBLIC_CACHE={idFromName:name=>name,get(name){if(!actors.has(name)){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  actors.set(name,new worker.GldPublicCache119({storage:{sql:{exec(sql,...args){const stmt=db.prepare(sql);if(stmt.columns().length){const rows=stmt.all(...args);return Object.assign(rows,{rowsRead:rows.length});}stmt.run(...args);return [];}},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}},env));
 }return {fetch:req=>actors.get(name).fetch(req)};}};
 const set=async(key,field,rows)=>{const stub=env.GLD_PUBLIC_CACHE.get('public-city-v119:'+key);const call=async body=>{const r=await stub.fetch(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({key,...body})}));const j=await r.json();assert.equal(r.status,200,j.error);return j;};const {value:base}=await call({op:'get'});await call({op:'put',base,value:{[field]:rows}});};
 return {env,set,cache:{get:async key=>raw.get(key)||null}};
}
test('un tipo nuevo viaja del registro de origen al publicador y al lector sin editar esas piezas',async t=>{
 const cutoff=Date.parse('2026-11-12T04:00:00Z');let now=cutoff-1000;t.mock.method(Date,'now',()=>now);
 const raw=new Map([['territorio:public:v1',{ciudades:[{ciudad_id:'DOL'}]}],['catalogs:publicidad:v1',{ubicaciones:[{modulo:'INMUEBLES',ubicacion_id:'nueva'}]}]]);
 const {env,set,cache}=actors(t,raw);
 worker.PUBLIC_FEATURES191.inmuebles={store:{prefix:'inmuebles:city:v1:',module:'inmuebles',field:'ofertas',id:'inmueble_id',collection:'inmuebles'},field:'ofertas',id:'inmueble_id',metadata:[],project:async({cache,city})=>({success:true,ofertas:(await cache.get('inmuebles:city:v1:'+city))?.ofertas||[]})};
 t.after(()=>delete worker.PUBLIC_FEATURES191.inmuebles);
 await set('inmuebles:city:v1:DOL','ofertas',[{inmueble_id:'casa-ensayo',titulo:'Proyección pública de ensayo'}]);
 await set('efemerides:city:v2:DOL','efemerides',[{efemeride_id:'dia-ensayo',nombre:'Calendario de ensayo',tipo_fecha:'FIJA',mes:11,dia:12}]);
 const job={empleo_id:'empleo-ensayo',tipo:'OFREZCO',nombre:'Aviso de ensayo',puesto:'Administración',tags:[],ciudad_id:'DOL',ciudad_ids:['DOL'],desde:new Date(cutoff-86400000).toISOString(),hasta:new Date(cutoff+3600000).toISOString(),estado_moderacion:'PUBLICADO',contacto:{email:'publico@example.test'},suscriptor_id:'NO_PUBLICAR',contacto_privado:{email:'NO_PUBLICAR'}};
 await set('employment:city:v1:DOL','rows',[job,{...job,empleo_id:'pendiente',estado_moderacion:'PENDIENTE'},{...job,empleo_id:'adulto',contenido_adulto:true,revision_adulto:'APROBADO',nombre:'NO_PUBLICAR_ADULTO'}]);
 now=cutoff+1000;
 const cut=await worker.exportCityBookCut({env,cache,after:cutoff-86400000,cutoff,known:['DOL'],report:{}});
 assert(cut.schema.inmuebles);assert(cut.schema.ads_inmuebles);assert(cut.schema.ephemerides);assert(cut.schema.employment);
 assert(!JSON.stringify(cut).includes('NO_PUBLICAR'));assert(!JSON.stringify(cut).includes('"empleo_id":"pendiente"'));
 assert.equal(cut.cities[0].replacements.employment.rows.length,2);
 const previous={cutoff:cut.after,manifest:{DOL:{key:Buffer.from('DOL').toString('base64url'),revision:1,deltas:[]}}};
 const root=await stage(t),book=oldBook('DOL');
 const result=await aplicarCorte({previous,source:cut,readPublished:async()=>book,stage:root});
 const base='plataforma/paquetes-ciudad/'+result.manifest.DOL.key+'/';
 const published=await readAt(root)(base+'completo-2.json'),delta=await readAt(root)(base+'cambios-1-2.json');
 assert(validBook(published,'DOL'));assert.deepEqual(applyDelta(book,delta),published);assert.equal(published.modules.inmuebles.ofertas.length,1);
 const storage=new Map([['DOL',book]]),requests=[];
 const open=()=>client({manifest:()=>result.manifest.DOL,storage:{get:c=>storage.get(c),put:b=>storage.set(b.city,b)},fetchJson:async p=>{requests.push(p);return readAt(root)(p);}});
 assert.deepEqual(await open().get('DOL'),published);assert.equal(requests.length,1);assert.match(requests[0],/cambios-1-2/);
 await open().get('DOL');assert.equal(requests.length,1);
 assert.equal((await open().module('DOL','ads','INMUEBLES')).publicidades.length,0);
 // Sin editar ni guardar un empleo, su vencimiento debe generar una baja pública.
 now=cutoff+86400000+1000;
 const next=await worker.exportCityBookCut({env,cache,after:cutoff,cutoff:cutoff+86400000,known:['DOL'],knownSchema:cut.schema,report:{}});
 assert.equal(next.cities[0].replacements.employment.rows.length,0);
});
test('el contrato rechaza claves peligrosas, metadatos no declarados y cambios incompatibles',()=>{
 const book={...oldBook('DOL'),schema:legacySchema()};
 assert.throws(()=>applyDelta(book,{city:'DOL',from:1,revision:2,changes:{ads:{upsert:[],remove:[],metadata:{privado:'reservado'}}}}),/Metadatos/);
 assert(!validBook({...book,schema:JSON.parse('{"__proto__":{"field":"rows","id":"id","metadata":[]}}')},'DOL'));
 assert.throws(()=>applyDelta(book,{city:'DOL',from:1,revision:2,schema:{...legacySchema(),events:{field:'otra',id:'id',metadata:[]}},changes:{}}),/incompatible/);
});
