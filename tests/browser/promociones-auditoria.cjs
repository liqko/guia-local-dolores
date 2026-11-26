const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {checkPromo,installMeasurement} = require('../../scripts/auditar-en-vivo.cjs');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.GLD_CHROME,headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();
    const measured=installMeasurement(context,new Map([['audit.invalid','hosting']]),()=> 'promociones');
    const title='Promoción de ensayo';
    const html={
      '/usuario':'<details><summary class="modulos-menu-trigger">Más opciones</summary><a id="moduloPromos" href="/promos" target="central">Promociones</a></details><iframe name="central" id="moduloCentralFrame"></iframe>',
      '/promos':'<h1 id="promosTitle">Promociones</h1><input id="search"><div id="cards"><b>'+title+'</b></div>',
      '/anunciante':'<div id="panel-dashboard">Comercio<details id="dashboard-navigation"><summary id="dashboard-navigation-label">Funcionalidades</summary><button id="tab-promos" onclick="document.querySelector(\'#promos-list\').hidden=false">Promos</button></details><p id="promos-status">Cupo</p><div id="promos-list" hidden><span>'+title+'</span></div></div>',
      '/gran-hermano':'<nav id="ghTabs"><button class="gh-main" data-gh-group="funcionalidades" aria-expanded="true">Funcionalidades</button><button data-view="promos">Promociones</button></nav><input id="dir-promos-q"><div id="ghPromosList"></div><script>document.querySelector("#dir-promos-q").oninput=async (e)=>{const r=await fetch("/superadmin/listados?tipo=promos&q="+encodeURIComponent(e.target.value));const j=await r.json();document.querySelector("#ghPromosList").innerHTML=(j.title?"<details><summary>"+j.title+" · ACTIVA</summary></details>":"")+"<nav>Resultados</nav>";};</script>',
    };
    await context.route('https://audit.invalid/**',route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/superadmin/listados')return route.fulfill({json:{preparado:true,title:url.searchParams.get('q')===title?title:''}});
      return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8">'+html[url.pathname]});
    });
    const page=await context.newPage();
    const fixture={ciudad:'DOLORES',anunciante:'Comercio'};
    for(const name of ['usuario','anunciante','gran-hermano']){
      await page.goto('https://audit.invalid/'+name);
      await checkPromo(page,name,{...fixture,titulo:title,esperado:'presente'});
      await page.goto('https://audit.invalid/'+name);
      await checkPromo(page,name,{...fixture,titulo:'Ficha ausente',esperado:'ausente'});
    }
    const evidence=await measured();
    assert(evidence.hosting.bodyBytes>0);
    assert.equal(evidence.requests.filter(row=>row.path==='/superadmin/listados'&&row.phase==='promociones').length,2);
    assert(evidence.requests.every(row=>!row.path.includes('?')));
    console.log('Promociones: acciones y comprobaciones de presencia y ausencia aprobadas en las tres interfaces simuladas.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
