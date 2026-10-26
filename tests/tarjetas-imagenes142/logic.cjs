const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync('plataforma/tarjetas-imagenes.js','utf8');
function env(withObserver=true){
 const network=[],listeners=new Map(),storage=new Map();let observer;
 const ctx={console:{warn(){}},localStorage:{setItem:(k,v)=>storage.set(k,v)},document:{querySelectorAll:()=>[]}};ctx.window=ctx;
 if(withObserver)ctx.IntersectionObserver=class{constructor(callback,options){this.callback=callback;this.options=options;this.observed=new Set();observer=this}observe(x){this.observed.add(x)}unobserve(x){this.observed.delete(x)}disconnect(){this.observed.clear()}};
 vm.runInNewContext(code,ctx);
 function image(url){let src='';const img={dataset:{gldImageSrc:url},addEventListener:(name,fn)=>{let m=listeners.get(img);if(!m)listeners.set(img,m={});m[name]=fn},get src(){return src},set src(v){src=v;network.push(v)}};return img}
 return {api:ctx.GLD_CARD_IMAGES,image,network,listeners,storage,get observer(){return observer}};
}
(async()=>{
 const e=env(),a=e.image('https://drive.example/A'),b=e.image('https://drive.example/B');
 e.api.refresh({querySelectorAll:()=>[a,b]});assert.equal(e.network.length,0);assert.equal(e.observer.observed.size,2);
 e.observer.callback([{target:a,isIntersecting:false}]);assert.equal(e.network.length,0);
 e.observer.callback([{target:a,isIntersecting:true}]);assert.deepEqual(e.network,['https://drive.example/A']);assert.equal(b.src,'');assert(!e.observer.observed.has(a));
 e.api.refresh({querySelectorAll:()=>[a,b]});assert.equal(e.network.length,1);e.observer.callback([{target:b,isIntersecting:true}]);assert.equal(e.network.length,2);
 console.log('PASS original image URLs requested only after visibility signal; repeated scan does not duplicate request');
 e.listeners.get(a).error();assert.equal(e.api.snapshot().failed,1);assert.equal(JSON.parse(e.storage.get('gld_card_image_errors_v142')).length,1);assert.equal(e.network.length,2);console.log('PASS failure persisted locally without telemetry fetch or retry');
 e.api.reset();assert.equal(e.observer.observed.size,0);const c=e.image('https://drive.example/C');e.api.refresh({querySelectorAll:()=>[c]});assert.equal(e.observer.observed.size,1);console.log('PASS rerender disconnects old observers and registers new cards');
 let calls=0,finish;const wait=new Promise(r=>finish=r);const x=e.api.resolve('post',async()=>{calls++;await wait;return 'photo'}),y=e.api.resolve('post',()=>{calls++;return 'wrong'});await Promise.resolve();finish();assert.deepEqual(await Promise.all([x,y]),['photo','photo']);assert.equal(await e.api.resolve('post',()=>{calls++;return 'wrong'}),'photo');assert.equal(calls,1);
 let failures=0;await assert.rejects(e.api.resolve('bad',()=>{failures++;throw Error('network')}));assert.equal(await e.api.resolve('bad',()=>{failures++;return 'retry'}),'retry');assert.equal(failures,2);console.log('PASS concurrent/successful Instagram lookups shared; rejected lookup permits retry');
 const fallback=env(false),f=fallback.image('https://drive.example/fallback');fallback.api.refresh({querySelectorAll:()=>[f]});assert.deepEqual(fallback.network,['https://drive.example/fallback']);assert(e.api.attributes('https://example/"<>').includes('&quot;&lt;&gt;'));console.log('PASS absent observer loads images; URL attribute escaped');
 const html=fs.readFileSync('plataforma/anunciantes.html','utf8');const {execFileSync}=require('node:child_process');const before=execFileSync('git',['show','origin/main:plataforma/anunciantes.html'],{encoding:'utf8',maxBuffer:2000000});
 const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
 assert.equal(section(html,'        window.mostrarModalGaleria =','        const ordenAleatorioGuiaInternal'),section(before,'        window.mostrarModalGaleria =','        const ordenAleatorioGuiaInternal'));
 for(const a of ['          renderNormales(normalesPaginadas,destacadasVisibles.length);','window.GLD_CARD_IMAGES?.refresh(contenedor);','window.GLD_CARD_IMAGES?.refresh(destacadasBar);','window.GLD_CARD_IMAGES?.refresh(el);'])assert(html.includes(a));
 assert.equal(html.match(/width="110" height="110" \$\{gldCardImageAttrs\(item.logo\)\}/g).length,2);
 const deferred=section(html,'        function renderGaleria','        function renderContactoNuevo');assert(!deferred.includes('src="${url}"'));assert(deferred.includes('gldCardImageAttrs(url)'));
 console.log('PASS original modal, filters and card actions preserved; both logo and gallery render paths defer images');
})().catch(e=>{console.error(e);process.exitCode=1});
