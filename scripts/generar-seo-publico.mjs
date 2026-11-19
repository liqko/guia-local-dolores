import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// Solo utiliza copias públicas preparadas para Hosting. No consulta servicios privados.
const ORIGIN='https://guialocal.ar';
const escapeHtml = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = v => String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,85);
const unique = a => [...new Set(a.filter(Boolean))];
const readable = row => row && typeof row==='object' && !row.contenido_adulto && row.estado_moderacion!=='RECHAZADO';
const list = (book,name) => {
  const item=book?.modules?.[name];
  if(!item || item.success!==true)return [];
  const field=({guide:'results',events:'events',promos:'promos',activities:'actividades',pharmacy:'ciclos',ephemerides:'efemerides'})[name];
  return Array.isArray(item[field])?item[field]:[];
};
const appLink = (city,extra={}) => {
  const u=new URL('/descubrir',ORIGIN);
  u.searchParams.set('ciudad_id',city.ciudad_id);
  for(const [k,v] of Object.entries(extra))if(v)u.searchParams.set(k,v);
  return u.href;
};
const html = ({title,description,canonical,body,structured}) => '<!doctype html>\n'+
  '<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+escapeHtml(title)+'</title><meta name="description" content="'+escapeHtml(description)+'">'+
  '<meta name="robots" content="index,follow"><link rel="canonical" href="'+canonical+'">'+
  '<meta property="og:type" content="website"><meta property="og:title" content="'+escapeHtml(title)+'">'+
  '<meta property="og:description" content="'+escapeHtml(description)+'">'+
  '<meta property="og:url" content="'+canonical+'">'+
  (structured?'<script type="application/ld+json">'+JSON.stringify(structured).replace(/</g,'\\u003c')+'</script>':'')+
  '<style>body{font:16px/1.55 system-ui,sans-serif;color:#24343c;max-width:880px;margin:auto;padding:26px}a{color:#006699}li{margin:.6rem 0}h1{line-height:1.2}header{border-bottom:2px solid #006699}footer{margin-top:2rem;border-top:1px solid #ddd;padding-top:1rem}</style></head><body>'+
  '<header><a href="'+ORIGIN+'/">Guía Local</a></header><main>'+body+'</main>'+
  '<footer><a href="'+ORIGIN+'/descubrir">Explorar Guía Local</a></footer></body></html>';
const safeRows = (items,caption) => {
  const shown=items.slice(0,60);
  if(!shown.length)return '';
  return '<ul>'+shown.map(x=>'<li>'+escapeHtml(String(x.nombre||x.titulo||x.nombre_sede||x.nombre_ref||x.actividad||caption))+
    (x.descripcion?': '+escapeHtml(String(x.descripcion).slice(0,180)):'')+'</li>').join('')+'</ul>';
};
const parsePublished = source => {
  const match=source.match(/^const published = (.+);$/m);
  if(!match)throw Error('No se encuentra el catálogo territorial publicado');
  const published=JSON.parse(match[1]);
  const cityMatch=source.match(/^const paquetes = .*?JSON\.parse\(("(?:\\.|[^"\\])*")\);$/m);
  if(!cityMatch)throw Error('No se encuentra el manifiesto de paquetes de ciudad');
  return {cities:published.data.ciudades.filter(c=>c.activa!==false), manifest:JSON.parse(JSON.parse(cityMatch[1]))};
};

export async function generarSeoPublico(hostingDir){
  const root=join(hostingDir,'plataforma');
  const source=await readFile(join(root,'territorio-cache.js'),'utf8');
  const {cities,manifest}=parsePublished(source);
  const urls=[];
  const write=async (path,content) => {
    const absolute=join(hostingDir,path);
    await mkdir(join(absolute,'..'),{recursive:true});
    await writeFile(absolute,content,'utf8');
    urls.push(ORIGIN+'/'+path.replace(/\/index\.html$/,'/'));
  };
  const used=new Set();
  for(const city of cities){
    const info=manifest[city.ciudad_id];
    if(!info)continue;
    let book;
    try{book=JSON.parse(await readFile(join(root,'paquetes-ciudad',info.key,'completo-'+info.revision+'.json'),'utf8'));}
    catch{continue;} // Nunca incluir rutas sin contenido disponible.
    if(book.city!==city.ciudad_id||book.revision!==info.revision)continue;
    const town=String(city.ciudad_visible||'').trim();
    const province=String(city.provincia_visible||'').trim();
    const place=[town,province].filter(Boolean).join(', ');
    const citySlug=slug(town)+'-'+slug(city.provincia_id||'')+'-'+slug(city.pais_id||'');
    if(!town || used.has(citySlug))continue;
    used.add(citySlug);
    const base='seo/'+citySlug;
    const guide=list(book,'guide').filter(readable);
    const sections=[];
    const link=(path,title)=>'<li><a href="'+ORIGIN+'/'+path+'/">'+escapeHtml(title)+'</a></li>';
    const add=async (suffix,title,description,body,kind='CollectionPage')=>{
      const path=base+'/'+suffix;
      const canonical=ORIGIN+'/'+path+'/';
      const schema={'@context':'https://schema.org','@type':kind,name:title,description,url:canonical,
        isPartOf:{'@type':'WebSite',name:'Guía Local',url:ORIGIN}};
      await write(path+'/index.html',html({title,description,canonical,body,structured:schema}));
      sections.push({path,title});
    };
    if(guide.length){
      const title='Comercios y servicios en '+town+' | Guía Local';
      const description='Explorá comercios, profesionales y servicios disponibles en '+place+' desde Guía Local.';
      await add('comercios-y-servicios',title,description,'<h1>'+escapeHtml(title.split(' |')[0])+'</h1><p>'+escapeHtml(description)+'</p>'+
        safeRows(guide,'Anunciante')+'<p><a href="'+appLink(city)+'">Ver buscador completo de Guía Local</a></p>');
      const groups=new Map();
      for(const row of guide){
        for(const category of unique([...(Array.isArray(row.categorias)?row.categorias:[]),...(typeof row.categorias==='string'?row.categorias.split(';'):[])])){
          const key=String(category).trim();
          if(!key)continue;
          if(!groups.has(key))groups.set(key,[]);
          groups.get(key).push(row);
        }
      }
      const slugs=new Set();
      for(const [category,rows] of groups){
        const catSlug=slug(category);
        if(!catSlug||slugs.has(catSlug)||rows.length<2)continue;
        slugs.add(catSlug);
        const t=category+' en '+town+' | Guía Local';
        const d='Encontrá '+category.toLowerCase()+' en '+place+'. Consultá los establecimientos publicados en Guía Local.';
        await add('categorias/'+catSlug,t,d,'<h1>'+escapeHtml(category+' en '+town)+'</h1><p>'+escapeHtml(d)+'</p>'+
          safeRows(rows,category)+'<p><a href="'+appLink(city)+'">Abrir Guía Local</a></p>');
      }
    }
    // Farmacias: crear únicamente para ciudades con programación pública.
    const pharmacies=list(book,'pharmacy');
    if(pharmacies.length){
      const title='Farmacias de turno en '+town+' | Guía Local';
      const description='Consultá las farmacias de turno en '+place+', sus direcciones y cómo llegar desde Guía Local.';
      await add('farmacias-de-turno',title,description,'<h1>'+escapeHtml('Farmacias de turno en '+town)+'</h1>'+
        '<p>'+escapeHtml(description)+'</p><p>Los turnos cambian periódicamente. Verificá el turno vigente en la plataforma.</p>'+
        '<p><a href="'+appLink(city)+'">Consultar farmacia de turno actualizada</a></p>','WebPage');
    }
    // Efemérides: no inventar fechas; los calendarios se consultan desde la aplicación.
    const ephemerides=list(book,'ephemerides');
    if(ephemerides.length){
      const title='Efemérides de '+town+' | Guía Local';
      const description='Consultá las efemérides y fechas de interés publicadas para '+place+'.';
      await add('efemerides',title,description,'<h1>'+escapeHtml('Efemérides de '+town)+'</h1><p>'+escapeHtml(description)+'</p>'+
        '<p><a href="'+appLink(city)+'">Ver efemérides de hoy</a></p>','WebPage');
    }
    for(const [family,name,segment] of [['events','Eventos','eventos'],['activities','Actividades','actividades'],['promos','Promociones','promociones']]){
      const rows=list(book,family).filter(readable);
      if(!rows.length)continue;
      const title=name+' en '+town+' | Guía Local';
      const description='Descubrí '+name.toLowerCase()+' publicadas en '+place+' a través de Guía Local.';
      await add(segment,title,description,'<h1>'+escapeHtml(name+' en '+town)+'</h1><p>'+escapeHtml(description)+'</p>'+
        safeRows(rows,name)+'<p><a href="'+appLink(city)+'">Explorar en Guía Local</a></p>');
    }
    if(sections.length){
      const cityTitle='Guía Local en '+town+' | Comercios, eventos y servicios';
      const cityDesc='Descubrí lo que ofrece '+place+': comercios, servicios, actividades y más.';
      const canonical=ORIGIN+'/'+base+'/';
      const body='<h1>'+escapeHtml('Guía Local en '+town)+'</h1><p>'+escapeHtml(cityDesc)+'</p><ul>'+
        sections.map(s=>link(s.path,s.title.replace(' | Guía Local',''))).join('')+'</ul><p><a href="'+appLink(city)+'">Abrir la plataforma en '+escapeHtml(town)+'</a></p>';
      await write(base+'/index.html',html({title:cityTitle,description:cityDesc,canonical,body,
        structured:{'@context':'https://schema.org','@type':'CollectionPage',name:cityTitle,url:canonical}}));
    }
  }
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    unique([ORIGIN+'/',ORIGIN+'/descubrir',...urls]).sort().map(url=>'  <url><loc>'+escapeHtml(url)+'</loc></url>').join('\n')+'\n</urlset>\n';
  await writeFile(join(hostingDir,'sitemap.xml'),xml,'utf8');
  await writeFile(join(hostingDir,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+ORIGIN+'/sitemap.xml\n','utf8');
  return {cities:used.size,pages:urls.length};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const dir=process.argv[2];
  if(!dir)throw Error('Uso: node scripts/generar-seo-publico.mjs <hosting-public>');
  console.log(await generarSeoPublico(dir));
}
