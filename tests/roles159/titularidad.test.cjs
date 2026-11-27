/* Unidad 1. Ejecuta funciones del Worker único, nunca una implementación duplicada. */
function load(source,crypto,TextEncoder,clone,sessionState,revoke){
 const cut=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+1);if(i<0||j<i)throw Error('No se encontró '+a);return source.slice(i,j)};
 const code=[
  cut('function httpError(message, status) {','function text(v) {'),
  cut('var text27 =','function publicSubscriber(s)'),
  cut('function sessionAllows(','// reconstruccion/worker/modules/commerce-v2.js'),
  cut('async function wholeRevisionInternal(','const PROFILE_REVISION_FIELDS_INTERNAL'),
  cut('var text72 =','// Asignaciones administrativas'),
  cut('function activeSessionRelation155(','async function routeAdvertiserAccess155('),
  cut('function roleName159(','function contactSummary159('),
  cut('var withPrivateCacheV46 =','var withPanelCacheV48 =')
 ].join('\n');
 return new Function('crypto','TextEncoder','structuredClone','subscriberSessionState','revokeSubscriberSessions','ADMIN_SUBSCRIBERS_KEY',code+'\nreturn {commitOwnership155,saveAdvertiserRelation155,ownershipSnapshot155,ownershipRevision155,wholeRevisionInternal,sessionAllows,activeOwners155,moderatedCreation155,withPrivateCacheV46,findSubscriberForRelation155};')(crypto,TextEncoder,clone,sessionState,revoke,'admin:index:subscribers:v2');
}
const A='A',C='suscriptor_anunciante',ADM='anunciantes_administracion',GH={sid:'GH',rol:'SUPERADMIN_PRINCIPAL'};
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const fail=(status,message)=>Object.assign(Error(message),{status});
function fixture(){
 const data=new Map(),trace=[],commits=[],states=new Map();let n=0,gate=null;
 function seed(c,id,row){data.set(c+'/'+id,{doc:{id,...clone(row)},updateTime:String(++n)});}
 function read(c,id){return clone(data.get(c+'/'+id)||{doc:null,updateTime:undefined});}
 function rows(c,field,value,limit=1000){return [...data].filter(([k,v])=>k.startsWith(c+'/')&&v.doc[field]===value).slice(0,limit).map(([,v])=>clone(v.doc));}
 const db={
  async get(c,id){trace.push(['get',c,id]);return read(c,id).doc;},
  async getVersioned(c,id){trace.push(['version',c,id]);return read(c,id);},
  async queryEqual(c,field,value,limit){trace.push(['query',c,field,value,limit]);return rows(c,field,value,limit);},
  async commitPatches(entries){
   trace.push(['commit',entries.length]);
   if(gate){const g=gate;if(++g.arrived===g.total){gate=null;g.release();}await g.promise;}
   for(const e of entries){const v=read(e.collection,e.id),p=e.options||{};
    if(p.updateTime&&v.updateTime!==p.updateTime||p.mustNotExist&&v.doc||p.mustExist&&!v.doc)throw fail(409,'Precondición fallida');
   }
   const result=entries.map(e=>{if(e.remove){data.delete(e.collection+'/'+e.id);return null;}seed(e.collection,e.id,{...read(e.collection,e.id).doc,...e.patch});return read(e.collection,e.id).doc;});
   commits.push(clone(entries));return result;
  }
 };
 const seedUser=(sid,active=true)=>seed('suscriptores',sid,{nombre:sid,mail:sid.toLowerCase()+'@test.invalid',activo:active});
 const rel=(sid,role='PROPIETARIO',active=true,id=sid+'__'+A,aid=A)=>seed(C,id,{relacion_id:id,suscriptor_id:sid,anunciante_id:aid,rol:role,activo:active,permisos:role==='PROPIETARIO'?'':'PROMOS',permisos_definidos:role!=='PROPIETARIO'});
 const seedAd=(aid=A)=>{seed('anunciantes',aid,{nombre:'Comercio '+aid});seed(ADM,aid,{nivel:4,funcionalidades:'EVENTOS,PROMOS'});};
 function race(total=2){let release;const promise=new Promise(r=>release=r);gate={total,arrived:0,promise,release};}
 return {data,trace,commits,states,db,seed,read,rows,seedUser,rel,seedAd,race};
}
async function run(source,crypto,Encoder,assert){
 const state=async(env,sid)=>({version:env.states.get(sid)||0,deleted:false});
 const revoke=async(env,sid)=>env.states.set(sid,(env.states.get(sid)||0)+1);
 const api=load(source,crypto,Encoder,clone,state,revoke),passed=[];
 const {commitOwnership155:change,saveAdvertiserRelation155:save,ownershipRevision155:revision,wholeRevisionInternal:rowRevision,sessionAllows:allows,activeOwners155:owners,withPrivateCacheV46:cacheDb,findSubscriberForRelation155:find}=api;
 const basic=()=>{const f=fixture();f.seedAd();for(const sid of ['OLD','NEW','THIRD','M','D'])f.seedUser(sid);return f;};
 const active=f=>owners(f.rows(C,'anunciante_id',A)).map(r=>r.suscriptor_id).sort();
 const body=async(f,sid,activo=true,rol='PROPIETARIO',permisos=[])=>{
  const rows=f.rows(C,'anunciante_id',A),row=rows.find(r=>r.suscriptor_id===sid);
  return {suscriptor_id:sid,activo,rol,permisos,revision:await rowRevision(row||{}),revision_titularidad:await revision(rows,f.read(ADM,A).doc)};
 };
 const gh=async(f,sid,activo=true)=>save({db:f.db,aid:A,auth:GH,body:await body(f,sid,activo)});
 const check=async(name,fn)=>{await fn();passed.push(name);};
 const reject=async(p,status)=>assert.rejects(p,e=>e.status===status);
 await check('Asignación inicial: una escritura atómica, un propietario y revisión previa a consulta',async()=>{
  const f=basic();const result=await gh(f,'OLD');assert.equal(result.relacion.rol,'PROPIETARIO');assert.deepEqual(active(f),['OLD']);assert.equal(f.commits.length,1);
  const first=f.trace.findIndex(x=>x[0]==='version'&&x[1]===ADM),query=f.trace.findIndex(x=>x[0]==='query'&&x[1]===C);assert.ok(first>=0&&first<query);assert.equal(f.trace.filter(x=>x[0]==='query'&&x[1]===C).length,1);
 });
 await check('Transferencia a manager existente: conserva otro administrador, cupos y datos comerciales',async()=>{
  const f=basic();f.rel('OLD');f.rel('NEW','MANAGER');f.rel('D','ADMINISTRADOR');const before=f.read(ADM,A).doc;await gh(f,'NEW');
  assert.deepEqual(active(f),['NEW']);assert.equal(f.read(C,'OLD__A').doc.activo,false);assert.equal(f.read(C,'D__A').doc.activo,true);assert.equal(f.read(C,'D__A').doc.rol,'ADMINISTRADOR');assert.equal(f.read(ADM,A).doc.nivel,before.nivel);assert.equal(f.read(ADM,A).doc.funcionalidades,before.funcionalidades);assert.equal(f.commits[0].length,3);
 });
 await check('Revocación: cero propietarios sin eliminar el anunciante ni sus delegados',async()=>{
  const f=basic();f.rel('OLD');f.rel('M','MANAGER');await gh(f,'OLD',false);assert.deepEqual(active(f),[]);assert.ok(f.read('anunciantes',A).doc);assert.equal(f.read(C,'M__A').doc.activo,true);
 });
 await check('Revocar un antiguo titular inactivo no afecta al actual; operación sin cambios',async()=>{
  const f=basic();f.rel('OLD','PROPIETARIO',false);f.rel('NEW');const result=await gh(f,'OLD',false);assert.equal(result.updated,false);assert.deepEqual(active(f),['NEW']);assert.equal(f.commits.length,0);
 });
 await check('Revocación de vínculo huérfano: no exige una cuenta vigente',async()=>{
  const f=basic();f.rel('DELETED');await gh(f,'DELETED',false);assert.deepEqual(active(f),[]);
 });
 await check('Rechaza cuenta inexistente o inactiva, revisión obsoleta y cambio administrativo sin titularidad',async()=>{
  const f=basic();f.rel('OLD');f.seedUser('NEW',false);await reject(gh(f,'NEW'),404);await reject(gh(f,'UNKNOWN'),404);
  const stale=await body(f,'THIRD');stale.revision='stale';await reject(save({db:f.db,aid:A,auth:GH,body:stale}),409);
  const b=await body(f,'M',true,'MANAGER',['PROMOS']);await reject(save({db:f.db,aid:A,auth:GH,body:b}),403);
  const noRev=await body(f,'THIRD');delete noRev.revision_titularidad;await reject(save({db:f.db,aid:A,auth:GH,body:noRev}),409);assert.equal(f.commits.length,0);
 });
 await check('Revisión de titularidad evita transferencias desde fichas anteriores, incluso ABA',async()=>{
  const f=basic();f.rel('OLD');const stale=await body(f,'THIRD');await gh(f,'NEW');await gh(f,'OLD');assert.deepEqual(active(f),['OLD']);
  await reject(save({db:f.db,aid:A,auth:GH,body:stale}),409);assert.deepEqual(active(f),['OLD']);
 });
 await check('Dos asignaciones simultáneas: solo una confirma, la otra 409',async()=>{
  const f=basic();f.rel('OLD');const b1=await body(f,'NEW'),b2=await body(f,'THIRD');f.race();
  const result=await Promise.allSettled([save({db:f.db,aid:A,auth:GH,body:b1}),save({db:f.db,aid:A,auth:GH,body:b2})]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.find(x=>x.status==='rejected').reason.status,409);assert.equal(active(f).length,1);assert.equal(f.commits.length,1);
 });
 await check('Transferencia y delegación simultáneas comparten precondición; antiguo titular no delega',async()=>{
  const f=basic();f.rel('OLD');const transfer=await body(f,'NEW'),delegation=await body(f,'M',true,'MANAGER',['PROMOS']);f.race();
  const result=await Promise.allSettled([save({db:f.db,aid:A,auth:GH,body:transfer}),save({db:f.db,aid:A,auth:{sid:'OLD',owner:true},body:delegation})]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.find(x=>x.status==='rejected').reason.status,409);assert.equal(active(f).length,1);
  if(active(f)[0]==='OLD')await gh(f,'NEW');
  await reject(save({db:f.db,aid:A,auth:{sid:'OLD',owner:true},body:await body(f,'D',true,'MANAGER',['EVENTOS'])}),403);
 });
 await check('Propietarios históricos múltiples: reclamo no los resuelve silenciosamente; GH elige uno',async()=>{
  const f=basic();f.rel('OLD');f.rel('NEW','PROPIETARIO','sí');f.rel('D','ADMINISTRADOR');await reject(change({db:f.db,aid:A,sid:'THIRD',actor:'GH'}),409);
  await gh(f,'NEW');assert.deepEqual(active(f),['NEW']);assert.equal(f.read(C,'D__A').doc.activo,true);
 });
 await check('Vínculos duplicados o administración sin revisión: falla cerrada, sin escrituras',async()=>{
  const f=basic();f.rel('OLD');f.rel('OLD','PROPIETARIO',true,'legacy');await reject(gh(f,'NEW'),409);assert.equal(f.commits.length,0);
  const g=basic();g.data.delete(ADM+'/'+A);await reject(gh(g,'NEW'),409);assert.equal(g.commits.length,0);
 });
 await check('Reclamo aprobado y transferencia comparten commit; solicitud obsoleta no cambia propietario',async()=>{
  const f=basic();f.rel('OLD');f.seed('solicitudes_anunciante','Q',{estado:'PENDIENTE',suscriptor_id:'NEW'});
  const q=f.read('solicitudes_anunciante','Q'),extra=[{collection:'solicitudes_anunciante',id:'Q',before:q.doc,patch:{estado:'APROBADA',anunciante_id:A},options:{updateTime:q.updateTime}}];
  f.seed('solicitudes_anunciante','Q',{estado:'RECHAZADA',suscriptor_id:'NEW'});
  await reject(change({db:f.db,aid:A,sid:'NEW',actor:'GH',extra}),409);assert.deepEqual(active(f),['OLD']);assert.equal(f.commits.length,0);
  f.seed('solicitudes_anunciante','Q',{estado:'PENDIENTE',suscriptor_id:'NEW'});extra[0].before=f.read('solicitudes_anunciante','Q').doc;extra[0].options.updateTime=f.read('solicitudes_anunciante','Q').updateTime;
  await change({db:f.db,aid:A,sid:'NEW',actor:'GH',extra});assert.deepEqual(active(f),['NEW']);assert.equal(f.read('solicitudes_anunciante','Q').doc.estado,'APROBADA');assert.equal(f.commits[0].length,4);
 });
 await check('Alta: anuncio, administración, sede, propietario y solicitud son indivisibles',async()=>{
  const f=fixture();f.seedUser('NEW');f.seed('solicitudes_anunciante','Q',{estado:'PENDIENTE'});
  const creation=api.moderatedCreation155({nombre:'Comercio nuevo',ciudad_id:'D',detalle:{direccion:'Calle 1'}},A,'4','2026-11-27T00:00:00Z');
  const q=f.read('solicitudes_anunciante','Q'),extra=[{collection:'solicitudes_anunciante',id:'Q',before:q.doc,patch:{estado:'APROBADA'},options:{updateTime:'obsolete'}}];
  await reject(change({db:f.db,aid:A,sid:'NEW',actor:'GH',creation,extra}),409);assert.equal(f.read('anunciantes',A).doc,null);assert.equal(f.read(ADM,A).doc,null);assert.deepEqual(active(f),[]);
  extra[0].options.updateTime=q.updateTime;const result=await change({db:f.db,aid:A,sid:'NEW',actor:'GH',creation,extra});
  assert.deepEqual(active(f),['NEW']);assert.equal(result.created.sedes[0].direccion,'Calle 1');assert.equal(f.commits[0].length,5);
  await reject(change({db:f.db,aid:A,sid:'NEW',actor:'GH',creation,extra:[]}),409);
 });
 await check('Delegación: funciones contratadas, manager sin edición, administrador explícito y sin escrituras redundantes',async()=>{
  const f=basic();f.rel('OLD');const auth={sid:'OLD',owner:true};
  await reject(save({db:f.db,aid:A,auth,body:await body(f,'M',true,'MANAGER',['NO_EXISTE'])}),400);
  await reject(save({db:f.db,aid:A,auth,body:await body(f,'M',true,'MANAGER',['MODIFICAR_DATOS'])}),403);
  await reject(save({db:f.db,aid:A,auth,body:await body(f,'OLD',true,'ADMINISTRADOR',['PROMOS'])}),403);
  const result=await save({db:f.db,aid:A,auth,body:await body(f,'M',true,'MANAGER',['PROMOS'])});assert.equal(result.relacion.permisos,'PROMOS');assert.equal(result.relacion.permisos_definidos,true);
  const repeat=await save({db:f.db,aid:A,auth,body:await body(f,'M',true,'MANAGER',['PROMOS'])});assert.equal(repeat.updated,false);assert.equal(f.commits.length,1);
  await save({db:f.db,aid:A,auth,body:await body(f,'M',false,'MANAGER',[])});assert.equal(f.read(C,'M__A').doc.activo,false);
 });
 await check('Expropietario inactivo puede ser delegado sin recuperar titularidad',async()=>{
  const f=basic();f.rel('OLD');f.rel('NEW','PROPIETARIO',false);await save({db:f.db,aid:A,auth:{sid:'OLD',owner:true},body:await body(f,'NEW',true,'ADMINISTRADOR',['PROMOS'])});
  assert.deepEqual(active(f),['OLD']);assert.equal(f.read(C,'NEW__A').doc.rol,'ADMINISTRADOR');
 });
 await check('Sesiones legadas firmadas, roles actuales, alcance GH y permisos explícitos',async()=>{
  const session=(r,extra={})=>({ok:true,auth:[{anunciante_id:A,...r}],...extra});
  assert.equal(allows(session({rol:'PROPIETARIO'}),A,'promos'),true);
  assert.equal(allows(session({rol:'PROPIETARIO',activo:false}),A,'modificar_datos'),false);
  assert.equal(allows(session({rol:'MANAGER',activo:true,permisos:'EVENTOS',permisos_definidos:true}),A,'eventos'),true);
  assert.equal(allows(session({rol:'MANAGER',activo:true,permisos:'MODIFICAR_DATOS'}),A,'modificar_datos',{write:true}),false);
  assert.equal(allows(session({rol:'ADMINISTRADOR',permisos:'',permisos_definidos:true}),A,'promos'),false);
  assert.equal(allows(session({rol:'ADMINISTRADOR',permisos:'',permisos_definidos:true}),A,'modificar_datos'),false);
  assert.equal(allows(session({rol:'COADMINISTRADOR'}),A,'modificar_datos'),true);
  const scoped=session({rol:'ADMINISTRADOR'},{admin_panel:true,aid:A});assert.equal(allows(scoped,A,'modificar_datos'),true);assert.equal(allows(scoped,'OTHER','modificar_datos'),false);
 });
 await check('Búsqueda exacta reutiliza índice, no expone claves ni permite coincidencias ambiguas',async()=>{
  const list=[{suscriptor_id:'M',nombre:'Manager',mail:'m@test.invalid',activo:true,clave:'SECRET'},{suscriptor_id:'D',mail:'d@test.invalid',activo:'false'}],c={get:async()=>({results:list})};
  assert.deepEqual((await find(c,' M@TEST.INVALID ')).results,[{suscriptor_id:'M',nombre:'Manager',mail:'m@test.invalid'}]);
  assert.deepEqual((await find(c,'M')).results,[]);assert.deepEqual((await find(c,'d@test.invalid')).results,[]);list.push({...list[0],suscriptor_id:'M2'});await reject(find(c,'m@test.invalid'),409);
 });
 await check('Caché de login: no autoriza desde una proyección KV de generación anterior',async()=>{
  const f=basic();f.rel('OLD','PROPIETARIO',false);const store=new Map(),env={states:f.states,GLD_CACHE_KV:{async get(k){return store.get(k)??null;},async put(k,v){store.set(k,v);},async delete(k){store.delete(k);}}};
  const key='login:relations:v45:OLD:initial';store.set(key,JSON.stringify({version:46,relation_limit:100,authorization_version:0,data:[{id:'OLD__A',suscriptor_id:'OLD',anunciante_id:A,rol:'PROPIETARIO',activo:true}]}));f.states.set('OLD',2);
  const db=cacheDb(f.db,env),fresh=await db.loginRelations('OLD',2);assert.equal(fresh[0].activo,false);const reads=f.trace.filter(x=>x[0]==='query').length;assert.equal((await db.loginRelations('OLD',2))[0].activo,false);assert.equal(f.trace.filter(x=>x[0]==='query').length,reads);
  store.set('auth:account-bundle:v161:OLD',JSON.stringify({version:161,sv:2,relations:[{rol:'PROPIETARIO'}]}));let builds=0;const build=async()=>{builds++;return [];};assert.deepEqual(await db.loginAuthorizationBundle161('OLD',2,build),[]);assert.deepEqual(await db.loginAuthorizationBundle161('OLD',2,build),[]);assert.equal(builds,1);
 });
 await check('Commit real de la capa de caché: deltas y revocación de sesiones solo para titular anterior y nuevo',async()=>{
  const f=basic();f.rel('OLD');f.rel('M','MANAGER');const store=new Map(),env={states:f.states,GLD_CACHE_KV:{async get(k){return store.get(k)??null;},async put(k,v){store.set(k,v);},async delete(k){store.delete(k);},async list({prefix}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};}}};
  const db=cacheDb(f.db,env);await change({db,aid:A,sid:'NEW',actor:'GH'});await db.flushLoginCache();
  assert.equal(JSON.parse(store.get('gh:advertiser-relations:v104:A:delta:OLD__A')).data.activo,false);
  assert.equal(JSON.parse(store.get('gh:advertiser-relations:v104:A:delta:NEW__A')).data.activo,true);
  assert.equal(f.states.get('OLD'),2);assert.equal(f.states.get('NEW'),2);assert.equal(f.states.has('M'),false);
  assert.ok(store.get('login:relations:v45:OLD:revision'));assert.ok(store.get('login:relations:v45:NEW:revision'));
 });
 return passed;
}
module.exports={run};
if(require.main===module){
 const {readFileSync}=require('node:fs'),{webcrypto}=require('node:crypto'),assert=require('node:assert/strict');
 run(readFileSync('worker/worker206.txt','utf8'),webcrypto,TextEncoder,assert).then(passed=>{for(const name of passed)console.log('PASS '+name);console.log('TOTAL '+passed.length);},error=>{console.error(error);process.exitCode=1;});
}
