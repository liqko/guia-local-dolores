import {guideCityKey,guideAdvertiserKey} from "./guide-read-model-v2.js";

const text=v=>String(v??"").trim();

function sortCards(rows){
  return [...rows].sort((a,b)=>text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"}));
}
function upsert(rows,card){
  const aid=text(card.id);
  const out=(rows||[]).filter(x=>text(x.id)!==aid);
  if(card.aprobado!==false)out.push(card);
  return sortCards(out);
}

export async function patchGuideSegmentV2({cache,advertiserId,segmentoId}){
  const aid=text(advertiserId),sid=text(segmentoId);
  const [base,catalogs]=await Promise.all([
    cache.get(guideAdvertiserKey(aid)),
    cache.get("catalogs:commerce:v1")
  ]);

  if(!base||!Array.isArray(base.cards)){
    return{success:true,changed:false,needs_full_sync:true,firestore_reads:0};
  }

  const segment=(catalogs&&catalogs.segmentos||[]).find(s=>text(s.segmento_id||s.id)===sid)||{};
  const nextCards=base.cards.map(card=>({
    ...card,
    segmento_id:sid,
    segmento:text(segment.nombre)
  }));

  for(const card of nextCards){
    const cityId=text(card.ciudad_id);
    const packet=(await cache.get(guideCityKey(cityId)))||{version:2,ciudad_id:cityId,updated_at:"",anunciantes:[]};
    await cache.put(guideCityKey(cityId),{
      version:2,
      ciudad_id:cityId,
      updated_at:new Date().toISOString(),
      anunciantes:upsert(packet.anunciantes||[],card)
    });
  }

  await cache.put(guideAdvertiserKey(aid),{
    ...base,
    updated_at:new Date().toISOString(),
    cards:nextCards
  });

  return{success:true,changed:true,ciudades:base.ciudades||[],firestore_reads:0};
}
