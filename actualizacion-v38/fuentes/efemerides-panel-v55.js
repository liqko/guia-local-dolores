/**
 * MODULO EFEMERIDES
 * El panel recibe permisos + efemérides. Provincias/ciudades vienen de territorio común.
 */
export async function efemeridesPanelData({db, permisos, advertiserId, canSee}){
  if(db.panelReadDb)db=db.panelReadDb();
  const p=await permisos(advertiserId);
  const jobs=[];
  if(p.efemerides_grl) jobs.push(db.queryEqual("efemerides_bis","tipo","GENERAL",500));
  if(p.efemerides_provincial){
    if(p.todas_provincias) jobs.push(db.queryEqual("efemerides_bis","tipo","PROVINCIAL",500));
    else for(const id of (p.provincias||[])) jobs.push(db.queryEqual("efemerides_bis","provincia_id",id,500));
  }
  if(p.efemerides_local){
    if(p.todas_ciudades) jobs.push(db.queryEqual("efemerides_bis","tipo","LOCAL",500));
    else for(const id of (p.ciudades||[])) jobs.push(db.queryEqual("efemerides_bis","ciudad_id",id,500));
  }
  const groups=await Promise.all(jobs);
  const uniq=new Map();
  for(const row of groups.flat()){
    const id=String(row.efemeride_id||row.id||"");
    if(id) uniq.set(id,row);
  }
  return {success:true,permisos:p,efemerides:[...uniq.values()].filter(x=>canSee(x,p))};
}
