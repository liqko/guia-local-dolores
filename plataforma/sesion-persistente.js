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
  const r=await nativeFetch(input,{...options,headers});
  const token=r.headers.get('X-GLD-Session-Token'),kind=r.headers.get('X-GLD-Session-Kind'),key=keys[kind];
  if(token&&key&&read(key)===sent){try{known.add(sent);known.add(token);localStorage.setItem(key,token);aliases.set(sent,token);window.dispatchEvent(new CustomEvent('gld-session-updated',{detail:{kind}}));}catch{}}
  return r;
 };
})();
