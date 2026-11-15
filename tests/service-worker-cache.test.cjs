const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const source = fs.readFileSync('plataforma/sw.js', 'utf8');
const origin = 'https://anunciantes-guialocal.web.app';

function harness({offline = false} = {}) {
  const handlers = new Map(), cacheMap = new Map(), downloads = [], cacheWrites = [];
  const store = new Map();
  function cache(name) {
    if (!store.has(name)) store.set(name, new Map());
    const bucket = store.get(name);
    return {
      add: async key => { downloads.push(String(key)); bucket.set(String(key), {ok:true, source:'preloaded'}); },
      match: async key => bucket.get(typeof key === 'string' ? key : key.url) ?? null,
      put: async (key, value) => { cacheWrites.push(typeof key === 'string' ? key : key.url); bucket.set(typeof key === 'string' ? key : key.url, value); }
    };
  }
  const caches = {open:async name=>cache(name), keys:async()=>[...store.keys()],delete:async name=>store.delete(name)};
  const self = {
    location:{origin}, clients:{claim:async()=>{},matchAll:async()=>[]},skipWaiting:async()=>{},
    registration:{showNotification:async()=>{}},
    addEventListener:(name,fn)=>handlers.set(name,fn)
  };
  const context = {
    self,caches,URL,Promise, console,
    fetch:async req => { const url = typeof req === 'string' ? req : req.url; downloads.push(url); if (offline) throw Error('offline'); return {ok:true,type:'basic',source:'network',clone(){return this;}}; },
    Response:{error:()=>({source:'error'})},
  };
  vm.runInNewContext(source, context, {filename:'plataforma/sw.js'});
  async function fire(name, props={}) {
    const tasks = []; let response;
    const event = {
      ...props,waitUntil(p){tasks.push(Promise.resolve(p));},
      respondWith(p){response=Promise.resolve(p);},
    };
    handlers.get(name)(event);
    const result=response?await response:undefined;
    await Promise.all(tasks);
    return result;
  }
  function request(path,{method='GET',mode='navigate',headers={}}={}) {
    const url = new URL(path,origin).href;
    return {url,method,mode,headers:{has:k=>Object.keys(headers).some(h=>h.toLowerCase()===k.toLowerCase())}};
  }
  return {fire,request,downloads,cacheWrites,cache,store,handlers};
}

test('installation downloads only offline page, not seven screens or extra script',async()=>{
  const h=harness();await h.fire('install');
  assert.deepEqual(h.downloads,['/plataforma/offline.html']);
});
test('visited HTML is fetched and then retained for an offline revisit',async()=>{
  const h=harness();await h.fire('install');
  const req=h.request('/plataforma/eventos.html');
  const online=await h.fire('fetch',{request:req});
  assert.equal(online.source,'network');
  assert(h.cacheWrites.includes('/plataforma/eventos.html'));
  assert(!h.downloads.includes('/plataforma/actividades.html'));
});
test('offline fallback still serves installed offline page for unvisited route',async()=>{
  const h=harness({offline:true});await h.fire('install');
  const result=await h.fire('fetch',{request:h.request('/plataforma/actividades.html')});
  assert.equal(result.source,'preloaded');
});
test('private and cross-origin requests are not intercepted',async()=>{
  const h=harness();await h.fire('install');
  for(const req of [
    h.request('/plataforma/login.html',{method:'POST'}),
    h.request('/no-plataforma/pagina.html'),
    {url:'https://login.liqkoargentina.workers.dev/commerce',method:'POST',headers:{has:()=>true}}
  ]) assert.equal(await h.fire('fetch',{request:req}),undefined);
  assert.equal(h.cacheWrites.length,0);
});
test('public guide is network first and fallback is used only offline',async()=>{
  const h=harness();await h.fire('install');
  const req={url:'https://login.liqkoargentina.workers.dev/guide?compact=1&ciudad_id=DOL',method:'GET',headers:{has:()=>false}};
  const response=await h.fire('fetch',{request:req});
  assert.equal(response.source,'network');
  assert(h.cacheWrites.includes(req.url));
});
