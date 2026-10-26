(function(root){
 'use strict';
 const inflight=new Map(),remembered=new Map(),prefix='gld_publication_request_v143:';
 const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>[k,normalize(v[k])])):v;
 function eligible(url,body){
  const path=new URL(url,location.href).pathname,action=String(body?.action||body?.accion||'').toLowerCase();
  return path==='/promos'?['createpromo','updatepromo','deletepromo'].includes(action):path==='/publicidad'?['guardar','actualizar_activos','eliminar'].includes(action):path==='/superadmin/promos'?['pausar','reanudar','borrar','aprobar','rechazar'].includes(action):path==='/superadmin/publicidad'?['pausar','eliminar'].includes(action):false;
 }
 async function run(url,body,send){
  if(!eligible(url,body))return send(body);
  const source=JSON.stringify({path:new URL(url,location.href).pathname,body:normalize(body)});
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(inflight.has(hash))return inflight.get(hash);
  const storedKey=prefix+hash;let operation_id=body.operation_id||body.request_key;
  if(!operation_id){const prior=remembered.get(hash);if(prior&&Date.now()-prior.at<86400000)operation_id=prior.id;}
  if(!operation_id){try{const saved=JSON.parse(sessionStorage.getItem(storedKey)||'null');if(saved&&Date.now()-saved.at<86400000)operation_id=saved.id;}catch(_){}operation_id||=crypto.randomUUID();}
  try{
   const old=[];for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(!key?.startsWith(prefix))continue;try{const value=JSON.parse(sessionStorage.getItem(key));if(Date.now()-value.at>=86400000)sessionStorage.removeItem(key);else old.push({key,at:value.at});}catch(_){}}
   old.sort((a,b)=>a.at-b.at);while(old.length>=32)sessionStorage.removeItem(old.shift().key);
   sessionStorage.setItem(storedKey,JSON.stringify({id:operation_id,at:Date.now()}));
  }catch(_){}
  if(remembered.size>=32)remembered.delete(remembered.keys().next().value);remembered.set(hash,{id:operation_id,at:Date.now()});
  const promise=Promise.resolve().then(()=>send({...body,operation_id})).then(result=>{
   if(result?.status>=200&&result.status<300&&result.json?.success||result?.json?.code==='PUBLICATION_OPERATION_REVIEW'){remembered.delete(hash);try{sessionStorage.removeItem(storedKey);}catch(_){}}
   return result;
  });inflight.set(hash,promise);
  try{return await promise;}finally{if(inflight.get(hash)===promise)inflight.delete(hash);}
 }
 root.GLD_PUBLICATION_REQUEST143={run,eligible};
})(window);
