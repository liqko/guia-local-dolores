const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const {resolve,extname}=require('node:path');
const {chromium}=require('playwright');
const {installMeasurement}=require('../../scripts/auditar-en-vivo.cjs');

const root=resolve(__dirname,'../..');
const origin='https://fixture.invalid',api='login.liqkoargentina.workers.dev';
const person={suscriptor_id:'ENSAYO',nombre:'Cuenta de ensayo',mail:'cuenta@fixture.invalid'};
const relation={anunciante_id:'A',anunciante_nombre:'Comercio de ensayo',rol:'PROPIETARIO',
  administracion:{funcionalidades:'PROMOS'},configuracion_funcionalidades:{PROMOS:{activo:true}}};
const sede={sede_id:'SEDE',ciudad_id:'DOL',nombre_sede:'Principal',activa:true};
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json'};

async function run(){
  const browser=await chromium.launch({executablePath:process.env.GLD_CHROME,headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({serviceWorkers:'block'});
    let phase='inicio',errorMode='',row=null,published=null,writes=0;
    const calls=[];
    const measure=installMeasurement(context,new Map([[api,'worker'],['fixture.invalid','hosting']]),()=>phase);
    await context.addInitScript(p=>{
      if(location.hostname!=='fixture.invalid')return;
      localStorage.setItem('gld_suscriptor_session_v2',JSON.stringify(p));
      localStorage.setItem('gld_suscriptor_token_v2','FIXTURE-TOKEN');
    },person);
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin){
        const path=url.pathname==='/anunciantes'?'/plataforma/login.html':url.pathname;
        try {return await route.fulfill({body:await readFile(resolve(root,'.'+path)),contentType:mime[extname(path)]});}
        catch {return route.fulfill({status:404,body:''});}
      }
      if(url.hostname!==api)return route.fulfill({body:''});
      const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':route.request().headers()['access-control-request-headers']||'Authorization, Content-Type',
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
      const method=route.request().method();
      if(method==='OPTIONS')return route.fulfill({status:204,headers});
      const body=route.request().postDataJSON()||{},action=String(body.action||url.searchParams.get('action')||'').toLowerCase();
      calls.push({path:url.pathname,action,phase});
      let data={success:true,rows:[],results:[],ciudades:[{ciudad_id:'DOL',ciudad_visible:'Dolores'}],paises:[],provincias:[]},status=200,written=0;
      if(url.pathname==='/')data={version:212,event_scope_version:1};
      if(url.pathname==='/suscriptores')data={success:true,suscriptor:person,token:'FIXTURE-TOKEN',anunciantes:[relation],autorizaciones:[relation]};
      if(url.pathname==='/advertiser/terms')data={success:true,aceptada:true,version:'2026-10-11',aceptacion:{usuario_id:'ENSAYO',version:'2026-10-11'}};
      if(url.pathname==='/commerce')data={success:true,advertiser:{id:'A',nombre:'Comercio de ensayo'},anunciante:{id:'A',nombre:'Comercio de ensayo'},sedes:[sede],administracion:relation.administracion,configuracion_funcionalidades:relation.configuracion_funcionalidades};
      if(url.pathname==='/promos'){
        const payload=body.payload||{};
        if(method==='GET')data={success:true,promos:published?[published]:[]};
        if(action==='getpaneldata')data={success:true,advertiser:{id:'A',nombre:'Comercio de ensayo'},promos_cant:3,categorias:['General'],sedes:[sede],promos:row?[row]:[]};
        if(action==='getpromos')data=errorMode==='reload-error'?{success:false,message:'Proyección no disponible'}:{success:true,promos:row?[row]:[]};
        if(action==='createpromo'){
          assert.equal(row,null,'Un alta duplicada no debe crear dos fichas');
          row={...payload,promo_id:'ID-ENSAYO',pausado:false};written++;
          data={success:true,promo:row};
        }
        if(action==='updatepromo'||action==='deletepromo'){
          assert.equal(payload.promo_id,'ID-ENSAYO');
          if(!['stale','reload-error'].includes(errorMode)){
            if(action==='updatepromo')row={...row,...payload};else row=null;
            written++;
          }
          if(errorMode){status=503;data={success:false,operation_unconfirmed:true};}
          else data={success:true,promo:row};
        }
      }
      writes+=written;
      return route.fulfill({status,json:data,headers:{...headers,'X-GLD-Consumption':encodeURIComponent(JSON.stringify({
        firestore:{write_calls:written},cloudflare:{worker_requests:1},
      }))}});
    });
    const page=await context.newPage();
    page.on('dialog',dialog=>dialog.accept());
    const list=page.locator('#promos-list');
    const notice=page.locator('#promos-msg');
    async function openPanel(){
      await page.goto(origin+'/anunciantes');
      const chooser=page.locator('#anunciantes-autorizados-lista button').first();
      const dashboard=page.locator('#panel-dashboard.active');
      await chooser.or(dashboard).first().waitFor();
      if(await chooser.isVisible())await chooser.click();
      await dashboard.waitFor();
      if(await page.locator('#dashboard-navigation').getAttribute('open')===null)await page.locator('#dashboard-navigation-label').click();
      await page.locator('#tab-promos').click();
      await page.locator('#promo-sede option[value="SEDE"]').waitFor({state:'attached'});
    }
    const find=title=>list.getByText(title,{exact:true});
    async function edit(title){
      await find(title).click();
      await list.locator('[data-promo-action="edit"]').click();
    }
    async function message(text){await page.waitForFunction(value=>document.querySelector('#promos-msg')?.textContent.includes(value),text);}
    await openPanel();
    assert.equal(calls.filter(call=>call.path==='/'&&call.phase==='inicio').length,1,'Promociones y Empleo comparten la consulta de capacidades');
    phase='crear';
    await page.locator('#promo-text').fill('Promoción de ensayo');
    await page.locator('#promo-sede').selectOption('SEDE');
    await page.locator('#promo-categoria').selectOption({label:'General'});
    await page.locator('#promo-desde').fill('2026-11-26');
    await page.locator('#promo-hasta').fill('2026-12-10');
    await page.locator('#aceptacion-promos').check();
    await page.locator('#promo-create').click();
    try{await find('Promoción de ensayo').waitFor({timeout:5000});}
    catch(error){throw new Error((await notice.innerText())+' · '+JSON.stringify(calls.slice(-6)),{cause:error});}
    phase='guardar-edición';
    await edit('Promoción de ensayo');
    await page.locator('#promo-text').fill('Texto guardado');
    await page.locator('#aceptacion-promos').check();
    await page.locator('#promo-create').click();
    await find('Texto guardado').waitFor();

    phase='recuperar-edición-no-aplicada';
    errorMode='stale';
    await edit('Texto guardado');
    await page.locator('#promo-text').fill('Edición sin escritura');
    await page.locator('#aceptacion-promos').check();
    await page.locator('#promo-create').click();
    await message('No se pudo confirmar la actualización');
    await find('Texto guardado').waitFor();
    await page.locator('[data-global-error-close]').click();

    phase='recuperar-edición-aplicada';
    errorMode='lost';
    await page.locator('#promo-text').fill('Recuperada después del fallo');
    await page.locator('#aceptacion-promos').check();
    await page.locator('#promo-create').click();
    await message('Promo actualizada.');
    await find('Recuperada después del fallo').waitFor();
    phase='sincronizar-recarga';
    errorMode='';
    await openPanel();
    await find('Recuperada después del fallo').waitFor();

    phase='comprobar-proyección-pública';
    published={...row,nombre:'Comercio de ensayo',anunciante:'Comercio de ensayo',hasta:'2099-12-10'};
    const publicPage=await context.newPage();
    await publicPage.goto(origin+'/plataforma/promos.html?ciudad_id=DOL');
    await publicPage.locator('#cards').getByText('Recuperada después del fallo',{exact:true}).waitFor();

    await find('Recuperada después del fallo').click();
    phase='recuperar-baja-no-verificable';
    errorMode='reload-error';
    await list.locator('[data-promo-action="delete"]').click();
    await message('No se pudo confirmar la operación');
    assert(row,'La baja no se aplicó en el origen simulado');
    phase='sincronizar-antes-de-baja';
    errorMode='';
    await openPanel();
    await find('Recuperada después del fallo').click();
    phase='eliminar-y-recuperar';
    errorMode='lost';
    await list.locator('[data-promo-action="delete"]').click();
    await message('Promo borrada.');
    await find('Recuperada después del fallo').waitFor({state:'hidden'});
    phase='sincronizar-baja';
    errorMode='';
    await openPanel();
    await list.getByText('No hay promos registradas.').waitFor();
    phase='comprobar-baja-pública';
    published=null;
    await publicPage.reload();
    await publicPage.locator('#cards').getByText('No hay promos para mostrar.',{exact:true}).waitFor();

    assert.equal(writes,4);
    assert.equal(row,null);
    const forPhase=(name,action)=>calls.filter(x=>x.phase===name&&x.path==='/promos'&&x.action===action).length;
    assert.equal(forPhase('crear','createpromo'),1);
    assert.equal(forPhase('guardar-edición','updatepromo'),1);
    for(const name of ['recuperar-edición-no-aplicada','recuperar-edición-aplicada','recuperar-baja-no-verificable','eliminar-y-recuperar']){
      assert.equal(forPhase(name,'getpromos'),1);
    }
    const evidence=await measure();
    assert(evidence.requests.some(item=>item.phase==='crear'&&item.bodyBytes>0));
    console.log(JSON.stringify({status:'PASS',durableWrites:writes,promoRequests:calls.filter(x=>x.path==='/promos').map(({action,phase})=>({action,phase}))}));
  }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
