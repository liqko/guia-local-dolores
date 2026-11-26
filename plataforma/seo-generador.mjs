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
  for(const [k,v] of [['pais_id',city.pais_id],['provincia_id',city.provincia_id],['ciudad_id',city.ciudad_id],['pais',city.pais_visible],['provincia',city.provincia_visible],['ciudad',city.ciudad_visible]])if(v)u.searchParams.set(k,v);
  for(const [k,v] of Object.entries(extra))if(v)u.searchParams.set(k,v);
  return u.href;
};
const html = ({title,description,canonical,body,structured,destination}) => '<!doctype html>\n'+
  '<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+escapeHtml(title)+'</title><meta name="description" content="'+escapeHtml(description)+'">'+
  '<meta name="robots" content="index,follow"><link rel="canonical" href="'+canonical+'">'+
  '<meta property="og:type" content="website"><meta property="og:title" content="'+escapeHtml(title)+'">'+
  '<meta property="og:description" content="'+escapeHtml(description)+'">'+
  '<meta property="og:url" content="'+canonical+'">'+
  (structured?'<script type="application/ld+json">'+JSON.stringify(structured).replace(/</g,'\\u003c')+'</script>':'')+
  '<style>body{font:16px/1.55 system-ui,sans-serif;color:#24343c;margin:0;padding:0}a{color:#006699}.seo-info{max-width:960px;margin:auto;padding:14px 22px}h1{line-height:1.2;margin:.4em 0}.seo-app{width:100%;height:85vh;min-height:620px;border:0;display:block}.seo-detalles{max-width:960px;margin:auto;padding:16px 22px}li{margin:.6rem 0}</style></head><body>'+
  '<header class="seo-info"><a href="'+ORIGIN+'/">Guía Local</a></header><main><section class="seo-info"><h1>'+escapeHtml(title.split(' |')[0])+'</h1><p>'+escapeHtml(description)+'</p><p><a href="'+escapeHtml(destination)+'">Abrir Guía Local en pantalla completa</a></p></section>'+
  '<iframe class="seo-app" title="Guía Local, ciudad y funcionalidad seleccionadas" src="'+escapeHtml(destination)+'" loading="eager"></iframe>'+
  '<details class="seo-detalles"><summary>Ver información publicada de esta ciudad</summary>'+body+'</details></main>'+
  '<footer class="seo-info"><a href="'+escapeHtml(destination)+'">Continuar en Guía Local</a></footer></body></html>';
const safeRows = (items,caption) => {
  const shown=items.slice(0,60);
  if(!shown.length)return '';
  return '<ul>'+shown.map(x=>'<li>'+escapeHtml(String(x.nombre||x.titulo||x.nombre_sede||x.nombre_ref||x.actividad||caption))+
    (x.descripcion?': '+escapeHtml(String(x.descripcion).slice(0,180)):'')+'</li>').join('')+'</ul>';
};
// Indexar los mismos nombres, categorías y etiquetas que llegan del paquete público.
// No crear palabras clave ficticias ni nuevas URLs por cada publicación.
const textoPublicacion=(row,keys)=>keys.map(k=>row?.[k]).flatMap(v=>
  Array.isArray(v)?v:typeof v==='string'&&v.includes(';')?v.split(';'):[v]
).map(v=>typeof v==='object'&&v!==null?String(v.nombre||v.descripcion||''):String(v??'').trim())
 .filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
const publicacionesHtml=(rows,family)=>{
  const fields=family==='events'
    ? {title:['nombre_evento','titulo','nombre'],detail:['categoria','tipo','disciplina','organizador','lugar','fecha_desde','fecha_hasta','etiquetas','tags','palabras_clave','descripcion']}
    : family==='promos'
    ? {title:['promo','titulo','nombre'],detail:['anunciante','categoria','rubro','tipo','etiquetas','tags','palabras_clave','descripcion','desde','hasta']}
    : {title:['nombre_actividad','titulo','nombre','actividad'],detail:['categoria','tipo','disciplina','organizador','lugar','etiquetas','tags','palabras_clave','descripcion']};
  return '<ul>'+rows.slice(0,100).map(row=>{
    const title=textoPublicacion(row,fields.title)[0]|| (family==='events'?'Evento':family==='promos'?'Promoción':'Actividad');
    const details=textoPublicacion(row,fields.detail).map(v=>v.slice(0,240)).join(' · ').slice(0,600);
    return '<li><strong>'+escapeHtml(title)+'</strong>'+(details?': '+escapeHtml(details):'')+'</li>';
  }).join('')+'</ul>';
};
const parsePublished = source => {
  const match=source.match(/^const published = (.+);$/m);
  if(!match)throw Error('No se encuentra el catálogo territorial publicado');
  const published=JSON.parse(match[1].replace(/^\s*\/\* GLD_TERRITORY_SNAPSHOT \*\/\s*/,''));
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
      const destino = suffix==='farmacias-de-turno' ? 'farmacias' : suffix==='efemerides' ? 'efemerides' : ['eventos','promociones','actividades'].includes(suffix) ? ({promociones:'promos'}[suffix]||suffix) : 'guia';
      await write(path+'/index.html',html({title,description,canonical,body,structured:schema,destination:appLink(city,destino==='guia'?{}:{seo_destino:destino})}));
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
      // Reutilizar las mismas clasificaciones públicas que usa el buscador.
      const dimensions=[
        ['segmentos', 'Segmento', row=>row.segmento?[row.segmento]:[]],
        ['actividades-clave', 'Actividad', row=>row.actividad?[row.actividad]:[]],
        ['acciones', 'Acción', row=>Array.isArray(row.acciones)?row.acciones:
          typeof row.acciones==='string'?row.acciones.split(/[;,]/):[]]
      ];
      for(const [folder,label,getValues] of dimensions){
        const groups=new Map();
        for(const row of guide)for(const value of getValues(row)){
          const name=typeof value==='string'?value.trim():String(value?.nombre||value?.descripcion||'').trim();
          if(!name)continue;
          if(!groups.has(name))groups.set(name,[]);
          groups.get(name).push(row);
        }
        const slugs=new Set();
        for(const [name,rows] of groups){
          const key=slug(name);
          if(!key||slugs.has(key)||rows.length<2)continue;
          slugs.add(key);
          const title=name+' en '+town+' | Guía Local';
          const description='Descubrí opciones relacionadas con '+name.toLowerCase()+' en '+place+'.';
          await add(folder+'/'+key,title,description,'<h1>'+escapeHtml(name+' en '+town)+'</h1><p>'+escapeHtml(description)+
            '</p>'+safeRows(rows,label)+'<p><a href="'+appLink(city)+'">Explorar en Guía Local</a></p>');
        }
      }
      const temas=[
        ['turismo-lgbt','Turismo LGBT',/\b(lgbt|lgbti|lgbtq|diversidad sexual)\b/i],
        ['pet-friendly','Comercios que aceptan mascotas',/\b(pet friendly|acepta mascotas|admite mascotas)\b/i],
        ['accesibilidad','Accesibilidad',/\b(accesibilidad|accesible|rampa)\b/i]
      ];
      for(const [key,name,pattern] of temas){
        const rows=guide.filter(row=>pattern.test(String(row.tags||'')+' '+String(row.adicionales||'')));
        if(rows.length<2)continue;
        const title=name+' en '+town+' | Guía Local';
        const description='Explorá establecimientos relacionados con '+name.toLowerCase()+' en '+place+'.';
        await add('temas/'+key,title,description,'<h1>'+escapeHtml(name+' en '+town)+'</h1><p>'+escapeHtml(description)+
          '</p>'+safeRows(rows,name)+'<p><a href="'+appLink(city)+'">Ver más en Guía Local</a></p>');
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
      const title=name+' en '+town+' | Guía Local';
      const description='Descubrí '+name.toLowerCase()+' publicados en '+place+' a través de Guía Local.';
      await add(segment,title,description,'<h1>'+escapeHtml(name+' en '+town)+'</h1><p>'+escapeHtml(description)+'</p>'+
        (rows.length?publicacionesHtml(rows,family):'<p>Consultá en Guía Local las publicaciones disponibles para esta ciudad.</p>')+'<p><a href="'+appLink(city,{seo_destino:segment==='promociones'?'promos':segment})+'">Abrir '+escapeHtml(name)+' dentro de Guía Local</a></p>');
    }
    if(sections.length){
      const cityTitle='Guía Local en '+town+' | Comercios, eventos y servicios';
      const cityDesc='Descubrí lo que ofrece '+place+': comercios, servicios, actividades y más.';
      const canonical=ORIGIN+'/'+base+'/';
      const body='<h1>'+escapeHtml('Guía Local en '+town)+'</h1><p>'+escapeHtml(cityDesc)+'</p><ul>'+
        sections.map(s=>link(s.path,s.title.replace(' | Guía Local',''))).join('')+'</ul><p><a href="'+appLink(city)+'">Abrir la plataforma en '+escapeHtml(town)+'</a></p>';
      await write(base+'/index.html',html({title:cityTitle,description:cityDesc,canonical,body,
        structured:{'@context':'https://schema.org','@type':'CollectionPage',name:cityTitle,url:canonical},destination:appLink(city)}));
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
