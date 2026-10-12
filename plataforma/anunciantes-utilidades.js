(function(root){
  'use strict';
  const texto=v=>String(v??'').trim();
  const claves=['pais_id','provincia_id','ciudad_id','pais','provincia','ciudad','anunciante_id','sede_id'];
  function parametros(href,referrer,embebido=false){
    const propios=new URL(href).searchParams;
    if(embebido){
      try{
        const padre=new URL(referrer).searchParams;
        const ciudadesDistintas=propios.get('ciudad_id')&&padre.get('ciudad_id')&&propios.get('ciudad_id')!==padre.get('ciudad_id');
        for(const k of claves){
          if(ciudadesDistintas&&(k==='anunciante_id'||k==='sede_id'))continue;
          if(!propios.has(k)&&padre.has(k))propios.set(k,padre.get(k));
        }
      }catch(_){}
    }
    return propios;
  }
  function urlFicha(id,contexto={},sedeId=''){
    if(!texto(id))throw new Error('Falta identificar el anunciante.');
    const u=new URL('https://guialocal.ar/guia/');
    for(const k of ['pais_id','provincia_id','ciudad_id'])if(texto(contexto[k]))u.searchParams.set(k,texto(contexto[k]));
    u.searchParams.set('anunciante_id',texto(id));
    if(texto(sedeId))u.searchParams.set('sede_id',texto(sedeId));
    return u.toString();
  }
  async function compartir(datos,navegador=root.navigator,abrir=(...args)=>root.open(...args)){
    const nombre=texto(datos.nombre);
    const contenido={title:nombre?nombre+' | Guía Local':'Guía Local',text:nombre?'📍 '+nombre+'\nMirá su ficha en Guía Local:':'Mirá esta ficha en Guía Local:',url:urlFicha(datos.id,datos.contexto,datos.sede_id)};
    const mensaje=contenido.text+'\n'+contenido.url;
    if(typeof navegador?.share==='function'){
      try{await navegador.share(contenido);return 'compartido';}
      catch(e){if(e?.name==='AbortError')return 'cancelado';}
    }
    if(typeof navegador?.clipboard?.writeText==='function'){
      try{await navegador.clipboard.writeText(mensaje);return 'copiado';}catch(_){}
    }
    abrir('https://wa.me/?text='+encodeURIComponent(mensaje),'_blank','noopener,noreferrer');
    return 'whatsapp';
  }
  function filtroFicha(filas,params){
    const id=texto(params.get('anunciante_id')),sede=texto(params.get('sede_id'));
    if(!id)return filas;
    return filas.filter(item=>[item.id,item.anunciante_id,item.id_comercio,item.__id].some(x=>texto(x)===id))
      .flatMap(item=>{
        if(!sede)return [item];
        const sedes=(Array.isArray(item.sedes)?item.sedes:[]).filter(x=>texto(x.sede_id||x.id)===sede);
        return sedes.length?[{...item,sedes}]:[];
      });
  }
  function filtroActividades(params,storage,ahora=Date.now()){
    const id=texto(params.get('anunciante_id'));
    if(id)return {anunciante_id:id,actividad_ids:[]};
    try{
      const d=JSON.parse(storage.getItem('gld_actividades_filter')||'null'),edad=ahora-Number(d?.ts||0);
      const ciudad=texto(params.get('ciudad_id'));
      if(d&&edad>=0&&edad<=10*60*1000&&(!d.ciudad_id||!ciudad||texto(d.ciudad_id)===ciudad))return {
        anunciante_id:texto(d.anunciante_id),
        actividad_ids:Array.isArray(d.actividad_ids)?d.actividad_ids.map(texto).filter(Boolean):[]
      };
    }catch(_){}
    return null;
  }
  function actividadCoincide(a,filtro){
    if(!filtro)return true;
    if(filtro.anunciante_id&&texto(a.anunciante_id)!==filtro.anunciante_id)return false;
    return !filtro.actividad_ids.length||filtro.actividad_ids.includes(texto(a.actividad_id||a.id));
  }
  function ordenarAutorizados(filas,nombre=item=>item.anunciante_nombre||item.nombre||item.anunciante_id||''){
    return (Array.isArray(filas)?filas:[]).slice().sort((a,b)=>
      texto(nombre(a)).localeCompare(texto(nombre(b)),'es',{sensitivity:'base',numeric:true})||
      texto(a.anunciante_id||a.id).localeCompare(texto(b.anunciante_id||b.id),'es',{numeric:true}));
  }
  root.GLD_ANUNCIANTES_UI={parametros,urlFicha,compartir,filtroFicha,filtroActividades,actividadCoincide,ordenarAutorizados};
})(globalThis);
