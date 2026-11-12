const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='https://fixture.invalid';
const person={suscriptor_id:'FIXTURE',nombre:'Cuenta de ensayo',mail:'cuenta@fixture.invalid'};
const report=[];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.GLD_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 async function scenario(name,{stored=false,status=200,assigned=false}={},run){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),calls=[],errors=[];
  if(stored)await context.addInitScript(p=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('gld_suscriptor_session_v2',JSON.stringify(p));localStorage.setItem('gld_suscriptor_token_v2','FIXTURE-TOKEN');sessionStorage.setItem('seeded','1');}},person);
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin===origin){
    let p=u.pathname;
    if(['/reclamar-anuncio','/anunciantes'].includes(p.replace(/\/$/,'')))p='/plataforma/login.html';
    if(p==='/mi-guia')p='/plataforma/suscriptores.html';
    try{return await route.fulfill({status:200,body:fs.readFileSync(path.join(root,p)),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'application/json'});}catch{return route.fulfill({status:404,body:''});}
   }
   if(u.hostname==='login.liqkoargentina.workers.dev'){
    const body=route.request().postDataJSON()||{},action=body.action||u.searchParams.get('action');calls.push({path:u.pathname,action,method:route.request().method()});
    let data={success:true,results:[],ciudades:[],paises:[],provincias:[],config:{},anunciantes:[],autorizaciones:[]},code=200;
    if(u.pathname==='/suscriptores'&&['login','session'].includes(action)){
     code=action==='session'?status:200;
     data={success:code===200,suscriptor:person,token:'FIXTURE-TOKEN',anunciantes:assigned?[{anunciante_id:'A',anunciante_nombre:'Asignado'}]:[],autorizaciones:assigned?[{anunciante_id:'A',anunciante_nombre:'Asignado'}]:[],message:code===401?'Sesión vencida':'No disponible'};
    }
    if(u.pathname==='/advertisers/claim-options')data={success:true,results:[{id:'EXISTENTE',nombre:'Anuncio existente',ciudad_id:'DOL'}]};
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
  await scenario('Crear cuenta conserva destino al verificar e ingresar',{},async(p,c)=>{await p.goto(origin+'/reclamar-anuncio');await p.locator('#btnCrearCuentaSuscriptor').click();await p.waitForURL('**/mi-guia?vista=registro&continuar=reclamar-anuncio');await p.locator('#reg-mail').fill(person.mail);await p.locator('#verify-code').fill('123456');await p.evaluate(()=>confirmVerification());await p.locator('#login-panel:not(.hidden)').waitFor();await p.locator('#login-clave').fill('ensayo-local');await p.locator('#login-btn').click();await p.waitForURL('**/reclamar-anuncio');await claim(p);});
  await scenario('Panel ordinario conserva acceso denegado para cuenta sin anuncio',{},async p=>{await p.goto(origin+'/anunciantes');await login(p);await p.locator('#panel-no-autorizado.active').waitFor();});
  await scenario('Destino ajeno no redirige',{},async p=>{await p.goto(origin+'/mi-guia?continuar=https://externo.invalid');await p.locator('#tab-login').click();await p.locator('#login-mail').fill(person.mail);await p.locator('#login-clave').fill('ensayo-local');await p.locator('#login-btn').click();await p.locator('#profile-view:not(.hidden)').waitFor();assert.equal(new URL(p.url()).pathname,'/mi-guia');});
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/reclamo-directo.json',JSON.stringify({date:new Date().toISOString(),environment:'Chromium aislado; API simulada, sin credenciales ni mutaciones reales',report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
