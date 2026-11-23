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

test('P4-0005: Actividades publica una vez y evita KV put idéntico; cambios sí actualizan',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../worker/worker206.txt'),'utf8');
 const begin=source.indexOf('async function syncActivityPreparedV2(');
 const end=source.indexOf('async function getActivitiesCityV2(',begin);
 assert(begin>0&&end>begin);
 const sync=new Function('text16','activityCityKeyV2','sort5','isPublic3','putPreparedRelationsV1','GLD_BUSINESS143',source.slice(begin,end)+';return syncActivityPreparedV2')(
  v=>String(v??'').trim(),id=>'activities:city:v2:'+id,
  rows=>rows.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre))),
  a=>a.activo===true,
  async()=>{}, {equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}
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
