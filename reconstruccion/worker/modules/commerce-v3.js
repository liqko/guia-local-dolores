function text(v){return String(v??"").trim();}
function ids(v){
  if(Array.isArray(v))return [...new Set(v.map(text).filter(Boolean))];
  return [...new Set(text(v).split(/[;,|\n]/).map(text).filter(Boolean))];
}
function newSedeId(advertiserId){
  return "SED-"+text(advertiserId)+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,10);
}
const DATA_ALLOWED=new Set([
  "actividad","descripcion","tags","adicionales","logo","link","segmento_id","categoria_id","categoria_ids",
  "img1","img2","img3","img4","img5","img6","img7","img8","img9","img10"
]);
const SEDE_ALLOWED=new Set([
  "nombre_sede","direccion","lat","lng","maps",
  "telefono","telefono2","telefono3","telefono4","telefono5",
  "whatsapp","whatsapp2","whatsapp3","whatsapp4","whatsapp5",
  "mail","mail2","mail3","instagram","facebook","youtube","tiktok","linkedin","x",
  "img1","img2","img3","img4","img5","img6","img7","img8","img9","img10",
  "estado","ciudad_id","pais_id","provincia_id","codigo_postal","actividad_ids","accion_ids","nodo_ids"
]);

export async function commercePanelDataV3({db,advertiserId,catalogs}){
  const [datos,administracion,sedes]=await Promise.all([
    db.get("anunciantes",advertiserId),
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId,500)
  ]);
  if(!datos)return{success:false,error:"anunciante_no_encontrado"};
  return{success:true,advertiser:{
    id:advertiserId,datos,administracion:administracion||{},sedes,
    segmentos:catalogs.segmentos||[],categorias:catalogs.categorias||[],
    actividades_clave:catalogs.actividades_clave||[],acciones:catalogs.acciones||[],
    nodos:catalogs.nodos||[],funcionalidades:catalogs.funcionalidades||[],
    niveles_anunciante:catalogs.niveles_anunciante||[]
  }};
}

export async function commerceSetDatosV3({db,advertiserId,body}){
  const patch={actualizado_en:new Date().toISOString()};
  for(const [k,v] of Object.entries(body||{})){
    if(!DATA_ALLOWED.has(k))continue;
    if(k==="categoria_id"||k==="categoria_ids")patch.categoria_ids=ids(v);
    else patch[k]=v;
  }
  if(Object.keys(patch).length===1)return{success:true,updated:false,id:advertiserId,patch:{}};
  const saved=await db.patch("anunciantes",advertiserId,patch,{mustExist:true});
  return{success:true,updated:true,id:advertiserId,patch,advertiser:saved};
}

export async function commerceSetSedesV3({db,advertiserId,body}){
  const incoming=Array.isArray(body&&body.sedes)?body.sedes:[];
  const saved=[];
  for(const raw of incoming){
    const existingId=text(raw&&raw.sede_id);
    const id=existingId||newSedeId(advertiserId);
    if(existingId){
      const current=await db.get("anunciantes_sedes",id);
      if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La sede no pertenece al anunciante.");
    }
    const patch={sede_id:id,anunciante_id:advertiserId,actualizado_en:new Date().toISOString()};
    for(const [k,v] of Object.entries(raw||{})){
      if(!SEDE_ALLOWED.has(k))continue;
      patch[k]=["actividad_ids","accion_ids","nodo_ids"].includes(k)?ids(v):v;
    }
    const doc=await db.patch("anunciantes_sedes",id,patch,{mustExist:!!existingId});
    saved.push(doc);
  }
  return{success:true,updated:!!saved.length,id:advertiserId,sedes:saved};
}

export async function commerceDeleteSedeV3({db,advertiserId,body}){
  const id=text(body&&body.sede_id);
  if(!id)throw new Error("Falta sede_id.");
  const current=await db.get("anunciantes_sedes",id);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La sede no pertenece al anunciante.");
  await db.delete("anunciantes_sedes",id,{mustExist:true});
  return{success:true,deleted:true,sede_id:id,previous:current};
}
