import {syncPromo,getPromosCity} from "../core/promos-read-model.js";
import {changedFieldsV1,sameValueV1} from "../core/changed-fields-v1.js";

const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
const paused=p=>bool(p&&p.pausado);

function categoryFrom(catalogs,value){
  const needle=text(value);
  const norm=s=>text(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return (catalogs.categorias||[]).find(c=>
    text(c.categoria_id||c.id)===needle ||
    norm(c.nombre||c.titulo||c.categoria||c.id)===norm(needle)
  )||null;
}
function cityExists(territory,cityId){
  return (territory.ciudades||[]).some(c=>text(c.ciudad_id||c.id)===text(cityId));
}
function promoId(){ return "PRO-"+crypto.randomUUID(); }

export async function promosPanelDataV2({db,cache,advertiserId,cupoFromAdmin}){
  const [admin,advertiser,sedes,promos,catalogs]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.get("anunciantes",advertiserId),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId),
    db.queryEqual("promos","anunciante_id",advertiserId),
    cache.get("catalogs:promos:v1")
  ]);
  if(!admin)return{success:false,message:"No existe la administración del anunciante."};
  return{
    success:true,
    advertiser:advertiser||{id:advertiserId},
    sedes,
    categorias:(catalogs&&catalogs.categorias)||[],
    promos,
    promos_cant:Number(cupoFromAdmin(admin)||0)
  };
}

async function validateContext({db,cache,advertiserId,data}){
  const [territory,catalogs]=await Promise.all([
    cache.get("territorio:public:v1"),
    cache.get("catalogs:promos:v1")
  ]);
  const cityId=text(data.ciudad_id);
  if(!cityId||!territory||!cityExists(territory,cityId))throw new Error("La ciudad indicada no existe o no está activa.");

  const cat=categoryFrom(catalogs||{},data.categoria_id||data.categoria);
  if(!cat)throw new Error("La categoría indicada no existe.");

  const sedeId=text(data.sede_id);
  if(sedeId){
    const sede=await db.get("anunciantes_sedes",sedeId);
    if(!sede||text(sede.anunciante_id)!==text(advertiserId))throw new Error("La sede no pertenece al anunciante.");
    if(text(sede.ciudad_id)!==cityId)throw new Error("La sede no pertenece a la ciudad indicada.");
  }
  return{
    cityId,
    categoria_id:text(cat.categoria_id||cat.id),
    categoria:text(cat.nombre||cat.titulo||cat.categoria),
    logo_categoria:text(cat.logo)
  };
}

async function quota({db,advertiserId,cupoFromAdmin,excludeId=""}){
  const [admin,promos]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("promos","anunciante_id",advertiserId)
  ]);
  const max=Number(cupoFromAdmin(admin||{})||0);
  const active=promos.filter(p=>text(p.promo_id||p.id)!==text(excludeId)&&!paused(p)).length;
  return{max,active};
}

export async function promoCreateV2({db,cache,advertiserId,body,cupoFromAdmin}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:body||{};
  if(text(data.promo_id))throw new Error("El alta de una promo no admite promo_id; usá editar para una promo existente.");
  const ctx=await validateContext({db,cache,advertiserId,data});
  const q=await quota({db,advertiserId,cupoFromAdmin});
  if(q.max<=0||q.active>=q.max)throw new Error("Alcanzaste el máximo de promos activas.");

  const now=new Date().toISOString();
  const doc={
    ...data,
    promo_id:promoId(),
    anunciante_id:advertiserId,
    id_comercio:advertiserId,
    ciudad_id:ctx.cityId,
    categoria_id:ctx.categoria_id,
    categoria:ctx.categoria,
    logo_categoria:ctx.logo_categoria,
    pausado:bool(data.pausado),
    creado:text(data.creado)||now,
    actualizado:now
  };
  const saved=await db.patch("promos",doc.promo_id,doc);
  await syncPromo({cache,next:saved});
  return{success:true,promo:saved};
}

export async function promoUpdateV2({db,cache,advertiserId,body,cupoFromAdmin}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:body||{};
  const id=text(data.promo_id);
  if(!id)throw new Error("Falta promo_id.");

  const current=await db.get("promos",id);
  if(!current||text(current.anunciante_id||current.id_comercio)!==text(advertiserId))throw new Error("La promo no pertenece al anunciante.");

  const allowed=[
    "promo","categoria","categoria_id","sede_id","ciudad_id","img","desde","hasta","otros",
    "instagram","facebook","youtube","tiktok","linkedin","x","direccion","maps",
    "telefono","telefono1","telefono2","telefono3","telefono4","whatsapp","whatsapp2","whatsapp3","pausado"
  ];
  const next={...current};
  for(const k of allowed)if(Object.prototype.hasOwnProperty.call(data,k))next[k]=data[k];

  const contextChanged=["ciudad_id","categoria_id","categoria","sede_id"].some(k=>
    Object.prototype.hasOwnProperty.call(data,k)&&!sameValueV1(data[k],current[k]));
  if(contextChanged){
    const contextData={...next};
    if(Object.prototype.hasOwnProperty.call(data,"categoria")&&!Object.prototype.hasOwnProperty.call(data,"categoria_id"))delete contextData.categoria_id;
    const ctx=await validateContext({db,cache,advertiserId,data:contextData});
    next.ciudad_id=ctx.cityId;
    next.categoria_id=ctx.categoria_id;
    next.categoria=ctx.categoria;
    next.logo_categoria=ctx.logo_categoria;
  }
  if(Object.prototype.hasOwnProperty.call(data,"pausado")&&!bool(data.pausado)&&paused(current)){
    const q=await quota({db,advertiserId,cupoFromAdmin,excludeId:id});
    if(q.active>=q.max)throw new Error("Alcanzaste el máximo de promos activas.");
  }

  if(Object.prototype.hasOwnProperty.call(data,"pausado"))next.pausado=bool(next.pausado);
  next.actualizado=new Date().toISOString();

  const patch=changedFieldsV1(current,next);
  if(!Object.keys(patch).length)return{success:true,updated:false,promo_id:id,promo:current};
  const saved=await db.patch("promos",id,patch,{mustExist:true});
  await syncPromo({cache,current,next:saved});
  return{success:true,promo_id:id,promo:saved};
}

export async function promoDeleteV2({db,cache,advertiserId,body}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:body||{};
  const id=text(data.promo_id);
  if(!id)throw new Error("Falta promo_id.");
  const current=await db.get("promos",id);
  if(!current||text(current.anunciante_id||current.id_comercio)!==text(advertiserId))throw new Error("La promo no pertenece al anunciante.");
  await db.delete("promos",id,{mustExist:true});
  await syncPromo({cache,current,next:null});
  return{success:true,promo_id:id};
}

export async function promosPublicV2({cache,cityId}){
  return getPromosCity({cache,cityId});
}
