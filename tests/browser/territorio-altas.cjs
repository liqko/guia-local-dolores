const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');

async function run() {
  const html = readFileSync('plataforma/administracion.html', 'utf8');
  const start = html.indexOf('function ghTerrId_(');
  const end = html.indexOf('async function buscarSus(', start);
  const controls = html.match(/<div class="toolbar">[^\n]+?<button id="btnCiudadesRefresh">[^\n]+?<\/div><div id="territorioAlta"><\/div>/)?.[0];
  assert(start >= 0 && end > start && controls);
  const ref=process.env.GLD_TERRITORY_WORKER_REF;
  const source=ref?require('node:child_process').execFileSync('git',['show',ref+':worker/worker206.txt'],{encoding:'utf8',maxBuffer:5_000_000}):readFileSync('worker/worker206.txt','utf8');
  const worker = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const { fixture, session } = await import('../efemerides140/fixture.mjs');
  const backend = fixture(worker.GldPublicCache119);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = backend.network;
  const styles=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  assert(styles);
  const browser = await chromium.launch({ executablePath:process.env.GLD_CHROME, args:['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport:{ width:390, height:844 }, serviceWorkers:'block' });
    page.setDefaultTimeout(5000);
    const posts = [];
    await page.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).pathname === '/') return route.fulfill({ contentType:'text/html; charset=utf-8', body:'<style>'+styles+'</style>'+controls+'<select id=ciuSelect><option value=DOL>Dolores</option></select><div id=ciudadDetalle></div>' });
      const path = new URL(request.url()).pathname;
      const { item } = request.postDataJSON();
      posts.push({path,item});
      const response = await worker.default.fetch(new Request(request.url(), {
        method:'POST', headers:request.headers(), body:request.postData()
      }), backend.env);
      const raw=response.headers.get('X-GLD-Consumption');
      if(raw)posts.at(-1).consumption=JSON.parse(decodeURIComponent(raw));
      return route.fulfill({ status:response.status, json:await response.json() });
    });
    await page.goto('https://fixture.invalid');
    await page.addScriptTag({ content:`
      let GH_COUNTRIES=[{pais_id:'AR',nombre:'Argentina'},{pais_id:'UY',nombre:'Uruguay'}];
      let GH_PROVINCES=[{provincia_id:'BA',pais_id:'AR',nombre:'Buenos Aires'},{provincia_id:'MO',pais_id:'UY',nombre:'Montevideo'}];
      let GH_CITIES=[];
      const esc=String, TOKEN=${JSON.stringify(session())}, TERRITORY_API_ORIGIN=location.origin;
      const ghInvalidarCatalogoPublicoCiudades=()=>{}, ghRenderCiudades=()=>{};
      const GH_CITY_EDIT_PENDING=new Set();
      const GH_ADMIN_ACCESS={rol:'SUPERADMIN_PRINCIPAL'};
      ${html.slice(html.indexOf('function ghRenderCiudadEdicion('),html.indexOf('async function ghGuardarCambioCiudad('))}
      ${html.slice(start,end)}
    ` });
    await page.evaluate(()=>{GH_CITIES.push({ciudad_id:'DOL',nombre:'Dolores'});ghRenderCiudadEdicion();});
    for(const width of [390,1024]){
      await page.setViewportSize({width,height:844});
      const refresh=page.locator('.toolbar button').last();
      assert(await refresh.isVisible());
      assert.equal(await refresh.textContent(),'Actualizar');
      assert.equal(await refresh.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(46, 125, 50)');
      const remove=page.getByRole('button',{name:'Eliminar ciudad'});
      assert(await remove.isVisible());
      assert.equal(await remove.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(198, 40, 40)');
    }
    await page.setViewportSize({width:390,height:844});
    const form = page.locator('#territorioAlta');
    async function open(name, value) {
      await page.getByRole('button', { name, exact:true }).click();
      await form.locator('input').fill(value);
    }
    async function save() {
      await form.getByRole('button', { name:'Guardar' }).click();
      await form.getByRole('button', { name:'Guardar' }).waitFor({ state:'detached' });
    }
    await open('+ País','País de ensayo');
    await form.getByRole('button', { name:'Cancelar' }).click();
    assert.equal(posts.length,0);
    await open('+ País','País de ensayo');
    await save();
    const country = posts[0].item.pais_id;
    await open('+ Provincia / Estado','Provincia de ensayo');
    await form.locator('[data-terr-pais]').selectOption(country);
    await save();
    const region = posts[1].item.provincia_id;
    await open('+ Ciudad / Partido','Ciudad de ensayo');
    await form.locator('[data-terr-pais]').selectOption(country);
    const province = form.locator('[data-terr-prov]');
    assert.deepEqual(await province.locator('option').evaluateAll(options=>options.map(option=>option.value)), ['', region]);
    await province.selectOption(region);
    await save();
    assert.deepEqual(posts.map(post=>post.path), ['/superadmin/countries/create','/superadmin/provinces/create','/superadmin/cities/create']);
    assert.equal(posts[2].item.pais_id,country);
    for(const post of posts)assert.equal(post.consumption.cloudflare.action_store.shared_marker_calls,1);
    for(const [collection,id] of [['paises',country],['provincias',region],['ciudades',posts[2].item.ciudad_id]]) {
      assert(backend.docs.has(collection+'/'+id));
      for(const scope of ['admin','public']) assert(backend.packet(scope)[collection].some(row=>Object.values(row).includes(id)));
    }
    console.log('Altas GH, Worker real con servicios simulados:',JSON.stringify(backend.counts));
    if(process.env.GLD_TERRITORY_TRACE==='1')console.log('Traza territorial:',JSON.stringify(backend.all));
    assert.equal(backend.counts['firestore.PATCH'],3);
    assert.equal(backend.counts['kv.put'],6);
    assert.equal(backend.counts['do.calls'],9);
    backend.reset();
    const replay=await backend.call(worker.default,posts[0].path,{method:'POST',body:{item:posts[0].item},headers:{'Idempotency-Key':'territory-create-'+country}});
    assert.equal(replay.result.operation_replayed,true);
    assert.equal(backend.counts['do.calls'],2);
    assert.equal(backend.counts['kv.get']||0,0);
    assert.equal(backend.counts['kv.put']||0,0);
    assert.equal(backend.counts['firestore.PATCH']||0,0);
    backend.reset();
    for(const post of posts.slice(0,2)){
      for(const options of [{auth:false},{role:'ADMIN_LOCAL'}]){
        const denied=await backend.call(worker.default,post.path,{method:'POST',body:{item:post.item},...options});
        assert.equal(denied.status,options.auth===false?401:403);
      }
    }
    assert(!backend.all.some(call=>call.service==='do'&&call.detail==='territory-actions-v138'));
    assert.equal(backend.counts['firestore.PATCH']||0,0);
    const invalid=await backend.call(worker.default,posts[1].path,{method:'POST',body:{item:{...posts[1].item,pais_id:'INEXISTENTE'}},role:'SUPERADMIN'});
    assert.equal(invalid.status,400);
    assert.equal(backend.counts['firestore.PATCH']||0,0);
    const admin=await backend.call(worker.default,'/superadmin/territory',{role:'SUPERADMIN'});
    assert.equal(admin.status,200);
    assert(admin.result.paises.some(row=>row.pais_id===country));
    assert(admin.result.provincias.some(row=>row.provincia_id===region));
    backend.reset();
    const noop=await backend.call(worker.default,posts[0].path,{method:'POST',body:{item:posts[0].item}});
    assert.equal(noop.result.updated,false);
    assert.equal(backend.counts['firestore.PATCH']||0,0);
    assert.equal(backend.counts['kv.put']||0,0);
    backend.reset();
    const draft=await backend.call(worker.default,'/superadmin/countries/create',{method:'POST',body:{item:{pais_id:'DRAFT',nombre:'Borrador',activo:false}}});
    assert.equal(draft.status,200);
    assert.equal(backend.counts['firestore.PATCH'],1);
    assert.deepEqual(backend.all.filter(call=>call.service==='kv'&&call.operation==='put').map(call=>call.detail),['territorio:admin:v1']);
    assert(backend.packet('admin').paises.some(row=>row.pais_id==='DRAFT'));
    assert(!backend.packet('public').paises.some(row=>row.pais_id==='DRAFT'));
    backend.reset();
    backend.fail.publicPut=1;
    const path='/superadmin/countries/create';
    const recovery={method:'POST',body:{item:{pais_id:'RECOVERY',nombre:'Recuperación'}},headers:{'Idempotency-Key':'recovery-test'}};
    const pending=await backend.call(worker.default,path,recovery);
    assert.equal(pending.status,503);
    assert(backend.docs.has('paises/RECOVERY'));
    backend.evict();
    assert(await backend.alarm());
    const confirmed=await backend.call(worker.default,path,recovery);
    assert.equal(confirmed.result.operation_replayed,true);
    assert.equal(backend.counts['firestore.PATCH'],1);
    assert.equal(backend.all.filter(e=>e.service==='kv'&&e.operation==='put'&&e.detail==='territorio:admin:v1').length,1);
    assert(backend.packet('public').paises.some(row=>row.pais_id==='RECOVERY'));
    console.log('Recuperación territorial:',JSON.stringify(backend.counts));
    if(!ref){
      backend.reset();
      const edit=await backend.call(worker.default,'/superadmin/countries/DRAFT',{method:'PATCH',body:{item:{nombre:'Borrador editado'}}});
      assert.equal(edit.status,200);
      assert.equal(edit.result.pais.activo,false);
      assert(!backend.packet('public').paises.some(row=>row.pais_id==='DRAFT'));
      const missing=await backend.call(worker.default,'/superadmin/countries/FALTANTE',{method:'PATCH',body:{item:{nombre:'Alta accidental'}}});
      assert.equal(missing.status,404);
      const move=await backend.call(worker.default,'/superadmin/provinces/'+region,{method:'PATCH',body:{item:{pais_id:'AR'}}});
      assert.equal(move.status,409);
      const rename=await backend.call(worker.default,'/superadmin/provinces/'+region,{method:'PATCH',body:{item:{nombre:'Provincia renombrada'}}});
      assert.equal(rename.status,200);
      assert.equal(rename.result.provincia.pais_id,country);
      assert.equal(backend.counts['firestore.PATCH'],2);
    }
    const now=Math.floor((Date.now()-4*3600000)/86400000);
    const actor=backend.env.GLD_PUBLIC_CACHE.get(backend.env.GLD_PUBLIC_CACHE.idFromName('city-book-shared-v1'));
    async function changes(from,to){
      return (await actor.fetch(new Request('https://local.invalid/',{method:'POST',body:JSON.stringify({op:'city-book-shared-changes',from,to})}))).json();
    }
    assert.equal((await changes(now-1,now)).later,true);
    assert.deepEqual((await changes(now,now+1)).kinds,['territory']);
  } finally { globalThis.fetch=originalFetch; await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
