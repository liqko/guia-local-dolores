const key=sid=>"subscriber:session-state:v1:"+String(sid||"").trim();

export async function subscriberSessionState(env,sid){
  const kv=env.GLD_CACHE_KV;
  if(!kv)throw new Error("Falta binding GLD_CACHE_KV.");
  const raw=await kv.get(key(sid));
  if(!raw)return{version:0,deleted:false};
  return JSON.parse(raw);
}

export async function revokeSubscriberSessions(env,sid,{deleted=false}={}){
  const current=await subscriberSessionState(env,sid);
  await env.GLD_CACHE_KV.put(key(sid),JSON.stringify({
    version:Number(current.version||0)+1,
    deleted:deleted||current.deleted===true
  }));
}
