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
