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
 const sync=new Function('PROMOS_ADMIN_PREFIX_V91','GLD_BUSINESS143',src.slice(from,to)+';return syncAdminPromoV91')(
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
