/**
 * Catálogos estables en KV.
 * Firestore es la verdad, pero la lectura normal de paneles NO recorre colecciones.
 */
const KEYS={
  commerce:"catalogs:commerce:v1",
  promos:"catalogs:promos:v1",
  eventos:"catalogs:eventos:v1",
  actividades:"catalogs:actividades:v1",
  publicidad:"catalogs:publicidad:v1"
};

function active(x){
  if(x.activo===undefined&&x.activa===undefined)return true;
  const v=x.activo??x.activa;
  if(v===true||v===1)return true;
  return ["true","1","si","sí","x","activo","activa"].includes(String(v||"").trim().toLowerCase());
}
const onlyActive=rows=>(rows||[]).filter(active);

export async function getCommerceCatalogs(cache){
  return (await cache.get(KEYS.commerce))||{segmentos:[],categorias:[],actividades_clave:[],acciones:[],nodos:[],funcionalidades:[],niveles_anunciante:[]};
}
export async function getPromosCatalogs(cache){
  return (await cache.get(KEYS.promos))||{categorias:[]};
}
export async function getEventosCatalogs(cache){
  return (await cache.get(KEYS.eventos))||{categorias:[],lugares:[],partners:[]};
}
export async function getActividadesCatalogs(cache){
  return (await cache.get(KEYS.actividades))||{categorias:[],lugares:[]};
}
export async function getPublicidadCatalogs(cache){
  return (await cache.get(KEYS.publicidad))||{categorias:[],ubicaciones:[],prioridades:[]};
}

/**
 * Mantenimiento explícito. Es el único lugar donde estos catálogos se reconstruyen
 * mediante lecturas completas. Nunca lo llama getPanelData.
 */
export async function rebuildCatalogs({db,cache}){
  const [
    segmentos,categorias,actividades,acciones,nodos,funcionalidades,niveles,
    promosCategorias,eventosCategorias,lugares,
    actividadesCategorias,publicidadCategorias,publicidadUbicaciones,publicidadPrioridades
  ]=await Promise.all([
    db.listCollection("segmentos"),
    db.listCollection("categorias"),
    db.listCollection("actividades_clave"),
    db.listCollection("acciones"),
    db.listCollection("nodos"),
    db.listCollection("funcionalidades"),
    db.listCollection("niveles_anunciante"),
    db.listCollection("promos_categorias"),
    db.listCollection("eventos_categorias"),
    db.listCollection("lugares"),
    db.listCollection("actividades_categorias"),
    db.listCollection("publicidad_categorias"),
    db.listCollection("publicidad_ubicaciones"),
    db.listCollection("publicidad_prioridades")
  ]);

  const now=new Date().toISOString();
  await Promise.all([
    cache.put(KEYS.commerce,{updated_at:now,segmentos:onlyActive(segmentos),categorias:onlyActive(categorias),actividades_clave:onlyActive(actividades),acciones:onlyActive(acciones),nodos:onlyActive(nodos),funcionalidades:onlyActive(funcionalidades),niveles_anunciante:onlyActive(niveles)}),
    cache.put(KEYS.promos,{updated_at:now,categorias:onlyActive(promosCategorias)}),
    cache.put(KEYS.eventos,{updated_at:now,categorias:onlyActive(eventosCategorias),lugares:onlyActive(lugares),partners:[]}),
    cache.put(KEYS.actividades,{updated_at:now,categorias:onlyActive(actividadesCategorias),lugares:onlyActive(lugares)}),
    cache.put(KEYS.publicidad,{updated_at:now,categorias:onlyActive(publicidadCategorias),ubicaciones:onlyActive(publicidadUbicaciones),prioridades:onlyActive(publicidadPrioridades)})
  ]);

  return {success:true,updated_at:now};
}

export {KEYS as catalogKeys};
