import {guideCityKey,guideAdvertiserKey} from "./guide-read-model-v2.js";
import {ADMIN_ADVERTISERS_KEY} from "./admin-indexes-v2.js";

const text=v=>String(v??"").trim();
const ids=v=>Array.isArray(v)?v.map(text).filter(Boolean):text(v).split(/[;,|\n]/).map(text).filter(Boolean);

function sortCards(rows){
  return [...rows].sort((a,b)=>text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"}));
}
function mapBy(rows,field){
  const m=new Map();
  for(const r of rows||[]){
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
async function writeCityPacket(cache,cityId,aid,card){
  const key=guideCityKey(cityId);
  const packet=(await cache.get(key))||{version:2,ciudad_id:cityId,updated_at:"",anunciantes:[]};
  let rows=(packet.anunciantes||[]).filter(x=>text(x.id)!==text(aid));
  if(card&&card.aprobado!==false)rows.push(card);
  await cache.put(key,{version:2,ciudad_id:cityId,updated_at:new Date().toISOString(),anunciantes:sortCards(rows)});
}
function updateIndexRow(row,patch){
  const out={...row};
  if("nombre" in patch)out.nombre=text(patch.nombre);
  if("segmento_id" in patch)out.segmento_id=text(patch.segmento_id);
  const searchable=["nombre","actividad","descripcion"];
  if(searchable.some(k=>Object.prototype.hasOwnProperty.call(patch,k))){
    const current=[out.id,out.nombre,patch.actividad??row.actividad,patch.descripcion??row.descripcion].filter(Boolean).join(" ");
    out.search=text(current).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
  }
  return out;
}
async function patchAdminIndex(cache,aid,patch,cities){
  const packet=await cache.get(ADMIN_ADVERTISERS_KEY);
  if(!packet||!Array.isArray(packet.results))return;
  const rows=[...packet.results];
  const i=rows.findIndex(x=>text(x.id)===text(aid));
  if(i<0)return;
  let row=updateIndexRow(rows[i],patch||{});
  if(Array.isArray(cities))row.ciudad_ids=[...new Set(cities.map(text).filter(Boolean))];
  rows[i]=row;
  await cache.put(ADMIN_ADVERTISERS_KEY,{...packet,updated_at:new Date().toISOString(),results:sortCards(rows)});
}
function sedePublic(raw,{territory,catalogs}){
  const cityId=text(raw.ciudad_id);
  const city=(territory.ciudades||[]).find(c=>text(c.ciudad_id||c.id)===cityId)||{};
  const actMap=mapBy(catalogs.actividades_clave,"actividad_id");
  const accMap=mapBy(catalogs.acciones,"accion_id");
  const nodeMap=mapBy(catalogs.nodos,"nodo_id");
  return {
    sede_id:text(raw.sede_id||raw.id),
    nombre_sede:text(raw.nombre_sede),
    direccion:text(raw.direccion),
    ciudad_id:cityId,
    ciudad:text(raw.ciudad||city.ciudad_visible),
    provincia_id:text(raw.provincia_id||city.provincia_id),
    provincia:text(raw.provincia||city.provincia_visible),
    pais_id:text(raw.pais_id||city.pais_id),
    pais:text(raw.pais||city.pais_visible),
    codigo_postal:text(raw.codigo_postal||city.codigo_postal),
    lat:raw.lat??"",lng:raw.lng??"",maps:text(raw.maps),
    telefono:text(raw.telefono),telefono2:text(raw.telefono2),telefono3:text(raw.telefono3),telefono4:text(raw.telefono4),telefono5:text(raw.telefono5),
    whatsapp:text(raw.whatsapp),whatsapp2:text(raw.whatsapp2),whatsapp3:text(raw.whatsapp3),whatsapp4:text(raw.whatsapp4),whatsapp5:text(raw.whatsapp5),
    mail:text(raw.mail),mail2:text(raw.mail2),mail3:text(raw.mail3),
    instagram:text(raw.instagram),facebook:text(raw.facebook),youtube:text(raw.youtube),tiktok:text(raw.tiktok),x:text(raw.x),linkedin:text(raw.linkedin),
    estado:text(raw.estado),
    actividades:relObjects(raw.actividad_ids,actMap,"actividad_id"),
    acciones:relObjects(raw.accion_ids,accMap,"accion_id"),
    nodos:relObjects(raw.nodo_ids,nodeMap,"nodo_id"),
    img1:text(raw.img1),img2:text(raw.img2),img3:text(raw.img3),img4:text(raw.img4),img5:text(raw.img5),
    img6:text(raw.img6),img7:text(raw.img7),img8:text(raw.img8),img9:text(raw.img9),img10:text(raw.img10)
  };
}
function applyCardData(card,patch,catalogs){
  const out={...card};
  const direct=["nombre","actividad","descripcion","tags","adicionales","logo","link","img1","img2","img3","img4","img5","img6","img7","img8","img9","img10"];
  for(const k of direct)if(Object.prototype.hasOwnProperty.call(patch,k))out[k]=text(patch[k]);
  if(Object.prototype.hasOwnProperty.call(patch,"segmento_id")){
    const sid=text(patch.segmento_id);
    const x=(catalogs.segmentos||[]).find(s=>text(s.segmento_id||s.id)===sid)||{};
    out.segmento_id=sid;out.segmento=text(x.nombre);
  }
  if(Object.prototype.hasOwnProperty.call(patch,"categoria_ids")||Object.prototype.hasOwnProperty.call(patch,"categoria_id")){
    const vals=ids(patch.categoria_ids??patch.categoria_id);
    const map=mapBy(catalogs.categorias,"categoria_id");
    out.categoria_ids=vals;
    out.categorias=vals.map(id=>map.get(id)).filter(Boolean).map(x=>text(x.nombre)).filter(Boolean);
  }
  return out;
}

export async function patchGuideAdvertiserDataFromCacheV2({cache,advertiserId,patch}){
  const aid=text(advertiserId);
  const [base,catalogs]=await Promise.all([
    cache.get(guideAdvertiserKey(aid)),
    cache.get("catalogs:commerce:v1")
  ]);
  if(!base||!Array.isArray(base.cards))return{success:true,needs_seed:true};

  const cards=base.cards.map(c=>applyCardData(c,patch,catalogs||{}));
  for(const card of cards)await writeCityPacket(cache,text(card.ciudad_id),aid,card);
  await cache.put(guideAdvertiserKey(aid),{...base,updated_at:new Date().toISOString(),cards});
  await patchAdminIndex(cache,aid,patch,base.ciudades||[]);
  return{success:true,updated:true,firestore_reads:0};
}

export async function patchGuideAdvertiserSedesFromCacheV2({cache,advertiserId,savedSedes=[],deletedSedeId=""}){
  const aid=text(advertiserId);
  const [base,catalogs,territory]=await Promise.all([
    cache.get(guideAdvertiserKey(aid)),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  if(!base||!Array.isArray(base.cards))return{success:true,needs_seed:true};

  const cards=new Map((base.cards||[]).map(c=>[text(c.ciudad_id),{...c,sedes:[...(c.sedes||[])]}]));
  const affected=new Set();

  const removeSede=id=>{
    for(const [city,card] of cards){
      const before=(card.sedes||[]).length;
      card.sedes=(card.sedes||[]).filter(s=>text(s.sede_id)!==text(id));
      if(card.sedes.length!==before)affected.add(city);
    }
  };

  if(deletedSedeId)removeSede(deletedSedeId);

  for(const raw of savedSedes||[]){
    const sid=text(raw.sede_id||raw.id);
    if(!sid)continue;
    removeSede(sid);
    const cityId=text(raw.ciudad_id);
    if(!cityId)continue;

    let card=cards.get(cityId);
    if(!card){
      const template=[...cards.values()][0]||(base.cards||[])[0];
      if(!template)continue;
      const city=(territory&&territory.ciudades||[]).find(c=>text(c.ciudad_id||c.id)===cityId)||{};
      card={...template,ciudad_id:cityId,ciudad:text(city.ciudad_visible),provincia_id:text(city.provincia_id),provincia:text(city.provincia_visible),pais_id:text(city.pais_id),pais:text(city.pais_visible),sedes:[]};
      cards.set(cityId,card);
    }
    card.sedes.push(sedePublic(raw,{territory:territory||{},catalogs:catalogs||{}}));
    affected.add(cityId);
  }

  for(const [city,card] of [...cards.entries()]){
    if(!(card.sedes||[]).length){
      cards.delete(city);
      affected.add(city);
    }
  }

  for(const city of affected){
    await writeCityPacket(cache,city,aid,cards.get(city)||null);
  }

  const nextCards=[...cards.values()];
  const ciudades=nextCards.map(c=>text(c.ciudad_id)).filter(Boolean);
  await cache.put(guideAdvertiserKey(aid),{...base,updated_at:new Date().toISOString(),ciudades,cards:nextCards});
  await patchAdminIndex(cache,aid,{},ciudades);
  return{success:true,updated:true,ciudades_actualizadas:[...affected],firestore_reads:0};
}
