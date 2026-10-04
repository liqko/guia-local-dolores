const text=v=>String(v??'').trim();
// Sólo reutiliza IDs que pertenecen al padre consultado; conserva filas sin cambios.
export async function patchChildRowsV1({db,collection,idField,prefix,previous=[],desired=[],matchKey}){
  const byId=new Map(previous.map(r=>[text(r[idField]||r.id),r]));
  const used=new Set(),prepared=[];
  for(let i=0;i<desired.length;i++){
    const raw=desired[i],requested=text(raw[idField]);
    let current=requested?byId.get(requested):null;
    if(requested&&used.has(requested))throw new Error('Fila repetida en la operación.');
    if(!current&&matchKey)current=previous.find(r=>!used.has(text(r[idField]||r.id))&&matchKey(r)===matchKey(raw));
    if(!current&&!requested&&!matchKey)current=previous[i];
    const id=current?text(current[idField]||current.id):prefix+'-'+crypto.randomUUID();
    if(used.has(id))throw new Error('Fila repetida en la operación.');
    used.add(id);
    const {id:oldId,actualizado,creado,...fields}=raw;
    prepared.push({id,current,patch:{...fields,[idField]:id}});
  }
  const saved=[];
  for(const {id,current,patch}of prepared){
    if(current&&Object.entries(patch).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v))){saved.push(current);continue;}
    saved.push(await db.patch(collection,id,{...patch,actualizado:new Date().toISOString()},{mustExist:!!current}));
  }
  for(const [id]of byId)if(!used.has(id))await db.delete(collection,id);
  return saved;
}
