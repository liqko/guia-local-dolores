import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base=new URL('../plataforma/',import.meta.url);
const helper=fs.readFileSync(new URL('sesion-persistente.js',base),'utf8');
const inicio=fs.readFileSync(new URL('inicio.html',base),'utf8');
const cityBlock=inicio.slice(inicio.indexOf('let ciudadRecordada=false;'),inicio.indexOf('if(!ciudadRecordada)cargarCiudades()'));
const token=p=>Buffer.from(JSON.stringify(p)).toString('base64url')+'.signature';
function context(auth,pending=false){
 const store=new Map([['gld_ciudad_contexto',JSON.stringify({ciudad_id:'DOLORES'})],['gld_suscriptor_session_v2',JSON.stringify({suscriptor_id:'S',ciudad_predeterminada_id:'DOLORES'})]]);
 if(auth)store.set('gld_suscriptor_token_v2',auth);
 if(pending)store.set('gld_cambio_ciudad_pendiente',JSON.stringify({ts:Date.now()}));
 const redirects=[];const window={fetch:()=>{throw Error('No network allowed');},addEventListener:()=>{},location:{replace:u=>redirects.push(u)}};
 const ctx=vm.createContext({window,location:{href:'https://example.invalid/'},localStorage:{getItem:k=>store.get(k)||null},URL,atob,Date,Map,Set,Headers,Request,CITY_CONTEXT_KEY:'gld_ciudad_contexto',SUBSCRIBER_SESSION_KEY:'gld_suscriptor_session_v2',GUIDE_PAGE_URL:'https://example.invalid/carcasa.html'});
 vm.runInContext(helper,ctx);return {ctx,redirects};
}
for(const [auth,pending,restore] of [[null,false,false],[token({sid:'S',typ:'GLD_SUBSCRIBER',exp:Date.now()-1}),false,false],['bad',false,false],[token({sid:'S',typ:'GLD_SUBSCRIBER',persistent:true,exp:null}),false,true],[token({sid:'S',typ:'GLD_SUBSCRIBER',persistent:true,exp:null}),true,false]]){
 const {ctx,redirects}=context(auth,pending);vm.runInContext(cityBlock,ctx);assert.equal(redirects.length,restore?1:0);
}
for(const name of ['inicio.html','carcasa.html']){
 const html=fs.readFileSync(new URL(name,base),'utf8');
 for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
}
const shell=fs.readFileSync(new URL('carcasa.html',base),'utf8');
assert(shell.includes('if(!sesionRecordada) ctx=null;'));
assert(shell.includes("qs.get('ciudad_id') ||"));
console.log('PASS: anonymous/stale sessions choose city; saved valid session restores; explicit change stays in Inicio; no network/storage mutations; scripts valid');
