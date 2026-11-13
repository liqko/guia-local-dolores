const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='https://fixture.invalid';
const person={suscriptor_id:'FIXTURE',nombre:'Cuenta de ensayo',mail:'cuenta@fixture.invalid'};
const report=[];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.GLD_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 async function scenario(name,{stored=false,status=200,assigned=false,enabled=true,role='PROPIETARIO'}={},run){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),calls=[],errors=[];
  const relation=id=>({anunciante_id:id,anunciante_nombre:'Anunciante '+id,rol:role,permisos_definidos:true,permisos:'',administracion:{funcionalidades:'EVENTOS_FREE'},configuracion_funcionalidades:{EVENTOS_FREE:{activo:enabled}}});
  const relations=assigned?(assigned==='multiple'?[relation('A'),relation('B')]:[relation('A')]):[];
  if(stored)await context.addInitScript(p=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('gld_suscriptor_session_v2',JSON.stringify(p));localStorage.setItem('gld_suscriptor_token_v2','FIXTURE-TOKEN');sessionStorage.setItem('seeded','1');}},person);
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin===origin){
    let p=u.pathname;
    if(['/reclamar-anuncio','/anunciantes','/registrar-anuncio','/cargar-evento-free'].includes(p.replace(/\/$/,'')))p='/plataforma/login.html';
    if(['/mi-guia','/crear-cuenta','/ingresar'].includes(p))p='/plataforma/suscriptores.html';
    if(p.endsWith('.json')&&!fs.existsSync(path.join(root,p)))return route.fulfill({json:{success:true,ciudades:[],paises:[],provincias:[]}});
    try{return await route.fulfill({status:200,body:fs.readFileSync(path.join(root,p)),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'application/json'});}catch{return route.fulfill({status:404,body:''});}
   }
   if(u.hostname==='login.liqkoargentina.workers.dev'){
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});
    const body=route.request().postDataJSON()||{},action=body.action||u.searchParams.get('action');calls.push({path:u.pathname,action,method:route.request().method()});
    let data={success:true,results:[],ciudades:[],paises:[],provincias:[],config:{},anunciantes:[],autorizaciones:[]},code=200;
    if(u.pathname==='/suscriptores'&&['login','session'].includes(action)){
     code=action==='session'?status:200;
     data={success:code===200,suscriptor:person,token:'FIXTURE-TOKEN',anunciantes:relations,autorizaciones:relations,message:code===401?'Sesión vencida':'No disponible'};
    }
    if(u.pathname==='/advertisers/claim-options')data={success:true,results:[{id:'EXISTENTE',nombre:'Anuncio existente',ciudad_id:'DOL'}]};
    if(u.pathname==='/advertiser/terms')data={success:true,aceptada:true,version:'2026-10-11',aceptacion:{usuario_id:person.suscriptor_id,version:'2026-10-11'}};
    if(u.pathname==='/events-new'&&action==='getFreeEventsPanelData')data={success:true,funcionalidades:{eventos_free:true},eventos_free:[],eventos_free_cant:3,eventos_free_limites:{altas_mensuales_max:3,activas_max:3,guardadas_max:6,usados:0},advertiser:{id:'A',nombre:'Anunciante de ensayo'},categorias:[],ciudades:[]};
    return route.fulfill({status:code,json:data,headers:{'Access-Control-Allow-Origin':'*'}});
   }
   return route.fulfill({status:200,body:''});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  try{await run(page,calls,async next=>{status=next;});assert.deepEqual(errors,[],name+': errores JS');report.push({name,result:'PASS',calls});console.log('PASS',name);}finally{await context.close();}
 }
 const claim=async p=>{await p.locator('#panel-alta-anunciante.active').waitFor();assert.equal(await p.locator('#alta-anunciante-modo').inputValue(),'RECLAMAR');assert(await p.locator('#alta-reclamo155').isVisible());};
 const login=async p=>{await p.locator('#login-mail').fill(person.mail);await p.locator('#clave').fill('ensayo-local');await p.locator('#btnLogin').click();};
 try{
  await scenario('Sin sesión: ingreso y formulario sin anunciante asignado',{},async(p,c)=>{await p.goto(origin+'/reclamar-anuncio');await p.locator('#panel-login.active').waitFor();assert.equal(c.filter(x=>x.action==='session').length,0);await login(p);await claim(p);assert.equal(c.filter(x=>x.action==='login').length,1);assert.equal(c.filter(x=>x.action==='session').length,0);assert.equal(c.filter(x=>x.path==='/advertisers/claim-options').length,0);await p.locator('#alta-reclamo-buscar155').fill('Anuncio');await p.getByRole('button',{name:'Buscar anuncio',exact:true}).click();await p.locator('#alta-reclamo-id155 option[value=EXISTENTE]').waitFor({state:'attached'});await p.locator('#alta-reclamo-id155').selectOption('EXISTENTE');assert.equal(await p.locator('#alta-anunciante-nombre').inputValue(),'Anuncio existente');});
  await scenario('Sesión guardada válida sin anunciante',{stored:true},async(p,c)=>{await p.goto(origin+'/reclamar-anuncio/');await claim(p);assert.equal(c.filter(x=>x.action==='session').length,1);});
  await scenario('Sesión guardada con anunciante evita selector y dashboard',{stored:true,assigned:true},async(p,c)=>{await p.goto(origin+'/reclamar-anuncio');await claim(p);assert.equal(c.filter(x=>x.path==='/commerce').length,0);await p.locator('#btnVolverDesdeAltaAnunciante').click();await p.locator('#panel-seleccionar-anunciante.active').waitFor();assert(!await p.locator('#panel-alta-anunciante').isVisible());});
  await scenario('Sesión vencida conserva destino para nuevo ingreso',{stored:true,status:401},async p=>{await p.goto(origin+'/reclamar-anuncio');await p.locator('#panel-login.active').waitFor();await login(p);await claim(p);});
  await scenario('Fallo transitorio conserva sesión y destino',{stored:true,status:503},async(p,c,setStatus)=>{await p.goto(origin+'/reclamar-anuncio');await p.getByRole('button',{name:'Reintentar',exact:true}).waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('gld_suscriptor_token_v2')),'FIXTURE-TOKEN');await setStatus(200);await p.getByRole('button',{name:'Reintentar',exact:true}).click();await claim(p);});
  await scenario('Crear cuenta conserva destino al pasar a ingreso',{},async(p,c)=>{await p.goto(origin+'/reclamar-anuncio');await p.locator('#btnCrearCuentaSuscriptor').click();await p.waitForURL('**/crear-cuenta?continuar=reclamar-anuncio');await p.locator('#tab-login').click();await p.locator('#login-mail').fill(person.mail);await p.locator('#login-panel:not(.hidden)').waitFor();await p.locator('#login-clave').fill('ensayo-local');await p.locator('#login-btn').click();await p.waitForURL('**/reclamar-anuncio');await claim(p);});
  await scenario('Panel ordinario conserva acceso denegado para cuenta sin anuncio',{},async p=>{await p.goto(origin+'/anunciantes');await login(p);await p.locator('#panel-no-autorizado.active').waitFor();});
  await scenario('Destino ajeno no redirige',{},async p=>{await p.goto(origin+'/mi-guia?continuar=https://externo.invalid');await p.locator('#tab-login').click();await p.locator('#login-mail').fill(person.mail);await p.locator('#login-clave').fill('ensayo-local');await p.locator('#login-btn').click();await p.locator('#profile-view:not(.hidden)').waitFor();assert.equal(new URL(p.url()).pathname,'/mi-guia');});
  for(const stored of [false,true])await scenario('Registrar anuncio abre su formulario; sesión '+stored,{stored},async p=>{await p.goto(origin+'/registrar-anuncio');if(!stored)await login(p);await p.locator('#panel-alta-anunciante.active').waitFor();assert.equal(await p.locator('#alta-anunciante-modo').inputValue(),'CREAR');assert(!await p.locator('#alta-reclamo155').isVisible());});
  await scenario('Crear cuenta tiene enlace propio',{},async p=>{await p.goto(origin+'/crear-cuenta');await p.locator('#register-panel:not(.hidden)').waitFor();});
  await scenario('Ingreso tiene enlace propio',{},async p=>{await p.goto(origin+'/ingresar');await p.locator('#login-panel:not(.hidden)').waitFor();});
  for(const stored of [false,true])await scenario('Evento Free abre formulario; sesión '+stored,{stored,assigned:true},async(p,c)=>{await p.goto(origin+'/cargar-evento-free');if(!stored)await login(p);await p.locator('#panel-dashboard.active #eventos-free-panel:not(.hidden-panel)').waitFor();await p.waitForFunction(()=>document.getElementById('eventos-free-msg').hidden===true&&document.getElementById('evf-guardar').textContent.includes('Crear'));await p.waitForTimeout(150);assert.equal(c.filter(x=>x.action==='getFreeEventsPanelData').length,1);assert(!c.some(x=>x.action==='createfreeevent'));await p.locator('#evf-nombre').fill('Ensayo local sin guardar');});
  await scenario('Evento Free elige anunciante cuando hay varios',{stored:true,assigned:'multiple'},async(p,c)=>{await p.goto(origin+'/cargar-evento-free');await p.locator('#panel-seleccionar-anunciante.active').waitFor();assert(!c.some(x=>x.action==='getFreeEventsPanelData'));await p.locator('#anunciantes-autorizados-lista button').first().click();await p.locator('#panel-dashboard.active #eventos-free-panel:not(.hidden-panel)').waitFor();});
  await scenario('Evento sin anuncio informa requisito',{},async(p,c)=>{await p.goto(origin+'/cargar-evento-free');await login(p);await p.locator('#panel-no-autorizado.active').waitFor();assert.match(await p.locator('#panel-no-autorizado .info-banner').textContent(),/anuncio vinculado/);assert(!c.some(x=>x.action==='getFreeEventsPanelData'));});
  for(const config of [{enabled:false},{role:'MANAGER'}])await scenario('Evento respeta permisos '+JSON.stringify(config),{stored:true,assigned:true,...config},async(p,c)=>{await p.goto(origin+'/cargar-evento-free');await p.locator('#panel-dashboard.active').waitFor();await p.waitForFunction(()=>document.getElementById('dashboard-ready-prompt').textContent.includes('no tiene habilitada'));assert(!c.some(x=>x.action==='getFreeEventsPanelData'));assert(!await p.locator('#eventos-free-panel').isVisible());});
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/reclamo-directo.json',JSON.stringify({date:new Date().toISOString(),environment:'Chromium aislado; API simulada, sin credenciales ni mutaciones reales',report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
