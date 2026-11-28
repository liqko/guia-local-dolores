import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
function testAppearance(source, assert) {
  function fixture({stored=null,system=false,embedded=false,blocked=false}={}){
    const callbacks={},mediaCallbacks={},values=new Map(stored===null?[]:[['gld_apariencia',stored]]);
    function element(tag){return {tag,children:[],dataset:{},attributes:{},value:'',content:'',appendChild(node){this.children.push(node);return node;},prepend(node){this.children.unshift(node);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this[k]=fn;}};}
    const root=element('html'),head=element('head'),body=element('body'),nav=element('nav');
    const media={matches:system,addEventListener(k,fn){mediaCallbacks[k]=fn;}};
    const storage={getItem(k){if(blocked)throw Error('blocked');return values.get(k)??null;},setItem(k,v){if(blocked)throw Error('blocked');values.set(k,v);}};
    const document={documentElement:root,head,body,readyState:'loading',createElement:element,querySelector(){return head.children.find(x=>x.name==='theme-color')||null;},getElementById(id){if(id==='gldNavegacionGlobal')return nav;return nav.children.find(x=>x.id===id)||null;},addEventListener(k,fn){callbacks[k]=fn;}};
    const window={matchMedia:()=>media,addEventListener(k,fn){callbacks[k]=fn;},setTimeout:fn=>fn()};
    window.top=embedded?{}:window;
    new Function('window','document','localStorage',source)(window,document,storage);
    const theme=()=>root.dataset.gldTheme;
    return {root,head,nav,window,values,theme,ready:()=>callbacks.DOMContentLoaded(),system(v){media.matches=v;mediaCallbacks.change();},storage(v){values.set('gld_apariencia',v);callbacks.storage({key:'gld_apariencia'});}};
  }
  let f=fixture({system:true});assert(f.theme()==='dark','auto oscuro antes de DOM');f.ready();
  assert(f.nav.children.length===1,'selector unico');f.window.GLDApariencia.mount();assert(f.nav.children.length===1,'montaje idempotente');
  let control=f.nav.children[0].children[0];assert(control.children.length===3,'tres opciones');control.value='light';control.change();assert(f.theme()==='light'&&f.values.get('gld_apariencia')==='light','seleccion persistida');
  f.system(true);assert(f.theme()==='light','manual prevalece');control.value='auto';control.change();assert(f.theme()==='dark','retorno a auto');
  f.system(false);assert(f.theme()==='light','cambio sistema');f.storage('dark');assert(f.theme()==='dark'&&control.value==='dark','sincronizacion entre documentos');
  assert(f.head.children.find(x=>x.name==='theme-color').content==='#111820','meta PWA');
  f=fixture({stored:'dark',embedded:true});f.ready();assert(f.theme()==='dark'&&f.nav.children.length===0,'iframe sin selector duplicado');f.storage('light');assert(f.theme()==='light','iframe actualiza');
  f=fixture({stored:'invalid',system:false});assert(f.theme()==='light','preferencia invalida');f=fixture({blocked:true,system:true});f.window.GLDApariencia.set('light');assert(f.theme()==='light','sin storage funciona en documento');
}

test('apariencia compartida: preferencia, persistencia, iframe y PWA',()=>testAppearance(readFileSync('plataforma/apariencia.js','utf8'),assert.ok));
