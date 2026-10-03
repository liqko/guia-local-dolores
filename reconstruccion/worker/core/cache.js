/**
 * KV — capa intermedia.
 * Una única abstracción; no escribe Firestore.
 */
export function createCache(env){
  const kv=env.GLD_CACHE_KV;
  if(!kv||typeof kv.get!=="function"||typeof kv.put!=="function"){
    throw new Error("Falta binding GLD_CACHE_KV.");
  }
  return {
    async get(key){const raw=await kv.get(key);if(!raw)return null;try{return JSON.parse(raw)}catch(_){return null}},
    async put(key,value,options){await kv.put(key,JSON.stringify(value),options)},
    async del(key){if(typeof kv.delete==="function")await kv.delete(key)}
  };
}
