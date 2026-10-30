// Índice unificado de pendientes 147. No ejecuta lecturas ni escrituras de red.
// El coordinador debe persistir el snapshot únicamente junto con mutaciones reales.
export const PENDING_KINDS147 = Object.freeze([
  'ANUNCIANTE','TITULARIDAD','EVENTO_FREE','EVENTO_VIP','ACTIVIDAD',
  'PUBLICIDAD','PROMO','EMPLEO','REVISION_ADULTO','BLOQUEADO','SOPORTE','ACCESO'
]);
const allowed=new Set(PENDING_KINDS147);
const keyOf=(x)=>[x.tipo,x.id,x.motivo||'GENERAL'].join(':');
const valid=(x)=>x&&allowed.has(x.tipo)&&typeof x.id==='string'&&x.id.length>0;
export function newPendingSnapshot147(){
  return {schema:147,revision:0,actualizado_en:null,estado:'VALIDO',items:[]};
}
export function pendingApply147(snapshot,changes,now){
  if(snapshot?.schema!==147||snapshot.estado!=='VALIDO'||!Array.isArray(snapshot.items))
    throw new Error('Índice no verificado: reconstrucción requerida');
  if(!Array.isArray(changes)||!changes.every(c=>valid(c)&&['UPSERT','REMOVE'].includes(c.accion)))
    throw new Error('Cambio de pendientes inválido');
  const entries=new Map(snapshot.items.map(x=>[keyOf(x),x]));
  for(const change of changes){
    const key=keyOf(change);
    if(change.accion==='REMOVE'){entries.delete(key);continue;}
    entries.set(key,{
      tipo:change.tipo,id:change.id,motivo:change.motivo||'GENERAL',
      ciudad_id:String(change.ciudad_id||''),creado_en:String(change.creado_en||now),
      resumen:String(change.resumen||'').slice(0,180)
    });
  }
  return {schema:147,revision:snapshot.revision+1,actualizado_en:now,
    estado:'VALIDO',items:[...entries.values()].sort((a,b)=>keyOf(a).localeCompare(keyOf(b)))};
}
export function pendingView147(snapshot,auth){
  if(snapshot?.schema!==147||snapshot.estado!=='VALIDO'||!Array.isArray(snapshot.items))
    return {estado:'SIN_COMPROBAR',cantidades:null,items:[]};
  const role=String(auth?.rol||'');
  if(!['SUPERADMIN_PRINCIPAL','SUPERADMIN','ADMIN_LOCAL'].includes(role))
    throw new Error('Acceso no autorizado');
  const local=role==='ADMIN_LOCAL';
  const cities=new Set(auth?.ciudades||[]);
  const items=snapshot.items.filter(x=>{
    if(local&&['REVISION_ADULTO','BLOQUEADO','SOPORTE','ACCESO'].includes(x.tipo))return false;
    return !local||cities.has(x.ciudad_id);
  });
  const cantidades=Object.fromEntries(PENDING_KINDS147.map(k=>[k,0]));
  for(const item of items)cantidades[item.tipo]++;
  return {estado:'VALIDO',revision:snapshot.revision,actualizado_en:snapshot.actualizado_en,cantidades,items};
}
