import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
const source=await readFile(new URL('../../worker/worker191_consolidado_sobre_190_d8446f0.txt',import.meta.url),'utf8');
const w=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {subscriberRow,rowOf,routeCalendarV83,issue2,searchSubscribersV2,routeCityBookCut,withAuthCacheV58}; export function setCityIdentity195ForTest(fn){cityBookIdentity=fn;}').toString('base64'));
const day=Date.parse('2026-11-12T04:00:00Z');
function setup(t,rows){
 let clock=day+60000;t.mock.method(Date,'now',()=>clock);
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 const state={storage:{sql:{exec(s,...args){const p=sql.prepare(s);if(p.columns().length){const rows=p.all(...args);return Object.assign(rows,{rowsRead:rows.length,rowsWritten:0});}const r=p.run(...args);return Object.assign([],{rowsRead:0,rowsWritten:r.changes});}}}};
 const raw=new Map();if(rows!==null)raw.set('admin:index:subscribers:v2',JSON.stringify({version:2,results:rows}));
 // Prepared private indices used by the same complete entry producer.
 raw.set('admin:index:advertisers:v2',JSON.stringify({version:2,results:[]}));
 raw.set('territorio:admin:v1',JSON.stringify({paises:[],provincias:[],ciudades:[]}));
 raw.set('territorio:public:v1',JSON.stringify({paises:[],provincias:[],ciudades:[]}));
 raw.set('admin:gh:fixed:v169',JSON.stringify({version:169,catalogos:{},reglas:{revision:0,reglas:{}},precios:{revision:0,precios:{}}}));
 const pairs=[['eventos','estado_moderacion','PENDIENTE'],['eventos','estado_moderacion','REVISION'],['actividades','aprobado',false],['solicitudes_anunciante','estado','PENDIENTE'],...['anunciantes','publicidades','promos','empleos'].map(c=>[c,'estado_moderacion','PENDIENTE']),...['empleos','promos','anunciantes','eventos','actividades','publicidades'].map(c=>[c,'revision_adulto','PENDIENTE']),...['PENDIENTE','EN_ATENCION'].map(v=>['solicitudes_soporte','estado',v])];
 for(const[c,f,v]of pairs){const key='panel:query:v48:'+c+':'+(c==='solicitudes_soporte'||['estado_moderacion','ciudad_id','aprobado','revision_adulto'].includes(f)?f+':':'')+encodeURIComponent(String(v));raw.set(key,JSON.stringify({version:48,data:[],revision:''}));}
 const calls=[];const kv={get:async k=>{calls.push(['get',k]);return raw.get(k)||null;},put:async(k,v)=>{calls.push(['put',k]);raw.set(k,v);},delete:async k=>{calls.push(['delete',k]);raw.delete(k);},list:async({prefix})=>{calls.push(['list',prefix]);return {keys:[...raw.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};}};
 const env={SERVER_SECRET:'prueba-local',GLD_CACHE_KV:kv};let actor=new w.PrivateDaily195(state,env);
 env.GLD_PUBLIC_CACHE={idFromName:name=>name,get(name){assert.equal(name,'city-book-shared-v1');return {fetch:async req=>actor.fetch(await req.json())};}};
 return {env,raw,calls,sql,setClock(n){clock=n;},restart(){actor=new w.PrivateDaily195(state,env);},async op(action,cutoff=Math.floor((Date.now()-4*3600000)/86400000)*86400000+4*3600000){const r=await actor.fetch({action,cutoff});const j=await r.json();assert.equal(r.status,200,j.error);return j.value;}};
}
const people=[{id:'A',suscriptor_id:'A',nombre:'Ana',fecha_nacimiento:'1990-11-12',activo:true},{id:'B',nombre:'Bea',fecha_nacimiento:'1980-11-18',activo:true},{id:'C',nombre:'Caro',fecha_nacimiento:'1970-11-19',activo:true},{id:'D',nombre:'Dani',fecha_nacimiento:'2000-11-13',activo:false}];
test('cumpleaños es una lista de personas de hoy y los seis días siguientes, sin resúmenes de edad',()=>{
 const r=w.birthdayList195({preparado:true,results:people},new Date('2026-11-12T14:00:00Z'));
 assert.equal(r.periodo_dias,7);assert.equal(r.desde,'2026-11-12');assert.equal(r.hasta,'2026-11-18');assert.deepEqual(r.results.map(x=>x.nombre),['Ana','Bea']);assert(!JSON.stringify(r).includes('mayores18'));
 const tomorrow=w.birthdayList195({preparado:true,results:people},new Date('2026-11-13T14:00:00Z'));assert.deepEqual(tomorrow.results.map(x=>x.nombre),['Bea','Caro']);
});
test('ventana de siete días cruza año usando fecha argentina y conserva homónimos',()=>{
 const rows=[{id:'1',nombre:'Juan',fecha_nacimiento:'1980-12-31'},{id:'2',nombre:'Juan',fecha_nacimiento:'2000-01-01'},{id:'3',nombre:'Fuera',fecha_nacimiento:'2000-01-04'}];
 const r=w.birthdayList195({preparado:true,results:rows},new Date('2027-01-01T01:00:00Z'));assert.equal(r.desde,'2026-12-31');assert.equal(r.results.length,3);
 const r2=w.birthdayList195({preparado:true,results:rows},new Date('2027-01-01T04:00:00Z'));assert.equal(r2.results.length,2);
});
test('lectura de edición inexistente no consulta KV ni Firestore ni crea una copia vacía',async t=>{
 const h=setup(t,null);const p=await h.op('read');assert.equal(p.preparado,false);assert.equal(p.results,null);assert.equal(h.calls.length,0);assert.equal(w.birthdayList195(p).total,null);
});
test('misma publicación diaria: stage idempotente, commit y reaperturas sin lecturas KV incluso al reiniciar',async t=>{
 const h=setup(t,people);await h.op('stage');assert.equal((await h.op('read')).preparado,false);const preparedReads=h.calls.length;assert(preparedReads>1);
 await h.op('stage');assert.equal(h.calls.length,preparedReads);await h.op('commit');assert.equal((await h.op('read')).results.length,4);
 h.restart();h.setClock(day+10*3600000);await h.op('read');await h.op('read');assert.equal(h.calls.length,preparedReads);
});
test('alta o corrección durante el día se incorpora una sola vez en el corte siguiente',async t=>{
 const h=setup(t,people);await h.op('initial');
 h.raw.set('admin:index:subscribers:v2',JSON.stringify({version:2,results:[...people,{id:'NUEVA',nombre:'Nueva',fecha_nacimiento:'1995-11-15',activo:true}]}));
 assert.equal((await h.op('read')).results.length,4);await h.op('initial');assert.equal((await h.op('read')).results.length,4);
 h.setClock(day+86400000+1000);await h.op('stage',day+86400000);assert.equal((await h.op('read')).preparado,false);await h.op('commit',day+86400000);assert.equal((await h.op('read')).results.length,5);
 const n=h.calls.length;await h.op('stage',day+86400000);assert.equal(h.calls.length,n);
});
test('primera migración usa índice privado preparado; las siguientes ediciones reutilizan fechas sin enumerarlo otra vez',async t=>{
 const h=setup(t,[{id:'A',nombre:'Ana'}]);h.raw.set('private:birthdays:ready:v91','{}');h.raw.set('private:birthdays:v91:11-12:A',JSON.stringify({fecha_nacimiento:'1990-11-12'}));
 const first=await h.op('initial');assert.equal(first.results[0].fecha_nacimiento,'1990-11-12');assert.equal(h.calls.filter(x=>x[0]==='list').length,1);
 h.setClock(day+86400000+1000);await h.op('stage',day+86400000);await h.op('commit',day+86400000);assert.equal((await h.op('read')).results[0].fecha_nacimiento,'1990-11-12');assert.equal(h.calls.filter(x=>x[0]==='list').length,1);
});
test('cambio real alimenta el listado general; repetir sin cambios no vuelve a escribir índices ni toca el índice de cumpleaños',async t=>{
 const h=setup(t,[]);const row={id:'A',suscriptor_id:'A',nombre:'Ana',mail:'ana@example.invalid',fecha_nacimiento:'1990-11-12',activo:true};
 await w.syncSubscriberDirectory195(h.env,null,row);const puts=h.calls.filter(x=>x[0]==='put').length;await w.syncSubscriberDirectory195(h.env,row,row);assert.equal(h.calls.filter(x=>x[0]==='put').length,puts);
 assert.equal(JSON.parse(h.raw.get('admin:index:subscribers:v2')).results[0].fecha_nacimiento,row.fecha_nacimiento);assert(!h.calls.some(x=>String(x[1]).startsWith('private:birthdays:')));
});
test('datos privados no forman parte del registro de tipos públicos y la consulta de cumpleaños sigue exigiendo autorización',async t=>{
 const h=setup(t,people);const request=new Request('https://test.invalid/superadmin/birthdays');
 const response=await w.routeCalendarV83({env:h.env,db:{},cache:{},url:new URL(request.url),path:'/superadmin/birthdays',request});assert.equal(response.status,401);assert.equal(h.calls.filter(x=>x[0]==='list').length,0);
 const schema=await w.publicFeatures191({get:async()=>null});assert(!Object.keys(schema).some(x=>/subscriber|birthday/i.test(x)));
});

test('peticiones simultáneas preparan la edición una vez; fallo previo a publicar no crea una lista vacía',async t=>{
 const h=setup(t,people);await Promise.all([h.op('stage'),h.op('stage')]);const preparedReads=h.calls.length;await h.op('stage');assert.equal(h.calls.length,preparedReads);
 const missing=setup(t,null);const p=await missing.op('stage');assert.equal(p.preparado,false);assert.equal(missing.sql.prepare('SELECT * FROM private_subscribers_daily195').all().length,0);
});
test('el mismo protocolo diario read/commit prepara y activa el listado privado sin enviarlo al paquete público',async t=>{
 const h=setup(t,people);h.env.GLD_CITY_BOOK_CAPTURE='1';w.setCityIdentity195ForTest(async()=>true);
 const original=h.env.GLD_PUBLIC_CACHE;
 h.env.GLD_PUBLIC_CACHE={...original,get(name){const privateStub=original.get(name);return {fetch:async req=>{const b=await req.clone().json();if(b.op==='city-book-checkpoint')return Response.json({cutoff:day});if(b.op==='city-book-commit')return Response.json({success:true});return privateStub.fetch(req);}};}};
 const invoke=async body=>{const request=new Request('https://test.invalid/internal/city-books',{method:'POST',body:JSON.stringify(body)});const r=await w.routeCityBookCut({request,env:h.env,report:{}});assert.equal(r.status,200);return r.json();};
 const data=await invoke({op:'read',cutoff:day,publishedCutoff:day,known:[]});assert.equal(data.complete,true);assert(!JSON.stringify(data).includes('Ana'));assert(!JSON.stringify(data).includes('1990-11-12'));assert.equal((await h.op('read')).preparado,false);
 await invoke({op:'commit',cutoff:day});assert.equal((await h.op('read')).results.length,4);
});

test('pantalla muestra nombres y fechas sin pedir datos; una respuesta antigua no se interpreta como lista vacía',async()=>{
 const nodes=new Map();const node=()=>({children:[],hidden:false,textContent:'',replaceChildren(){this.children=[];this.textContent='';},appendChild(c){this.children.push(c);}});
 for(const id of ['ghBirthdayContent','ghBirthdayPrepare','ghBirthdaySummary'])nodes.set(id,node());
 const context={window:{},GH_ADMIN_ACCESS:{rol:'SUPERADMIN_PRINCIPAL'},document:{getElementById:id=>nodes.get(id),createElement:()=>node()},fetch(){throw Error('La presentación no debe consultar datos');}};
 vm.runInNewContext(await readFile(new URL('../../plataforma/gh-calendario.js',import.meta.url),'utf8'),context);
 context.window.ghCalendarDashboardV83(w.birthdayList195({preparado:true,results:people},new Date('2026-11-12T14:00:00Z')));
 assert(nodes.get('ghBirthdayContent').children.some(x=>x.textContent.includes('Ana')));assert(!nodes.get('ghBirthdayContent').children.some(x=>x.textContent.includes('Caro')));
 context.window.ghCalendarDashboardV83({preparado:true,total:2,dias:[]});assert(nodes.get('ghBirthdayContent').textContent.includes('Falta activar'));assert(!nodes.get('ghBirthdayContent').textContent.includes('No hay cumpleaños'));
});

test('ingreso completo en una respuesta: 4 KV get de autenticación y una lectura privada; reanudación 2 KV get',async t=>{
 t.mock.method(console,'log',()=>{});const h=setup(t,people);await h.op('initial');
 const subscriber={id:'P',suscriptor_id:'P',nombre:'Principal de ensayo',mail:'principal@example.invalid',clave:'solo-ensayo',activo:true};
 const admin={id:'P',suscriptor_id:'P',rol:'SUPERADMIN_PRINCIPAL',activo:true};
 const auth=w.withAuthCacheV58({queryEqual:async()=>[subscriber],get:async()=>admin},h.env);await auth.loginAccount(subscriber.mail,subscriber.clave);await auth.loginAdmin('P');h.calls.length=0;
 const login=await w.default.fetch(new Request('https://test.invalid/superadmin/session/login',{method:'POST',body:JSON.stringify({mail:subscriber.mail,clave:subscriber.clave})}),h.env);assert.equal(login.status,200);const logged=await login.json();assert(logged.token);assert.equal(logged.entry_version,195);assert(logged.entrada.inbox);assert(logged.entrada.fixed);assert(logged.entrada.territory);
 const dashboard=await w.default.fetch(new Request('https://test.invalid/superadmin/dashboard',{headers:{Authorization:'Bearer '+logged.token}}),h.env);assert.equal(dashboard.status,200);const entry=await dashboard.json();assert.equal(entry.entry_version,195);assert(entry.entrada.inbox);assert(entry.entrada.fixed);assert(entry.entrada.territory);assert.equal(entry.cumpleanos.periodo_dias,7);
 const a=JSON.parse(decodeURIComponent(login.headers.get('X-GLD-Consumption'))),b=JSON.parse(decodeURIComponent(dashboard.headers.get('X-GLD-Consumption')));
 assert.equal(a.cloudflare.kv.get_calls,4);assert.equal(b.cloudflare.kv.get_calls,2);assert.equal(a.firestore.read_calls+b.firestore.read_calls,0);assert.equal(a.firestore.write_calls+b.firestore.write_calls,0);assert.equal(a.cloudflare.kv.put_calls+b.cloudflare.kv.put_calls,0);assert.equal(a.cloudflare.kv.list_calls+b.cloudflare.kv.list_calls,0);assert.equal(a.cloudflare.admin_store.calls,1);assert.equal(a.cloudflare.admin_store.rows_read,1);assert.equal(b.cloudflare.admin_store.calls,1);assert.equal(b.cloudflare.admin_store.rows_read,1);
 assert.equal(h.calls.filter(x=>x[0]==='get').length,6);
});

test('copia del ingreso respeta permisos actuales: un moderador no recibe soporte, +18 ni configuración privada',async t=>{
 const h=setup(t,people);await h.op('initial');const packet=await h.op('read');
 packet.admin.inbox.adult=[{nombre:'PRIVADO_ADULTO'}];packet.admin.inbox.support.results=[{nombre:'PRIVADO_SOPORTE'}];
 packet.admin.inbox.moderation={eventos:[{tipo:'EVENTO',ciudad_id:'DOL',id:'E1'},{tipo:'EVENTO',ciudad_id:'OTRA',id:'E2'}],actividades:[],anunciantes:[],cantidades:{}};
 packet.admin.inbox.blocked=[{tipo:'PUBLICIDAD',id:'P1',scope195:['DOL']},{tipo:'PUBLICIDAD',id:'P2',scope195:['DOL','OTRA']}];
 const auth={ok:true,sid:'LOCAL',rol:'ADMIN_LOCAL',ciudades:['DOL'],permisos:{moderacion:{EVENTO:true,PUBLICIDAD:true}}};
 const view=await w.dailyInboxForAuth195(packet,auth);assert.equal(view.moderation.eventos.length,1);assert.equal(view.blocked.length,1);assert.deepEqual(view.adult,[]);assert.deepEqual(view.support.results,[]);assert(!JSON.stringify(view).includes('scope195'));
 packet.admin.inbox.blocked=[{tipo:'PUBLICIDAD',id:'P3',scope195:null}];await assert.rejects(w.dailyInboxForAuth195(packet,auth));
 const denied=await w.dailyDashboard195(h.env,{ok:true,typ:'GLD_SUBSCRIBER'});assert.equal(denied.status,403);
});
test('revocación de sesión se aplica antes de leer la copia diaria y una contraseña incorrecta nunca entrega Inicio',async t=>{
 t.mock.method(console,'log',()=>{});const h=setup(t,people);await h.op('initial');
 const subscriber={id:'P',suscriptor_id:'P',mail:'principal@example.invalid',clave:'ensayo',activo:true},admin={id:'P',suscriptor_id:'P',rol:'SUPERADMIN_PRINCIPAL',activo:true};
 const auth=w.withAuthCacheV58({queryEqual:async()=>[subscriber],get:async()=>admin},h.env);await auth.loginAccount(subscriber.mail,subscriber.clave);await auth.loginAdmin('P');
 let calls=0;const binding=h.env.GLD_PUBLIC_CACHE;h.env.GLD_PUBLIC_CACHE={...binding,get(name){calls++;return binding.get(name);}};
 const bad=await w.default.fetch(new Request('https://test.invalid/superadmin/session/login',{method:'POST',body:JSON.stringify({mail:subscriber.mail,clave:'incorrecta'})}),h.env);assert.equal(bad.status,401);assert.equal(calls,0);
 const token=await w.issue2(h.env,{sid:'P',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:0});h.raw.set('subscriber:session-state:v1:P',JSON.stringify({version:1,deleted:false}));
 const stale=await w.default.fetch(new Request('https://test.invalid/superadmin/dashboard',{headers:{Authorization:'Bearer '+token}}),h.env);assert.equal(stale.status,401);assert.equal(calls,0);
});


test('un fallo de la edición privada no bloquea ni deja sin confirmar el libro público; se registra pendiente y el reintento recupera',async t=>{
 const h=setup(t,people);h.env.GLD_CITY_BOOK_CAPTURE='1';w.setCityIdentity195ForTest(async()=>true);
 const original=h.env.GLD_PUBLIC_CACHE;let failed=true,publicCommits=0;
 h.env.GLD_PUBLIC_CACHE={...original,get(name){const privateStub=original.get(name);return {fetch:async req=>{const b=await req.clone().json();if(b.op==='city-book-checkpoint')return Response.json({cutoff:day});if(b.op==='city-book-commit'){publicCommits++;return Response.json({success:true});}if(failed)throw Error('almacenamiento privado no disponible');return privateStub.fetch(req);}};}};
 const invoke=async op=>{const report={},request=new Request('https://test.invalid/internal/city-books',{method:'POST',body:JSON.stringify({op,cutoff:day,publishedCutoff:day,known:[]})});const r=await w.routeCityBookCut({request,env:h.env,report});assert.equal(r.status,200);return report;};
 assert.equal((await invoke('read')).private_daily195.status,'pending');assert.equal((await invoke('commit')).private_daily195.status,'pending');assert.equal(publicCommits,1);assert.equal((await h.op('read')).preparado,false);
 failed=false;assert.equal((await invoke('read')).private_daily195.status,'staged');assert.equal((await invoke('commit')).private_daily195.status,'committed');assert.equal((await h.op('read')).results.length,4);assert.equal(publicCommits,2);
});
