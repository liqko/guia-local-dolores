/**
 * INDICES ADMINISTRATIVOS PREPARADOS EN KV
 * Búsquedas normales de Gran Hermano no recorren Firestore.
 */
const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();

export const ADMIN_ADVERTISERS_KEY="admin:index:advertisers:v2";
export const ADMIN_SUBSCRIBERS_KEY="admin:index:subscribers:v2";

function sortByName(rows){
  return [...rows].sort((a,b)=>text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"}));
}
function advertiserRow({advertiser,admin,sedes}){
  const id=text(advertiser&&advertiser.id||admin&&admin.id);
  const cities=[...new Set((sedes||[]).map(s=>text(s.ciudad_id)).filter(Boolean))];
  const nombre=text(advertiser&&advertiser.nombre||admin&&admin.nombre);
  return{
    id,
    nombre,
    nivel:text(admin&&admin.nivel),
    subnivel:text(admin&&admin.subnivel),
    aprobado:admin&&admin.aprobado===true,
    verificado:admin&&admin.verificado===true,
    gold:admin&&admin.gold===true,
    segmento_id:text(advertiser&&advertiser.segmento_id),
    ciudad_ids:cities,
    search: norm([id,nombre,advertiser&&advertiser.actividad,advertiser&&advertiser.descripcion].filter(Boolean).join(" "))
  };
}
function subscriberRow(s){
  const id=text(s.suscriptor_id||s.id);
  const nombre=text(s.nombre),mail=text(s.mail),whatsapp=text(s.whatsapp||s.telefono);
  return{
    suscriptor_id:id,
    id,
    nombre,
    mail,
    whatsapp,
    tipo_usuario:text(s.tipo_usuario).toUpperCase(),
    ciudad_id:text(s.ciudad_predeterminada_id||s.ciudad_origen_id||s.ciudad_id),
    activo:s.activo,
    search:norm([id,nombre,mail,whatsapp].join(" "))
  };
}
function upsert(rows,idField,item){
  const id=text(item[idField]||item.id);
  const out=(rows||[]).filter(x=>text(x[idField]||x.id)!==id);
  out.push(item);
  return sortByName(out);
}

export async function rebuildAdminIndexesV2({db,cache}){
  const [advertisers,admins,sedes,subscribers]=await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    db.listCollection("suscriptores")
  ]);

  const adminMap=new Map(admins.map(a=>[text(a.id||a.anunciante_id),a]));
  const sedesBy=new Map();
  for(const s of sedes){
    const aid=text(s.anunciante_id);if(!aid)continue;
    if(!sedesBy.has(aid))sedesBy.set(aid,[]);
    sedesBy.get(aid).push(s);
  }

  const advRows=advertisers.map(a=>{
    const aid=text(a.id||a.anunciante_id);
    return advertiserRow({advertiser:a,admin:adminMap.get(aid)||{},sedes:sedesBy.get(aid)||[]});
  }).filter(x=>x.id);

  const subRows=subscribers.map(subscriberRow).filter(x=>x.suscriptor_id);
  const now=new Date().toISOString();

  await Promise.all([
    cache.put(ADMIN_ADVERTISERS_KEY,{version:2,updated_at:now,results:sortByName(advRows)}),
    cache.put(ADMIN_SUBSCRIBERS_KEY,{version:2,updated_at:now,results:sortByName(subRows)})
  ]);

  return{success:true,anunciantes:advRows.length,suscriptores:subRows.length,updated_at:now};
}

export async function syncAdvertiserIndexV2({db,cache,advertiserId}){
  const aid=text(advertiserId);
  const [advertiser,admin,sedes,packet]=await Promise.all([
    db.get("anunciantes",aid),
    db.get("anunciantes_administracion",aid),
    db.queryEqual("anunciantes_sedes","anunciante_id",aid,500),
    cache.get(ADMIN_ADVERTISERS_KEY)
  ]);
  if(!advertiser&&!admin)return{success:true,removed:false,missing:true};

  const row=advertiserRow({advertiser:advertiser||{id:aid},admin:admin||{},sedes});
  const base=packet&&Array.isArray(packet.results)?packet.results:[];
  await cache.put(ADMIN_ADVERTISERS_KEY,{
    version:2,
    updated_at:new Date().toISOString(),
    results:upsert(base,"id",row)
  });
  return{success:true,row};
}

export async function patchAdvertiserIndexCommercialV2({cache,advertiserId,patch}){
  const aid=text(advertiserId),packet=await cache.get(ADMIN_ADVERTISERS_KEY);
  if(!packet||!Array.isArray(packet.results))return{success:true,changed:false,needs_rebuild:true};

  const rows=[...packet.results];
  const i=rows.findIndex(x=>text(x.id)===aid);
  if(i<0)return{success:true,changed:false,needs_rebuild:true};

  const row={...rows[i]};
  for(const key of ["nivel","subnivel","aprobado","verificado","gold"]){
    if(Object.prototype.hasOwnProperty.call(patch||{},key))row[key]=patch[key];
  }
  rows[i]=row;

  await cache.put(ADMIN_ADVERTISERS_KEY,{
    ...packet,
    updated_at:new Date().toISOString(),
    results:sortByName(rows)
  });
  return{success:true,changed:true};
}

export async function searchAdvertisersV2({cache,q="",cityId="",limit=100}){
  const packet=await cache.get(ADMIN_ADVERTISERS_KEY);
  const needle=norm(q),city=text(cityId);
  let rows=packet&&Array.isArray(packet.results)?packet.results:[];
  if(needle)rows=rows.filter(x=>text(x.search).includes(needle));
  if(city)rows=rows.filter(x=>Array.isArray(x.ciudad_ids)&&x.ciudad_ids.includes(city));
  return{success:true,results:rows.slice(0,Math.max(1,Math.min(250,Number(limit)||100))),source:"kv"};
}

export async function searchSubscribersV2({cache,q="",tipo="",limit=100}){
  const packet=await cache.get(ADMIN_SUBSCRIBERS_KEY);
  const needle=norm(q),wanted=text(tipo).toUpperCase();
  let rows=packet&&Array.isArray(packet.results)?packet.results:[];
  if(needle)rows=rows.filter(x=>text(x.search).includes(needle));
  if(wanted)rows=rows.filter(x=>text(x.tipo_usuario).toUpperCase()===wanted);
  return{success:true,results:rows.slice(0,Math.max(1,Math.min(250,Number(limit)||100))),source:"kv"};
}

export async function advertiserDetailV2({db,advertiserId}){
  const aid=text(advertiserId);
  const [advertiser,admin,sedes,relations]=await Promise.all([
    db.get("anunciantes",aid),
    db.get("anunciantes_administracion",aid),
    db.queryEqual("anunciantes_sedes","anunciante_id",aid,500),
    db.queryEqual("suscriptor_anunciante","anunciante_id",aid,500)
  ]);
  if(!advertiser&&!admin)return{success:false,message:"Anunciante no encontrado"};
  return{success:true,anunciante:advertiser||{},administracion:admin||{},sedes,relaciones:relations};
}

export async function subscriberDetailV2({db,subscriberId}){
  const sid=text(subscriberId);
  const [subscriber,relations]=await Promise.all([
    db.get("suscriptores",sid),
    db.queryEqual("suscriptor_anunciante","suscriptor_id",sid,500)
  ]);
  if(!subscriber)return{success:false,message:"Suscriptor no encontrado"};
  return{success:true,suscriptor:subscriber,relaciones:relations};
}
