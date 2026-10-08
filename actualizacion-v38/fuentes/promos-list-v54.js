const text=v=>String(v??"").trim();

export async function promoListOwnV3({db,advertiserId}){
  if(db.panelReadDb)db=db.panelReadDb();
  const promos=await db.queryEqual("promos","anunciante_id",text(advertiserId),500);
  return{
    success:true,
    promos,
    rows:promos,
    count:promos.length
  };
}
