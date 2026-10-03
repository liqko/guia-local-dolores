const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
export const efemCityKey=cityId=>"efemerides:city:v1:"+text(cityId);

function matchesCity(e,city,territory){
  const tipo=text(e.tipo).toUpperCase();
  if(tipo==="GENERAL")return true;
  if(tipo==="LOCAL")return text(e.ciudad_id)===city;
  if(tipo==="PROVINCIAL"){
    const c=(territory.ciudades||[]).find(x=>text(x.ciudad_id||x.id)===city)||{};
    return text(e.provincia_id)===text(c.provincia_id);
  }
  return false;
}
export async function syncEfemeride({db,cache,efemerideId,previous=null}){
  const id=text(efemerideId),next=await db.get("efemerides_bis",id),territory=(await cache.get("territorio:public:v1"))||{};
  const targets=new Set();
  for(const e of [previous,next].filter(Boolean)){
    const tipo=text(e.tipo).toUpperCase();
    if(tipo==="LOCAL"&&text(e.ciudad_id))targets.add(text(e.ciudad_id));
    if(tipo==="PROVINCIAL"){
      for(const c of (territory.ciudades||[]))if(text(c.provincia_id)===text(e.provincia_id))targets.add(text(c.ciudad_id||c.id));
    }
    if(tipo==="GENERAL")for(const c of (territory.ciudades||[]))targets.add(text(c.ciudad_id||c.id));
  }
  for(const city of [...targets].filter(Boolean)){
    const key=efemCityKey(city),packet=(await cache.get(key))||{version:1,ciudad_id:city,updated_at:"",efemerides:[]};
    let rows=(packet.efemerides||[]).filter(x=>text(x.efemeride_id||x.id)!==id);
    if(next&&(next.activo===undefined||bool(next.activo))&&matchesCity(next,city,territory))rows.push(next);
    await cache.put(key,{version:1,ciudad_id:city,updated_at:new Date().toISOString(),efemerides:rows});
  }
  return{success:true,ciudades_actualizadas:[...targets]};
}
export async function getEfemCity({cache,cityId}){
  const city=text(cityId);if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const p=await cache.get(efemCityKey(city));
  return p?{success:true,...p}:{success:true,ciudad_id:city,efemerides:[],cold:true};
}
