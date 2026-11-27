import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generarSeoPublico,prepararSeoInstalado} from '../plataforma/seo-generador.mjs';

test('la verificación SEO ocurre después de confirmar el corte y conserva un aviso recuperable',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/firebase-hosting-merge.yml',import.meta.url),'utf8');
  const verify=workflow.indexOf('node --test tests/seo-publico.test.mjs');
  assert(verify>workflow.indexOf('name: Confirmar el corte publicado'));
  assert(verify>workflow.indexOf('name: Comprobar carcasa y Eventos publicados'));
  const step=workflow.slice(workflow.indexOf('id: seo'));
  assert(step.includes("steps.confirmar.outcome == 'success'"));
  assert.match(step,/for delay in 0 5 15/);
  assert.match(step,/GITHUB_STEP_SUMMARY/);
  assert.match(step,/::error title=SEO pendiente::/);
});
test('SEO conserva la edición activa ante un paquete ausente y reintenta sobre la misma revisión',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gld-seo-recovery-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const cities=[{ciudad_id:'A',ciudad_visible:'Dolores',provincia_id:'BUE',pais_id:'ARG'}];
  const stage=join(root,'stage'),planPath=join(root,'seo.plan.json'),calls=[];
  let sitemap='',missing=true,cutoff=1;
  const read=async input=>{
    const path=new URL(input).pathname;calls.push(path);
    if(path==='/sitemap.xml')return new Response(sitemap,{status:sitemap?200:404});
    if(path.endsWith('/territorio-cache.js'))return new Response('const published = '+JSON.stringify({data:{ciudades:cities}})+';',{headers:{etag:'"territory"'}});
    if(path.endsWith('/publicacion.json'))return Response.json({cutoff,manifest:{A:{key:'QQ',revision:7,deltas:[]}}},{headers:{etag:'"index"'}});
    if(missing)return new Response(null,{status:404});
    return Response.json({city:'A',revision:7,modules:{events:{success:true,events:[{nombre_evento:'Visible'},{nombre_evento:'Restringido',bloqueado18:true}]}}});
  };
  await assert.rejects(prepararSeoInstalado(stage,{planPath,read}),/HTTP 404/);
  await assert.rejects(readFile(planPath),{code:'ENOENT'});
  missing=false;
  assert.equal((await prepararSeoInstalado(stage,{planPath,read})).changed,true);
  assert.deepEqual(JSON.parse(await readFile(planPath,'utf8')),{status:200,etag:'"index"',territoryEtag:'"territory"'});
  const events=await readFile(join(stage,'seo/dolores-bue-arg/eventos/index.html'),'utf8');
  assert.match(events,/Visible/);
  assert.doesNotMatch(events,/Restringido/);
  sitemap=await readFile(join(stage,'sitemap.xml'),'utf8');
  cutoff++;
  calls.length=0;
  assert.deepEqual(await prepararSeoInstalado(join(root,'none'),{planPath,read}),{changed:false});
  assert.equal(calls.length,3);
  assert(!calls.some(path=>path.includes('/completo-')));
});

test('genera SEO y sitemap por ciudad desde copia pública sin consultar APIs', async()=>{
  const root=await mkdtemp(join(tmpdir(),'gld-seo-'));
  try {
    await mkdir(join(root,'plataforma','paquetes-ciudad','Y2l1ZGFkMQ'),{recursive:true});
    const cities=[{ciudad_id:'ciudad1',ciudad_visible:'Dolores',provincia_id:'BUE',provincia_visible:'Buenos Aires',pais_id:'ARG',activa:true}];
    const territory='const published = /* GLD_TERRITORY_SNAPSHOT */ '+JSON.stringify({data:{ciudades:cities}})+';\n'+
      'const paquetes = /* GLD_CITY_BOOKS */ JSON.parse('+JSON.stringify(JSON.stringify({ciudad1:{key:'Y2l1ZGFkMQ',revision:7,deltas:[]}}))+');\n';
    await writeFile(join(root,'plataforma','territorio-cache.js'),territory);
    const book={city:'ciudad1',revision:7,modules:{
      guide:{success:true,results:[
        {nombre:'Peluquería A',categorias:['Peluquerías'],estado_moderacion:'PUBLICADO'},
        {nombre:'Peluquería B',categorias:['Peluquerías'],estado_moderacion:'PUBLICADO'}]},
      pharmacy:{success:true,ciclos:[{ciclo_id:'t1'}]},
      ephemerides:{success:true,efemerides:[{nombre:'Día X'}]},
      events:{success:true,events:[{nombre_evento:'Torneo de fútbol juvenil',categoria:'Deportes',organizador:'Club local',etiquetas:['torneo','fútbol']}]},
      activities:{success:true,actividades:[{titulo:'Actividad de prueba'}]},
      promos:{success:true,promos:[{promo:'Descuento en indumentaria',anunciante:'Comercio de prueba',categoria:'Ropa',tags:['oferta']}]}
    }};
    await writeFile(join(root,'plataforma','paquetes-ciudad','Y2l1ZGFkMQ','completo-7.json'),JSON.stringify(book));
    const result=await generarSeoPublico(root);
    assert.equal(result.cities,1);
    const xml=await readFile(join(root,'sitemap.xml'),'utf8');
    assert.match(xml,/seo\/dolores-bue-arg\/farmacias-de-turno\//);
    assert.match(xml,/seo\/dolores-bue-arg\/categorias\/peluquerias\//);
    assert.match(xml,/seo\/dolores-bue-arg\/eventos\//);
    const html=await readFile(join(root,'seo','dolores-bue-arg','farmacias-de-turno','index.html'),'utf8');
    assert.match(html,/<title>Farmacias de turno en Dolores/);
    assert.match(html,/rel="canonical"/);
    assert.match(html,/<iframe[^>]*class="seo-app"/);
    assert.match(html,/seo_destino=farmacias/);
    assert.match(html,/ciudad_id=ciudad1/);
    const eventos=await readFile(join(root,'seo','dolores-bue-arg','eventos','index.html'),'utf8');
    assert.match(eventos,/seo_destino=eventos/);
    assert.match(eventos,/Torneo de fútbol juvenil/);
    assert.match(eventos,/Deportes/);
    assert.match(eventos,/Club local/);
    const promos=await readFile(join(root,'seo','dolores-bue-arg','promociones','index.html'),'utf8');
    assert.match(promos,/seo_destino=promos/);
    assert.match(promos,/Descuento en indumentaria/);
    assert.match(promos,/Comercio de prueba/);
    assert.match(promos,/oferta/);
    const actividades=await readFile(join(root,'seo','dolores-bue-arg','actividades','index.html'),'utf8');
    assert.match(actividades,/seo_destino=actividades/);
    const guia=await readFile(join(root,'seo','dolores-bue-arg','comercios-y-servicios','index.html'),'utf8');
    assert.doesNotMatch(guia,/seo_destino=/);
    const carcasa=await readFile('plataforma/carcasa.html','utf8');
    assert.match(carcasa,/entradaSeo\.get\('ciudad_id'\)/);
    assert.match(carcasa,/cargarCentro\(destinoSeo,\{disparador:MODULOS\[destinoSeo\]\?\.nav\}\)/);
    assert.match(carcasa,/destinoSeo==='farmacias'\?'farmaTurnoGo'/);

    const robots=await readFile(join(root,'robots.txt'),'utf8');
    assert.match(robots,/Sitemap: https:\/\/guialocal\.ar\/sitemap\.xml/);
  } finally {await rm(root,{recursive:true,force:true});}
});
