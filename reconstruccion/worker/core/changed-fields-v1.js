// Comparación estable: el orden de las claves de un objeto no es un cambio.
function comparable(v){
  if(Array.isArray(v))return v.map(comparable);
  if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,comparable(v[k])]));
  return v;
}
export function sameValueV1(a,b){return JSON.stringify(comparable(a))===JSON.stringify(comparable(b));}
export function changedFieldsV1(current,next,{timestamps=["actualizado","actualizado_en"],touch=false,fields=null}={}){
  if(!current)return {...next};
  const patch={};
  for(const [k,v]of Object.entries(next)){
    if(k==="id"||timestamps.includes(k)||v===undefined)continue;
    if(fields&&!fields.includes(k))continue;
    if(!sameValueV1(current[k],v))patch[k]=v;
  }
  if(Object.keys(patch).length||touch)for(const k of timestamps){
    if(next[k]!==undefined)patch[k]=next[k];
  }
  return patch;
}
