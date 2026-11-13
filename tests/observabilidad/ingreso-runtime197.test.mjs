// Runtime integration, original canonical Worker unchanged in memory.
// npm install --prefix /tmp/gld-worker-runtime --no-save --package-lock=false miniflare@4.20260730.0
// GLD_MINIFLARE=/tmp/gld-worker-runtime/node_modules/miniflare/dist/src/index.js node --test tests/observabilidad/ingreso-runtime197.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign,createHmac} from 'node:crypto';
import {publicarPaquetes} from '../../scripts/publicar-paquetes-ciudad.mjs';
const {Miniflare,Log,LogLevel}=await import(process.env.GLD_MINIFLARE||'miniflare');
import {source as script} from './worker-source.mjs';
const cutoff=Math.floor((Date.now()-4*3600000)/86400000)*86400000+4*3600000;
const fixture={suscriptores:[{id:'P',suscriptor_id:'P',nombre:'Cuenta local de integración',mail:'principal@example.invalid',clave:'solo-fixture',activo:true,fecha_nacimiento:'1990-11-12'}],superadmins:[{id:'P',suscriptor_id:'P',rol:'SUPERADMIN_PRINCIPAL',activo:true}],categorias:[{id:'CAT',categoria_id:'CAT',nombre:'Categoría de prueba',activo:true}]};
const fsValue=v=>typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:String(v)};
const fsDoc=(c,r)=>({name:'projects/local-fixture/databases/(default)/documents/'+c+'/'+r.id,fields:Object.fromEntries(Object.entries(r).filter(([k])=>k!=='id').map(([k,v])=>[k,fsValue(v)])),updateTime:'2026-11-01T00:00:00Z'});
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'local-only',alg:'RS256',use:'sig'};
function oidc(){const now=Math.floor(Date.now()/1000),head=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url'),claims={iss:'https://token.actions.githubusercontent.com',aud:'guialocal:publicacion-ciudades',repository_id:'987998657',repository_owner_id:'199677170',workflow_ref:'liqko/guia-local-dolores/.github/workflows/firebase-hosting-merge.yml@refs/heads/main',ref:'refs/heads/main',event_name:'workflow_dispatch',nbf:now-5,exp:now+300},body=Buffer.from(JSON.stringify(claims)).toString('base64url'),raw=head+'.'+body;return raw+'.'+sign('RSA-SHA256',Buffer.from(raw),privateKey).toString('base64url');}
const meters=r=>JSON.parse(decodeURIComponent(r.headers.get('X-GLD-Consumption')));

test('workerd + SQLite/KV persistentes: identidad de publicador, arranque frío, stage/commit, login completo, fallo y reinicio',async t=>{
 const root=await mkdtemp(join(tmpdir(),'gld-runtime197-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const requests=[];let denySource=false,failSource=false,mf;
 const options={script,modules:true,compatibilityDate:'2026-07-01',log:new Log(LogLevel.NONE),kvNamespaces:['GLD_CACHE_KV'],kvPersist:join(root,'kv'),durableObjects:{GLD_PUBLIC_CACHE:{className:'GldPublicCache119',useSQLite:true}},durableObjectsPersist:join(root,'do'),bindings:{SERVER_SECRET:'local-integration-secret',GLD_CITY_BOOK_CAPTURE:'1',FIREBASE_PROJECT_ID:'local-fixture',FIREBASE_CLIENT_EMAIL:'fixture@local-fixture.iam.gserviceaccount.com',FIREBASE_PRIVATE_KEY:privateKey.export({format:'pem',type:'pkcs8'})},outboundService:async req=>{
  const u=new URL(req.url);requests.push(u.hostname+u.pathname);
  if(u.hostname==='token.actions.githubusercontent.com'&&u.pathname==='/.well-known/jwks')return Response.json({keys:[jwk]});
  if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'local-google-fixture',expires_in:3600});
  assert.equal(u.hostname,'firestore.googleapis.com','Unexpected egress is blocked');assert.equal(denySource,false,'A published entry cannot read Firestore');if(failSource)return Response.json({error:{message:'fixture unavailable'}},{status:503});
  const c=u.pathname.split('/documents/')[1];
  if(u.pathname.endsWith(':runQuery')){const q=(await req.json()).structuredQuery,f=q.where.fieldFilter,v=f.value.stringValue??f.value.booleanValue;return Response.json((fixture[q.from[0].collectionId]||[]).filter(r=>r[f.field.fieldPath]===v).slice(0,q.limit).map(r=>({document:fsDoc(q.from[0].collectionId,r)})));}
  if(u.pathname.endsWith(':batchGet'))return Response.json((await req.json()).documents.map(name=>({missing:name,readTime:'2026-11-12T00:00:00Z'})));
  if(req.method==='GET'&&c){const [collection,id]=c.split('/');if(!id)return Response.json({documents:(fixture[collection]||[]).map(r=>fsDoc(collection,r))});const row=(fixture[collection]||[]).find(r=>r.id===id);return row?Response.json(fsDoc(collection,row)):Response.json({error:{message:'fixture missing'}},{status:404});}
  throw Error('Unexpected fixture request '+req.method+' '+u.pathname);
 }};
 const start=async()=>{mf=new Miniflare(options);await mf.ready;};await start();t.after(async()=>mf?.dispose());
 const send=(path,init)=>mf.dispatchFetch('https://worker.local'+path,init);
 const login=()=>send('/superadmin/session/login',{method:'POST',body:JSON.stringify({mail:fixture.suscriptores[0].mail,clave:fixture.suscriptores[0].clave})});
 const before=await login(),first=await before.json();assert.equal(before.status,200,JSON.stringify(first));assert(first.token);assert.equal(first.entrada_pendiente.code,'GH_DAILY_NOT_PREPARED');
 const auth={Authorization:'Bearer '+first.token};
 const unauthorized=await send('/internal/city-books',{method:'POST',body:JSON.stringify({op:'read',cutoff,known:[],publishedCutoff:cutoff})});assert.equal(unauthorized.status,401);
 const stage=join(root,'hosting');
 const read=async(url,init)=>{if(String(url).startsWith('https://anunciantes-guialocal.web.app/'))return Response.json({cutoff,manifest:{}});return send('/internal/city-books',init);};
 failSource=true;await publicarPaquetes({mode:'cut',stage,cutoff,read,identity:async()=>oidc()});
 await assert.rejects(publicarPaquetes({mode:'commit',cutoff,read,identity:async()=>oidc()}),/falta preparar Gran Hermano/);
 const absent=await send('/superadmin/dashboard',{headers:auth});assert.equal(absent.status,503);assert.equal((await absent.json()).code,'GH_DAILY_NOT_PREPARED');failSource=false;
 const prepared=await publicarPaquetes({mode:'cut',stage,cutoff,read,identity:async()=>oidc()});assert.equal(prepared.cutoff,cutoff);
 const draft=await send('/superadmin/dashboard',{headers:auth});assert.equal(draft.status,503);
 await publicarPaquetes({mode:'commit',cutoff,read,identity:async()=>oidc()});
 denySource=true;const sources=requests.length;
 for(let i=0;i<2;i++){
  const response=await login(),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert(body.entrada.inbox);assert(body.entrada.fixed);assert(body.entrada.territory);assert.equal(body.resumen.suscriptores,1);assert(body.entrada.fixed.catalogos.categorias.some(c=>c.nombre==='Categoría de prueba'));assert.equal(body.entry_version,195);
  const m=meters(response);assert.equal(m.firestore.read_calls,0);assert.equal(m.cloudflare.kv.get_calls,1);assert.deepEqual(m.cloudflare.auth_store,{calls:1,rows_read:1,rows_written:0,failures:0});assert.equal(m.cloudflare.admin_store.calls,1);assert.equal(m.cloudflare.admin_store.rows_read,1);assert.equal(m.cloudflare.kv.put_calls,0);assert.equal(m.cloudflare.kv.list_calls,0);
 }
 const noManual=await send('/superadmin/birthdays/prepare',{method:'POST',headers:auth});assert.equal(noManual.status,200);assert.equal(meters(noManual).firestore.read_calls,0);assert.equal(requests.length,sources);
 await mf.dispose();await start();
 const resumed=await send('/superadmin/dashboard',{headers:auth}),body=await resumed.json();assert.equal(resumed.status,200,JSON.stringify(body));assert.equal(body.resumen.suscriptores,1);assert.equal(meters(resumed).firestore.read_calls,0);assert.equal(meters(resumed).cloudflare.kv.get_calls,0);assert.deepEqual(meters(resumed).cloudflare.auth_store,{calls:1,rows_read:1,rows_written:0,failures:0});assert.equal(requests.length,sources);
 const bad=await send('/superadmin/session/login',{method:'POST',body:JSON.stringify({mail:fixture.suscriptores[0].mail,clave:'incorrecta'})});assert.equal(bad.status,401);assert.equal(requests.length,sources);
 // Use the actual bound DO for mutations; all identities below are fixtures.
 const access=async(sid,command={action:'read'})=>{
  const namespace=await mf.getDurableObjectNamespace('GLD_PUBLIC_CACHE');
  const actor=namespace.get(namespace.idFromName('private-access-v201:'+sid));
  const r=await actor.fetch('https://access.internal/',{method:'POST',body:JSON.stringify({op:'private-access201',sid,...command})});assert.equal(r.status,200);return (await r.json()).value;
 };
 const fixtureToken=(sid,rol,extra={})=>{const body=Buffer.from(JSON.stringify({sid,rol,persistent:true,sv:0,...extra})).toString('base64url');return body+'.'+createHmac('sha256','local-integration-secret').update(body).digest('base64url');};
 for(const rol of ['SUPERADMIN_PRINCIPAL','SUPERADMIN','ADMIN_LOCAL']){
  const sid='fixture-'+rol,token=fixtureToken(sid,rol,{ciudades:['DOL']});await access(sid);
  const headers={Authorization:'Bearer '+token};const allowed=await send('/superadmin/dashboard',{headers});assert.equal(allowed.status,200);const m=meters(allowed);assert.equal(m.cloudflare.kv.get_calls,0);assert.deepEqual(m.cloudflare.auth_store,{calls:1,rows_read:1,rows_written:0,failures:0});
  await access(sid,{action:'policy',policy:{activo:false,revision:'revoked'}});
  const denied=await send('/superadmin/dashboard',{headers});assert.equal(denied.status,401);assert.equal(meters(denied).cloudflare.admin_store.calls,0);
 }
 // Source data arriving after a change must not undo that change.
 const initial=await access('concurrent');await Promise.all(Array.from({length:20},()=>access('concurrent',{action:'revoke'})));
 const stale=await access('concurrent',{action:'admin',generation:initial.generation,admin:{id:'concurrent',activo:true,rol:'SUPERADMIN_PRINCIPAL'}});assert.equal(stale.state.version,20);assert.equal(stale.admin,null);
 const kv=await mf.getKVNamespace('GLD_CACHE_KV');await kv.put('subscriber:session-state:v1:corrupt','{');
 const corrupt=await send('/superadmin/dashboard',{headers:{Authorization:'Bearer '+fixtureToken('corrupt','SUPERADMIN_PRINCIPAL')}});assert.equal(corrupt.status,503);assert.equal(meters(corrupt).cloudflare.auth_store.failures,1);assert.equal(meters(corrupt).cloudflare.admin_store.calls,0);
 await mf.dispose();await start();const restored=await access('concurrent');assert.equal(restored.state.version,20);assert.equal(restored.admin,null);assert.equal(requests.length,sources);
});
