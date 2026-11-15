/* Guía Local: núcleo de lectura y medición. Arquitectura nueva, no desplegada.
   La autorización real SIEMPRE se verifica en el servidor.
   No se comparten copias privadas entre identidades. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.GLD_ARCHITECTURE_V1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const UNITS=['kv_reads','kv_writes','kv_deletes','fs_reads','fs_writes','fs_deletes',
    'sql_rows_read','sql_rows_written','do_requests','do_gb_seconds',
    'worker_requests','cpu_ms','stored_gb_month','egress_gb'];
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function createMeter({rates={},quotaLimits={}}={}){
    const actions=[],totals=Object.fromEntries(UNITS.map(k=>[k,0]));
    function add(action,usage=null,meta={}){
      const values={},missing=[];
      for(const unit of UNITS){
        const n=usage?.[unit];
        if(n===undefined||n===null){missing.push(unit);continue;}
        if(!Number.isFinite(n)||n<0)throw Error('Métrica inválida: '+unit);
        values[unit]=n;totals[unit]+=n;
      }
      const priced=Object.keys(values).filter(k=>own(rates,k));
      const unpriced=Object.keys(values).filter(k=>!own(rates,k));
      const knownUSD=priced.reduce((a,k)=>a+values[k]*rates[k],0);
      const item={action,values,knownUSD,complete:missing.length===0&&unpriced.length===0,
        missing,unpriced,...meta};
      actions.push(item);return item;
    }
    function report(){
      const knownUSD=actions.reduce((sum,a)=>sum+a.knownUSD,0);
      const missing=[...new Set(actions.flatMap(a=>[...a.missing,...a.unpriced]))];
      return {actions:actions.slice(),units:{...totals},knownUSD,
        complete:missing.length===0&&actions.length>0,missing,
        quotas:Object.fromEntries(Object.entries(quotaLimits).map(([key,limit])=>
          [key,{used:totals[key]??null,limit,percent:totals[key]===undefined?null:100*totals[key]/limit}]))};
    }
    function forecast(action,count){
      if(!Number.isSafeInteger(count)||count<0)throw Error('Cantidad inválida');
      const matches=actions.filter(a=>a.action===action);
      if(!matches.length)return {action,count,available:false};
      const sums=Object.fromEntries(UNITS.map(k=>[k,matches.reduce((n,a)=>n+(a.values[k]??0),0)/matches.length]));
      const missing=[...new Set(matches.flatMap(a=>[...a.missing,...a.unpriced]))];
      return {action,count,available:true,knownUSD:matches.reduce((n,a)=>n+a.knownUSD,0)/matches.length*count,
        projectedUnits:Object.fromEntries(UNITS.map(k=>[k,sums[k]*count])),
        complete:missing.length===0,missing};
    }
    return {add,report,forecast};
  }
  function createCore({transport,meter=createMeter(),pageSize=50}={}){
    if(typeof transport!=='function')throw Error('Falta transporte');
    if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw Error('Tamaño de página inválido');
    let generation=0,principal=null;
    const reads=new Map();
    function wipe(){generation++;reads.clear();}
    function signOut(){principal=null;wipe();}
    // Ninguna respuesta iniciada antes del cambio de cuenta podrá poblar la nueva sesión.
    function once(key,action,request){
      if(reads.has(key))return reads.get(key);
      const at=generation;
      const pending=Promise.resolve().then(request).then(response=>{
        if(at!==generation)throw Error('La sesión cambió durante la consulta');
        if(!response||response.ok!==true)throw Error(response?.error||'Consulta rechazada');
        meter.add(action,response.usage??null,{source:response.usage?'servidor':'sin-medición-servidor'});
        return response.data;
      }).catch(err=>{if(reads.get(key)===pending)reads.delete(key);throw err;});
      reads.set(key,pending);return pending;
    }
    async function bootstrap(session){
      if(!session)throw Error('Sesión ausente');
      signOut();
      const at=generation;
      const response=await transport({operation:'bootstrap',session});
      if(at!==generation)throw Error('Inicio de sesión sustituido');
      if(!response||response.ok!==true||!response.data?.principal_id)throw Error('Sesión no autorizada');
      meter.add('ingreso',response.usage??null,{source:response.usage?'servidor':'sin-medición-servidor'});
      const data=response.data;
      // Nunca se carga el detalle completo de los anunciantes durante el ingreso.
      principal={id:String(data.principal_id),permissions_revision:String(data.permissions_revision??''),
        roles:Array.isArray(data.roles)?data.roles.slice():[],
        managed_count:Math.max(0,Number(data.managed_count)||0)};
      return {...principal};
    }
    function requireSession(){if(!principal)throw Error('Iniciá sesión');return principal;}
    function managedPage(cursor=''){
      const p=requireSession(),encoded=String(cursor);
      return once('p:'+p.id+':'+encoded,'listar_anunciantes',()=>transport({
        operation:'managed_page',principal:p.id,cursor:encoded,limit:pageSize}));
    }
    function detail(id){
      const p=requireSession(),key=String(id);
      if(!key)throw Error('Anunciante inválido');
      return once('d:'+p.id+':'+p.permissions_revision+':'+key,'ver_anunciante',()=>transport({
        operation:'advertiser_detail',principal:p.id,advertiser:key}));
    }
    function publicCity(city,revision){
      const key=String(city),rev=String(revision);
      if(!key||!rev)throw Error('Ciudad o versión inválida');
      return once('city:'+key+':'+rev,'ver_ciudad',()=>transport({
        operation:'public_city',city:key,revision:rev}));
    }
    async function mutate({advertiser,command,revision,changes}){
      const p=requireSession();if(!advertiser||!command||!revision)throw Error('Cambio incompleto');
      const at=generation;
      const response=await transport({operation:'mutate',principal:p.id,advertiser,command,revision,changes});
      if(at!==generation)throw Error('La sesión cambió durante la modificación');
      if(!response||response.ok!==true)throw Error(response?.error||'Modificación rechazada');
      meter.add('modificar_anunciante',response.usage??null,{source:response.usage?'servidor':'sin-medición-servidor'});
      // Invalidar datos derivados: no borrar la sesión ni forzar recarga masiva.
      for(const key of [...reads.keys()])if(key.startsWith('d:'+p.id+':')||key.startsWith('p:'+p.id+':'))reads.delete(key);
      return response.data;
    }
    function permissionsChanged(principalId,revision){
      if(principal && (!principalId||String(principalId)===principal.id)){
        principal.permissions_revision=String(revision??'');wipe();
      }
    }
    return {bootstrap,managedPage,detail,publicCity,mutate,permissionsChanged,signOut,
      meter,session:()=>principal?{...principal}:null};
  }
  return {createCore,createMeter,UNITS};
});
