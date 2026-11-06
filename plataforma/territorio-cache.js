/* Catálogo territorial público: una sola descarga reutilizable entre pantallas. */
(function(){
'use strict';
if(window.GLD_CATALOGO_TERRITORIAL)return;
const KEY='gld_territorio_publico_cache_v1';
const TTL=24*60*60*1000;
const ENDPOINT='https://login.liqkoargentina.workers.dev/territory/public';
let pending=null;
function valid(data){return data&&data.success===true&&Array.isArray(data.ciudades)&&Array.isArray(data.paises)&&Array.isArray(data.provincias);}
function cached(){
 try{const box=JSON.parse(localStorage.getItem(KEY)||'null');if(box&&Number.isFinite(box.ts)&&Date.now()>=box.ts&&Date.now()-box.ts<TTL&&valid(box.data))return box.data;}catch(_){}
 return null;
}
async function load(timeoutMs=20000){
 const hit=cached();if(hit)return hit;
 if(pending)return pending;
 pending=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetch(ENDPOINT,{signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!valid(data))throw Error('Catálogo territorial inválido');
   try{localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),data}));}catch(_){}
   return data;
  }finally{clearTimeout(timer);}
 })();
 try{return await pending;}finally{pending=null;}
}
window.GLD_CATALOGO_TERRITORIAL={load};
})();
