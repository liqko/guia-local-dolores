// Regresiones del bloque público P4-0010/P4-0012/P4-0013; sin Worker ni red real.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

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


test('P4-0012/P4-0013: alta, baja, recuperación y error con API autenticada simulada',async()=>{
  const src=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes.html'),'utf8');
  const start=src.indexOf('let gldFavoritosAnunciantes=new Set();');
  const end=src.indexOf('const CITY_CONTEXT_KEY=',start);
  assert(start>=0&&end>start);
  const rows=new Set();
  const reqs=[];
  const storage=new Map();
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const btn={dataset:{anuncianteId:'A-ñ'},classList:{toggle(){}},textContent:'♡',title:'Agregar a favoritos',disabled:false};
  const document={querySelectorAll:()=>[btn]};
  let fail=false;
  const fetch=async (url,opt={})=>{
    const method=opt.method||'GET';
    if(method==='GET'){
      assert.equal(new URL(url).searchParams.get('action'),'favoritos');
      return {ok:true,json:async()=>({success:true,favoritos:[...rows].map(referencia_id=>({referencia_id}))})};
    }
    assert.equal(opt.headers.Authorization,'Bearer TOKEN');
    const body=JSON.parse(opt.body);
    reqs.push(body);
    if(fail)return {ok:false,json:async()=>({success:false,message:'Fallo controlado'})};
    if(body.action==='agregar_favorito')rows.add(body.referencia_id);
    else if(body.action==='quitar_favorito')rows.delete(body.referencia_id);
    else assert.fail('Acción inesperada');
    return {ok:true,json:async()=>({success:true})};
  };
  const api=new Function('localStorage','document','fetch','gldGetSubscriberSession','gldGetSubscriberToken','GLD_SUSCRIPTORES_API','ciudadSeleccionada','gldIsSubscriberLogged','window',src.slice(start,end)+
    ';return {load:gldCargarFavoritosAnunciantes,toggle:gldToggleFavoritoAnunciante,has:id=>gldFavoritosAnunciantes.has(id)}')(
      localStorage,document,fetch,()=>({suscriptor_id:'S-1'}),()=>('TOKEN'),'https://worker.test/suscriptores','DOL',()=>true,{parent:{postMessage(){assert.fail('No debe pedir login')}}});
  const nombre="O'Brien & Hijos <Ñ> \\ Casa";
  await api.toggle(btn,'A-ñ',nombre);
  assert.equal(api.has('A-ñ'),true);
  assert.equal(btn.textContent,'♥');
  assert.equal(btn.disabled,false);
  assert.equal(reqs[0].action,'agregar_favorito');
  assert.equal(reqs[0].nombre_ref,nombre);
  assert.equal(reqs[0].ciudad_id,'DOL');
  await api.load();
  assert.equal(api.has('A-ñ'),true,'GET debe recuperar favorito persistido');
  await api.toggle(btn,'A-ñ',nombre);
  assert.equal(api.has('A-ñ'),false);
  assert.equal(btn.textContent,'♡');
  assert.equal(reqs[1].action,'quitar_favorito');
  await api.load();
  assert.equal(api.has('A-ñ'),false,'GET no debe restaurar tras eliminación persistida');
  fail=true;
  await api.toggle(btn,'A-ñ',nombre);
  assert.equal(api.has('A-ñ'),false,'No confirmar favorito si falla el Worker');
  assert.equal(btn.disabled,false,'Botón habilitado tras error');
  assert.deepEqual(JSON.parse(storage.get('gld_favoritos_anunciantes_v2:S-1')).ids,[]);
});

test('P4-0010: construcción de destinos conserva filtros y ciudad del anunciante',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../plataforma/anunciantes.html'),'utf8');
 const urls=['EVENTS_PAGE_URL','PROMOS_PAGE_URL','ACTIVIDADES_PAGE_URL'].map(k=>{
   const line=src.split('\n').find(x=>x.includes('const '+k+' = '));
   const match=line&&line.match(/https:\/\/[^']+/);
   assert(match,'Falta '+k);
   return new URL(match[0]);
 });
 for(const u of urls){
   assert.equal(u.origin,'https://guialocal.ar');
   assert(['/plataforma/eventos.html','/plataforma/promos.html','/plataforma/actividades.html'].includes(u.pathname));
   u.searchParams.set('ciudad_id','DOL (BUE - ARG)');
   u.searchParams.set('anunciante_id',"A-O'Brien & Hijos");
   const after=new URL(u.href);
   assert.equal(after.searchParams.get('ciudad_id'),'DOL (BUE - ARG)');
   assert.equal(after.searchParams.get('anunciante_id'),"A-O'Brien & Hijos");
 }
});
