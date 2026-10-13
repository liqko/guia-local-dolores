/* Signed session upgrades stay local; no Firestore operations. */
(function(){
 'use strict';
 if(window.__gldSessionV87)return;window.__gldSessionV87=true;
 const origin='https://login.liqkoargentina.workers.dev';
 const keys={subscriber:'gld_suscriptor_token_v2',admin:'gld_superadmin_token'};
 const nativeFetch=window.fetch.bind(window),aliases=new Map();
 const read=k=>{try{return localStorage.getItem(k)||'';}catch{return '';}};
 window.fetch=async function(input,options){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);}catch{return nativeFetch(input,options);}
  if(url.origin!==origin)return nativeFetch(input,options);
  const headers=new Headers(options?.headers||(input instanceof Request?input.headers:undefined));
  const old=(headers.get('Authorization')||'').replace(/^Bearer\s+/i,''),sent=aliases.get(old)||old;
  if(sent!==old)headers.set('Authorization','Bearer '+sent);
  const r=await nativeFetch(input,{...options,headers});
  const token=r.headers.get('X-GLD-Session-Token'),kind=r.headers.get('X-GLD-Session-Kind'),key=keys[kind];
  if(token&&key&&read(key)===sent){try{localStorage.setItem(key,token);aliases.set(sent,token);window.dispatchEvent(new CustomEvent('gld-session-updated',{detail:{kind}}));}catch{}}
  return r;
 };
})();
