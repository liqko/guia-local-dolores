/* El catálogo publicado viaja en este mismo archivo, sin una consulta por visita. */
(function(){
'use strict';
if(window.GLD_CATALOGO_TERRITORIAL)return;
const KEY='gld_territorio_publico_cache_v1';
const ENDPOINT='https://login.liqkoargentina.workers.dev/territory/public';
const published = /* GLD_TERRITORY_SNAPSHOT */ null;
let pending=null;
function valid(data){return data?.success===true&&Array.isArray(data.ciudades)&&Array.isArray(data.paises)&&Array.isArray(data.provincias);}
function cached(){
 try{
  const box=JSON.parse(localStorage.getItem(KEY)||'null');
  return valid(box?.data)?box:null;
 }catch(_){return null;}
}
function store(box){
 try{localStorage.setItem(KEY,JSON.stringify(box));}catch(_){}
}
async function load(timeoutMs=20000){
 const hit=cached();
 if(published){
  if(hit?.revision!==published.revision)store(published);
  return published.data;
 }
 // Compatibilidad con una copia anterior o con una instalación sin empaquetar.
 if(hit)return hit.data;
 if(pending)return pending;
 pending=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetch(ENDPOINT,{signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!valid(data))throw Error('Catálogo territorial inválido');
   store({data});
   return data;
  }finally{clearTimeout(timer);}
 })();
 try{return await pending;}finally{pending=null;}
}
window.GLD_CATALOGO_TERRITORIAL={load};
})();
