const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {checkPublication,installMeasurement,publications} = require('../../scripts/auditar-en-vivo.cjs');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.GLD_CHROME,headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();
    let phase, selected;
    const measured=installMeasurement(context,new Map([['audit.invalid','hosting']]),()=>phase);
    const title='Publicación de ensayo';
    const id=selector=>selector.slice(1);
    function html(path){
      const {key,publicLink,publicList,privateList,status,input,cancel,directory,adminList}=selected;
      if(path==='/usuario')return '<details><summary class="modulos-menu-trigger">Más opciones</summary><a id="'+id(publicLink)+'" href="/listado" target="central">Abrir</a></details><iframe name="central" id="moduloCentralFrame"></iframe>';
      if(path==='/listado')return '<input id="search"><div id="'+id(publicList)+'"><b>'+title+'</b></div><script>document.querySelector("#search").oninput=e=>document.querySelector("b").hidden=e.target.value!=='+JSON.stringify(title)+';</script>';
      if(path==='/anunciante'){
        const edit=selected.edit.slice(1,-1);
        return '<div id="panel-dashboard">Comercio<details id="dashboard-navigation"><summary id="dashboard-navigation-label">Funcionalidades</summary><button id="tab-'+key+'" onclick="document.querySelector(\''+privateList+'\').hidden=false">Módulo</button></details><p id="'+id(status)+'">Cupo</p><div id="'+id(privateList)+'" hidden><details><summary>'+title+'</summary><button '+edit+' onclick="document.querySelector(\''+input+'\').value='+JSON.stringify(title).replaceAll('"','&quot;')+'">Editar</button></details></div><textarea id="'+id(input)+'"></textarea><button id="'+id(cancel)+'" onclick="document.querySelector(\''+input+'\').value=\'\'">Cancelar</button></div>';
      }
      const boxes=adminList.split(', ').map(selector=>'<div id="'+id(selector)+'"></div>').join('');
      const classes=directory==='vip'?['VIP','FREE']:[''];
      return '<nav id="ghTabs"><button class="gh-main" data-gh-group="funcionalidades" aria-expanded="true">Funcionalidades</button><button data-view="'+key+'">Módulo</button></nav><input id="dir-'+directory+'-q">'+boxes+
        '<script>document.querySelector("input").oninput=async (e)=>{ await Promise.all('+JSON.stringify(classes)+'.map(async (clase,i)=>{ const r=await fetch("/superadmin/listados?tipo='+key+'&clase="+clase+"&q="+encodeURIComponent(e.target.value));const j=await r.json();document.querySelectorAll('+JSON.stringify(adminList)+')[i].innerHTML=j.results.map(row=>"<details><summary>"+row.titulo+" · ACTIVA</summary></details>").join("")+"<nav>Resultados</nav>"; })); };</script>';
    }
    await context.route('https://audit.invalid/**',route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/superadmin/listados')return route.fulfill({json:{preparado:true,results:
        url.searchParams.get('q')===title&&url.searchParams.get('clase')!=='FREE'?[{titulo:title}]:[]}});
      return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8">'+html(url.pathname)});
    });
    const page=await context.newPage();
    const fixture={ciudad:'DOLORES',anunciante:'Comercio'};
    for(const module of Object.values(publications)){
      selected=module;
      for(const name of ['usuario','anunciante','gran-hermano']){
        phase='apertura';
        await page.goto('https://audit.invalid/'+name);
        await checkPublication(page,name,module,{...fixture,titulo:title,esperado:'presente'},step=>{phase=step;});
      }
      phase='apertura';
      await page.goto('https://audit.invalid/gran-hermano');
      await checkPublication(page,'gran-hermano',module,{...fixture,titulo:'Ficha ausente',esperado:'ausente'},step=>{phase=step;});
    }
    const evidence=await measured();
    assert(evidence.hosting.bodyBytes>0);
    assert.equal(evidence.requests.filter(row=>row.path==='/superadmin/listados'&&row.phase.endsWith(':filtrar')).length,8);
    assert.equal(evidence.requests.filter(row=>row.phase?.endsWith(':editar-y-cancelar')).length,0);
    assert(evidence.requests.every(row=>!row.path.includes('?')));
    console.log('Promociones, Eventos y Actividades: filtrar, editar y cancelar, y abrir/cerrar ficha aprobados en Chromium local.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
