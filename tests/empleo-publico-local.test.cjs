const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{readFileSync}=require('node:fs');
const s=readFileSync('plataforma/empleo.js','utf8');
const code=s.slice(s.indexOf('async function publicList()'),s.indexOf('\nfunction payload()'));
function setup(){
 const controls={'public-list':{},'f-q':{value:''},'f-area':{value:''},'f-tipo':{value:'OPORTUNIDADES'},pagina:{closest:()=>({})},prev:{},next:{}};
 let requests=0;const c=vm.createContext({city:'DOL',page:1,total:0,publicType:'OPORTUNIDADES',publicEmployment:{rows:[
  ...Array.from({length:12},(_,i)=>({empleo_id:'prueba-'+i,tipo:'OFREZCO',puesto:i===0?'Administración':'Puesto de ensayo',descripcion:'',tags:[],area:i===0?'Administración':'Otros',desde:'2026-01-01',hasta:'2040-01-01'})),
  {empleo_id:'busqueda',tipo:'BUSCO',puesto:'Mi búsqueda',tags:[],area:'Otros',desde:'2026-01-01',hasta:'2040-01-01'},
  {empleo_id:'concesion',tipo:'CONCESION',puesto:'Convocatoria',tags:[],area:'Otros',desde:'2026-01-01',hasta:'2040-01-01'},
  {empleo_id:'vencido',tipo:'OFREZCO',puesto:'Vencido',tags:[],area:'Otros',desde:'1999-01-01',hasta:'2000-01-01'}]},
  el:id=>controls[id],card:r=>'['+r.empleo_id+']',height:()=>{},URLSearchParams,
  window:{GLD_ADULT:{hasGrant:()=>false},GLD_PAGINACION:{render:()=>{}}},api:async()=>{requests++;return {rows:[],total:0};}
 });vm.runInContext(code,c);return {c,controls,requests:()=>requests};
}
test('Empleo local filtra tipo, vencimiento, texto con acentos y área; pagina sin red',async()=>{
 const {c,controls,requests}=setup();await c.publicList();assert.equal(c.total,13);assert.equal((controls['public-list'].innerHTML.match(/\[/g)||[]).length,10);
 c.page=2;await c.publicList();assert.equal((controls['public-list'].innerHTML.match(/\[/g)||[]).length,3);
 c.page=1;controls['f-q'].value='administracion';await c.publicList();assert.equal(c.total,1);assert.match(controls['public-list'].innerHTML,/prueba-0/);
 controls['f-q'].value='';controls['f-area'].value='Administración';await c.publicList();assert.equal(c.total,1);
 controls['f-area'].value='';c.publicType='BUSCO';await c.publicList();assert.equal(c.total,1);assert.match(controls['public-list'].innerHTML,/busqueda/);assert.equal(requests(),0);
});
test('Empleo conserva la consulta protegida si hay autorización +18',async()=>{
 const {c,requests}=setup();c.window.GLD_ADULT.hasGrant=()=>true;await c.publicList();assert.equal(requests(),1);
});
