const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('worker/worker206.txt','utf8');
const versionDeclaration=source.match(/^const WORKER_VERSION = ['"]\d+['"];$/m)?.[0];
assert(versionDeclaration,'El Worker debe declarar su versión');
const start=source.indexOf('GldPublicCache119.prototype.ghDetail204=async function(body){');
const end=source.indexOf('\nGldPublicCache119.prototype.commerceMaster209=',start);
assert(start>0&&end>start,'La copia GH debe existir en el actor duradero real');
function setup(existingStore=null){
 const store=existingStore||new Map(),calls={build:0,select:0,insert:0,delete:0,sql:0};
 class GldPublicCache119{}
 const ctx={GldPublicCache119,Response,JSON,String,Date,Error,
  crypto:{randomUUID:()=> 'test-uuid'},
  requestCache121:env=>env,observeKv117:env=>env,
  roleSourceDb192:db=>db,requestDb119:db=>db,observeDbV41:db=>db,createDb:()=>({}),
  withPrivateCacheV46:db=>db,withAuthCacheV58:db=>db,
  withPanelCacheV48:db=>({...db,flushLoginCache:async()=>{}}),
  consumption136:()=>({}),
  advertiserDetailV2:async({advertiserId})=>{calls.build++;return {success:true,id:advertiserId,revision:calls.build};}
 };
 vm.createContext(ctx);
 vm.runInContext(versionDeclaration+'\n'+source.slice(start,end),ctx);
 const actor=new GldPublicCache119();
 actor.env={GLD_CACHE_KV:{}};
 actor.metrics={rows_read:0,rows_written:0};
 actor.query=(sql,...params)=>{
  calls.sql++;
  if(sql.startsWith('SELECT ')){calls.select++;return store.has('detail')?[{value:store.get('detail')}]:[];}
  if(sql.startsWith('INSERT ')){calls.insert++;store.set('detail',params[0]);return [];}
  if(sql.startsWith('DELETE ')){calls.delete++;store.delete('detail');return [];}
  if(sql.startsWith('CREATE '))return [];
  throw Error('SQL no esperado: '+sql);
 };
 return {actor,calls,store};
}
async function operation(actor,op='gh-detail-read204'){const response=await actor.ghDetail204({op,aid:'A1'});assert.equal(response.status,200);return response.json();}
test('GH relee durante 24h sin reconstruir ni escribir',async()=>{
 const {actor,calls}=setup();
 const first=await operation(actor);
 const clock=Date.now;
 try{
  Date.now=()=>clock()+86400000;
  const next=await operation(actor);
  assert.equal(next.detail.revision,first.detail.revision);
 }finally{Date.now=clock;}
 assert.equal(calls.build,1);
 assert.equal(calls.insert,1);
 assert.equal(calls.select,2);
});
test('GH vuelve a abrir tras reiniciarse el actor sin reconstruir ni escribir datos',async()=>{
 const first=setup();await operation(first.actor);
 const again=setup(first.store);
 const value=await operation(again.actor);
 assert.equal(value.detail.revision,1);
 assert.equal(again.calls.build,0);
 assert.equal(again.calls.insert,0);
 assert.equal(again.calls.select,1);
});
test('un cambio confirmado invalida la copia del mismo anunciante y reconstruye una sola vez',async()=>{
 const {actor,calls}=setup();
 await operation(actor);
 await operation(actor,'gh-detail-invalidate204');
 const refreshed=await operation(actor);
 assert.equal(refreshed.detail.revision,2);
 assert.equal(calls.build,2);
 assert.equal(calls.insert,2);
 assert.equal(calls.delete,1);
});
test('la copia de GH no usa TTL120 ni la clave KV heredada',()=>{
 assert(!source.includes('GH_ADMIN_DETAIL_TTL203'));
 assert(!source.includes('admin:advertiser:detail:v203:'));
 assert(!source.includes('admin:advertiser:detail:v204:'));
 assert(source.includes('gh_advertiser_detail204'));
 assert(source.includes("['gh-detail-read204','gh-detail-invalidate204']"));
 assert(source.includes('await ghAdminDetailInvalidate203(directoryCache102,aid,env)'));
 assert(source.includes('this.requestTail127=new Promise'),'el actor debe serializar lecturas y escrituras');
});
