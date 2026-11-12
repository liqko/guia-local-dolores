import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../../plataforma/administracion.html',import.meta.url),'utf8');
const extension=await readFile(new URL('../../plataforma/gh-listados.js',import.meta.url),'utf8');
function declaration(name){const match=new RegExp('(?:async )?function '+name+'\\(').exec(html);assert(match,name);return html.slice(match.index,html.indexOf('\n}',match.index)+2);}
function setup(packet){
 const nodes=new Map(),calls=[];const node=()=>({style:{},dataset:{},hidden:false,value:'',children:[],textContent:'',classList:{toggle(){},add(){},remove(){}},setAttribute(){},replaceChildren(){this.children=[];},appendChild(x){this.children.push(x);}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 get('mail').value='principal@example.invalid';get('clave').value='solo-ensayo';get('ghSoporteEstado').value='ABIERTAS';
 const state=new Map();
 const context={console,Date,Intl,Map,Promise,JSON,Object,Array,Error,CustomEvent:function(type,options){this.type=type;this.detail=options?.detail;},window:{scrollTo(){},dispatchEvent(){},gldConsumoAdminV68(){},ghCalendarDashboardV83(){}},
 document:{getElementById:get,createElement:()=>node(),querySelectorAll:()=>[],querySelector:()=>node()},localStorage:{setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)},
 fetch:async url=>{calls.push(url);if(url.endsWith('/superadmin/session/login'))return {ok:true,status:200,json:async()=>({...packet,token:'sesion-ensayo'})};if(url.endsWith('/superadmin/dashboard'))return {ok:true,status:200,json:async()=>packet};throw Error('Carga adicional no permitida al ingresar: '+url);},
 TERRITORY_API_ORIGIN:'https://test.invalid',TOKEN:'',GH_ADMIN_ACCESS:{rol:'SUPERADMIN_PRINCIPAL'},GH_DAILY_ENTRY195:null,GH_FIXED_PACKET169:null,GH_FIXED_SUPPORTED169:false,GH_FIXED_PROMISE169:null,GH_FUNC_SAVE_READY170:false,GH_FUNC_GLOBAL166:null,GH_PRECIOS_ESTADO162:null,GH_CATALOG_CACHE:{},GH_CITIES:[],GH_COUNTRIES:[],GH_PROVINCES:[],GH_CITY_STATS:{},GH_TERRITORY_PENDING195:null,
 GH_REVISION_LOADING:null,GH_REVISION_SOURCES:new Map(),GH_REVISION_ERRORS:[],GH_REVISION_READY:false,GH_REVISION_ROWS:[],GH_PENDING_EVENTS:[],GH_PENDING_ACTIVITIES:[],GH_PENDING_ADVERTISERS:[],GH_SUPPORT_ROWS:[],GH_SUPPORT_ACTIVE_COUNT:null,
 ghNavRead:()=>({}),ghNavWrite(){},ghGrupoNavegacion(){},ghApplyAccessV72(){},ghRenderTodo(){},ghRenderAnunciantesPendientes(){},ghRenderReviewQueues(){},ghRenderRequestSummary(){},ghRenderEventos(){},informarAltura(){},ghAgruparRevision:rows=>rows,esc:s=>String(s)};
 const functions=['ghFixedApply195','ghDailyApply195','ghTerritoryApply195','ghCargarCiudades','ghCargarSoporteV73','ghRevisionUnificada','ghGoView','ghRestaurarNavegacion','abrirApp','login'];
 vm.createContext(context);vm.runInContext(functions.map(declaration).join('\n'),context);
 context.oldGo=context.ghGoView;context.ensure=()=>{};context.defs={vip:{},free:{},actividades:{},promos:{},publicidad:{},moderadores:{}};context.updateCities=()=>{};context.load=()=>{throw Error('No se debe abrir otro listado al ingresar');};context.search=context.load;
 const a=extension.indexOf('ghGoView=function(name,options)'),b=extension.indexOf('\n};',a)+3;vm.runInContext(extension.slice(a,b),context);
 return {context,nodes,calls};
}
const packet={success:true,entry_version:195,resumen:{suscriptores:4,anunciantes:2,ciudades:0},gh_fixed_packet_version:169,functional_settings_version:170,cumpleanos:{preparado:true,periodo_dias:7,results:[]},entrada:{corte:1,preparado_en:'2026-11-12T04:00:00Z',fixed:{version:169,catalogos:{niveles_anunciante:[]},reglas:{reglas:{}},precios:{precios:{}}},territory:{ciudades:[],paises:[],provincias:[]},inbox:{success:true,moderation:{eventos:[],actividades:[],anunciantes:[]},blocked:[],adult:[],support:{success:true,results:[],cantidades:{recuperacion:0,soporte:0,total:0}}}}};
test('cliente real de ingreso consume la respuesta completa sin repetir fixed, inbox, territorio ni soporte',async()=>{
 const h=setup(packet);await h.context.login();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.calls,['https://test.invalid/superadmin/session/login']);assert.equal(h.nodes.get('stSus').textContent,4);assert.equal(h.context.GH_REVISION_READY,true);assert(h.context.GH_FIXED_PACKET169);assert.equal(h.context.GH_CITIES.length,0);
 await h.context.ghCargarCiudades();assert.equal(h.calls.length,1);assert.equal(h.nodes.get('login').style.display,'none');
});
test('una copia inicial ausente muestra el pendiente y no dispara consultas para reconstruirla',async()=>{
 const h=setup({success:false,code:'GH_DAILY_NOT_PREPARED',message:'Copia diaria sin preparar.'});h.context.fetch=async url=>{h.calls.push(url);return {ok:false,status:503,json:async()=>({success:false,code:'GH_DAILY_NOT_PREPARED',message:'Copia diaria sin preparar.'})};};
 await h.context.abrirApp();assert.deepEqual(h.calls,['https://test.invalid/superadmin/dashboard']);assert.equal(h.nodes.get('ghSesionConexionEstado').textContent,'Copia diaria sin preparar.');
});

test('selector de capacidades del GH usa la respuesta de ingreso, sin consulta independiente a la raíz del Worker',async()=>{
 const listeners=new Map(),fields=[{id:'adulto'},{id:'evento'}];let reads=0;
 const context={window:{fetch:async()=>{reads++;throw Error('No se debe consultar versión al entrar');},addEventListener:(name,fn)=>listeners.set(name,fn)},document:{body:{},querySelector:()=>({hasAttribute:()=>true}),querySelectorAll:()=>fields},MutationObserver:class{observe(){}}};
 vm.runInNewContext(await readFile(new URL('../../plataforma/contenido-adulto.js',import.meta.url),'utf8'),context);assert.equal(reads,0);
 listeners.get('gld-admin-entry195')({detail:{version:195,event_scope_version:1}});assert.equal(context.window.GLD_ADULT_SUPPORTED,true);assert.equal(context.window.GLD_EVENT_SCOPE_SUPPORTED,true);assert.equal(reads,0);
});
