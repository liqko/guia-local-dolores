/**
 * READ MODEL — GUIA PUBLICA POR CIUDAD
 *
 * Fuente de verdad: Firestore.
 * Lectura pública normal: KV exclusivamente.
 * Mutación de un anunciante: actualiza sólo las ciudades realmente afectadas.
 */

const text=v=>String(v??"").trim();
const bool=v=>{
  if(v===true||v===1)return true;
  return ["true","1","si","sí","x","aprobado","activo","activa"].includes(text(v).toLowerCase());
};
const ids=v=>Array.isArray(v)?v.map(text).filter(Boolean):text(v).split(/[;,|\n]/).map(text).filter(Boolean);

export const guideCityKey=cityId=>"guide:city:v1:"+text(cityId);

function mapBy(rows,field){
  const m=new Map();
  for(const r of (rows||[])){
    const id=text(r&&r[field]||r&&r.id);
    if(id)m.set(id,r);
  }
  return m;
}
function relObjects(values,map,idField){
  return ids(values).map(id=>{
    const x=map.get(id)||{};
    return {[idField]:id,nombre:text(x.nombre),insignia:text(x.insignia)};
  });
}

export function buildGuideCard({advertiser,admin,sedes,catalogs,territory,cityId}){
  if(!advertiser)return null;
  if(admin && admin.aprobado!==undefined && !bool(admin.aprobado))return null;

  const city=text(cityId);
  const citySedes=(sedes||[]).filter(s=>text(s.ciudad_id)===city);
  if(!citySedes.length)return null;

  const segMap=mapBy(catalogs.segmentos,"segmento_id");
  const catMap=mapBy(catalogs.categorias,"categoria_id");
  const actMap=mapBy(catalogs.actividades_clave,"actividad_id");
  const actionMap=mapBy(catalogs.acciones,"accion_id");
  const nodeMap=mapBy(catalogs.nodos,"nodo_id");

  const segmentoId=text(advertiser.segmento_id);
  const segmento=segMap.get(segmentoId)||{};
  const categoriaIds=ids(advertiser.categoria_ids||advertiser.categoria_id);
  const categorias=categoriaIds.map(id=>catMap.get(id)).filter(Boolean).map(x=>text(x.nombre)).filter(Boolean);

  const cityMeta=(territory.ciudades||[]).find(x=>text(x.ciudad_id||x.id)===city)||{};

  const sedesPublicas=citySedes.map(s=>({
    sede_id:text(s.sede_id||s.id),
    nombre_sede:text(s.nombre_sede),
    direccion:text(s.direccion),
    ciudad_id:city,
    ciudad:text(s.ciudad||cityMeta.ciudad_visible),
    provincia_id:text(s.provincia_id||cityMeta.provincia_id),
    provincia:text(s.provincia||cityMeta.provincia_visible),
    pais_id:text(s.pais_id||cityMeta.pais_id),
    pais:text(s.pais||cityMeta.pais_visible),
    codigo_postal:text(s.codigo_postal),
    lat:s.lat??"",
    lng:s.lng??"",
    maps:text(s.maps),
    telefono:text(s.telefono),
    telefono2:text(s.telefono2),
    telefono3:text(s.telefono3),
    telefono4:text(s.telefono4),
    telefono5:text(s.telefono5),
    whatsapp:text(s.whatsapp),
    whatsapp2:text(s.whatsapp2),
    whatsapp3:text(s.whatsapp3),
    whatsapp4:text(s.whatsapp4),
    whatsapp5:text(s.whatsapp5),
    mail:text(s.mail),
    mail2:text(s.mail2),
    mail3:text(s.mail3),
    instagram:text(s.instagram),
    facebook:text(s.facebook),
    youtube:text(s.youtube),
    tiktok:text(s.tiktok),
    x:text(s.x),
    linkedin:text(s.linkedin),
    estado:text(s.estado),
    actividades:relObjects(s.actividad_ids,actMap,"actividad_id"),
    acciones:relObjects(s.accion_ids,actionMap,"accion_id"),
    nodos:relObjects(s.nodo_ids,nodeMap,"nodo_id"),
    img1:text(s.img1),img2:text(s.img2),img3:text(s.img3),img4:text(s.img4),img5:text(s.img5),
    img6:text(s.img6),img7:text(s.img7),img8:text(s.img8),img9:text(s.img9),img10:text(s.img10)
  }));

  return {
    id:text(advertiser.id||advertiser.anunciante_id),
    nombre:text(advertiser.nombre),
    nivel:text(admin&&admin.nivel),
    subnivel:text(admin&&admin.subnivel),
    verificado:bool(admin&&admin.verificado),
    gold:bool(admin&&admin.gold),
    segmento_id:segmentoId,
    segmento:text(segmento.nombre),
    categoria_ids:categoriaIds,
    categorias,
    actividad:text(advertiser.actividad),
    descripcion:text(advertiser.descripcion),
    tags:text(advertiser.tags),
    adicionales:text(advertiser.adicionales),
    logo:text(advertiser.logo),
    img1:text(advertiser.img1),img2:text(advertiser.img2),img3:text(advertiser.img3),
    img4:text(advertiser.img4),img5:text(advertiser.img5),img6:text(advertiser.img6),
    img7:text(advertiser.img7),img8:text(advertiser.img8),img9:text(advertiser.img9),img10:text(advertiser.img10),
    link:text(advertiser.link),
    ciudad_id:city,
    ciudad:text(cityMeta.ciudad_visible),
    provincia_id:text(cityMeta.provincia_id),
    provincia:text(cityMeta.provincia_visible),
    pais_id:text(cityMeta.pais_id),
    pais:text(cityMeta.pais_visible),
    sedes:sedesPublicas
  };
}

function sortCards(rows){
  return [...rows].sort((a,b)=>text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"}));
}

export async function syncGuideAdvertiser({db,cache,advertiserId,affectedCityIds=[]}){
  const aid=text(advertiserId);
  const [advertiser,admin,sedes,catalogs,territory]=await Promise.all([
    db.get("anunciantes",aid),
    db.get("anunciantes_administracion",aid),
    db.queryEqual("anunciantes_sedes","anunciante_id",aid),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);

  const currentCities=[...new Set((sedes||[]).map(s=>text(s.ciudad_id)).filter(Boolean))];
  const targets=[...new Set([...(affectedCityIds||[]).map(text),...currentCities].filter(Boolean))];

  for(const cityId of targets){
    const key=guideCityKey(cityId);
    const packet=(await cache.get(key))||{version:1,ciudad_id:cityId,updated_at:"",anunciantes:[]};
    const rows=(packet.anunciantes||[]).filter(x=>text(x.id)!==aid);
    const card=buildGuideCard({
      advertiser,admin,sedes,
      catalogs:catalogs||{},
      territory:territory||{},
      cityId
    });
    if(card)rows.push(card);
    await cache.put(key,{
      version:1,
      ciudad_id:cityId,
      updated_at:new Date().toISOString(),
      anunciantes:sortCards(rows)
    });
  }

  return {success:true,advertiser_id:aid,ciudades_actualizadas:targets};
}

export async function getGuideCity({cache,cityId}){
  const city=text(cityId);
  if(!city)return {success:false,message:"ciudad_id obligatorio",status:400};
  const packet=await cache.get(guideCityKey(city));
  if(!packet)return {success:true,ciudad_id:city,anunciantes:[],cold:true};
  return {success:true,...packet};
}

/**
 * Mantenimiento explícito. Recorre Firestore sólo cuando un administrador
 * decide inicializar/reconstruir la proyección completa.
 */
export async function rebuildGuideAll({db,cache}){
  const [advertisers,admins,sedes,catalogs,territory]=await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const adminMap=mapBy(admins,"id");
  const sedesByAdv=new Map();
  for(const s of sedes){
    const aid=text(s.anunciante_id);
    if(!sedesByAdv.has(aid))sedesByAdv.set(aid,[]);
    sedesByAdv.get(aid).push(s);
  }

  const byCity=new Map();
  for(const adv of advertisers){
    const aid=text(adv.id||adv.anunciante_id);
    const advSedes=sedesByAdv.get(aid)||[];
    const cityIds=[...new Set(advSedes.map(s=>text(s.ciudad_id)).filter(Boolean))];
    for(const cityId of cityIds){
      const card=buildGuideCard({
        advertiser:adv,
        admin:adminMap.get(aid)||{},
        sedes:advSedes,
        catalogs:catalogs||{},
        territory:territory||{},
        cityId
      });
      if(!card)continue;
      if(!byCity.has(cityId))byCity.set(cityId,[]);
      byCity.get(cityId).push(card);
    }
  }

  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(([cityId,cards])=>
    cache.put(guideCityKey(cityId),{
      version:1,ciudad_id:cityId,updated_at:now,anunciantes:sortCards(cards)
    })
  ));
  return {success:true,ciudades:byCity.size,anunciantes:advertisers.length,updated_at:now};
}
