/* Administrative panel never replaces the advertiser's personal browser session. */
const gldPanelStorage=(()=>{
 const nonce=new URL(location.href).searchParams.get('administracion');
 if(!nonce)return window.localStorage;
 document.documentElement.dataset.gldAdminPanel='true';
 const style=document.createElement('style');style.textContent='html[data-gld-admin-panel] #panel-login{display:none!important}';document.head.appendChild(style);
 const values=new Map();let resolve,reject;
 const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});ready.catch(()=>{});
 const state=window.GLD_ADMIN_PANEL155={nonce,ready,grant:null};
 const timeout=setTimeout(()=>reject(new Error('Volvé a abrir este panel desde Gran Hermano.')),60000);
 window.addEventListener('message',function receive(event){
  if(event.origin!==location.origin||event.source!==window.opener||event.data?.type!=='gld-admin-panel155'||event.data.nonce!==nonce)return;
  const grant=event.data.grant;if(!grant?.success||!grant.token||!grant.relacion?.anunciante_id)return;
  clearTimeout(timeout);window.removeEventListener('message',receive);state.grant=grant;resolve(grant);
 });
 const fetchNative=window.fetch.bind(window);
 window.fetch=(input,options={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href),headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));
  if(state.grant&&url.origin==='https://login.liqkoargentina.workers.dev'&&headers.has('Authorization'))headers.set('Authorization','Bearer '+state.grant.token);
  return fetchNative(input,{...options,headers});
 };
 document.addEventListener('DOMContentLoaded',()=>{window.opener?.postMessage({type:'gld-admin-ready155',nonce},location.origin);});
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
})();

window.GLD_PANEL_STORAGE155=gldPanelStorage;
