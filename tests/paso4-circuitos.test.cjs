// Paso 4: contrapruebas aisladas sin Cloudflare, Firebase ni escritura real.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const login=fs.readFileSync(path.join(__dirname,'../plataforma/login.html'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'../worker/worker206.txt'),'utf8');

test('P4-0002: respuesta incierta de baja de sede recarga por puente del mismo ámbito',async()=>{
  assert.match(login,/window\.gldReloadCommerceUIForVerification_\s*=\s*loadCommerceUI/);
  assert.match(login,/reload:\(\)=>window\.gldReloadCommerceUIForVerification_\(\)/);
  const sedeDelete=login.slice(login.indexOf('async function deleteSedeCard('),login.indexOf("document.addEventListener('click', function(e)",login.indexOf('async function deleteSedeCard(')));
  assert.doesNotMatch(sedeDelete,/reload:\(\)=>loadCommerceUI\(\)/);
  const expression=login.match(/reload:(\(\)=>window\.gldReloadCommerceUIForVerification_\(\))/)?.[1];
  assert(expression,'Falta callback verificable');
  let calls=0;
  const cb=Function('window','return '+expression)({gldReloadCommerceUIForVerification_:async()=>{calls++;return true;}});
  assert.equal(await cb(),true);
  assert.equal(calls,1);
});

test('P4-0009: no se reescribe KV público si Promociones no cambia; sí ante cambios',async()=>{
  const start=worker.indexOf('async function syncPromo(');
  const end=worker.indexOf('async function getPromosCity(',start);
  assert(start>=0&&end>start);
  const src=worker.slice(start,end);
  assert.match(src,/GLD_BUSINESS143\.equal\(packet2\.promos\|\|\[\],sorted\)/);
  let writes=0,adminUpdates=0,reads=0;
  const packet={version:1,ciudad_id:'DOLORES',promos:[{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'}]};
  const cache={get:async()=>{reads++;return packet;},put:async()=>{writes++;}};
  const injected=`
    const text5=v=>String(v??'').trim();
    const promoCityKey=id=>'promos:city:v1:'+id;
    const visible=p=>p.estado!=='PAUSADA';
    const publicPromo=p=>({promo_id:p.promo_id,ciudad_id:p.ciudad_id,promo:p.promo});
    const sort=rows=>[...rows].sort((a,b)=>a.promo.localeCompare(b.promo));
    const GLD_BUSINESS143={equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)};
    const syncAdminPromoV91=async()=>{adminUpdates();};
  `;
  const sync=Function('adminUpdates',injected+src+';return syncPromo')(()=>{adminUpdates++;});
  // Función auxiliar inyectada: en este ensayo no afecta el contador de escrituras públicas.
  await sync({cache,current:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'},next:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'}});
  assert.equal(writes,0,'El paquete idéntico no debe escribirse');
  await sync({cache,current:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'},next:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Otra oferta'}});
  assert.equal(writes,1,'Una modificación visible debe escribir el paquete');
  assert.equal(reads,2,'Se mantiene una lectura por sincronización');
});

test('P4-0010: ficha de Guía apunta al módulo real de Actividades publicado por Hosting',()=>{
  const guide=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes.html'),'utf8');
  const hosting=JSON.parse(fs.readFileSync(path.join(__dirname,'../firebase.json'),'utf8'));
  assert.match(guide,/const ACTIVIDADES_PAGE_URL = 'https:\/\/guialocal\.ar\/plataforma\/actividades\.html';/);
  assert.match(guide,/const EVENTS_PAGE_URL = 'https:\/\/guialocal\.ar\/plataforma\/eventos\.html';/);
  assert.match(guide,/const PROMOS_PAGE_URL = 'https:\/\/guialocal\.ar\/plataforma\/promos\.html';/);
  assert(fs.existsSync(path.join(__dirname,'../plataforma/eventos.html')));
  assert(fs.existsSync(path.join(__dirname,'../plataforma/promos.html')));
  assert(!hosting.hosting.rewrites.some(x=>['/eventos/','/promos/'].includes(x.source)));
  assert.match(guide,/renderActividadesActivasButton\(item\)/);
  assert.match(guide,/destino\.searchParams\.set\('anunciante_id',ids\[0\]\)/);
  assert(fs.existsSync(path.join(__dirname,'../plataforma/actividades.html')));
  assert.equal(hosting.hosting.public,'hosting-public');
  assert(!hosting.hosting.rewrites.some(x=>x.source==='/actividades/'),'No existe rewrite para el enlace antiguo');
});


test('P4-0011: el filtro público acepta el ID real del paquete promocional Worker',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../plataforma/promos.html'),'utf8');
  const worker=fs.readFileSync(path.join(__dirname,'../worker/worker206.txt'),'utf8');
  const start=src.indexOf('function promoMatchesIncomingFilter(');
  const end=src.indexOf('function showPromoFilterNotice(',start);
  assert(start>0&&end>start,'Falta filtro actual de Promos');
  assert.match(worker.slice(worker.indexOf('function publicPromo('),worker.indexOf('function sort(rows)')),/anunciante_id:\s*text5\(p\.anunciante_id/);
  const filter=new Function('normalizeFilterText','promoFilterKey',src.slice(start,end)+';return promoMatchesIncomingFilter')(
    x=>String(x||'').toLowerCase().trim(),
    x=>'id:'+x.promo_id
  );
  const item={promo_id:'P_1',anunciante_id:'ANU_ACP',sede_id:'SEDE_A',promo:'Oferta 1'};
  assert.equal(filter(item,{id_comercio:'ANU_ACP'}),true,'Debe incluir la promoción del anunciante');
  assert.equal(filter(item,{id_comercio:'ANU_OTRO'}),false,'No puede incluir otro anunciante');
  assert.equal(filter(item,{id_comercio:'ANU_OTRO',anunciante:'Otro'}),false);
  assert.equal(filter(item,{id_comercio:'ANU_ACP',sede_id:'SEDE_A'}),true);
});

test('P4-0013: inline Favoritos preserva apóstrofos sin romper callback AUD',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes.html'),'utf8');
  const marker='gldToggleFavoritoAnunciante(this,this.dataset.anuncianteId,';
  const pos=src.indexOf(marker);
  assert(pos>0&&src.indexOf(marker,pos+1)<0,'El onclick debe tener una sola entrada AUD');
  const region=src.slice(pos,pos+400);
  assert.match(region,/safeNombre\.replace\(\/\\\\\/g,"\\\\\\\\"\)/,'Debe escapar backslashes');
  assert.match(region,/\.replace\(\/'\/g,"\\\\x27"\)/,'Debe escapar apóstrofos para literal JS');
  const escaped=name=>name.replace(/\\/g,"\\\\").replace(/'/g,"\\x27").replace(/\r/g,"\\r").replace(/\n/g,"\\n");
  for(const original of ["O'Connor","Barra \\\\ y O'Brien","Otra\nlínea","Sin apóstrofos"]){
    const call="gldToggleFavoritoAnunciante(this,this.dataset.anuncianteId,'"+escaped(original)+"')";
    let passed;
    const invoke=new Function('gldToggleFavoritoAnunciante','return function(){'+call+'}')((btn,id,name)=>{passed=name});
    invoke.call({dataset:{anuncianteId:'A1'}});
    assert.equal(passed,original);
  }
});

test('P4-0012: GET anterior no puede restaurar favorito eliminado luego de POST exitoso',async()=>{
  const src=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes.html'),'utf8');
  const start=src.indexOf('let gldFavoritosAnunciantes=new Set();');
  const end=src.indexOf("const CITY_CONTEXT_KEY=",start);
  assert(start>0&&end>start);
  let resolveGet;
  const fetchStub=async(url,opts={})=>{
    if(opts.method==='GET')return new Promise(resolve=>{resolveGet=resolve});
    assert.equal(opts.method,'POST');
    assert.equal(JSON.parse(opts.body).action,'quitar_favorito');
    return {ok:true,json:async()=>({success:true})};
  };
  const store=new Map([['gld_favoritos_anunciantes_v2:S1',JSON.stringify({ids:['A1']})]]);
  const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  const btn={dataset:{anuncianteId:'A1'},classList:{toggle(){}},textContent:'♥',title:'Quitar de favoritos',disabled:false};
  const document={querySelectorAll:()=>[btn]};
  const api=new Function('localStorage','document','fetch','gldGetSubscriberSession','gldGetSubscriberToken','GLD_SUSCRIPTORES_API','ciudadSeleccionada','gldIsSubscriberLogged',src.slice(start,end)+
    ';return {load:gldCargarFavoritosAnunciantes,toggle:gldToggleFavoritoAnunciante,has:id=>gldFavoritosAnunciantes.has(id)}')(
      localStorage,document,fetchStub,()=>({suscriptor_id:'S1'}),()=>('TOKEN'),'https://example.test/suscriptores','DOL',()=>true);
  const pending=api.load();
  await api.toggle(btn,'A1',"O'Connor");
  resolveGet({ok:true,json:async()=>({success:true,favoritos:[{referencia_id:'A1'}]})});
  await pending;
  assert.equal(api.has('A1'),false,'GET obsoleto no debe pisar POST');
  assert.equal(btn.textContent,'♡');
  assert.deepEqual(JSON.parse(store.get('gld_favoritos_anunciantes_v2:S1')).ids,[]);
});

test('P4-0037: Actividades publica una vez y evita KV put idéntico; cambios sí actualizan',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../worker/worker206.txt'),'utf8');
 const begin=source.indexOf('async function syncActivityPreparedV2(');
 const end=source.indexOf('async function getActivitiesCityV2(',begin);
 assert(begin>0&&end>begin);
 const sync=new Function('text16','activityCityKeyV2','sort5','isPublic3','putPreparedRelationsV1','bool8','GLD_BUSINESS143',source.slice(begin,end)+';return syncActivityPreparedV2')(
  v=>String(v??'').trim(),id=>'activities:city:v2:'+id,
  rows=>rows.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre))),
  a=>a.activo===true,
  async()=>{},v=>v===true, {equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}
 );
 const packets=new Map();let puts=0,gets=0;
 const cache={get:async key=>(gets++,packets.get(key)),put:async(key,v)=>(puts++,packets.set(key,v))};
 const base={actividad_id:'ACT-1',ciudad_id:'DOL',nombre:'Taller',activo:true};
 const horarios=[{ciudad_id:'DOL',activo:true,dia:'LUNES'}];
 await sync({cache,next:base,horarios});
 assert.equal(puts,1,'La primera publicación debe generar paquete');
 await sync({cache,current:base,next:base,horarios,previousCities:['DOL']});
 assert.equal(puts,1,'Una segunda publicación igual no debe escribir KV');
 const changed={...base,nombre:'Taller actualizado'};
 await sync({cache,current:base,next:changed,horarios,previousCities:['DOL']});
 assert.equal(puts,2,'Cambio visible debe persistirse');
 assert.equal(packets.get('activities:city:v2:DOL').actividades[0].nombre,'Taller actualizado');
 assert.equal(gets,3,'Una lectura de paquete por intento');
});

test('P4-0009: índice administrativo Promos evita reescribir igual y conserva bajas',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../worker/worker206.txt'),'utf8');
 const from=src.indexOf('async function syncAdminPromoV91(');
 const to=src.indexOf('/** @param {Record<string, any>} row */',from);
 assert(from>0&&to>from);
 const authority=src.slice(src.indexOf('function publicationAuthority('),src.indexOf('function checkPublicationWrite('));
 const sync=new Function('PROMOS_ADMIN_PREFIX_V91','GLD_BUSINESS143',authority+src.slice(from,to)+';return syncAdminPromoV91')(
  'admin:promos:item:v91:',{equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}
 );
 const store=new Map();let puts=0,gets=0;
 const cache={get:async k=>(gets++,store.get(k)),put:async(k,v)=>(puts++,store.set(k,v))};
 const one={promo_id:'P-1',promo:'Oferta',ciudad_id:'DOL'};
 await sync(cache,null,one);
 assert.equal(puts,1,'Alta escribe índice');
 await sync(cache,one,{...one});
 assert.equal(puts,1,'Repetir la misma proyección no reescribe índice');
 await sync(cache,one,{...one,promo:'Oferta nueva'});
 assert.equal(puts,2,'Cambio de oferta sí escribe');
 await sync(cache,one,null);
 assert.equal(puts,3,'Baja escribe tombstone');
 assert.equal(store.get('admin:promos:item:v91:P-1').deleted,true);
 await sync(cache,one,null);
 assert.equal(puts,3,'Baja idéntica no reescribe tombstone');
 assert.equal(gets,5,'Una comprobación por sincronización');
});


test('P4-0035/P4-0011: alta idempotente recuperada completa la proyección KV pendiente',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../worker/worker206.txt'),'utf8');
 const from=src.indexOf('async function promoCreateV2(');
 const to=src.indexOf('async function promoUpdateV2(',from);
 assert(from>0&&to>from);
 const id='11111111-1111-4111-8111-111111111111';
 const row={promo_id:'PRO-'+id,anunciante_id:'A1',operation_fingerprint143:'same',ciudad_id:'DOL',promo:'Oferta'};
 const actions=[];
 let fail=false;
 const create=new Function('text29','fieldRevisionInternal','httpError','syncPromo',
   src.slice(from,to)+'; return promoCreateV2')(
      v=>String(v??'').trim(),async()=> 'same',(message,status)=>Object.assign(new Error(message),{status}),
      async opts=>{actions.push(opts);if(fail)throw new Error('KV no disponible');}
   );
 const db={get:async(collection,key)=>{assert.equal(collection,'promos');assert.equal(key,row.promo_id);return row;}};
 const body={operation_id:id,payload:{promo:'Oferta'}};
 const recovered=await create({db,cache:{},advertiserId:'A1',body,cupoFromAdmin:()=>1});
 assert.equal(recovered.success,true);
 assert.equal(recovered.operation_recovered,true);
 assert.equal(actions.length,1,'Recuperar alta debe volver a publicar la promoción existente');
 assert.deepEqual(actions[0].next,row);
 fail=true;
 await assert.rejects(create({db,cache:{},advertiserId:'A1',body,cupoFromAdmin:()=>1}),/KV no disponible/,'No confirmar éxito cuando sigue pendiente KV');
 const alien={...row,anunciante_id:'A2'};
 const dbAlien={get:async()=>alien};
 const previous=actions.length;
 await assert.rejects(create({db:dbAlien,cache:{},advertiserId:'A1',body,cupoFromAdmin:()=>1}),/otra promoción/);
 assert.equal(actions.length,previous,'No sincronizar alta idempotente de otro anunciante');
});


test('P4-0020: GH reutiliza carga territorial por sesión pero Actualizar fuerza GET',async()=>{
  const src=fs.readFileSync(path.join(__dirname,'../plataforma/administracion.html'),'utf8');
  const from=src.indexOf('let GH_TERRITORY_PENDING195=null;');
  const to=src.indexOf('function ghDetalleEvento(',from);
  assert(from>0&&to>from);
  let requests=0;
  const fetch=async(_url,_options)=>{requests++;return{ok:true,json:async()=>({success:true,ciudades:[{ciudad_id:'DOL'}]})}};
  const factory=new Function('fetch',`
    let GH_CITIES=[],GH_DAILY_ENTRY195=null,TOKEN='S1';
    const TERRITORY_API_ORIGIN='https://worker.test';
    function ghTerritoryApply195(data){GH_CITIES=data.ciudades||[];}
    ${src.slice(from,to)}
    return {load:ghCargarCiudades,setToken:value=>TOKEN=value};
  `);
  const gh=factory(fetch);
  await Promise.all([gh.load(),gh.load()]);
  assert.equal(requests,1,'Solicitudes concurrentes deben compartir Promise');
  await gh.load();
  assert.equal(requests,1,'Reabrir otra vista en misma sesión no debe leer');
  await gh.load(true);
  assert.equal(requests,2,'Botón Actualizar debe consultar');
  gh.setToken('S2');
  await gh.load();
  assert.equal(requests,3,'Otra sesión no debe reutilizar la copia anterior');
  assert.match(src,/btnCiudadesRefresh'\)\.onclick=async function\(\)\{await ghCargarCiudades\(true\)/);
  assert.match(src,/GLD_CATALOGO_TERRITORIAL\.load\(\)/,'El catálogo público de roles conserva permisos y ruta independiente');
});


test('P4-0039: compartir usa alternativas y nunca informa éxito con popup bloqueado',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes-utilidades.js'),'utf8');
  const gui=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes.html'),'utf8');
  const root={};
  new Function('globalThis','URL',source)(root,URL);
  const datos={id:"A-O'Brien",nombre:"Comercio O'Brien & Cía",sede_id:"S&A",contexto:{ciudad_id:"DOL (BUE - ARG)"}};
  const expected=root.GLD_ANUNCIANTES_UI.urlFicha(datos.id,datos.contexto,datos.sede_id);
  assert.equal(new URL(expected).searchParams.get('anunciante_id'),datos.id);
  assert.equal(new URL(expected).searchParams.get('sede_id'),datos.sede_id);
  let opened='';
  const open=(url)=>{opened=url;return {}};
  const fallback=await root.GLD_ANUNCIANTES_UI.compartir(datos,{},open);
  assert.equal(fallback,'whatsapp');
  assert.equal(new URL(opened).searchParams.get('text').includes(expected),true);
  assert.equal(await root.GLD_ANUNCIANTES_UI.compartir(datos,{},()=>null),'bloqueado');
  assert.equal(await root.GLD_ANUNCIANTES_UI.compartir(datos,{},()=>{throw new Error('Pop-up denegado')}),'bloqueado');
  let copied='';
  assert.equal(await root.GLD_ANUNCIANTES_UI.compartir(datos,{clipboard:{writeText:async value=>{copied=value}}},()=>{throw Error('No abrir')}),'copiado');
  assert(copied.includes(expected));
  let shared=0;
  assert.equal(await root.GLD_ANUNCIANTES_UI.compartir(datos,{share:async()=>{shared++}},()=>null),'compartido');
  assert.equal(shared,1);
  assert.match(gui,/resultado==='bloqueado'/);
  assert.match(gui,/window\.prompt\('No se pudo abrir la opción para compartir/);
  assert.match(gui,/GLD_ANUNCIANTES_UI\.urlFicha\(btn\.dataset\.anuncianteId/);
});


test('P4-0011/P4-0009: reconstruir Promos vacía ciudad con sólo pausadas y omite PUT idéntico',async()=>{
 const from=worker.indexOf('async function rebuildPromosAll({ db, cache }) {'),to=worker.indexOf('\nvar text6 =',from);
 assert(from>0&&to>from);
 const rebuild=new Function('text5','visible','publicPromo','promoCityKey','sort','GLD_BUSINESS143',
  worker.slice(from,to)+';return rebuildPromosAll;')(
   v=>String(v??'').trim(),
   p=>p.pausado!==true&&p.estado_moderacion!=='RECHAZADO',
   p=>({promo_id:p.promo_id,ciudad_id:p.ciudad_id,promo:p.promo}),
   city=>'promos:city:v1:'+city,
   rows=>[...rows].sort((a,b)=>a.promo.localeCompare(b.promo)),
   {equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}
  );
 const stale={version:1,ciudad_id:'DOL',updated_at:'anterior',promos:[{promo_id:'P-A',ciudad_id:'DOL',promo:'Ya pausada'}]};
 const ready={version:1,ciudad_id:'OTRA',updated_at:'anterior',promos:[{promo_id:'P-B',ciudad_id:'OTRA',promo:'Vigente'}]};
 const packets=new Map([['promos:city:v1:DOL',stale],['promos:city:v1:OTRA',ready]]);
 const put=[],get=[];
 const cache={
  get:async key=>{get.push(key);return packets.get(key)||null},
  put:async(key,value)=>{put.push([key,value]);packets.set(key,value)}
 };
 const db={listCollection:async name=>{
  assert.equal(name,'promos');
  return[{promo_id:'P-A',ciudad_id:'DOL',promo:'Ya pausada',pausado:true},
         {promo_id:'P-B',ciudad_id:'OTRA',promo:'Vigente',pausado:false}];
 }};
 const result=await rebuild({db,cache});
 assert.equal(result.success,true);
 assert.deepEqual(packets.get('promos:city:v1:DOL').promos,[],'Un paquete obsoleto no puede seguir mostrando una promo pausada');
 assert.deepEqual(put.map(x=>x[0]),['promos:city:v1:DOL'],'La ciudad con paquete idéntico no necesita otra escritura KV');
 await rebuild({db,cache});
 assert.equal(put.length,1,'Segunda reconstrucción idéntica no escribe KV');
 assert.equal(get.length,4,'Dos lecturas KV por reconstrucción son costo observable del algoritmo');
});


test('P4-0020: un refresco administrativo prevalece sobre copia diaria obsoleta incluso si queda vacío',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../plataforma/administracion.html'),'utf8');
 const start=html.indexOf('let GH_TERRITORY_PENDING195=null;');
 const end=html.indexOf('function ghDetalleEvento(',start);
 assert(start>=0&&end>start);
 let reads=0,returned=[{ciudad_id:'NUEVA'}];
 const fetch=async()=>{reads++;return {ok:true,json:async()=>({success:true,ciudades:returned})};};
 const factory=new Function('fetch',`
   let GH_CITIES=[],GH_DAILY_ENTRY195={territory:{ciudades:[{ciudad_id:'ANTIGUA'}]}},TOKEN='S1';
   const TERRITORY_API_ORIGIN='https://worker.test';
   function ghTerritoryApply195(v){GH_CITIES=v.ciudades||[];}
   ${html.slice(start,end)}
   return {load:ghCargarCiudades,cities:()=>GH_CITIES.map(c=>c.ciudad_id),token:v=>TOKEN=v,daily:v=>GH_DAILY_ENTRY195={territory:v}};
 `);
 const gh=factory(fetch);
 await gh.load();assert.deepEqual(gh.cities(),['ANTIGUA']);assert.equal(reads,0,'Paquete diario evita GET inicial');
 await gh.load(true);assert.deepEqual(gh.cities(),['NUEVA']);assert.equal(reads,1);
 await gh.load();assert.deepEqual(gh.cities(),['NUEVA'],'Copia diaria anterior no debe sobrescribir refresh');
 assert.equal(reads,1);
 returned=[];
 await gh.load(true);assert.deepEqual(gh.cities(),[]);
 await gh.load();assert.deepEqual(gh.cities(),[],'Catálogo vacío fresco no debe reemplazarse por uno antiguo');
 assert.equal(reads,2);
 gh.token('S2');gh.daily({ciudades:[{ciudad_id:'OTRA_SESION'}]});
 await gh.load();assert.deepEqual(gh.cities(),['OTRA_SESION'],'Nueva sesión puede consumir su nuevo paquete diario');
});


test('P3-17 / P4-0029: exportación dinámica Promos GH tiene consumidor real y archivo cargado',()=>{
 const admin=fs.readFileSync(path.join(__dirname,'../plataforma/administracion.html'),'utf8');
 const module=fs.readFileSync(path.join(__dirname,'../plataforma/gh-promos.js'),'utf8');
 const script=admin.match(/<script src="([^"]*gh-promos\.js[^"]*)"/);
 assert(script,'Gran Hermano no carga el módulo Promos');
 assert.match(module,/window\.ghPromosLoadV91\s*=\s*function\s*\(force\s*=\s*false\)/,'No hay exportación del controlador');
 const entry=admin.match(/if\(name==='promos'\)\{[^\n]*window\.ghPromosLoadV91\(\)/);
 assert(entry,'Navegación de GH no invoca la exportación');
 assert.match(admin,/if\(tipo==='PROMO'\)window\.ghPromosLoadV91\?\.\(true\)/,'La resolución de moderación no recarga Promos');
 assert.match(module,/return requestRaw143\(path,body\)/,'La consulta debe seguir el permiso admin');
 assert.match(module,/Authorization:'Bearer '\+TOKEN/);
 // Estas pruebas certifican el enlace estático cruzado, NO sesión ni render funcional live.
});


test('Gran Hermano usa un solo botón de actualización por listado y trae los cambios del servidor',async()=>{
 const admin=fs.readFileSync(path.join(__dirname,'../plataforma/administracion.html'),'utf8');
 const script=fs.readFileSync(path.join(__dirname,'../plataforma/gh-listados.js'),'utf8');
 const elements=new Map();
 const requests=[];
 let revision=1;
 const createElement=()=>({
   children:[],style:{},value:'',
   set id(id){elements.set(id,this);},
   setAttribute(){},
   append(...children){this.children.push(...children);},
   replaceChildren(){this.children=[];},
   before(){},
   set textContent(value){this.text=value;this.children=[];},
   get textContent(){return this.text;}
 });
 for(const id of ['activitiesAll102','ghPromosList','ghPublicidadList'])elements.set(id,createElement());
 const window={};
 const document={getElementById:id=>elements.get(id),createElement};
 const api=async(route,params)=>{
   requests.push({route,params});
   return {preparado:true,total:1,results:[{id:'fixture',titulo:params.tipo+' '+revision,estado:'ACTIVA'}]};
 };
 const openView=Function('window','document','GH_ADMIN_ACCESS','GH_CITIES','ghAdminRequest_','informarAltura',`
   let ghGoView=()=>{},ghRenderEventos=()=>{},ghPublicidadLoad101,ghPublicidadPrepare101,buscarAnu,buscarSus;
   ${script}
   return ghGoView;
 `)(window,document,{rol:'SUPERADMIN'},[{ciudad_id:'DOLORES'}],api,()=>{});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 for(const [view,boxId] of [['promos','ghPromosList'],['publicidad','ghPublicidadList']]){
   const section=admin.match(new RegExp('<section id="view-'+view+'"[^>]*>[\\s\\S]*?</section>'))?.[0];
   assert(section);
   assert.doesNotMatch(section,/>Actualizar listado<\/button>/);
   revision=1;
   openView(view);
   await settle();
   const box=elements.get(boxId);
   assert.equal(box.children[0].children[0].textContent,view+' 1 · ACTIVA');
   const buttons=elements.get('dir-'+view).children.filter(el=>el.textContent==='Actualizar listado');
   assert.equal(buttons.length,1);
   const before=requests.length;
   revision=2;
   buttons[0].onclick();
   await settle();
   assert.equal(requests.length,before+1);
   assert.equal(requests.at(-1).route,'/listados');
   assert.equal(requests.at(-1).params.tipo,view);
   assert.equal(box.children[0].children[0].textContent,view+' 2 · ACTIVA');
 }
});

test('P4-0011: fallo de lectura de Promos GH permite reintento en nueva apertura',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../plataforma/gh-promos.js'),'utf8');
 const start=source.indexOf('window.ghPromosLoadV91=function(');
 const end=source.indexOf('window.ghPromosPrepareV91=',start);
 assert(start!==-1&&end>start);
 const section=source.slice(start,end);
 let attempts=0,loaded=false,prepared=false,loading=null,rows=[],renderCount=0,message='';
 const win={};
 const make=Function('window','el','request','render','state',`
 let loaded=false,prepared=false,loading=null,rows=[];
 ${section}
 return {get loaded(){return loaded;},get rows(){return rows;}};
 `);
 const context=make(win,()=>({set textContent(v){message=v;}}),async()=>{
   attempts++;
   if(attempts===1)throw Error('fallo temporal');
   return {preparado:true,results:[{promo_id:'RECUPERADA'}],next_cursor:null};
 },()=>{renderCount++;});
 await win.ghPromosLoadV91();
 assert.equal(context.loaded,false,'No se debe dejar el flag cargado tras una excepción');
 assert.match(message,/fallo temporal/);
 await win.ghPromosLoadV91();
 assert.equal(attempts,2,'La apertura siguiente debe solicitar de nuevo los datos');
 assert.equal(context.loaded,true);
 assert.equal(context.rows[0].promo_id,'RECUPERADA');
 assert.equal(renderCount,1);
});


test('P4-0011: Gran Hermano comparte la elegibilidad de la copia pública de Promociones',async()=>{
 const {promoStateV91,directoryProjection102,syncPromo}=await import(
  'data:text/javascript;base64,'+Buffer.from(worker+'\nexport {promoStateV91,directoryProjection102,syncPromo};').toString('base64')
 );
 const city='DOL (BUE - ARG)', aid='ACP-SINTETICO';
 const references={advertisers:new Map([[aid,{ciudad_ids:[city]}]]),cities:new Map(),subscribers:new Map()};
 const stored=new Map();
 const cache={get:async key=>stored.get(key),put:async (key,data)=>stored.set(key,data)};
 const base={ciudad_id:city,anunciante_id:aid,estado:'ACTIVA',estado_moderacion:'PUBLICADO',hasta:'2099-12-31'};
 const fixtures=[
  ['activa',{},'ACTIVA'],
  ['inactiva',{estado:'INACTIVA'},'NO PUBLICADA'],
  ['borrador',{estado:'BORRADOR'},'NO PUBLICADA'],
  ['sin-ciudad',{ciudad_id:' '},'NO PUBLICADA'],
  ['pendiente',{estado_moderacion:'PENDIENTE'},'PENDIENTE'],
  ['pausada',{pausado:'sí'},'PAUSADA'],
  ['rechazada',{estado:'RECHAZADA'},'RECHAZADA'],
  ['adulto-sin-aprobacion',{contenido_adulto:true},'NO PUBLICADA'],
 ];
 const rows=[];
 for(const [id,patch,expected] of fixtures){
  const row={...base,...patch,promo_id:id,promo:id};
  rows.push({...row,estado_panel:promoStateV91(row)});
  assert.equal(rows.at(-1).estado_panel,expected,id);
  assert.equal(directoryProjection102(row,'promos',references).estado,expected,id);
  await syncPromo({cache,next:row});
 }
 assert.deepEqual(stored.get('promos:city:v1:'+city).promos.map(row=>row.promo_id),['activa']);
 assert.equal(stored.get('admin:promos:item:v91:borrador').row.estado,'BORRADOR');
 assert.equal(stored.has('promos:city:v1:'),false);
 assert.equal(directoryProjection102({...base,hasta:'2000-01-01'},'promos',references).estado,'VENCIDA');
 assert.equal(directoryProjection102({...base,revision_definitiva:true},'promos',references).estado,'BLOQUEADA');

 const source=fs.readFileSync(path.join(__dirname,'../plataforma/gh-promos.js'),'utf8');
 const suppliedRows=[...rows,{promo_id:'sin-estado-servidor',promo:'Sin estado del servidor',ciudad_id:city}];
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',querySelectorAll:()=>[]});
  return elements.get(id);
 };
 const win={};
 const fetch=async()=>({ok:true,json:async()=>({success:true,preparado:true,results:suppliedRows})});
 Function('window','document','fetch','TERRITORY_API_ORIGIN','TOKEN','ghNorm','GH_CITIES','esc',source)(
  win,{getElementById:element},fetch,'https://worker.test','fixture',String,[],String
 );
 await win.ghPromosLoadV91();
 assert.match(element('ghPromosSummary').textContent,/1 activa\(s\).*4 no publicada\(s\)/);
 element('ghPromosState').value='ACTIVA';
 win.ghPromosFilterV91();
 assert.match(element('ghPromosList').innerHTML,/<b>activa<\/b>/);
 assert.doesNotMatch(element('ghPromosList').innerHTML,/<b>(borrador|inactiva|Sin estado del servidor)<\/b>/);
 element('ghPromosState').value='NO PUBLICADA';
 win.ghPromosFilterV91();
 assert.match(element('ghPromosList').innerHTML,/<b>borrador<\/b>.*NO PUBLICADA/);
});

test('P4-0009: identidad de promo antigua, inválida o distinta no corrompe el paquete',async()=>{
 const start=worker.indexOf('async function syncPromo('),end=worker.indexOf('async function getPromosCity(',start);
 assert(start>=0&&end>start);
 const run=Function('syncAdminPromoV91',`
 const text5=v=>String(v??'').trim();
 const promoCityKey=id=>'promos:'+id;
 const visible=p=>!p.pausado;
 const publicPromo=p=>({...p,promo_id:p.promo_id||p.id});
 const sort=r=>r;
 const GLD_BUSINESS143={equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)};
 ${worker.slice(start,end)}
 return syncPromo;
 `);
 let reads=0,writes=0,admin=0;
 let data={promos:[{id:'P1',promo:'antigua'},{promo_id:'P2',promo:'otra'}]};
 const cache={get:async()=>{reads++;return data;},put:async(k,v)=>{writes++;data=v;}};
 const sync=run(async()=>{admin++;});
 await assert.rejects(sync({cache,next:{ciudad_id:'DOL'}}),/Identidad/);
 await assert.rejects(sync({cache,current:{promo_id:'P1'},next:{promo_id:'P2'}}),/Identidad/);
 await sync({cache});
 assert.deepEqual([reads,writes,admin],[0,0,0]);
 await sync({cache,current:{id:'P1',ciudad_id:'DOL'},next:{promo_id:'P1',ciudad_id:'DOL',promo:'nueva'}});
 assert.deepEqual(data.promos.map(p=>p.promo_id||p.id),['P2','P1']);
 assert.equal(data.promos[1].promo,'nueva');
 await sync({cache,current:{promo_id:'P1',ciudad_id:'DOL'}});
 assert.deepEqual(data.promos.map(p=>p.promo_id||p.id),['P2']);
 assert.deepEqual([reads,writes,admin],[2,2,2]);
});


test('P4-0012: proyección privada confirma bajas históricas y recupera fallo parcial sin repetir escritura',async()=>{
 const a=worker.indexOf('async function executeFavoriteProjection('),b=worker.indexOf('async function listFavoritesV2(',a);
 assert(a>=0&&b>a);
 const run=Function('text','typeOf','favoriteDocId','httpError',worker.slice(a,b)+';return executeFavoriteProjection;')(
  v=>String(v??'').trim(),v=>['ANUNCIANTE','EVENTO','PROMO','ACTIVIDAD','CIUDAD'].includes(String(v??'').toUpperCase())?String(v).toUpperCase():'',
  async(s,t,r)=>'FAV-'+s+'-'+t+'-'+r,(m,status)=>Object.assign(Error(m),{status}));
 const source=new Map([['OLD',{id:'OLD',suscriptor_id:'S',tipo:'ANUNCIANTE',referencia_id:'A',activo:true}],
 ['FAV-S-ANUNCIANTE-A',{id:'FAV-S-ANUNCIANTE-A',suscriptor_id:'S',tipo:'ANUNCIANTE',referencia_id:'A',activo:true}],
 ['B',{id:'B',suscriptor_id:'S',tipo:'ANUNCIANTE',referencia_id:'B',activo:true}]]);
 let packet=null,reads=0,writes=0,commits=0,storeReads=0,storeWrites=0,fail=false;
 const db={queryEqual:async(c,f,sid)=>{assert.equal(c,'suscriptor_favoritos');reads++;return [...source.values()].filter(r=>r.suscriptor_id===sid);},
 commitPatches:async entries=>{commits++;for(const e of entries){writes++;if(e.remove)source.delete(e.id);else source.set(e.id,{...source.get(e.id),...e.patch,id:e.id});}if(fail)throw Error('lost ack');}};
 const call=(command,sid='S')=>run({sid,command,db,load:async()=>{storeReads++;return packet?structuredClone(packet):null;},save:async p=>{storeWrites++;packet=structuredClone(p);}});
 assert.equal((await call({action:'list'})).favoritos.length,2);
 await call({action:'remove',tipo:'ANUNCIANTE',ref:'A'});
 assert.deepEqual((await call({action:'list'})).favoritos.map(x=>x.referencia_id),['B']);
 assert(!source.has('OLD')&&!source.has('FAV-S-ANUNCIANTE-A'));
 assert.deepEqual([reads,writes,commits,storeReads,storeWrites],[1,2,1,3,3]);
 await call({action:'remove',tipo:'ANUNCIANTE',ref:'A'});
 assert.deepEqual([reads,writes,commits,storeWrites],[1,2,1,3]);
 await assert.rejects(call({action:'list'},'OTRA'),/Identidad/);
 fail=true;await assert.rejects(call({action:'add',tipo:'ANUNCIANTE',ref:'C',nombre_ref:'C'}),/lost ack/);
 assert.equal(packet.dirty,true);
 fail=false;assert.deepEqual((await call({action:'list'})).favoritos.map(x=>x.referencia_id),['B','C']);
 await call({action:'add',tipo:'ANUNCIANTE',ref:'C',nombre_ref:'C'});
 assert.deepEqual([reads,writes,commits,storeWrites],[2,3,2,5]);
});
test('P4-0027: el encabezado distingue la copia GH de la autorización',()=>{
 const a=worker.indexOf('function consumption136(report)');
 const b=worker.indexOf('function consumptionBase136(report)',a);
 const measure=Function('consumptionBase136',worker.slice(a,b)+';return consumption136;')(
  ()=>({cloudflare:{kv:{get_calls:0},auth_store:{calls:1}},coverage:{missing:[]}}));
 const gh={calls:1,rows_read:1,rows_written:0,cache_misses:1,kv:{get_calls:3,list_calls:1}};
 const report=measure({gh_detail_store204:gh});
 assert.deepEqual(report.cloudflare.gh_detail_store,gh);
 assert.equal(report.cloudflare.auth_store.calls,1);
 assert.equal(report.cloudflare.kv.get_calls,0);
});

test('P4-0006: verificación compacta aplica la máscara y no guarda contenido provisional',async t=>{
 const start=worker.indexOf('function compactPublicVisibility('), end=worker.indexOf('async function routeAdult(',start);
 assert(start>=0&&end>start);
 let authorizations=0;
 const run=Function('adultGrant','adultPublic',worker.slice(start,end)+';return adultPublicResponse;')(
  async()=>{authorizations++;return false;},value=>value);
 const input={success:true,promos:[{promo_id:'P',descripcion:'x'.repeat(3000)},{promo_id:'R',sedes:[{bloqueado18:true}]}]};
 const spec={field:'promos',id:'promo_id'};
 const normal=await run(Response.json(input),{},{}),compact=await run(Response.json(input),{},{},spec);
 assert.deepEqual(await normal.json(),input);
 const result=await compact.text();
 assert.deepEqual(JSON.parse(result),{success:true,promos:[{promo_id:'P'},{promo_id:'R',bloqueado18:true}]});
 assert.equal(authorizations,2);
 assert.equal(compact.headers.get('Cache-Control'),'private, no-store');
 assert(Buffer.byteLength(result)<Buffer.byteLength(JSON.stringify(input)));
 t.diagnostic('Bytes de cuerpo simulados: '+Buffer.byteLength(JSON.stringify(input))+' → '+Buffer.byteLength(result));

 const source=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes.html'),'utf8');
 const from=source.indexOf('    function obtenerModuloCiudad('),to=source.indexOf('    async function obtenerEventosPromise(',from);
 const requests=[],saved=[];
 const loader=Function('moduloPromises','gldLeerModuloCache','gldFetchJson','gldGuardarModuloCache',
  source.slice(from,to)+';return obtenerModuloCiudad;')(new Map(),()=>null,
   async(url,options)=>{requests.push([new URL(url).searchParams.get('vista'),options.cache]);return {data:{success:true}};},
   (...args)=>saved.push(args));
 await Promise.all([loader('https://local.invalid/promos','p','', 'DOL',true,true),loader('https://local.invalid/promos','p','', 'DOL',true,true)]);
 assert.deepEqual(requests,[['visibilidad','no-store']]);
 assert.deepEqual(saved,[]);
 await loader('https://local.invalid/promos','p','', 'DOL');
 assert.equal(saved.length,1);
});

test('P4-0025: la base de relaciones omite la revisión sin perder bajas de deltas',async()=>{
 const base=worker.slice(worker.indexOf('  async function revision(key)'),worker.indexOf('  async function relationRows('));
 const reader=worker.slice(worker.indexOf('  const advertiserRelationKey104='),worker.indexOf('  async function relationOwners('));
 assert(base&&reader);
 const key='gh:advertiser-relations:v104:A';
 const stored=new Map([
  [key+':initial',JSON.stringify({version:46,data:[{id:'A-1'},{id:'A-2'}]})],
  [key+':delta:A-1',JSON.stringify({id:'A-1',deleted:true})],
  [key+':delta:A-3',JSON.stringify({id:'A-3',data:{id:'A-3'}})]
 ]);
 async function run(code){
  const calls=[];
  const kv={async get(k){calls.push(['get',k]);return stored.get(k);},
   async list({prefix}){calls.push(['list',prefix]);return {keys:[...stored.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};}};
  const read=Function('kv','text','db','remember','dirty',base+code+';return cachedAdvertiserRelations104;')(
   kv,v=>String(v??''),{queryEqual(){assert.fail('La base caliente no requiere Firestore');}},(_c,rows)=>rows,new Set());
  return {rows:await read('A'),calls};
 }
 const before=await run(reader.replace("read(key,'initial')","read(key)"));
 const after=await run(reader);
 assert.deepEqual(after.rows,[{id:'A-2'},{id:'A-3'}]);
 assert.deepEqual(after.rows,before.rows);
 assert.deepEqual(before.calls,[['get',key+':revision'],...after.calls]);
 assert.equal(after.calls.filter(([op])=>op==='list').length,1);
});

test('P4-0035-T08: Favoritos devuelve 401 ante una sesión denegada',async()=>{
 const a=worker.indexOf('async function sessionOrThrow(');
 const b=worker.indexOf('// Single private projection',a);
 assert(a>=0&&b>a);
 const verify=Function('verifySubscriberSession','httpError',worker.slice(a,b)+';return sessionOrThrow;');
 const error=(message,status)=>Object.assign(Error(message),{status});
 const denied=verify(async()=>({ok:false,message:'Sesión vencida'}),error);
 await assert.rejects(denied({},{}),{status:401,message:'Sesión vencida'});
 const allowed={ok:true,sid:'A'};
 assert.equal(await verify(async()=>allowed,error)({},{}),allowed);
});

test('P4-0012: rutas de favoritos usan proyección serializada e identidad autenticada',()=>{
 const a=worker.indexOf('async function listFavoritesV2('),b=worker.indexOf('return {listFavoritesV2',a);
 const src=worker.slice(a,b);
 assert.equal((src.match(/sessionOrThrow\(env,request\)/g)||[]).length,3);
 assert.equal((src.match(/favoriteProjectionCommand\(env,text\(session.sid\)/g)||[]).length,3);
 assert.match(worker,/body\.op==='private-favorites'\)return await this\.privateFavoritesProjection\(body\)/);
 assert.match(worker,/private_favorites_store=report\.private_favorites_store/);
});



test('P4-0001: el manifiesto PWA de raiz entra en el artefacto de Firebase Hosting',()=>{
  const yaml=fs.readFileSync(path.join(__dirname,'../.github/workflows/firebase-hosting-merge.yml'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.webmanifest'),'utf8'));
  const firebase=JSON.parse(fs.readFileSync(path.join(__dirname,'../firebase.json'),'utf8'));
  assert.equal(firebase.hosting.public,'hosting-public');
  assert.match(yaml,/cp manifest\.webmanifest hosting-public\/manifest\.webmanifest/);
  assert.match(yaml,/git diff --name-only "[^"]+" "\$GITHUB_SHA" -- plataforma\/ firebase\.json manifest\.webmanifest/);
  assert.match(yaml,/cron: ["']0 4 \* \* \*["']/,'Corte a las 01:00 Argentina (UTC-3)');
  assert.equal(manifest.start_url,'/elegi-tu-ciudad');
  assert(manifest.icons.some(x=>x.src&&fs.existsSync(path.join(__dirname,'..',x.src.replace(/^\//,'')))));
  for(const page of ['inicio.html','carcasa.html','suscriptores.html','app-prueba.html']){
    const html=fs.readFileSync(path.join(__dirname,'../plataforma',page),'utf8');
    assert.match(html,/\/manifest\.webmanifest/,page+' debe referenciar el manifiesto');
  }
});

test('E2: autenticación compartida por petición, entorno y rol sin contaminar permisos',async()=>{
 const start=worker.indexOf('var GLD_ACTIONS138 = (() => {');
 const end=worker.indexOf(' function identify(path,method)',start);
 assert(start>=0&&end>start);
 const core=Function(worker.slice(start,end)+'return {authenticate,seed};})();return GLD_ACTIONS138;')();
 let admin=0,subscriber=0;
 const env={},request={};
 const av=async()=>{admin++;return {ok:true,rol:'SUPERADMIN',nested:{value:1}};};
 const sv=async()=>{subscriber++;return {ok:false,message:'No subscriber'};};
 const [a,b,s]=await Promise.all([core.authenticate(env,request,av),core.authenticate(env,request,av),core.authenticate(env,request,sv,'subscriber')]);
 assert.equal(admin,1);assert.equal(subscriber,1);assert.equal(s.ok,false);
 a.nested.value=99;assert.equal(b.nested.value,1);
 assert.equal((await core.authenticate(env,request,av)).nested.value,1);
 await core.authenticate({},request,av);await core.authenticate(env,{},av);assert.equal(admin,3);
 const seeded={};core.seed(env,seeded,{ok:true,rol:'SUPERADMIN'},{});
 assert.equal((await core.authenticate(env,seeded,av)).rol,'SUPERADMIN');
 assert.equal((await core.authenticate(env,seeded,sv,'subscriber')).ok,false);
 assert.equal(admin,3);assert.equal(subscriber,2);
 assert.match(worker,/verifySubscriberSessionRaw143,'subscriber'/);
});
