/** Caché privada del login. No guarda contraseñas ni sustituye la autenticación. */
const text=v=>String(v??'').trim();
const relationKey=sid=>'login:relations:v45:'+text(sid);
const recordKey=(collection,id)=>'login:record:v45:'+collection+':'+text(id);
const TTL=3600;
const advertiserCollections=new Set(['anunciantes','anunciantes_administracion']);

export function withLoginCacheV45(db,env){
  const kv=env.GLD_CACHE_KV;
  const owners=new Map();
  const dirty=new Set();
  function remember(collection,rows){
    if(collection==='suscriptor_anunciante')for(const row of rows||[]){
      const id=text(row.id||row.suscriptor_anunciante_id),sid=text(row.suscriptor_id);
      if(id&&sid)owners.set(id,sid);
    }
    return rows;
  }
  async function revision(key){
    if(!kv||typeof kv.get!=='function')return 'initial';
    return text(await kv.get(key+':revision',{cacheTtl:30}))||'initial';
  }
  async function read(key){
    const rev=await revision(key);
    if(!kv||typeof kv.get!=='function')return {packet:null,rev};
    const raw=await kv.get(key+':'+rev,{cacheTtl:30});
    if(!raw)return {packet:null,rev};
    try{const packet=JSON.parse(raw);return {packet:packet&&packet.version===45&&Number(packet.expires_at)>Date.now()?packet:null,rev}}catch(_){return {packet:null,rev}}
  }
  async function save(key,data,rev){
    // Llenado opcional. Una falla deja la caché fría, sin romper el login.
    if(!kv||typeof kv.put!=='function'||dirty.has(key))return;
    try{await kv.put(key+':'+rev,JSON.stringify({version:45,expires_at:Date.now()+TTL*1000,data}),{expirationTtl:TTL})}catch(_){}
  }
  async function invalidate(key){
    const rev=await revision(key);
    if(kv&&typeof kv.delete==='function')await kv.delete(key+':'+rev);
    else if(kv&&(await read(key)).packet)throw Error('KV debe permitir invalidar la caché privada.');
    dirty.add(key);
  }
  async function flush(){
    // Una revisión por entidad y petición, incluso si se borraron varios vínculos.
    // Un llenado que comenzó antes de la mutación queda en la revisión anterior.
    for(const key of dirty){
      if(kv&&typeof kv.put==='function')await kv.put(key+':revision',crypto.randomUUID());
      dirty.delete(key);
    }
  }
  async function relationOwners(id,patch,options){
    // Si el router no cargó el vínculo, leer sólo ese documento para conocer
    // también su propietario anterior. Nunca barrer la colección.
    if(!owners.has(text(id))){const previous=await db.get('suscriptor_anunciante',id);if(previous)remember('suscriptor_anunciante',[previous]);}
    const set=new Set([owners.get(text(id)),text(patch&&patch.suscriptor_id),text(options&&options.subscriberId)].filter(Boolean));
    if(!set.size)throw Error('Falta contexto de suscriptor para invalidar su relación.');
    return set;
  }
  return {
    ...db,
    flushLoginCache:flush,
    async get(collection,id){const row=await db.get(collection,id);if(row)remember(collection,[row]);return row;},
    async queryEqual(...args){return remember(args[0],await db.queryEqual(...args));},
    async patch(collection,id,patch,options={}){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      let affected=[];
      if(collection==='suscriptor_anunciante'){
        affected=[...await relationOwners(id,patch,options)];
        for(const sid of affected)await invalidate(relationKey(sid));
      }
      const row=await db.patch(collection,id,patch,options);
      if(row)remember(collection,[row]);
      return row;
    },
    async delete(collection,id,options={}){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      if(collection==='suscriptor_anunciante')for(const sid of await relationOwners(id,null,options))await invalidate(relationKey(sid));
      if(collection==='suscriptores')await invalidate(relationKey(id));
      return db.delete(collection,id,options);
    },
    async loginRelations(sid){
      const key=relationKey(sid),{packet:hit,rev}=await read(key);
      if(hit&&Array.isArray(hit.data)&&!dirty.has(key))return remember('suscriptor_anunciante',hit.data);
      const rows=remember('suscriptor_anunciante',await db.queryEqual('suscriptor_anunciante','suscriptor_id',sid,100));
      // Almacenar solamente los campos que usa el login.
      await save(key,rows.map(r=>({id:text(r.id||r.suscriptor_anunciante_id),suscriptor_id:text(r.suscriptor_id),anunciante_id:text(r.anunciante_id),anunciante_nombre:text(r.anunciante_nombre),rol:text(r.rol),permisos:text(r.permisos),activo:r.activo})),rev);
      return rows;
    },
    async loginAdvertiser(collection,id){
      if(!advertiserCollections.has(collection))throw Error('Colección no admitida para caché del login.');
      const key=recordKey(collection,id),{packet:hit,rev}=await read(key);
      if(hit&&!dirty.has(key))return hit.data;
      const row=await db.get(collection,id);
      const data=row?{id:text(row.id||id),nombre:text(row.nombre),funcionalidades:row.funcionalidades}:null;
      await save(key,data,rev);
      return data;
    }
  };
}
