/**
 * GUIA READ MODEL V2
 *
 * Clave del benchmark:
 * - cambio comercial admin (verificado/gold/nivel/subnivel/aprobado):
 *   1 PATCH Firestore + KV puntual, 0 lecturas Firestore adicionales.
 * - el mapa anunciante -> ciudades y las tarjetas base quedan preparados en KV.
 */
const text=v=>String(v??"").trim();
const bool=v=>{
  if(v===true||v===1)return true;
  return ["true","1","si","sí","x","aprobado","activo","activa"].includes(text(v).toLowerCase());
};
const ids=v=>Array.isArray(v)?v.map(text).filter(Boolean):text(v).split(/[;,|\n]/).map(text).filter(Boolean);

export const guideCityKey=cityId=>"guide:city:v1:"+text(cityId);
export const guideAdvertiserKey=aid=>"guide:advertiser:v2:"+text(aid);

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
function sortCards(rows){
  return [...rows].sort((a,b)=>text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"}));
}
function publicAllowed(card){
  return card&&card.aprobado!==false;
}
function upsertCard(rows,card){
  const aid=text(card&&card.id);
  const out=(rows||[]).filter(x=>text(x.id)!==aid);
  if(publicAllowed(card))out.push(card);
  return sortCards(out);
}

export function buildGuideCardBaseV2({advertiser,admin,sedes,catalogs,territory,cityId}){
  if(!advertiser)return null;
  const city=text(cityId);
  const citySedes=(sedes||[]).filter(s=>text(s.ciudad_id)===city);
  if(!city)return null;

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

  return {
    id:text(advertiser.id||advertiser.anunciante_id),
    nombre:text(advertiser.nombre),
    aprobado:admin&&admin.aprobado!==undefined?bool(admin.aprobado):true,
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
    sedes:citySedes.map(s=>({
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
      lat:s.lat??"",lng:s.lng??"",maps:text(s.maps),
      telefono:text(s.telefono),telefono2:text(s.telefono2),telefono3:text(s.telefono3),telefono4:text(s.telefono4),telefono5:text(s.telefono5),
      whatsapp:text(s.whatsapp),whatsapp2:text(s.whatsapp2),whatsapp3:text(s.whatsapp3),whatsapp4:text(s.whatsapp4),whatsapp5:text(s.whatsapp5),
      mail:text(s.mail),mail2:text(s.mail2),mail3:text(s.mail3),
      instagram:text(s.instagram),facebook:text(s.facebook),youtube:text(s.youtube),tiktok:text(s.tiktok),x:text(s.x),linkedin:text(s.linkedin),
      estado:text(s.estado),
      actividades:relObjects(s.actividad_ids,actMap,"actividad_id"),
      acciones:relObjects(s.accion_ids,actionMap,"accion_id"),
      nodos:relObjects(s.nodo_ids,nodeMap,"nodo_id"),
      img1:text(s.img1),img2:text(s.img2),img3:text(s.img3),img4:text(s.img4),img5:text(s.img5),
      img6:text(s.img6),img7:text(s.img7),img8:text(s.img8),img9:text(s.img9),img10:text(s.img10)
    }))
  };
}

export async function syncGuideAdvertiserV2({db,cache,advertiserId,affectedCityIds=[]}){
  const aid=text(advertiserId);
  const [advertiser,admin,sedes,catalogs,territory,previousBase]=await Promise.all([
    db.get("anunciantes",aid),
    db.get("anunciantes_administracion",aid),
    db.queryEqual("anunciantes_sedes","anunciante_id",aid,500),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1"),
    cache.get(guideAdvertiserKey(aid))
  ]);

  const sedeCities=(sedes||[]).map(s=>text(s.ciudad_id)).filter(Boolean);
  const currentCities=[...new Set(sedeCities.length?sedeCities:[text(advertiser?.ciudad_id),...(previousBase?.ciudades||[])].filter(Boolean))];
  const previousCities=Array.isArray(previousBase&&previousBase.ciudades)?previousBase.ciudades:[];
  const targets=[...new Set([...(affectedCityIds||[]).map(text),...previousCities,...currentCities].filter(Boolean))];

  const cards=[];
  if(advertiser){
    for(const cityId of currentCities){
      const card=buildGuideCardBaseV2({
        advertiser,admin:admin||{},sedes,catalogs:catalogs||{},territory:territory||{},cityId
      });
      if(card)cards.push(card);
    }
  }
  const cardMap=new Map(cards.map(c=>[text(c.ciudad_id),c]));

  for(const cityId of targets){
    const key=guideCityKey(cityId);
    const packet=(await cache.get(key))||{version:2,ciudad_id:cityId,updated_at:"",anunciantes:[]};
    const base=cardMap.get(cityId);
    let rows=(packet.anunciantes||[]).filter(x=>text(x.id)!==aid);
    if(base&&publicAllowed(base))rows.push(base);
    await cache.put(key,{version:2,ciudad_id:cityId,updated_at:new Date().toISOString(),anunciantes:sortCards(rows)});
  }

  await cache.put(guideAdvertiserKey(aid),{
    version:2,
    anunciante_id:aid,
    updated_at:new Date().toISOString(),
    ciudades:currentCities,
    template:cards[0]||previousBase?.template||previousBase?.cards?.[0],
    cards
  });

  return{success:true,advertiser_id:aid,ciudades_actualizadas:targets};
}

export async function patchGuideAdminFieldsV2({cache,advertiserId,patch}){
  const aid=text(advertiserId);
  const allowed=["aprobado","nivel","subnivel","verificado","gold"];
  const relevant={};
  for(const key of allowed)if(Object.prototype.hasOwnProperty.call(patch||{},key))relevant[key]=patch[key];
  if(!Object.keys(relevant).length)return{success:true,changed:false,firestore_reads:0};

  const base=await cache.get(guideAdvertiserKey(aid));
  if(!base||!Array.isArray(base.cards)){
    return{success:true,changed:false,needs_full_sync:true,firestore_reads:0};
  }

  const nextCards=base.cards.map(card=>{
    const out={...card};
    if("aprobado" in relevant)out.aprobado=!!relevant.aprobado;
    if("nivel" in relevant)out.nivel=text(relevant.nivel);
    if("subnivel" in relevant)out.subnivel=text(relevant.subnivel);
    if("verificado" in relevant)out.verificado=!!relevant.verificado;
    if("gold" in relevant)out.gold=!!relevant.gold;
    return out;
  });

  for(const card of nextCards){
    const cityId=text(card.ciudad_id),key=guideCityKey(cityId);
    const packet=(await cache.get(key))||{version:2,ciudad_id:cityId,updated_at:"",anunciantes:[]};
    await cache.put(key,{
      version:2,
      ciudad_id:cityId,
      updated_at:new Date().toISOString(),
      anunciantes:upsertCard(packet.anunciantes||[],card)
    });
  }

  await cache.put(guideAdvertiserKey(aid),{
    ...base,
    updated_at:new Date().toISOString(),
    template:nextCards[0]||Object.assign({},base.template||{},relevant),
    cards:nextCards
  });

  return{success:true,changed:true,ciudades:(base.ciudades||[]),firestore_reads:0};
}

export async function rebuildGuideAllV2({db,cache}){
  const [advertisers,admins,sedes,catalogs,territory]=await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const adminMap=new Map(admins.map(a=>[text(a.id||a.anunciante_id),a]));
  const sedesBy=new Map();
  for(const s of sedes){
    const aid=text(s.anunciante_id);if(!sedesBy.has(aid))sedesBy.set(aid,[]);
    sedesBy.get(aid).push(s);
  }
  const byCity=new Map(),baseWrites=[];
  for(const adv of advertisers){
    const aid=text(adv.id||adv.anunciante_id),advSedes=sedesBy.get(aid)||[];
    const previousBase=await cache.get(guideAdvertiserKey(aid));
    const sedeCities=advSedes.map(s=>text(s.ciudad_id)).filter(Boolean);
    const cities=[...new Set(sedeCities.length?sedeCities:[text(adv.ciudad_id),...(previousBase?.ciudades||[])].filter(Boolean))];
    const cards=[];
    for(const cityId of cities){
      const card=buildGuideCardBaseV2({
        advertiser:adv,admin:adminMap.get(aid)||{},sedes:advSedes,
        catalogs:catalogs||{},territory:territory||{},cityId
      });
      if(!card)continue;
      cards.push(card);
      if(publicAllowed(card)){
        if(!byCity.has(cityId))byCity.set(cityId,[]);
        byCity.get(cityId).push(card);
      }
    }
    baseWrites.push(cache.put(guideAdvertiserKey(aid),{
      version:2,anunciante_id:aid,updated_at:new Date().toISOString(),ciudades:cities,template:cards[0]||previousBase?.template,cards
    }));
  }
  const now=new Date().toISOString();
  await Promise.all([
    ...baseWrites,
    ...[...byCity.entries()].map(([cityId,cards])=>cache.put(guideCityKey(cityId),{
      version:2,ciudad_id:cityId,updated_at:now,anunciantes:sortCards(cards)
    }))
  ]);
  return{success:true,ciudades:byCity.size,anunciantes:advertisers.length,updated_at:now};
}
