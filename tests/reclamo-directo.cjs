const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM,ResourceLoader,VirtualConsole}=require(process.env.GLD_JSDOM_MODULE||'jsdom');
const root=path.resolve(__dirname,'..'),person={suscriptor_id:'FIXTURE',nombre:'Cuenta de ensayo',mail:'cuenta@fixture.invalid'},report=[],windows=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class Files extends ResourceLoader{fetch(url){const u=new URL(url);if(u.hostname!=='fixture.invalid')return null;const p=path.join(root,u.pathname);return fs.existsSync(p)?Promise.resolve(fs.readFileSync(p)):null;}}
async function make({url='/reclamar-anuncio',file='login.html',stored=false,status=200,assigned=false}={}){
 const errors=[],calls=[],nav=[],log=new VirtualConsole();log.on('jsdomError',e=>{if(!/navigation|HTMLCanvasElement/.test(e.message))errors.push(e.message);});
 const original=fs.readFileSync(path.join(root,'plataforma',file),'utf8');
 for(const match of original.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:file});
 // JSDOM no navega. Sólo sustituir las dos primitivas del navegador para capturar el destino.
 const html=original.replaceAll('window.location.replace(', 'window.__navigate(').replaceAll('window.top.location.href=destino;', 'window.__navigate(destino);');
 const state={status};
 const dom=new JSDOM(html,{url:'https://fixture.invalid'+url,runScripts:'dangerously',resources:new Files(),pretendToBeVisual:true,virtualConsole:log,beforeParse(w){
  w.Headers=Headers;w.Request=Request;w.Response=Response;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;Object.defineProperty(w.crypto,'subtle',{value:crypto.subtle});w.crypto.randomUUID=crypto.randomUUID.bind(crypto);w.ResizeObserver=class{observe(){} disconnect(){}};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>false;w.matchMedia=()=>({matches:false,addEventListener(){}});w.__navigate=u=>nav.push(u);
  if(stored){w.localStorage.setItem('gld_suscriptor_session_v2',JSON.stringify(person));w.localStorage.setItem('gld_suscriptor_token_v2','FIXTURE-TOKEN');}
  w.fetch=async(url,options={})=>{const u=new URL(String(url)),body=JSON.parse(options.body||'{}'),action=body.action||u.searchParams.get('action');calls.push({path:u.pathname,action,method:options.method||'GET'});let code=200,data={success:true,results:[],ciudades:[],paises:[],provincias:[],anunciantes:[],autorizaciones:[],config:{}};
   if(u.pathname==='/suscriptores'&&['login','session'].includes(action)){code=action==='session'?state.status:200;data={success:code===200,suscriptor:person,token:'FIXTURE-TOKEN',anunciantes:assigned?[{anunciante_id:'A',anunciante_nombre:'Asignado'}]:[],autorizaciones:assigned?[{anunciante_id:'A',anunciante_nombre:'Asignado'}]:[],message:code===401?'Sesión vencida':'No disponible'};}
   if(u.pathname==='/advertisers/claim-options')data={success:true,results:[{id:'EXISTENTE',nombre:'Anuncio existente',ciudad_id:'DOL'}]};
   return Response.json(data,{status:code});
  };
 }});await new Promise(r=>dom.window.addEventListener('load',r));await wait(120);return {dom,w:dom.window,calls,errors,nav,state};
}
async function login(x){x.w.document.getElementById('login-mail').value=person.mail;x.w.document.getElementById('clave').value='ensayo-local';await x.w.document.getElementById('login-form').onsubmit({preventDefault(){}});}
function claim(x){assert(x.w.document.getElementById('panel-alta-anunciante').classList.contains('active'));assert.equal(x.w.document.getElementById('alta-anunciante-modo').value,'RECLAMAR');assert.equal(x.w.document.getElementById('alta-reclamo155').hidden,false);}
async function scenario(name,options,run){const x=await make(options);windows.push(x.w);try{await run(x);assert.deepEqual(x.errors,[]);report.push({name,result:'PASS',calls:x.calls});console.log('PASS',name);}finally{}}
(async()=>{
 await scenario('Ingreso directo sin anunciante; búsqueda sólo al pedirla',{},async x=>{assert(x.w.document.getElementById('panel-login').classList.contains('active'));assert.equal(x.calls.filter(c=>c.action==='session').length,0);await login(x);claim(x);assert.equal(x.calls.filter(c=>c.action==='login').length,1);assert.equal(x.calls.filter(c=>c.action==='session').length,0);assert.equal(x.calls.filter(c=>c.path==='/advertisers/claim-options').length,0);x.w.document.getElementById('alta-reclamo-buscar155').value='Anuncio';await x.w.buscarAnuncioReclamo155();const sel=x.w.document.getElementById('alta-reclamo-id155');sel.value='EXISTENTE';sel.dispatchEvent(new x.w.Event('change'));assert.equal(x.w.document.getElementById('alta-anunciante-nombre').value,'Anuncio existente');});
 await scenario('Sesión válida sin anunciante',{stored:true},async x=>{claim(x);assert.equal(x.calls.filter(c=>c.action==='session').length,1);});
 await scenario('Sesión con anunciante: formulario y cancelar sin reabrir',{stored:true,assigned:true},async x=>{claim(x);assert.equal(x.calls.filter(c=>c.path==='/commerce').length,0);x.w.document.getElementById('btnVolverDesdeAltaAnunciante').click();await wait(80);assert(x.w.document.getElementById('panel-seleccionar-anunciante').classList.contains('active'));});
 await scenario('Sesión vencida: ingreso mantiene destino',{stored:true,status:401},async x=>{assert(x.w.document.getElementById('panel-login').classList.contains('active'));await login(x);claim(x);});
 await scenario('Fallo transitorio y reintento',{stored:true,status:503},async x=>{assert.equal(x.w.localStorage.getItem('gld_suscriptor_token_v2'),'FIXTURE-TOKEN');x.state.status=200;x.w.document.querySelector('#login-msg button').click();await wait(80);claim(x);});
 await scenario('Crear cuenta conserva destino',{},async x=>{x.w.document.getElementById('btnCrearCuentaSuscriptor').click();assert.deepEqual(x.nav,['/mi-guia?vista=registro&continuar=reclamar-anuncio']);});
 await scenario('Verificación y login retornan al reclamo',{file:'suscriptores.html',url:'/mi-guia?vista=registro&continuar=reclamar-anuncio'},async x=>{x.w.document.getElementById('reg-mail').value=person.mail;x.w.document.getElementById('verify-code').value='123456';await x.w.confirmVerification();assert(!x.w.document.getElementById('login-panel').classList.contains('hidden'));x.w.document.getElementById('login-clave').value='ensayo-local';await x.w.login();assert.deepEqual(x.nav,['/reclamar-anuncio']);assert(!x.calls.some(c=>c.action==='favoritos'));});
 await scenario('Registro con sesión existente continúa sin cargar favoritos',{file:'suscriptores.html',url:'/mi-guia?vista=registro&continuar=reclamar-anuncio',stored:true},async x=>{assert.deepEqual(x.nav,['/reclamar-anuncio']);assert(!x.calls.some(c=>c.action==='favoritos'||c.path==='/commerce'));});
 await scenario('Acceso administrativo no se convierte en reclamo',{url:'/anunciantes?administracion=nonce-local&accion=reclamar'},async x=>{assert(x.w.document.getElementById('panel-acceso-administrativo').classList.contains('active'));assert(!x.w.document.getElementById('panel-alta-anunciante').classList.contains('active'));});
 await scenario('Panel ordinario mantiene restricción',{url:'/anunciantes'},async x=>{await login(x);assert(x.w.document.getElementById('panel-no-autorizado').classList.contains('active'));});
 await scenario('Destino externo rechazado',{file:'suscriptores.html',url:'/mi-guia?continuar=https://externo.invalid'},async x=>{x.w.document.getElementById('login-mail').value=person.mail;x.w.document.getElementById('login-clave').value='ensayo-local';await x.w.login();assert.deepEqual(x.nav,[]);assert(!x.w.document.getElementById('profile-view').classList.contains('hidden'));});
 assert(JSON.parse(fs.readFileSync(path.join(root,'firebase.json'))).hosting.rewrites.some(x=>x.source==='/reclamar-anuncio'&&x.destination==='/plataforma/login.html'));
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/reclamo-directo-dom.json',JSON.stringify({date:new Date().toISOString(),environment:'JSDOM 26; API simulada; navegación capturada; sin datos ni consumo reales',report},null,2));
 for(const w of windows)w.close();
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
