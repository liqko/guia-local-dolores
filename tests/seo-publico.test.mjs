import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generarSeoPublico} from '../plataforma/seo-generador.mjs';

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
