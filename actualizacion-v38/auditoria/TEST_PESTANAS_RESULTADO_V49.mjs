import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../plataforma/login.html',import.meta.url),'utf8');
const extract=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const loader=extract('async function loadFarmaciasUI(){','async function events_post(');
const loads=extract('    async function ejecutarCargaModulo(key,state){','    function actualizarEstadoCargaGlobal(){');
const show=extract('    function showTab(key){','    Object.keys(tabs).forEach((k)=>{');
async function scenario({rejected=false,renderError=false}={}){
 let farmCalls=0,pubCalls=0;const results=[],messages=[],errors=[];
 const element=()=>({value:'',innerHTML:'',textContent:'',options:[],classList:{remove(){},add(){}}});
 const elements=new Map(['farma-status','farma-msg','farma-ciudad'].map(k=>[k,element()]));
 const c={window:{gldConsumoVistaV49:(key,ok)=>results.push([key,ok])},document:{getElementById:id=>elements.get(id)||null},sesion:{id:'A'},farmaState:{},
  farmacias_post:async()=>{farmCalls++;return {status:200,json:{success:!rejected,message:rejected?'No habilitado':undefined,farmacias:[],ciclos:[],participantes:[]}};},
  gldTerritoryPublic_:async()=>({ciudades:[{ciudad_id:'D',ciudad_visible:'Dolores'}]}),htmlEscape:v=>String(v),
  renderFarmaList:()=>{if(renderError)throw Error('Error al dibujar');},loadFarmaCityData:async()=>{},setMsg:(...args)=>messages.push(args),console:{error:(...args)=>errors.push(args)},
  moduleRuntime:{turnos_farma:{status:'idle'},publicidad:{status:'idle'}},loadPublicidadUI:async()=>{pubCalls++;return true;},initPublicidadUI_:()=>{},
  setDashboardBusy:()=>{},mostrarCargaModulo:()=>{},actualizarEstadoCargaGlobal:()=>{},setTabActive:()=>{},hideAll:()=>{},despuesDePintar:fn=>fn(),
  dashboardBusy:false,dashboardActionBusy:false,inicioPanel:null,datosPanel:null,promosPanel:null,eventosPanel:null,eventosFreePanel:null,turnosFarmaPanel:element(),efemeridesPanel:null,actividadesPanel:null,publicidadPanel:element(),menuPanel:null};
 vm.createContext(c);vm.runInContext(loader+'\n'+loads+'\n'+show,c);
 for(let i=0;i<3;i++){
  c.showTab('turnos_farma');await c.cargarModulo('turnos_farma');
  c.showTab('publicidad');await c.cargarModulo('publicidad');
 }
 return {farmCalls,pubCalls,results,messages,errors,state:c.moduleRuntime};
}
const good=await scenario();assert.equal(good.farmCalls,1);assert.equal(good.pubCalls,1);assert.equal(good.state.turnos_farma.status,'ready');assert.equal(good.errors.length,0);
const denied=await scenario({rejected:true});assert.equal(denied.farmCalls,3);assert.equal(denied.pubCalls,1);assert.equal(denied.state.turnos_farma.status,'error');assert.ok(denied.results.some(([m,ok])=>m==='turnos_farma'&&!ok));
const uiError=await scenario({renderError:true});assert.equal(uiError.farmCalls,3);assert.equal(uiError.state.turnos_farma.status,'error');assert.ok(uiError.messages.some(x=>String(x[2]).includes('Error al dibujar')));
console.log('HTML original: respuesta correcta carga una vez; rechazo200 o error de vista reintenta; diagnóstico diferencia Vista Lista/Error. No certifica la respuesta real de la cuenta del usuario.');
