/* Signed session upgrades stay local; no Firestore operations. */
(function(){
 'use strict';
 if(window.__gldSessionV87)return;window.__gldSessionV87=true;
 const origin='https://login.liqkoargentina.workers.dev';
 const keys={subscriber:'gld_suscriptor_token_v2',admin:'gld_superadmin_token'};
 const nativeFetch=window.fetch.bind(window),aliases=new Map();
 const read=k=>{try{return localStorage.getItem(k)||'';}catch{return '';}};
 const known=new Set(Object.values(keys).map(read).filter(Boolean));
 const payload=token=>{try{return JSON.parse(atob(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));}catch{return null;}};
 // Local navigation hint only; server authorization remains authoritative.
 window.gldTieneSesionLocal=function(){
  return Object.values(keys).some(key=>{
   const token=read(key),p=payload(token);
   return !!(token.split('.').length===2&&p?.sid&&(p.typ==='GLD_SUBSCRIBER'||p.rol)&&
    ((p.persistent===true&&p.exp===null)||Number(p.exp)>Date.now()));
  });
 };
 window.addEventListener('storage',e=>{if(Object.values(keys).includes(e.key)&&e.oldValue)known.add(e.oldValue);});
 window.fetch=async function(input,options){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);}catch{return nativeFetch(input,options);}
  if(url.origin!==origin)return nativeFetch(input,options);
  const headers=new Headers(options?.headers||(input instanceof Request?input.headers:undefined));
  const old=(headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  let sent=aliases.get(old)||old;
  const p=payload(sent),requestKind=p?.typ==='GLD_SUBSCRIBER'?'subscriber':p?.rol?'admin':null;
  if(requestKind){const current=read(keys[requestKind]),live=payload(current);if(current&&live?.sid===p.sid){known.add(old);sent=current;}else if(known.has(old)){sent='';}}
  if(sent!==old){if(sent)headers.set('Authorization','Bearer '+sent);else headers.delete('Authorization');}
  const method=String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  let r;
  for(let attempt=0;;attempt++){
   r=await nativeFetch(input,{...options,headers});
   if(method!=='GET'||r.status!==503||attempt>=5)break;
   const pending=await r.clone().json().catch(()=>null);
   if(pending?.code!=='COMMERCE_COPY_PREPARING')break;
   await new Promise((resolve,reject)=>{
    const signal=options?.signal||(input instanceof Request?input.signal:null);
    if(signal?.aborted)return reject(signal.reason||new DOMException('Aborted','AbortError'));
    const abort=()=>{clearTimeout(timer);reject(signal.reason||new DOMException('Aborted','AbortError'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},Math.min(5000,1000*2**attempt));
    signal?.addEventListener('abort',abort,{once:true});
   });
  }
  if(method==='POST'&&url.pathname==='/commerce'&&(r.ok||r.status===409)){
   try{
    const result=await r.clone().json();
    const body=JSON.parse(options?.body||(input instanceof Request?await input.clone().text():'{}'));
    window.dispatchEvent(new CustomEvent('gld-commerce-saved210',{detail:{body,result,status:r.status}}));
   }catch{}
  }
  const token=r.headers.get('X-GLD-Session-Token'),kind=r.headers.get('X-GLD-Session-Kind'),key=keys[kind];
  if(token&&key&&read(key)===sent){try{known.add(sent);known.add(token);localStorage.setItem(key,token);aliases.set(sent,token);window.dispatchEvent(new CustomEvent('gld-session-updated',{detail:{kind}}));}catch{}}
  return r;
 };
})();
