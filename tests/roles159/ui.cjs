const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM,ResourceLoader,VirtualConsole}=require(process.env.GLD_JSDOM_MODULE||'jsdom');
const root=path.resolve(__dirname,'../..');
class Files extends ResourceLoader{fetch(url){const u=new URL(url);if(u.hostname!=='test.invalid')return null;const file=path.join(root,u.pathname);return fs.existsSync(file)?Promise.resolve(fs.readFileSync(file)):null;}}
for(const file of ['plataforma/login.html','plataforma/granhermano.html']){const html=fs.readFileSync(path.join(root,file),'utf8');for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:file});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function make(admin,deliver=true){
 const errors=[],requests=[];const logs=new VirtualConsole();logs.on('jsdomError',error=>{if(!/navigation|HTMLCanvasElement/.test(error.message))errors.push(error.message);});
 const dom=new JSDOM(fs.readFileSync(path.join(root,'plataforma/login.html'),'utf8'),{url:'https://test.invalid/plataforma/login.html'+(admin?'?administracion=nonce155':''),runScripts:'dangerously',resources:new Files(),pretendToBeVisual:true,virtualConsole:logs,beforeParse(w){
  w.Headers=Headers;w.Request=Request;w.Response=Response;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;Object.defineProperty(w.crypto,'subtle',{value:crypto.subtle});w.crypto.randomUUID=crypto.randomUUID.bind(crypto);w.ResizeObserver=class{observe(){} disconnect(){}};w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>false;w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.localStorage.setItem('gld_suscriptor_token_v2','PERSONAL-TOKEN');w.localStorage.setItem('comercio_id','PERSONAL-A');
  w.fetch=async(url,options={})=>{const u=new URL(String(url)),action=u.searchParams.get('action')||JSON.parse(options.body||'{}').action;requests.push({url:String(url),action,auth:new Headers(options.headers).get('Authorization')});let data={success:true,results:[],ciudades:[],paises:[],provincias:[],anunciantes:[],config:{},sedes:[]};
   if(u.pathname==='/advertisers/claim-options')data={success:true,results:[{id:'A',nombre:'Mismo nombre',ciudad_ids:['D']},{id:'B',nombre:'Mismo nombre',ciudad_ids:['D']},{id:'C',nombre:'Otra ciudad',ciudad_ids:['OTRA']}]};
   if(u.pathname==='/commerce')data={success:true,id:'A',administracion:{nivel:4,funcionalidades:[]},advertiser:{id:'A',datos:{id:'A',nombre:'Comercio'},administracion:{nivel:4,funcionalidades:[]},sedes:[],segmentos:[],categorias:[],actividades_clave:[],acciones:[],revision_datos:'a'.repeat(64)}};
   if(u.pathname==='/commerce/team')data={success:true,results:[{suscriptor_id:'S',rol:'PROPIETARIO',activo:true,persona:{suscriptor_id:'S',nombre:'Titular',mail:'titular@test.invalid'},revision:'owner-rev'},{suscriptor_id:'M',rol:'MANAGER',activo:true,permisos:'EVENTOS',permisos_definidos:true,persona:{suscriptor_id:'M',nombre:'Colaborador',mail:'manager@test.invalid'},revision:'manager-rev'}],funcionalidades:['EVENTOS','PROMOS','PUBLICIDAD','EMPLEO'],revision_nueva:'new-rev'};
   if(u.pathname==='/commerce/team/responsables'){const body=JSON.parse(options.body);data={success:true,updated:true,relacion:{...body,permisos:body.permisos.join(', '),permisos_definidos:true},revision:'saved-rev',message:'Permisos guardados.'};}
   if(u.pathname==='/commerce/team/search')data={success:true,results:[]};
   if(u.pathname==='/advertiser/terms')data={success:true,aceptada:true,version:'2026-10-11',terms:{version:'2026-10-11'}};
   return Response.json(data);
  };
  if(admin&&deliver)w.opener={postMessage(message){if(message.type==='gld-admin-ready155')setTimeout(()=>w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w.opener,data:{type:'gld-admin-panel155',nonce:'nonce155',grant:{success:true,token:'SCOPED-ADMIN-TOKEN',relacion:{anunciante_id:'A',anunciante_nombre:'Comercio',rol:'ADMINISTRADOR',permisos:''},administracion:{nivel:4,funcionalidades:[]}}}})),0);}};
 }});
 await new Promise(resolve=>dom.window.addEventListener('load',resolve));await wait(1200);return {dom,errors,requests};
}
(async()=>{
 let x=await make(false);const w=x.dom.window;
 w.eval("sesionSuscriptor={suscriptor_id:'S'};gldSubscriberToken='PERSONAL-TOKEN';gldTerritoryPublic_=async()=>({ciudades:[{ciudad_id:'D',ciudad_visible:'Dolores'},{ciudad_id:'OTRA',ciudad_visible:'Castelli'}]});abrirSolicitudAnunciante_('RECLAMAR')");await wait(20);
 const city=w.document.getElementById('alta-reclamo-ciudad');city.value='D';city.dispatchEvent(new w.Event('change'));await wait(20);
 const select=w.document.getElementById('alta-reclamo-id155');assert.equal(select.options.length,3);const claimInput=w.document.getElementById('alta-reclamo-buscar155');claimInput.value='Mismo nombre · B';claimInput.dispatchEvent(new w.Event('change'));assert(![...select.options].some(o=>o.value==='C'));assert.equal(w.document.getElementById('alta-anunciante-nombre').value,'Mismo nombre');assert.equal(select.selectedOptions[0].value,'B');assert.equal(w.localStorage.getItem('comercio_id'),'PERSONAL-A');
 assert.deepEqual(x.errors,[]);
 x=await make(true);assert.deepEqual(x.errors,[]);assert(x.dom.window.document.getElementById('panel-dashboard').classList.contains('active'),'admin dashboard opens');assert(x.dom.window.document.getElementById('panel-dashboard').textContent.includes('Acceso administrativo de Gran Hermano'));
 assert.equal(x.dom.window.localStorage.getItem('gld_suscriptor_token_v2'),'PERSONAL-TOKEN');assert.equal(x.dom.window.localStorage.getItem('comercio_id'),'PERSONAL-A');
 const privateRequests=x.requests.filter(r=>r.url.includes('/commerce'));assert(privateRequests.length);assert(privateRequests.every(r=>r.auth==='Bearer SCOPED-ADMIN-TOKEN'));
 const gh=new JSDOM('<div id="detalle"></div><div id="detalleSuscriptor"></div>',{url:'https://test.invalid/plataforma/granhermano.html',runScripts:'dangerously'});
 const g=gh.window;g.eval('var GH_ADMIN_ACCESS={rol:"SUPERADMIN_PRINCIPAL"};'+fs.readFileSync(path.join(root,'plataforma/accesos155.js'),'utf8'));g.ghGoView=()=>{};g.detalleSus=()=>{};g.detalleAnu=async()=>{};g.ghAdminRequest_=async(path,body)=>{g.saved={path,body};return {success:true};};
 g.ghRenderAdvertiserAccess155({propietarios:[{nombre:'Diego',mail:'titular@test.invalid',whatsapp:'123'}],relaciones:[{suscriptor_id:'S',rol:'PROPIETARIO'}],revision_vinculo_nuevo:'new'},'A');
 assert(g.document.getElementById('ghOpenPanel155'));assert(g.document.getElementById('detalle').textContent.includes('Diego · titular@test.invalid'));assert(!g.document.querySelector('input,select,form'));assert(!g.document.getElementById('detalle').textContent.includes('Recuperar acceso'));assert(!g.document.getElementById('detalle').textContent.includes('coadministrador'));
 // Current GH controls are offered only after the Worker advertises the ownership revision.
 g.document.getElementById('detalle').replaceChildren();
 const ownershipData={propietarios:[{suscriptor_id:'S',nombre:'Titular actual',mail:'titular@test.invalid'}],relaciones:[{suscriptor_id:'S',rol:'PROPIETARIO',activo:true,revision:'owner-rev'},{suscriptor_id:'M',rol:'MANAGER',activo:true,revision:'manager-rev'}],revision_vinculo_nuevo:'new-rev',revision_titularidad:'ownership-rev'};
 let confirms=0,reloads=[],ownershipRequests=[];
 g.confirm=()=>{confirms++;return true;};g.detalleAnu=async id=>{reloads.push(id);};
 g.ghAdminRequest_=async(path,body,method)=>{ownershipRequests.push({path,body,method});if(method==='POST')return {success:true};return {success:true,results:[{suscriptor_id:'M',nombre:'Manager',mail:'manager@test.invalid'}]};};
 g.ghRenderAdvertiserAccess155(ownershipData,'A');
 const ownershipCard=g.document.querySelector('.gh-access155'),ownershipSearch=ownershipCard.querySelector('input[type=email]');
 assert(ownershipSearch);assert(ownershipCard.textContent.includes('Administrar titularidad'));assert.equal(ownershipRequests.length,0,'no lookup before action');
 ownershipSearch.value='manager@test.invalid';[...ownershipCard.querySelectorAll('button')].find(x=>x.textContent==='Buscar usuario').click();await wait(10);
 const assign=[...ownershipCard.querySelectorAll('button')].find(x=>x.textContent.startsWith('Asignar titularidad a'));assert(assign);assign.click();await wait(10);
 assert.equal(ownershipRequests[0].path,'/advertisers/A/responsables');assert.equal(ownershipRequests[0].body.q,'manager@test.invalid');
 assert.equal(ownershipRequests[1].method,'POST');assert.deepEqual(JSON.parse(JSON.stringify(ownershipRequests[1].body)),{suscriptor_id:'M',rol:'PROPIETARIO',activo:true,revision:'manager-rev',revision_titularidad:'ownership-rev'});assert.deepEqual(reloads,['A']);assert.equal(confirms,1);
 [...ownershipCard.querySelectorAll('button')].find(x=>x.textContent==='Revocar titularidad').click();await wait(10);
 assert.equal(ownershipRequests.at(-1).body.activo,false);assert.equal(ownershipRequests.at(-1).body.suscriptor_id,'S');assert.equal(ownershipRequests.at(-1).body.revision,'owner-rev');
 // Cancellation and stale view never write to a different advertiser.
 const count=ownershipRequests.length;g.confirm=()=>false;assign.click();await wait(10);assert.equal(ownershipRequests.length,count);
 g.document.getElementById('detalle').replaceChildren();g.ghRenderAdvertiserAccess155(ownershipData,'B');g.confirm=()=>true;assign.click();await wait(10);assert.equal(ownershipRequests.length,count);
 g.document.getElementById('detalle').replaceChildren();g.eval("GH_ADMIN_ACCESS={rol:'ADMIN_LOCAL'}");g.ghRenderAdvertiserAccess155(ownershipData,'A');assert.equal(g.document.getElementById('detalle').children.length,0);
 g.eval("GH_ADMIN_ACCESS={rol:'SUPERADMIN_PRINCIPAL'}");
 // Waiting for a GH handoff never offers or submits the personal password form.
 const pending=await make(true,false);assert(pending.dom.window.document.getElementById('panel-acceso-administrativo').classList.contains('active'));assert(!pending.dom.window.document.getElementById('panel-login').classList.contains('active'));
 const pendingBefore=pending.requests.length;pending.dom.window.document.getElementById('login-form').dispatchEvent(new pending.dom.window.Event('submit',{bubbles:true,cancelable:true}));await wait(10);assert.equal(pending.requests.length,pendingBefore);
 // Delegation is lazy, owner-only, and reuses the result of each save.
 const owner=await make(false),ow=owner.dom.window;
 ow.GLD_EQUIPO159.mount({aid:'A',role:'PROPIETARIO',base:'https://login.liqkoargentina.workers.dev',headers:()=>({Authorization:'Bearer OWNER'})});
 const section=ow.document.getElementById('equipo-anunciante159');assert.equal(section.hidden,false);assert.equal(owner.requests.filter(r=>new URL(r.url).pathname==='/commerce/team').length,0);
 section.open=true;await wait(60);assert.equal(owner.requests.filter(r=>new URL(r.url).pathname==='/commerce/team').length,1);assert(ow.document.getElementById('equipo-lista159').textContent.includes('Titular'));
 ow.document.querySelector('#equipo-lista159 button').click();assert.equal(ow.document.getElementById('equipo-rol159').value,'MANAGER');assert(!ow.document.querySelector('#equipo-funciones159 input[value=MODIFICAR_DATOS]'));
 const selectRole=ow.document.getElementById('equipo-rol159');selectRole.value='ADMINISTRADOR';selectRole.dispatchEvent(new ow.Event('change'));ow.document.querySelector('#equipo-funciones159 input[value=MODIFICAR_DATOS]').checked=true;
 const teamForm=ow.document.getElementById('equipo-form159'),submitTeam=teamForm.querySelector('[type=submit]');await teamForm.onsubmit({preventDefault(){},submitter:submitTeam});assert.equal(owner.requests.filter(r=>new URL(r.url).pathname==='/commerce/team/responsables').length,1);assert.equal(owner.requests.filter(r=>new URL(r.url).pathname==='/commerce/team').length,1);
 await teamForm.onsubmit({preventDefault(){},submitter:submitTeam});assert.equal(owner.requests.filter(r=>new URL(r.url).pathname==='/commerce/team/responsables').length,1);
 ow.eval("sesion={id:'A',relacion_autorizacion:{rol:'MANAGER',permisos:'EVENTOS',permisos_definidos:true}}");assert.equal(ow.gldRelacionPermiteModulo('modificar_datos'),false);assert.equal(ow.gldRelacionPuedeEliminarAnunciante(),false);assert.equal(ow.gldRelacionPermiteModulo('eventos'),true);assert.equal(ow.gldRelacionPermiteModulo('publicidad'),false);
 ow.eval("sesion.relacion_autorizacion={rol:'ADMINISTRADOR',permisos:'',permisos_definidos:true}");assert.equal(ow.gldRelacionPermiteModulo('modificar_datos'),false);assert.equal(ow.gldRelacionPuedeEliminarAnunciante(),false);
 ow.GLD_EQUIPO159.mount({aid:'A',role:'MANAGER',base:'https://login.liqkoargentina.workers.dev',headers:()=>({})});assert.equal(section.hidden,true);assert.equal(ow.document.getElementById('equipo-contenido159').children.length,0);assert.deepEqual(owner.errors,[]);
 console.log('PASS UI DOM: normal login, duplicate-name claim ID, administrative handshake, dashboard opens, private requests scoped, personal storage unchanged; no password form in administrative mode; GH proprietor summary; owner-only lazy delegation, explicit permissions, no-op save, no follow-up reload; inline scripts compile.');process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
